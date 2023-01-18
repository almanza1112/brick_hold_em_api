const express = require('express')
const router = express.Router()
var admin = require("firebase-admin");
var serviceAccount = require("../brick-hold-em-firebase-adminsdk-s0v2q-48899a2943.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://brick-hold-em-default-rtdb.firebaseio.com"
});

// Getting all
router.get('/:_email', async (req, res) => {
    
    try {

        console.log("in try")
        var email = req.params._email;

        admin.auth()
            .getUserByEmail(email)
            .then((userRecord) => {
                console.log("in user record")
                // See the UserRecord reference doc for the contents of userRecord.
                if (userRecord.email === email) {
                    console.log("in userrecord if statement")

                    res.status(201).json({'emailUsed': true })
                } /** TODO: Check logic on this */
            })
            .catch((error) => {
                console.log("in error")

                /** TODO: Check logic on this */
                if (error.code === 'auth/user-not-found') {
                    console.log("in error if statement")

                    res.status(201).json({'emailUsed': false })
                }

            });

    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

module.exports = router