const express = require("express");
const router = express();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

const cards = require("../table/table_starting_hand");

var firebaseAdmin = require("firebase-admin");
var db = firebaseAdmin.database();
var turnRef = db.ref("tables/1/turnOrder");
var playersRef = db.ref("tables/1/players");
var playerQueueRef = db.ref("tables/1/playerQueue");
var tableRef = db.ref("tables/1/");
var playerHandRef = db.ref("tables/1/cards/playerCards/");
var foldedHandsRef = db.ref("tables/1/cards/foldedHands");
var betsRef = db.ref("tables/1/betting/bets");
var chipsRef = db.ref("tables/1/chips");
var movesRef = db.ref("tables/1/moves");

const messageServerError = "Invalid server error.";

// Getting all
router.get("/", async (req, res) => {
  try {
    //const users = await User.find()
    //console.log(cards.shuffle())
    res.status(201).json({ cards: "brb" });
  } catch (err) {
    res.status(500).json({ message: messageServerError });
  }
});

router.get("/passturn", async (req, res) => {
  try {
    var snapshot = await turnRef.once("value");
    var data = snapshot.val();
    var playersList = data["players"];
    var turnPlayer = data["turnPlayer"];
    var currentIndex = playersList.indexOf(turnPlayer);
    var nextTurnIndex = currentIndex + 1;

    var nextTurnPlayer;

    // Check if player index is at the end of array
    if (nextTurnIndex < playersList.length) {
      nextTurnPlayer = playersList[nextTurnIndex];
    } else {
      nextTurnPlayer = playersList[0];
    }

    // Update turn player
    // TODO: need to update status codes
    await turnRef
      .update({ turnPlayer: nextTurnPlayer })
      .then((value) => {
        res.status(201).json({ message: "success" });
      })
      .catch((err) => {
        res.status(201).json({ message: "error" });
      });
  } catch (err) {
    res.status(500).json({ message: messageServerError });
  }
});

router.post("/join", async (req, res) => {
  try {
    const player = {
      uid: req.body.uid,
      name: req.body.name,
      photoURL: req.body.photoURL,
      username: req.body.username,
    };

    playersRef
      .get()
      .then((snapshot) => {
        if (snapshot.exists()) {
          // Get snapshot
          var data = snapshot.val();

          // Get object keys = player count
          var keys = Object.keys(data);

          // Check if user is already in the game. If he
          // is than litreally do nothing
          for (var i = 0; i < keys.length; i++) {
            if (data[keys[i]]["uid"] === req.body.uid) {
              return res
                .status(201)
                .json({ message: "Player is already in game." });
            }
          }

          // convert elements in keys array into int
          const keysInt = keys.map(function (element) {
            return parseInt(element, 10);
          });

          // pass new array of int into function that determines position
          var position = determinePosition(keysInt);

          if (keys.length < 6) {
            // There is less than 6 players, add player to game
            var playerJoiningUpdate = {};
            playerJoiningUpdate["chips/" + player["uid"] + "/chipCount"] =
              parseInt(req.body.chips);

            player["position"] = position;
            playerJoiningUpdate["players/" + position] = player;

            tableRef
              .update(playerJoiningUpdate)
              .then((value) => {
                // TODO: do i really need to pass the position?
                res.status(201).json({
                  position: position,
                  message: "Player added to table.",
                });
              })
              .catch((error) => {
                console.log("Error adding player to table: " + error);
                res
                  .status(500)
                  .json({ message: "Error adding player to the table." });
              });
          } else {
            // There is more than 6 players in game, add player to queue
            playerQueueRef
              .update(player)
              .then((value) => {
                res.status(201).json({ message: "Player added to queue." });
              })
              .catch((error) => {
                console.log("Error updating player queue: " + error);
                res
                  .status(500)
                  .json({ message: "Error adding player to queue." });
              });
          }
        } else {
          console.log("no data available");
          return res.status(500).json({ message: "No data available." });
        }
      })
      .catch((error) => {
        console.log(error);
        res
          .status(500)
          .json({ message: "Error getting players info from table." });
      });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: messageServerError });
  }
});

router.post("/foldhand", async (req, res) => {
  try {
    const uid = req.body.uid;
    const position = req.body.position;

    playerHandRef
      .child(uid)
      .get()
      .then((snapshot) => {
        if (snapshot.exists()) {
          // Get snapshot data
          var data = snapshot.val();

          // Get hand
          var hand = data["hand"];

          // Push hand into foldedHands list
          var newPostRef = foldedHandsRef.push();
          newPostRef
            .set(hand)
            .then(() => {
              // Update player to them being folded
              var playerUpdate = { folded: true };
              playersRef
                .child(position)
                .update(playerUpdate)
                .then(() => {
                  // Once complete return success
                  res.status(201).json({ message: "success" });
                })
                .catch((error) => {
                  console.log(error);
                  res
                    .status(500)
                    .json({ message: "Error updating players to folded." });
                });
            })
            .catch((error) => {
              console.log(error);
              res
                .status(500)
                .json({ message: "Error pushing into foldedHands list." });
            });
        } else {
          res.status(500).json({ message: "No data available." });
        }
      })
      .catch((error) => {
        console.log(error);
        res
          .status(500)
          .json({
            message: "Error getting the hand of player with uid:" + uid,
          });
      });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: messageServerError });
  }
});

router.post("/raiseBet", async (req, res) => {
  try {
    const bet = req.body.bet;
    const uid = req.body.uid;
    const position = req.body.position;

    console.log(req.body);

    chipsRef
      .child(uid)
      .get()
      .then((snapshot) => {
        if (snapshot.exists) {
          // Get data
          var data = snapshot.val();

          // Get current chipCount
          var chipCount = data["chipCount"];

          // Assign new chipCount
          var newChipCount = chipCount - bet;

          var chipCountUpdate = { chipCount: newChipCount };

          // Update chipCount
          chipsRef
            .child(uid)
            .update(chipCountUpdate)
            .then(() => {
              // Success, proceed to push into bets
              var newBetsPostRef = betsRef.push();

              var betsPost = {
                type: "raise",
                bet: bet,
                uid: uid,
                position: position,
              };

              newBetsPostRef
                .set(betsPost)
                .then(() => {
                  res.status(201).json({ message: "success" });
                })
                .catch((err) => {
                  console.log(err);
                  res
                    .status(500)
                    .json({
                      message: "Error posting new bet for player with uid: " + uid,
                    });
                });
            })
            .catch((error) => {
              console.log(error);
              res.status(500).json({
                message:
                  "Error getting the information of player at position :" +
                  position +
                  " with uid:" +
                  uid,
              });
            });

          console.log(chipCount);
        } else {
          res.status(500).json({
            message: "No chips data avaiable of player with uid: " + uid,
          });
        }
      })
      .catch((error) => {
        console.log(error);
        res.status(500).json({
          message:
            "Error getting the information of player at position :" +
            position +
            " with uid:" +
            uid,
        });
      });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: messageServerError });
  }
});

router.post("/playCards", async (req, res) => {
  try {
    console.log(req.body);
    var uid = req.body.uid;
    var move = req.body.move;
    var cardsInHand = req.body.cardsInHand;
    var isThereABet = JSON.parse(req.body.isThereABet);
    var betObject;

    if (isThereABet == true) {
      betObject = JSON.parse(req.body.bet);
    } 
  
    // Removes the brackets surronding the move string array 
    var trimmedMoveString = move.slice(1, -1);
    var trimmedCardsInHandString = cardsInHand.slice(1, -1);

    // Convert string into array
    var moveArray = trimmedMoveString.split(", ");
    var cardsInHandArray = trimmedCardsInHandString.split(", ");


    // Get the turn order information
    var snapshot = await turnRef.once("value");
    var data = snapshot.val();
    var playersList = data["players"];
    var turnPlayer = data["turnPlayer"];
    var currentIndex = playersList.indexOf(turnPlayer);
    var nextTurnIndex = currentIndex + 1;

    var nextTurnPlayer;

    // Check if next player index is at the end of array
    if (nextTurnIndex < playersList.length) {
      // Next player index is NOT at the end of array
      nextTurnPlayer = playersList[nextTurnIndex];
    } else {
      // Next player index is at the end of array, start from beginning 
      nextTurnPlayer = playersList[0];
    }

    // Creating variable for new post of moves
    var newMovesPost = movesRef.push();

    // Move update created
    var moveUpdate = {
      uid: uid,
      move: moveArray
    }

    newMovesPost.set(moveUpdate).then((_) => {
      // New move posted successfully

      // Create update for new hand and new turn player
      var update = {}
      update["cards/playerCards/" + uid + "/hand"] = cardsInHandArray;
      update["turnOrder/turnPlayer"] = nextTurnPlayer; 

      // Check if there was a bet placed
      if(isThereABet == true){
        if(betObject['type'] == 'raise'){
          update["betting/toCall"] = {
            didAFullCircle: false,
            uid: uid,
            amount: betObject['amount']
          };
          
          // Add bet amount to the pot
          update['betting/pot/pot1'] = firebaseAdmin.database.ServerValue.increment(parseInt(betObject['amount']));

        }
      }

      // Update cards in hand 
      tableRef.update(update).then(() => {
        // Cards in hand update success
        res.status(201).json({ message: "Success" });
      });

    }).catch((error) => {
      console.log("Error setting post in newMovesPost: ", error);
          res.status(500).json({ message: "Error setting new moves post." });

    });

  } catch (err) {
    console.log("Error in /playCards", err);
    res.status(500).json({ message: messageServerError });
  }
});


function determinePosition(array) {
  // Passing array as an argument which is the Object keys as ints

  // Sort array
  array.sort();

  // Determine the first available position
  let index = 0;
  while (index < array.length && array[index] === index + 1) {
    index++;
  }

  // Returning index + 1 since players position are 1 - 6 (array 0 - 5)
  return index + 1;
}

module.exports = router;
