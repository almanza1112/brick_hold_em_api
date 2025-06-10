module.exports = function (dependencies) {
  const {
    db,
    firebaseAdmin,
    fs, // If needed, pass in any other variables or modules
  } = dependencies;

  // Define your Firebase references here or reuse them if passed in
  const refTable = db.ref("tables/1");
  const refPlayers = db.ref("tables/1/players");
  const refIsRoundInProgress = db.ref("tables/1/roundInProgress");
  const deckRef = db.ref("tables/1/cards/dealer/deck");
  const deckCountRef = db.ref("tables/1/cards/dealer");
  const playerCardsRef = db.ref("tables/1/cards/playerCards");
  const cardsDiscardPileRef = db.ref("tables/1/cards/discardPile");
  const chipsRef = db.ref("tables/1/chips");
  const winnerRef = db.ref("tables/1/winner");
  const potRef = db.ref("tables/1/pot/pot1");
  const turnOrderRef = db.ref("tables/1/turnOrder");
  const turnPlayerRef = db.ref("tables/1/turnOrder/turnPlayer");

  // Utility functions can be defined here
  async function isRoundInProgress() {
    return await refIsRoundInProgress.get().then((snapshot) => snapshot.val());
  }

  async function getTurnOrder() {
    return await turnOrderRef
      .get()
      .then((snapshot) => snapshot.val())
      .catch((error) => {
        console.log("ERROR in getTurnOrder: ", error);
      });
  }

  function getRandomNumber(max) {
    return Math.floor(Math.random() * max);
  }

  // ----- Attach Event Listeners -----

  // Listener for when a player joins the lobby
  refPlayers.on(
    "value",
    async (snapshot) => {
      const data = snapshot.toJSON();
      if (!data) {
        // Table is empty or does not exist
        return;
      }

      const numOfPlayers = Object.keys(data).length;
      if (numOfPlayers > 1) {
        if (!(await isRoundInProgress())) {
          startGame(data, numOfPlayers);
        }
      } else {
        refTable.update({ roundInProgress: false });
      }
    },
    (error) => {
      console.log("The read failed: " + error.name);
    }
  );

  // Listener for updating deck count
  deckRef.on(
    "value",
    async (snapshot) => {
      const list = snapshot.val();
      const listLength = list ? Object.keys(list).length : 0;

      if (listLength > 0) {
        deckCountRef.update({ deckCount: listLength }).catch((err) => {
          console.log("error with deckCount: " + err);
        });
      } else {
        // When deck is empty, reshuffle discard pile back into deck
        cardsDiscardPileRef.get().then((snapshot) => {
          let discardPile = [];
          snapshot.forEach((childSnapshot) => {
            discardPile.push(...childSnapshot.val());
          });
          const faceUpCard = discardPile.pop();
          const shuffledDiscardPile = startingHand.shuffleArray(discardPile);
          deckRef.set(shuffledDiscardPile).then(() => {
            // Setting the discardPile to the deck is successful.
            // Proceed to deleting the discard pile
            cardsDiscardPileRef.remove().then(() => {
              // Deleting discard pile is successful, proceed to
              // push faceUpCard as the new and only entry of the
              // discardPile
              cardsDiscardPileRef
                .push()
                .set({ 0: faceUpCard })
                .catch((err) => console.log("Error updating discardPile", err));
            });
          });
        });
      }
    },
    (error) => {
      console.log("The read failed: " + error.name);
    }
  );

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
      skipPlayerTurn(); // Call without any parameter
    }, turnDuration);
  });

  async function skipPlayerTurn() {
    try {
      // Get the current turn player and the list of players to
      // determine the next player
      const turnOrderSnapshot = await turnOrderRef.once("value");
      const turnOrderData = turnOrderSnapshot.val();
      const playersList = turnOrderData["players"];
      const currentTurnPlayer = turnOrderData["turnPlayer"];
      const currentIndex = playersList.indexOf(currentTurnPlayer);
      const nextTurnIndex = (currentIndex + 1) % playersList.length;
      const nextTurnPlayer = playersList[nextTurnIndex];

      // Check if there is an action in progress under anteToCall
      const anteToCallSnapshot = await db
        .ref("tables/1/anteToCall")
        .once("value");
      const anteToCallData = anteToCallSnapshot.val();

      if (anteToCallData["playerToCallPosition"] === currentTurnPlayer) {
        // If the current player is the one who needs to call ante and action is pending then
        // proceed to perform action to skip the turn
        console.log(
          `Skipping turn for ${currentTurnPlayer} due to ante action.`
        );
      }

      // Update the turnPlayer in the database using turnOrderRef
      await turnOrderRef.update({ turnPlayer: nextTurnPlayer });
      console.log(`Turn skipped. Next player is: ${nextTurnPlayer}`);
      return nextTurnPlayer;
    } catch (error) {
      console.error("Error in skipPlayerTurn:", error);
      throw error;
    }
  }
};
