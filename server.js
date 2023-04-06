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

// Whenever a player joins the lobby
refPlayers.on('value', async (snapshot) => {
    var data = snapshot.toJSON();
    if(data == null) {
        // Table is empty or does not exist

    } else {
        // Retrieve how many players in table
        var numOfPlayers = Object.keys(data).length;

        if (numOfPlayers > 1) {            
            // Check if round is in progress
            var result = await isRoundInProgress();
            if (!result) {
                startGame(data, numOfPlayers);
            }
        } 
    }
    

    }, (errorObject) => {
    console.log('The read failed: ' + errorObject.name)
});

 async function isRoundInProgress(){
     var result = await refIsRoundInProgress.once('value');
     //return result.val();
     return false;
    
}

function startGame(data , numOfPlayers) {
    // Get starting hand
    var _startingHand = startingHand.setCards(numOfPlayers)
    // Retrieve uids of players
    var playerUids = Object.keys(data)
    
    var cardUpdates = {}
    var update = {}

    // Set the starting hand to players
    for (i = 0; i < numOfPlayers; i++){
        cardUpdates[playerUids[i]] = {"startingHand": _startingHand['playersCards'][i]};
    }

    // Set what the remaining cards are to the dealer
    cardUpdates['dealer'] = _startingHand['deck'];
    cardUpdates['faceUpCard'] = _startingHand['faceUpCard'];
    
    // Update roundInProgress to true
    update = { "roundInProgress": true, "cards": cardUpdates }
    
    refTable.update(update)
        .then(() => { 
            console.log("SUCCESS")
        })
        .catch((error) => {
            console.log("ERROR: " + error)
        })
}

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