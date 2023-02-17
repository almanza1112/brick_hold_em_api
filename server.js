const express = require('express')
const app = express()

// TODO: need to remove this eventually
const cards = require('./table/table_starting_hand')


var firebaseAdmin = require("firebase-admin");
var serviceAccount = require("./brick-hold-em-firebase-adminsdk-s0v2q-48899a2943.json");

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: "https://brick-hold-em-default-rtdb.firebaseio.com"
});


var db = firebaseAdmin.database();

var refTable = db.ref('tables/1')
var refPlayers = db.ref('tables/1/players');
var refCards = db.ref('tables/1/cards');
var refIsRoundInProgress = db.ref('tables/1/roundInProgress')

// Whenever a player joins the lobby
refPlayers.on('value', async (snapshot) => {
    var data = snapshot.toJSON();
    // Retrieve how many players in table
    var numOfPlayers = Object.keys(data).length;
    
    if(numOfPlayers > 1) {
        // Check if round is in progress
        var result = await isRoundInProgress();
        if (!result){
            startGame(data, numOfPlayers);
        }
    } 

    }, (errorObject) => {
    console.log('The read failed: ' + errorObject.name)
});

 async function isRoundInProgress(){
     var result = await refIsRoundInProgress.once('value');
     //console.log(result.val())
     return result.val();
    
}

function startGame(data , numOfPlayers) {
    var info = cards.setCards(numOfPlayers)
    var dataKeys = Object.keys(data)
    
    var cardUpdates = {}
    var update = {}
    for (i = 0; i < numOfPlayers; i++){
        cardUpdates[dataKeys[i]] = {"startingHand": info['playersCards'][i]};
    }
    cardUpdates['dealer'] = info['deck'];
    update = { "roundInProgress": true, "cards": cardUpdates }

    console.log(update)
    
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

//Uncomment below for local testing
app.listen(3000, () => console.log('Server Started'))

//Uncomment below for push
//app.listen(process.env.PORT || 5000 , () => console.log('Server Started'))