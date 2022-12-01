const express = require('express')
const router = express.Router()
const cards = require('../table/cards')


// Getting all
router.get('/', async (req, res) => {
    try {
        //const users = await User.find()
        console.log(cards.shuffle())
        res.status(201).json({'cards':cards.shuffle()})
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

module.exports = router