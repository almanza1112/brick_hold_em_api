const express = require("express");
const app = express();
const bodyParser = require("body-parser"); // TODO: do I really need this?
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));

// TODO: need to remove this eventually
const startingHand = require("./table/table_starting_hand");

var firebaseAdmin = require("firebase-admin");
var serviceAccount = require("./brick-hold-em-firebase-adminsdk-s0v2q-48899a2943.json");

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: "https://brick-hold-em-default-rtdb.firebaseio.com",
});

var db = firebaseAdmin.database();

var refTable = db.ref("tables/1");
var refPlayers = db.ref("tables/1/players");
var refIsRoundInProgress = db.ref("tables/1/roundInProgress");
var deckRef = db.ref("tables/1/cards/dealer/deck");
var deckCountRef = db.ref("tables/1/cards/dealer");
var playerCardsRef = db.ref("tables/1/cards/playerCards");
var cardsDiscardPileRef = db.ref("tables/1/cards/discardPile");
var winnerRef = db.ref("tables/1/winner");
var firstTurnPlayerRef = db.ref("tables/1/turnOrder/firstTurnPlayer");
var turnOrderRef = db.ref('tables/1/turnOrder');

// This is because the reference is a list, limitToLast(1) reassures we only get the
// latest one to be added.
var movesRef = db.ref("tables/1/moves").limitToLast(1);

// Whenever a player joins the lobby
refPlayers.on(
  "value",
  async (snapshot) => {
    var data = snapshot.toJSON();
    if (data == null) {
      // Table is empty or does not exist
    } else {
      // Retrieve how many players in table
      const numOfPlayers = Object.keys(data).length;

      if (numOfPlayers > 1) {
        // Check if round is in progress
        let result = await isRoundInProgress();
        if (!result) {
          // Get the turn order information from previous round
          let getTurnOrderResult = await getTurnOrder();

          // Check if there was a turnOrder
          if (getTurnOrderResult != undefined) {
            // There was a previous round, pass the firstTurnPlayer
            startGame(data, numOfPlayers, true, getTurnOrderResult);
          } else {
            // This table is brand new, there was no one here before so
            // start a new game
            startGame(data, numOfPlayers, false, null);
          }
        } else {
          // round is in progress, do nothing
        }
      } else {
        refTable.update({ roundInProgress: false });
      }
    }
  },
  (errorObject) => {
    console.log("The read failed: " + errorObject.name);
  }
);

async function isRoundInProgress() {
  return await refIsRoundInProgress.get().then((snapshot) => {
    return snapshot.val();
  });
}

async function getTurnOrder() {
  return await turnOrderRef
    .get()
    .then((snapshot) => {
      return snapshot.val();
    })
    .catch((error) => {
      console.log("ERROR in getFirstTurnPlayer: ", error);
    });
}

function startGame(data, numOfPlayers, wasThereAFirstTurnPlayerBefore, previousTurnOrderResult) {
  // Get starting hand
  var _startingHand = startingHand.setCards(numOfPlayers);
  var deck = _startingHand["deck"];
  // Retrieve uids of players
  var playerInfo = Object.values(data);

  var cardUpdates = {};
  var playerCards = {};
  var turnOrderUpdate = {};

  // Set the starting hand to players
  for (i = 0; i < numOfPlayers; i++) {
    playerCards[playerInfo[i].uid] = {
      hand: _startingHand["playersCards"][i],
      position: playerInfo[i].position,
    };
  }

  // Set what the remaining cards are to the dealer
  cardUpdates["dealer"] = { deck: deck, deckCount: deck.length };
  cardUpdates["playerCards"] = playerCards;
  var firstCardOnDiscard = _startingHand["faceUpCard"][0];

  // Set turn order of players
  var playerKeys = Object.keys(data);
  var playersPosition = playerKeys.map(function (str) {
    return parseInt(str);
  });
  // Add players list to update
  turnOrderUpdate["players"] = playersPosition;

  if (wasThereAFirstTurnPlayerBefore) {
    var previousFirstTurnPlayer = previousTurnOrderResult.firstTurnPlayer;
    //var previousPlayersList = previousTurnOrderResult.players;

    var previousFirstTurnPlayerIndex = turnOrderUpdate.players.indexOf(previousFirstTurnPlayer);

    if(previousFirstTurnPlayer == turnOrderUpdate.players[previousFirstTurnPlayerIndex]){
      // Assing new index for next firstTurnPlayer
      var newIndex = previousFirstTurnPlayerIndex + 1;
      // Check if newIndex is at the end of the list
      if (newIndex >= turnOrderUpdate.players.length){
        // If it is then assign to the first index of list
        newIndex = 0;
      }

      turnOrderUpdate["turnPlayer"] = playersPosition[newIndex];
      turnOrderUpdate["firstTurnPlayer"] = playersPosition[newIndex];

    }

    
  } else {

    var randomPosition = getRandomNumber(playersPosition.length);
    turnOrderUpdate["turnPlayer"] = playersPosition[randomPosition];
    turnOrderUpdate["firstTurnPlayer"] = playersPosition[randomPosition];
  }

  var update = {
    roundInProgress: true,
    cards: cardUpdates,
    turnOrder: turnOrderUpdate,
    winner: "none",

    // TODO: this needs to go somewhere else, possibly label
    // the path like tables/[small blind]_[big blind]/1/etc...
    blinds: {
      small: 2,
      big: 4,
    },
  };

  try {
    refTable
      .update(update)
      .then((_) => {
        var newDiscardPile = cardsDiscardPileRef.push();

        newDiscardPile
          .set({ 0: firstCardOnDiscard })
          .then((_) => {})
          .catch((err) => {
            console.log("error newDiscardPile: " + err);
          });
      })
      .catch((error) => {
        console.log("Error updating table in startGame: " + error);
      });
  } catch (err) {
    console.log("Error in startGame: ", err);
  }
}

function getRandomNumber(max) {
  // Generate a random number between 0 and max
  var randomNumber = Math.floor(Math.random() * max);
  return randomNumber;
}

// Listener that updates the number of cards that are left in the deck.
deckRef.on(
  "value",
  async (snapshot) => {
    const list = snapshot.val();
    // The list of Object keys is equal to the deck count
    const listLength = list ? Object.keys(list).length : 0;

    if (listLength > 0) {
      deckCountRef
        .update({ deckCount: listLength })
        .then(() => {
          // maybe do something when deckCount gets updated
        })
        .catch((err) => {
          console.log("error with deckCount: " + err);
        });
    } else {
      // There are zero cards left in deck, get cards from discardPile
      cardsDiscardPileRef.get().then((snapshot) => {
        var discardPile = [];

        snapshot.forEach((childSnapshot) => {
          var childData = childSnapshot.val();
          discardPile.push(...childData);
        });

        var faceUpCard = discardPile[discardPile.length - 1];

        discardPile.pop(discardPile.length - 1);

        var shuffledDiscardPile = startingHand.shuffleArray(discardPile);
        deckRef.set(shuffledDiscardPile).then((value) => {
          // Setting the discardPile to the deck is successful.
          // Proceed to deleting the discard pile
          cardsDiscardPileRef.remove().then((value) => {
            // Deleting discard pile is successful, proceed to
            // push faceUpCard as the new and only entry of the
            // discardPile
            cardsDiscardPileRef
              .push()
              .set({ 0: faceUpCard })
              .catch((err) => {
                console.log("Error updating discardPile", err);
              });
          });
        });
      });
    }
  },
  (errorObject) => {
    console.log("The read failed: " + errorObject.name);
  }
);

// Listener that updates card counts
playerCardsRef.on("value", async (snapshot) => {
  const players = snapshot.val();
  const playerUids = Object.keys(players);

  let update = {};

  for (let i = 0; i < playerUids.length; i++) {
    var refKey = "cards/playerCards/" + playerUids[i] + "/cardCount";
    var cardCount = players[playerUids[i]].hand;

    // if cardCount is not undefined, there is not winner, continue with update
    if (cardCount !== undefined) {
      update[refKey] = cardCount.length;
    } else {
      // There is a cardCount that is undefined, there is a winner.
      // Proceed to update cardCount of player to 0 and update winner
      update[refKey] = 0;
      update["winner"] = playerUids[i];
      //update["roundInProgress"] = false; // TODO: is this needed?
    }
  }

  refTable
    .update(update)
    .then(() => {
      // maybe do something here?
    })
    .catch((err) => {
      console.log("error updating card count: " + err);
    });
});

// Listener for moves
movesRef.on("value", async (snapshot) => {
  snapshot.forEach((childSnapshot) => {
    var childData = childSnapshot.val();

    var newDiscardPile = cardsDiscardPileRef.push();

    newDiscardPile
      .set(childData["move"])
      .then((value) => {})
      .catch((err) => {
        console.log("error newDiscardPile: " + err);
      });
  });
});

winnerRef.on("value", async (snapshot) => {
  var winner = snapshot.val();
  if (winner !== "none") {
    await delay(5000);
    refTable.update({ winner: "none" });
  }
});
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

app.get("/", async (req, res) => {
  res.send("Welcome to Brick Hold Em API");
});

const tableRouter = require("./routes/table");
app.use("/table", tableRouter);

const accountRouter = require("./routes/account");
app.use("/account", accountRouter);

const signInRouter = require("./routes/sign_in");
app.use("/sign_in", signInRouter);

//Uncomment below for local testing
app.listen(3000, () => console.log("Server Started"));

//Uncomment below for push
//app.listen(process.env.PORT || 5000 , () => console.log('Server Started'))
