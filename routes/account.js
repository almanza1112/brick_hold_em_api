const express = require('express')
const router = express.Router()
var admin = require("firebase-admin");

// test get
router.get('/', async (req, res) => {
    res.status(201).json({'message': "success"});
});

// Getting email
router.get('/:_email', async (req, res) => {
    
    try {
        var email = req.params._email;
        console.log("email: " + email)
        admin.auth()
            .getUserByEmail(email)
            .then((userRecord) => {
                console.log("in user record")
                // See the UserRecord reference doc for the contents of userRecord.
                if (userRecord.email === email) {
                    // Email is not available
                    res.status(201).json({ 'emailAvailable': false })
                } /** TODO: Check logic on this */
            })
            .catch((error) => {
                console.log("in error")

                /** TODO: Check logic on this */
                if (error.code === 'auth/user-not-found') {
                    // Email is available for user 
                    res.status(201).json({ 'emailAvailable': true })
                } else {
                    res.status(201).json({ 'error': error.code })
                }
            });

    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

module.exports = router