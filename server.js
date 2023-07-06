const express = require('express')
const app = express()

// TODO: need to remove this eventually
const startingHand = require('./table/table_starting_hand')


var firebaseAdmin = require("firebase-admin");
var serviceAccount = require("./brick-hold-em-firebase-adminsdk-s0v2q-48899a2943.json");

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: "https://brick-hold-em-default-rtdb.firebaseio.com"
});


var db = firebaseAdmin.database();

var refTable = db.ref('tables/1')
var refPlayers = db.ref('tables/1/players');
var refIsRoundInProgress = db.ref('tables/1/roundInProgress')
var deckRef = db.ref('tables/1/cards/dealer/deck');
var deckCountRef = db.ref('tables/1/cards/dealer');
var playerCardsRef = db.ref('tables/1/cards/playerCards');
var movesRef = db.ref('tables/1/moves').limitToLast(1);

// Whenever a player joins the lobby
refPlayers.on('value', async (snapshot) => {
    var data = snapshot.toJSON();
    if(data == null) {
        // Table is empty or does not exist

    } else {
        // Retrieve how many players in table
        const numOfPlayers = Object.keys(data).length;

        if (numOfPlayers > 1) {     

            // Check if round is in progress
            const result = await isRoundInProgress();
            if (!result) {

            startGame(data, numOfPlayers);
            } else {
                // round is in progress, do nothing
            }
        } else {
            refTable.update({'roundInProgress' : false});
        }
    }
    }, (errorObject) => {
    console.log('The read failed: ' + errorObject.name)
});

async function isRoundInProgress(){
     var result = await refIsRoundInProgress.once('value');
     return result.val();
}

function startGame(data , numOfPlayers) {
    // Get starting hand
    var _startingHand = startingHand.setCards(numOfPlayers)
    var deck =  _startingHand['deck'];
    // Retrieve uids of players
    var playerInfo = Object.values(data)
    
    var cardUpdates = {}
    var playerCards = {}
    var turnOrderUpdate = {}
    var update = {}

    // Set the starting hand to players
    for (i = 0; i < numOfPlayers; i++){
        playerCards[playerInfo[i].uid] = {"hand": _startingHand['playersCards'][i], "position" : playerInfo[i].position};
    }

    // Set what the remaining cards are to the dealer
    cardUpdates['dealer'] = {"deck" : deck, "deckCount" : deck.length};
    cardUpdates['faceUpCard'] = _startingHand['faceUpCard'][0];
    cardUpdates['playerCards'] = playerCards;

    // Set turn order of players
    var playerKeys = Object.keys(data);
    var playersPosition = playerKeys.map(function(str) {
        return parseInt(str);
    });
    var randomPosition = getRandomNumber(playersPosition.length);
    turnOrderUpdate['players'] = playersPosition;
    turnOrderUpdate['turnPlayer'] = playersPosition[randomPosition];

    console.log(randomPosition);

    // Update roundInProgress to true
    update = { 
        "roundInProgress": true, 
        "cards": cardUpdates, 
        "turnOrder": turnOrderUpdate}
    
    refTable.update(update)
        .then(() => { 
            console.log("SUCCESS")
        })
        .catch((error) => {
            console.log("ERROR: " + error)
        })
}

function getRandomNumber(max) {
  // Generate a random number between 1 and max
  var randomNumber = Math.floor(Math.random() * max);
  return randomNumber;
}

// Listener that updates the number of cards that are left in the deck.
deckRef.on('value', async (snapshot) => {
    const list = snapshot.val();
    // The list of Object keys is equal to the deck count
    const listLength = list ? Object.keys(list).length : 0;

    deckCountRef.update({'deckCount': listLength})
        .then(() => {
            // maybe do something when deckCount gets updated
        })
        .catch((err) => {
            console.log("error with deckCount: " + err)
        });
}, (errorObject) => {
    console.log('The read failed: ' + errorObject.name);
});

// Listener that updates card counts
playerCardsRef.on('value', async (snapshot) => {
    const players = snapshot.val();
    const playerUids = Object.keys(players);

    let playerCardCountUpdate ={};

    for (let i = 0; i < playerUids.length; i++){
        var refKey = "players/" + players[playerUids[i]].position + "/cardCount";
        playerCardCountUpdate[refKey] = players[playerUids[i]].hand.length;
    }

    refTable.update(playerCardCountUpdate).then(() => {
        console.log('card count updated')
    })
    .catch((err) => {
        console.log("error updating card count: " + err)
    });

});

// Listener for moves 
movesRef.on('value', async (snapshot) => {
    snapshot.forEach((childSnapshot) => {
    console.log(childSnapshot.key);
    var childKey = childSnapshot.key;
    var childData = childSnapshot.val();
   
  });
});

app.get('/', async (req, res) => {
    res.send("Welcome to Brick Hold Em API")
})

const tableRouter  = require('./routes/table')
app.use('/table', tableRouter)

const accountRouter = require('./routes/account')
app.use('/account', accountRouter)

const signInRouter = require('./routes/sign_in');
app.use('/sign_in', signInRouter)

//Uncomment below for local testing
app.listen(3000, () => console.log('Server Started'))

//Uncomment below for push
//app.listen(process.env.PORT || 5000 , () => console.log('Server Started'))