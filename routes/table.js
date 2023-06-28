const express = require('express');
const router = express();

router.use(express.json());
router.use(express.urlencoded({extended: true}));

const cards = require('../table/table_starting_hand')

var firebaseAdmin = require("firebase-admin");
var db = firebaseAdmin.database();
var turnRef = db.ref('tables/1/turnOrder');
var playersRef = db.ref('tables/1/players');
var playerQueueRef = db.ref('tables/1/playerQueue');

// Getting all
router.get('/', async (req, res) => {
    try {
        //const users = await User.find()
        //console.log(cards.shuffle())
        res.status(201).json({'cards':'brb'})
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

router.get('/passturn', async (req, res) => {
    try {
        var snapshot = await turnRef.once('value');
        var data = snapshot.val();
        var playersList = data['players'];
        var turnPlayer = data['turnPlayer'];
        var currentIndex = playersList.indexOf(turnPlayer);
        var nextTurnIndex = currentIndex + 1;

        var nextTurnPlayer;

        // Check if player index is at the end of array
        if (nextTurnIndex < playersList.length){
            nextTurnPlayer = playersList[nextTurnIndex];
        } else {
            nextTurnPlayer = playersList[0];
        }   

        // Update turn player
        // TODO: need to update status codes
        await turnRef.update({"turnPlayer":nextTurnPlayer})
            .then((value)=>{
                res.status(201).json({message: "success"});
            }).catch((err)=>{
                res.status(201).json({message: "error"});
            });

    } catch (err) {

    }
})

router.post( '/join', async (req, res) => {
                    
    try {
        const player = {
            'uid' : req.body.uid,
            'name' : req.body.name,
            'photoURL' : req.body.photoURL,
            'username' : req.body.username,
            'cardCount' : 0
        }

        playersRef.get().then((snapshot) => {
            if (snapshot.exists()){
                // Get snapshot
                var data = snapshot.val();

                // Get object keys = player count
                var keys = Object.keys(data);

                // Check if user is already in the game. If he
                // is than litreally do nothing
                for(var i = 0; i < keys.length; i++) {
                    if (data[keys[i]]['uid'] === req.body.uid) {
                        return res.status(201).json({message: "Player is already in game."});
                    }
                }
                
                // convert elements in keys array into int
                const keysInt = keys.map(function(element) {
                    return parseInt(element, 10);
                });
                   
                // pass new array of int into function that determines position
                var position = determinePosition(keysInt);
        
                if (keys.length < 6) {
                    // There is less than 6 players, add player to game
                    player['position'] = position;
                    playersRef.child(position)
                        .update(player)
                        .then((value) => {
                            // TODO: do i really need to pass the position?
                            res.status(201).json({position: position, message: "Player added to table."});
                        })
                        .catch((error) => {
                            console.log("Error adding player to table: " + error);
                            res.status(500).json({ message: 'Error adding player to the table.' });
                        });
                } else {
                    // There is more than 6 players in game, add player to queue
                    playerQueueRef.update(player)
                        .then((value) => {
                            res.status(201).json({message : 'Player added to queue.'});                            })
                        .catch((error) => { 
                            console.log("Error updating player queue: " + error);
                            res.status(500).json({ message: 'Error adding player to queue.' });
                        });
                    }
            } else {
                console.log("no data available");
                return res.status(500).json({ message: 'No data available.' });
            }
        }).catch((error) => {
            console.log(error)
            res.status(500).json({ message: 'Error getting players info from table.' });

        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
    }

})

function determinePosition(array){
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

module.exports = router