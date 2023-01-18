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
    console.log("before try")
    try {
        console.log("in try");
        var email = req.params._email;

        admin.auth()
            .getUserByEmail(email)
            .then((userRecord) => {
                // See the UserRecord reference doc for the contents of userRecord.
                if (userRecord.email === email) {
                    res.status(201).json({ 'emailUsed': true })
                } /** TODO: Check logic on this */
            })
            .catch((error) => {
                /** TODO: Check logic on this */
                if (error.code === 'auth/user-not-found') {
                    res.status(201).json({ 'emailUsed': false })
                }

            });

    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

module.exports = router