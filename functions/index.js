const {onValueUpdated,
  onValueWritten,
  onValueDeleted} = require("firebase-functions/v2/database");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();
const startingHand = require("./table/table_starting_hand");

/**
 *
 * Utility function: Retrieve the current turn order.
 **/
async function getTurnOrder() {
  try {
    const snapshot = await db.ref("tables/1/turnOrder").get();
    return snapshot.val();
  } catch (err) {
    console.log("ERROR in getTurnOrder:", err);
    return null;
  }
}

/**
 * Cloud Function: autoStartGame
 * Triggered when the value at `/tables/1/nextGameStarts` is updated.
 * When the current time is past the scheduled timestamp, this function
 * resets the game.
 */
exports.startGame = onValueUpdated(
    "/tables/1/nextGameStarts",
    async (event) => {
      const nextGameStarts = event.data.after.val();
      if (!nextGameStarts) {
        console.log("nextGameStarts not set—aborting.");
        return null;
      }

      // wait until the scheduled moment
      let now = Date.now();
      if (now < nextGameStarts) {
        await new Promise((res) => setTimeout(res, nextGameStarts - now));
        now = Date.now();
      }

      try {
        const tableRef = db.ref("tables/1");
        const playersRef = tableRef.child("players");
        const discardPileRef = tableRef.child("cards/discardPile");

        // 1) grab the list of players
        const playersSnap = await playersRef.get();
        const playersData = playersSnap.val();
        if (!playersData) {
          console.log("No players found—cannot start game.");
          return null;
        }
        const numPlayers = Object.keys(playersData).length;

        // 2) generate shuffled deck + hands
        const {deck, playersCards, faceUpCard} =
          startingHand.setCards(numPlayers);
        const topFaceUp = faceUpCard[0];

        // 3) build a map of new deck children: { pushKey: cardName }
        const deckListRef = tableRef.child("cards/dealer/deck");
        const deckMap = {};
        deck.forEach((cardName) => {
          const key = deckListRef.push().key;
          deckMap[key] = cardName;
        });

        // 4) start your multi-location payload by initializing it
        const updatePayload = {
          // resset anteToCall
          // 'anteToCall': {},
          // replace the deck
          "cards/dealer/deck": deckMap,
          "cards/dealer/deckCount": deck.length,

          // clear discard pile
          "cards/discardPile": {},

          // game flags you already know
          "roundInProgress": true,
          "nextGameStarts": 0,
        };


        // 5) build each player’s new hand as a map too
        Object.values(playersData).forEach((playerObj, idx) => {
          console.log("Processing player:", playerObj);
          console.log("idx:", idx);
          const uid = playerObj.uid;
          const cardsForMe = playersCards[idx];
          const handMap = {};
          const handRef = tableRef
              .child(`cards/playerCards/${uid}/hand`);
          cardsForMe.forEach((cardName) => {
            const childKey = handRef.push().key;
            handMap[childKey] = cardName;
          });

          // inject under the correct UID path:
          updatePayload[`cards/playerCards/${uid}`] = {
            hand: handMap,
            position: playerObj.position,
          };
        });


        // 6) compute new turnOrder
        const positions = Object.values(playersData)
            .map((p) => Number(p.position))
            .reverse();
        const turnOrderObj = {};
        const existingOrder = await getTurnOrder();
        if (existingOrder) {
          const prev = existingOrder.firstTurnPlayer;
          const curIndex = positions.indexOf(prev);
          const nextIndex = (curIndex + 1) % positions.length;
          turnOrderObj.firstTurnPlayer = positions[nextIndex];
          turnOrderObj.turnPlayer = positions[nextIndex];
        } else {
          const rand = Math.floor(Math.random() * positions.length);
          turnOrderObj.firstTurnPlayer = positions[rand];
          turnOrderObj.turnPlayer = positions[rand];
        }
        turnOrderObj.players = positions;
        turnOrderObj.turnExpiration = now + 30000;

        // 7) reset betting & moves
        const pot = {pot1: 0, potCount: 1};

        // 8) add to the big multi-location update under /tables/1
        updatePayload["turnOrder"] = turnOrderObj;
        updatePayload["pot"] = pot;
        updatePayload["moves"] = [];
        updatePayload["winner"] = "none";

        // 10) commit atomically
        await tableRef.update(updatePayload);

        // 11) push the one face-up card
        await discardPileRef.push().set(topFaceUp);

        console.log("New game started at", now);
      } catch (err) {
        console.error("Error starting game automatically:", err);
      }
      return null;
    },
);

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
