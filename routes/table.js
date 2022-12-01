const express = require('express')
const router = express.Router()


// Getting all
router.get('/', async (req, res) => {
    try {
        //const users = await User.find()
        res.status(201).json({'hi':'test'})
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

module.exports = router