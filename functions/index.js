const {onValueUpdated} = require("firebase-functions/v2/database");
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
exports.startGame = onValueUpdated("/tables/1/nextGameStarts",
    async (event) => {
      // Get the new nextGameStarts value.
      const nextGameStarts = event.data.after.val();
      if (!nextGameStarts) {
        console.log("nextGameStarts not set.");
        return;
      }

      let now = Date.now();
      if (now < nextGameStarts) {
        const delayMs = nextGameStarts - now;
        console.log(`Waiting ${delayMs} ms until next game start...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        now = Date.now(); // update now after delay
      }

      // Proceed with starting a new game.
      try {
        const refTable = db.ref("tables/1");
        const refPlayers = db.ref("tables/1/players");
        const cardsDiscardPileRef = db.ref("tables/1/cards/discardPile");

        // Get players data.
        const playersSnapshot = await refPlayers.get();
        const playersData = playersSnapshot.val();
        if (!playersData) {
          console.log("No players found. Aborting new game.");
          return;
        }
        const numOfPlayers = Object.keys(playersData).length;

        // Generate starting hand using your module.
        const startingHandData = startingHand.setCards(numOfPlayers);
        const deck = startingHandData["deck"]; // Array of cards.
        const playersCardsArray = startingHandData["playersCards"];
        const firstCardOnDiscard = startingHandData["faceUpCard"][0];

        // Build playerCards update.
        const playerCardsUpdate = {};
        const playerInfo = Object.values(playersData);
        playerInfo.forEach((player, index) => {
          playerCardsUpdate[player.uid] = {
            hand: playersCardsArray[index],
            position: player.position,
          };
        });
        const cardUpdates = {
          dealer: {deck: deck, deckCount: deck.length},
          playerCards: playerCardsUpdate,
        };

        // Turn order logic.
        const playerIds = Object.keys(playersData);
        let playersPosition = playerIds.map((uid) => Number(playersData[uid]
            .position));
        playersPosition = playersPosition.reverse();
        const turnOrderUpdate = {};
        turnOrderUpdate["players"] = playersPosition;

        const currentTurnOrder = await getTurnOrder();
        if (currentTurnOrder) {
          const previousFirstTurnPlayer = currentTurnOrder.firstTurnPlayer;
          const currentIndex = playersPosition.indexOf(previousFirstTurnPlayer);
          const newIndex = (currentIndex + 1) % playersPosition.length;
          turnOrderUpdate["turnPlayer"] = playersPosition[newIndex];
          turnOrderUpdate["firstTurnPlayer"] = playersPosition[newIndex];
        } else {
          const randomIndex = Math.floor(Math.random()*playersPosition.length);
          turnOrderUpdate["turnPlayer"] = playersPosition[randomIndex];
          turnOrderUpdate["firstTurnPlayer"] = playersPosition[randomIndex];
        }
        // e.g. 30 seconds from now
        turnOrderUpdate["turnExpiration"] = now + 30000;

        // Reset betting.
        const bettingUpdate = {pot: {pot1: 0, potCount: 1}};

        // Build the overall update object.
        const update = {};
        update["roundInProgress"] = true;
        // Clear nextGameStarts to indicate game has started.
        update["nextGameStarts"] = 0;
        update["cards"] = cardUpdates;
        update["turnOrder"] = turnOrderUpdate;
        update["betting"] = bettingUpdate;
        update["moves"] = [];
        update["winner"] = "none";

        // Update the table.
        await refTable.update(update);
        // Push the initial face-up card into the discard pile.
        await cardsDiscardPileRef.push().set({0: firstCardOnDiscard});

        console.log("New game started automatically at", now);
      } catch (err) {
        console.error("Error starting game automatically:", err);
      }
      return null;
    });
