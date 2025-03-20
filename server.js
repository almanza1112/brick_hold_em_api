const express = require("express");
const app = express();
const bodyParser = require("body-parser"); // TODO: do I really need this?
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const cron = require("node-cron");

var firebaseAdmin = require("firebase-admin");
var serviceAccount = require("./brick-hold-em-firebase-adminsdk-s0v2q-48899a2943.json");

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: "https://brick-hold-em-default-rtdb.firebaseio.com",
});

var db = firebaseAdmin.database();
var fs = firebaseAdmin.firestore();

// Import and initialize listeners
require("./listeners/listeners")({ db, firebaseAdmin, fs });

app.get("/", async (req, res) => {
  res.send("Welcome to Brick Hold Em API");
});

const tableRouter = require("./routes/table");
app.use("/table", tableRouter);

const accountRouter = require("./routes/account");
app.use("/account", accountRouter);

const signInRouter = require("./routes/sign_in");
app.use("/sign_in", signInRouter);

//Uncomment below for local testing
//app.listen(3000, () => console.log("Server Started"));

//Uncomment below for push
app.listen(process.env.PORT || 3000, () => console.log("Server Started"));

// Schedule a self-ping every 10 minutes
// Uncomment for production push. Comment for local testing
// cron.schedule('*/10 * * * *', () => {
//   console.log("Pinging self...");
//   https.get("https://the-sales-gong-api.onrender.com", (res) => {
//     console.log(`Ping response: ${res.statusCode}`);
//   });
// });
