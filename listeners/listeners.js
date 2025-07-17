const TurnService = require("../services/TurnService");

module.exports = function (dependencies) {
  const {
    db,
    firebaseAdmin,
    fs, // If needed, pass in any other variables or modules
  } = dependencies;

  const turnService = new TurnService({ db, firebaseAdmin, fs });

  // Define your Firebase references here or reuse them if passed in
  const refTable = db.ref("tables/1");
  const playerCardsRef = db.ref("tables/1/cards/playerCards");
  const winnerRef = db.ref("tables/1/winner");
  const potRef = db.ref("tables/1/pot/pot1");
  const turnOrderRef = db.ref("tables/1/turnOrder");
  const turnPlayerRef = db.ref("tables/1/turnOrder/turnPlayer");


  // Listener for updating player card counts
  playerCardsRef.on("value", async (snapshot) => {
    const players = snapshot.val() || {};
    const update = {};

    for (const uid of Object.keys(players)) {
      const handObj = players[uid].hand;

      // handObj is now an object (map of childKey → cardName)
      if (handObj && typeof handObj === "object") {
        const count = Object.keys(handObj).length;
        update[`cards/playerCards/${uid}/cardCount`] = count;
      } else {
        // no hand node? treat as zero and declare a winner
        update[`cards/playerCards/${uid}/cardCount`] = 0;
        update["winner"] = uid;
        //update["roundInProgress"] = false; // TODO: is this needed?
      }
    }

    try {
      await refTable.update(update);
    } catch (err) {
      console.error("error updating card count:", err);
    }
  });

  // Listener for handling the winner
  winnerRef.on("value", async (snapshot) => {
    const winner = snapshot.val();
    if (winner !== "none") {
      potRef.get().then((snapshot) => {
        const potAmount = snapshot.val();
        const update = {};
        update[`chips/${winner}/chipCount`] =
          firebaseAdmin.database.ServerValue.increment(potAmount);
        update["pot/pot1"] = 0;
        refTable.update(update).then(() => {
          fs.collection("users")
            .doc(winner)
            .update({
              chips: firebaseAdmin.firestore.FieldValue.increment(potAmount),
            })
            .then(async () => {
              // Instead of waiting 5 seconds and starting game immediately,
              // update nextGameStarts to 5 seconds from now.
              const nextGameStarts = Date.now() + 5000;
              await refTable.update({ nextGameStarts: nextGameStarts });
            });
        });
      });
    }
  });

  // A map to keep track of timers per table/player turn
  const turnTimers = {};
  turnPlayerRef.on("value", async (snapshot) => {
    const currentPlayer = snapshot.val();
    const turnDuration = 30 * 1000; // 30 seconds
    const expirationTime = Date.now() + turnDuration;

    // Update the realtime database with the expiration timestamp
    turnOrderRef.update({ turnExpiration: expirationTime });

    // Clear any existing timer for the current player
    if (turnTimers[currentPlayer]) {
      clearTimeout(turnTimers[currentPlayer]);
    }

    // Start a new timer for the current turn
    turnTimers[currentPlayer] = setTimeout(() => {
      console.log(`Player ${currentPlayer} timed out.`);
      turnService.skipPlayerTurn();
    }, turnDuration);
  });
};
