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

var ref = db.ref('tables/1/players');
// Whenever a change occurs
ref.on('value', (snapshot) => {
    var data = snapshot.toJSON();
    var dataLength = Object.keys(data).length;
    if(dataLength > 1) {
        startGame(dataLength);
    }
    }, (errorObject) => {
    console.log('The read failed: ' + errorObject.name)
});

function startGame(numOfPlayers) {
    cards.setCards(numOfPlayers)

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