const express = require('express')
const router = express.Router()
var admin = require("firebase-admin");

// test get
router.get('/', async (req, res) => {
    res.status(201).json({ 'message': "success" });
});


/** 
This is used for signing in. Since Firebase either links together gmails with the same email
or makes separate accounts depending if you are sigining in with email & password or with 
google. I am trying to avoid this and make any duplicate sign-in (google vs email) return as 
a user existing already. So I'll do the following:
    1.) Check if email exists in FirebaseAuth, if it doesn't then it is a new user
    2.) If it does exist then retireve provider data to see authentication method used
*/
// Check if email already exists in system
router.get('/:_email', async (req, res) => {
    try {
        var email = req.params._email;
        console.log("email: " + email)
        admin.auth()
            .getUserByEmail(email)
            .then((userRecord) => {
                // See the UserRecord reference doc for the contents of userRecord.
                // Email is found, user does exist in our system                    
                /**
                 There are 3 different types of providerIDs I will be using and reading
                    1.) password
                    2.) facebook.com
                    3.) google.com
                 */

                // Now check if authentication methods are the same
                if (req.query.providerID === userRecord.providerData[0].providerId) {
                    // Authentication method matches, this is a returning user
                    res.status(201).json({ 'authMethodMatches': true });
                } else {
                    // Authentication method does not match, this is a duplicate
                    res.status(201).json({ 'authMethodMatches': false });
                }
            })
            .catch((error) => {
                // Email is not found, this is a new user
                /** TODO: Check logic on this */
                if (error.code === 'auth/user-not-found') {
                    // Email is available for user 
                    res.status(201).json({ 'newUser': true })
                } else {
                    res.status(201).json({ 'error': error.code })
                }
            });

    } catch (err) {
        res.status(500).json({ message: err.message })
    }
});

module.exports = router