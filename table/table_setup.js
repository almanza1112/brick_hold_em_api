// var firebaseAdmin = require("firebase-admin");
// var serviceAccount = require("../brick-hold-em-firebase-adminsdk-s0v2q-48899a2943.json");

// firebaseAdmin.initializeApp({
//     credential: firebaseAdmin.credential.cert(serviceAccount),
//     databaseURL: "https://brick-hold-em-default-rtdb.firebaseio.com"
// });


// var db = firebaseAdmin.database();

// var ref = db.ref('tables/1/players');
// // Whenever a change occurs
// ref.on('value', (snapshot) => {
//     console.log(snapshot.val())
// }, (errorObject) => {
//     console.log('The read failed: ' + errorObject.name)
// });

// // update data
// ref.update({
//     'test': {
//         "just": "going to mess around"
//     }
// });
// // Read data once
// ref.once('value', function (snapshot) {
//     console.log(snapshot.val());
// });