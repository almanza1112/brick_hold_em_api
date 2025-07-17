const {onValueUpdated,
  onValueWritten,
  onValueDeleted} = require("firebase-functions/v2/database");
const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const TurnService = require("./services/TurnService");

admin.initializeApp();
const fs = admin.firestore();
const db = admin.database();
const startingHand = require("./table/table_starting_hand");

const turnService = new TurnService({
  db: admin.database(),
  firebaseAdmin: admin,
  fs: admin.firestore(),
});


// This is used in the sign up process and makes sure
// that the email is not being used already
exports.verifyEmail = onCall(async (request) => {
  const email = request.data.email;

  // 1) Validate input
  if (!email || typeof email !== "string") {
    throw new HttpsError(
        "invalid-argument",
        "Email is required and must be a string.",
    );
  }

  try {
    // try to fetch a user by email
    await admin.auth().getUserByEmail(email);
    // if found, it's in use
    return {exists: true};
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      // not in use
      return {exists: false};
    }
    if (error.code === "auth/invalid-email") {
      // malformed email
      throw new HttpsError(
          "invalid-argument",
          "Email address is improperly formatted.",
      );
    }
    // Unexpected failure
    console.error("verifyEmail unexpected error:", error);
    throw new HttpsError(
        "internal",
        "An internal error occurred. Please try again later.",
    );
  }
});


/** * Cloud Function: joinTable
 * Triggered by an HTTP request to join a table.
 * **/
exports.joinTable = onCall(async (request) => {
  // Validate inputs
  const tableId = request.data.tableId;
  const uid = request.data.uid;
  const name = request.data.name;
  const photoURL = request.data.photoURL || null;
  const username = request.data.username || null;
  const chips = parseInt(request.data.chips, 10);

  if (!tableId || !chips || isNaN(chips)) {
    throw new HttpsError(
        "invalid-argument",
        "Missing or invalid tableId or chips.",
    );
  }

  const tableRef = db.ref(`tables/${tableId}`);
  const playersRef = tableRef.child("players");
  const queueRef = tableRef.child("queue");
  const roundInProgressRef = tableRef.child("roundInProgress");

  try {
    // 3) Fetch existing players
    const snap = await playersRef.get();
    const players = snap.exists() ? snap.val() : {};

    // 4) Check if user already joined
    const existingEntry = Object.entries(players)
        .find(([pos, p]) => p.uid === uid);
    const existingPos = existingEntry ? existingEntry[0] : null;
    if (existingPos) {
      return {position: Number(existingPos), message: "Already joined"};
    }

    // 5) Determine next position
    const occupied = Object.keys(players)
        .map((k) => parseInt(k, 10))
        .sort((a, b)=>a-b);
    let position = 1;
    while (occupied.includes(position)) {
      position++;
    }

    // 6) If fewer than 6, add to table; otherwise queue
    if (occupied.length < 6) {
      // 6a) Check if round is in progress
      const inProgressSnap = await roundInProgressRef.get();
      const folded = !!inProgressSnap.val();

      // 6b) Build atomic update
      const updates = {
        [`players/${position}`]:
          {uid, name, photoURL, username, position, folded},
        [`chips/${uid}/chipCount`]: chips,
      };
      await tableRef.update(updates);

      return {
        position,
        message: `Player added at seat ${position}.`,
      };
    } else {
      // 6c) Too many players → enqueue
      await queueRef.push({uid, name, photoURL,
        username, requestedChips: chips});
      return {message: "Table full; you’ve been added to the queue."};
    }
  } catch (err) {
    console.error("joinTable error:", err);
    throw new HttpsError("internal", "Server error");
  }
});

/**
 * syncDeckCount
 * Fires on any update to /cards/dealer/deck.
 * If the deck node disappears or has no children, it writes deckCount: 0.
 */
exports.syncDeckCount = onValueWritten(
    "/tables/1/cards/dealer/deck",
    async (event) => {
      // Grab the raw value; if the node is gone this will be null
      const val = event.data.after.val();
      // If it's an object, count its keys; otherwise size=0
      const deckSize = (val && typeof val === "object") ?
        Object.keys(val).length : 0;

      console.log("syncDeckCount: raw val =", val);
      console.log("syncDeckCount: computed deckSize =", deckSize);

      // Write it back, even if zero
      await db
          .ref("tables/1/cards/dealer")
          .update({deckCount: deckSize});

      return null;
    },
);

/**
 * reshuffleOnEmpty
 * Triggered when deckCount changes.
 * As soon as it becomes 0, we reshuffle the discardPile back into the deck.
 */
exports.reshuffleOnEmpty = onValueDeleted(
    "/tables/1/cards/dealer/deck",
    async (event) => {
      console.log("reshuffleOnEmpty: deck node was deleted");

      const tableRef = db.ref("tables/1");
      const deckRef = tableRef.child("cards/dealer/deck");
      const discardRef = tableRef.child("cards/discardPile");

      // 1) Gather all cards from discard pile
      const discardSnap = await discardRef.get();
      const pile = [];
      discardSnap.forEach((child) => {
        pile.push(child.val());
      });
      console.log("  discardPile contents:", pile);

      // 2) Set aside the face-up card, shuffle the rest
      const faceUpCard = pile.pop();
      console.log("  faceUpCard saved:", faceUpCard);
      const newDeck = startingHand.shuffleArray(pile);
      console.log("  newDeck shuffled:", newDeck);

      // 3) Build the full deck map
      const deckMap = {};
      newDeck.forEach((cardName) => {
        const key = deckRef.push().key;
        deckMap[key] = cardName;
      });

      // 4) Build the single face-up discard map
      const discardMap = {};
      const upKey = discardRef.push().key;
      discardMap[upKey] = faceUpCard;

      // 5) Commit both in one atomic update
      const updatePayload = {
        "cards/dealer/deck": deckMap,
        "cards/dealer/deckCount": newDeck.length,
        "cards/discardPile": discardMap,
      };
      await tableRef.update(updatePayload);

      console.log("→ reshuffleOnEmpty: deck rebuilt and face-up card set");

      return null;
    },
);

/**
 * 1) Immediate start when players go from ≤1 ⇒ ≥2
 */
exports.onPlayerListChange = onValueWritten(
    "/tables/{tableId}/players",
    async (event) => {
      const tableId = event.params.tableId;
      const beforeVal = event.data.before.val() || {};
      const afterVal = event.data.after.val() || {};
      const numBefore = Object.keys(beforeVal).length;
      const numAfter = Object.keys(afterVal).length;
      const tableRef = admin.database().ref(`tables/${tableId}`);

      // if everyone left (or only one remains), clear in-progress
      if (numAfter <= 1) {
        await tableRef.child("roundInProgress").set(false);
        return;
      }

      // only fire on the transition 1 ⇒ 2
      if (numBefore <= 1 && numAfter > 1) {
        // bail if there’s a scheduled start pending
        const nextTs = (await tableRef
            .child("nextGameStarts").once("value")).val() || 0;
        if (nextTs > Date.now()) return;

        // bail if a round is already in progress
        const inProg = (await tableRef
            .child("roundInProgress").once("value")).val();
        if (inProg) return;

        // clear any stray timestamp and start immediately
        await tableRef.child("nextGameStarts").set(0);
        await turnService.startGame(afterVal, numAfter, tableId);
      }
    },
);

/**
 * Cloud Function: autoStartGame
 * Triggered when the value at `/tables/1/nextGameStarts` is updated.
 * When the current time is past the scheduled timestamp, this function
 * resets the game.
 */
exports.onScheduledStart = onValueUpdated(
    "/tables/{tableId}/nextGameStarts",
    async (event) => {
      const tableId = event.params.tableId;
      const oldTs = event.data.before.val() || 0;
      const newTs = event.data.after.val() || 0;
      // Only act when the timestamp actually changed and is non-zero
      if (newTs === oldTs || newTs === 0) return;

      // Wait until we reach the scheduled moment
      const now = Date.now();
      const delay = newTs - now;
      if (delay > 0) {
        await new Promise((res) => setTimeout(res, delay));
      }

      const tableRef = admin.database().ref(`tables/${tableId}`);

      // bail if round is already running
      const inProg = (await tableRef
          .child("roundInProgress").once("value")).val();
      if (inProg) {
        await tableRef.child("nextGameStarts").set(0);
        return;
      }

      // fetch current players
      const playersSnap = await tableRef.child("players").once("value");
      const playersData = playersSnap.val() || {};
      const numPlayers = Object.keys(playersData).length;

      // need at least 2 to start
      if (numPlayers < 2) {
        await tableRef.child("nextGameStarts").set(0);
        return;
      }

      // kick off the round
      await turnService.startGame(playersData, numPlayers, tableId);

      // clear the timestamp so it won’t immediately re-fire
      await tableRef.child("nextGameStarts").set(0);
    },
);

/**
 * When `/tables/{tableId}/winner` flips away from `"none"`,
 * award the pot to that winner and reset the pot, then
 * schedule the next game start timestamp.
 */
exports.handleWinner = onValueUpdated(
    "/tables/{tableId}/winner",
    async (event) => {
      const tableId = event.params.tableId;
      const newWinner = event.data.after.val();
      if (!newWinner || newWinner === "none") {
        // no real winner → nothing to do
        return;
      }

      const tableRef = db.ref(`tables/${tableId}`);
      const potRef = tableRef.child("pot/pot1");

      // 1) grab the pot amount
      const potSnap = await potRef.get();
      const potAmt = potSnap.val() || 0;

      if (potAmt > 0) {
        // 2) update RTDB: award chips and clear pot
        const updates = {
          [`chips/${newWinner}/chipCount`]:
              admin.database.ServerValue.increment(potAmt),
          "pot/pot1": 0,
        };
        await tableRef.update(updates);

        // 3) mirror into Firestore user document
        await fs.collection("users")
            .doc(newWinner)
            .update({
              chips: admin.firestore.FieldValue.increment(potAmt),
            });

        // 4) schedule the next round 5s out
        const nextGameStarts = Date.now() + 5000;
        await tableRef.update({nextGameStarts});
      }
    },
);

