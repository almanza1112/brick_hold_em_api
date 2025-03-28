const startingHand = require("../table/table_starting_hand");

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
  const potRef = db.ref("tables/1/betting/pot/pot1");
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

  // async function startGame(data, numOfPlayers) {
  //   // Get starting hand
  //   const _startingHand = startingHand.setCards(numOfPlayers);
  //   const deck = _startingHand["deck"];
  //   const playerInfo = Object.values(data);
  //   const playerPositions = Object.keys(data);

  //   // Reset folded status for each player
  //   let update = {};
  //   playerPositions.forEach((pos) => {
  //     update[`players/${pos}/folded`] = false;
  //   });

  //   // Set up player cards and turn order
  //   let cardUpdates = {};
  //   let playerCards = {};
  //   let turnOrderUpdate = {};

  //   playerInfo.forEach((player, i) => {
  //     playerCards[player.uid] = {
  //       hand: _startingHand["playersCards"][i],
  //       position: player.position,
  //     };
  //   });

  //   cardUpdates["dealer"] = { deck: deck, deckCount: deck.length };
  //   cardUpdates["playerCards"] = playerCards;
  //   const firstCardOnDiscard = _startingHand["faceUpCard"][0];

  //   // Setting turn order of players
  //   const playersPosition = playerPositions.map(Number).reverse();
  //   turnOrderUpdate["players"] = playersPosition;

  //   let getTurnOrderResult = await getTurnOrder();

  //   if (getTurnOrderResult) {
  //     // Rotate the firstTurnPlayer for fairness
  //     const previousFirstTurnPlayer = getTurnOrderResult.firstTurnPlayer;
  //     const currentIndex = playersPosition.indexOf(previousFirstTurnPlayer);
  //     const newIndex = (currentIndex + 1) % playersPosition.length;
  //     turnOrderUpdate["turnPlayer"] = playersPosition[newIndex];
  //     turnOrderUpdate["firstTurnPlayer"] = playersPosition[newIndex];
  //   } else {
  //     const randomIndex = getRandomNumber(playersPosition.length);
  //     turnOrderUpdate["turnPlayer"] = playersPosition[randomIndex];
  //     turnOrderUpdate["firstTurnPlayer"] = playersPosition[randomIndex];
  //   }

  //   // Restart betting data
  //   const bettingUpdate = {
  //     pot: { pot1: 0, potCount: 1 },
  //   };

  //   update["roundInProgress"] = true;
  //   update["nextGameStarts"] = nextGameStarts;
  //   update["cards"] = cardUpdates;
  //   update["turnOrder"] = turnOrderUpdate;
  //   update["betting"] = bettingUpdate;
  //   update["moves"] = [];
  //   update["winner"] = "none";

  //   try {
  //     refTable.update(update).then(() => {
  //       cardsDiscardPileRef
  //         .push()
  //         .set({ 0: firstCardOnDiscard })
  //         .catch((err) => {
  //           console.log("error newDiscardPile: " + err);
  //         });
  //     });
  //   } catch (err) {
  //     console.log("Error in startGame: ", err);
  //   }
  // }

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
    const players = snapshot.val();
    const update = {};
    for (let uid in players) {
      const hand = players[uid].hand;
      // if hand is not undefined, there is not winner, continue with update
      if (hand !== undefined) {
        update[`cards/playerCards/${uid}/cardCount`] = hand.length;
      } else {
        // There is a hand that is undefined, there is a winner.
        // Proceed to update cardCount of player to 0 and update winner
        update[`cards/playerCards/${uid}/cardCount`] = 0;
        update["winner"] = uid;
        //update["roundInProgress"] = false; // TODO: is this needed?
      }
    }
    refTable.update(update).catch((err) => {
      console.log("error updating card count: " + err);
    });
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
        update["betting/pot/pot1"] = 0;
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
      const snapshot = await turnOrderRef.once("value");
      const data = snapshot.val();
      const playersList = data["players"];
      const currentTurnPlayer = data["turnPlayer"];
      const currentIndex = playersList.indexOf(currentTurnPlayer);
      const nextTurnIndex = (currentIndex + 1) % playersList.length;
      const nextTurnPlayer = playersList[nextTurnIndex];
  
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
