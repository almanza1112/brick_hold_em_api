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
      // 1) Load the current turn order and anteToCall state
      const [turnSnap, anteSnap] = await Promise.all([
        turnOrderRef.once("value"),
        db.ref("tables/1/anteToCall").once("value"),
      ]);
      const turnOrderData = turnSnap.val();
      const anteData = anteSnap.val() || {};

      const playersList = turnOrderData.players;
      const currentTurnPlayer = turnOrderData.turnPlayer;
      const cardsToDraw = parseInt(anteData.cardsToDraw, 10) || 0;
      const amountToCall = parseInt(anteData.amountToCall, 10) || 0;

      // Compute next player
      const idx = playersList.indexOf(currentTurnPlayer);
      const nextIdx = (idx + 1) % playersList.length;
      const nextTurnPlayer = playersList[nextIdx];

      // Only do the skip/auto‐call if this player was the one to call
      if (anteData.playerToCallPosition === currentTurnPlayer && !anteData.didPlayerCall) {
        // 2) Look up the UID for that position
        const playerSnap = await refPlayers
          .child(String(currentTurnPlayer))
          .once("value");
        const uid = playerSnap.val().uid;

        // 3) Pull the top N cards from the deck
        const deckSnap = await deckRef
          .orderByKey()
          .limitToLast(cardsToDraw)
          .once("value");
        const deckMap = deckSnap.val() || {};

        // 4) Build the multi‐location update
        const updatePayload = {};

        // — a) Remove those cards from the dealer’s deck
        for (const cardKey of Object.keys(deckMap)) {
          updatePayload[`cards/dealer/deck/${cardKey}`] = null;
        }

        // — b) Push each drawn card into the player’s hand
        const handBase = `cards/playerCards/${uid}/hand`;
        for (const cardName of Object.values(deckMap)) {
          const newKey = playerCardsRef.child(uid).child("hand").push().key;
          updatePayload[`${handBase}/${newKey}`] = cardName;
        }

        // — c) Debit their chips and credit the pot
        updatePayload[`chips/${uid}/chipCount`] =
          firebaseAdmin.database.ServerValue.increment(-amountToCall);
        updatePayload[`pot/pot1`] =
          firebaseAdmin.database.ServerValue.increment(amountToCall);

        // — d) Mark that they auto-called/skipped
        updatePayload["anteToCall/didPlayerCall"] = true;

        // 5) Advance the turn as well
        updatePayload["turnOrder/turnPlayer"] = nextTurnPlayer;

        // 6) Commit all at once
        await refTable.update(updatePayload);

        console.log(
          `Player ${currentTurnPlayer} auto-called ${amountToCall}, drew ${cardsToDraw} cards, next is ${nextTurnPlayer}`
        );
      } else {
        // Not the caller's turn-skipping case: just advance normally
        await turnOrderRef.update({ turnPlayer: nextTurnPlayer });
        console.log(`Turn skipped. Next player is: ${nextTurnPlayer}`);
      }

      return nextTurnPlayer;
    } catch (error) {
      console.error("Error in skipPlayerTurn:", error);
      throw error;
    }
  }
};
