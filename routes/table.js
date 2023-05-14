const express = require('express')
const router = express.Router()
const cards = require('../table/table_starting_hand')

var firebaseAdmin = require("firebase-admin");
var db = firebaseAdmin.database();
var turnRef = db.ref('tables/1/turnOrder');

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
        await turnRef.update({"turnPlayer":nextTurnPlayer})
            .then((value)=>{
                res.status(201).json("something went right");
            }).catch((err)=>{
                res.status(201).json("something went wrong");
            });

    } catch (err) {

    }
})

module.exports = router