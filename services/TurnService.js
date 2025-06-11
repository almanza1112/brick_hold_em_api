const firebaseAdmin = require("firebase-admin");

class TurnService {
  constructor({ db }) {
    this.db = db;
    this.refTable = db.ref("tables/1");
    this.turnOrderRef = db.ref("tables/1/turnOrder");
    this.turnPlayerRef = db.ref("tables/1/turnOrder/turnPlayer");
    this.refPlayers = db.ref("tables/1/players");
    this.deckRef = db.ref("tables/1/cards/dealer/deck");
    this.playerCardsRef = db.ref("tables/1/cards/playerCards");
    this.potRef = db.ref("tables/1/pot/pot1");
    this.anteToCallRef = db.ref("tables/1/anteToCall");
  }

  async skipPlayerTurn() {
    const [turnSnap, anteSnap] = await Promise.all([
      this.turnOrderRef.once("value"),
      this.anteToCallRef.once("value"),
    ]);
    const turnOrderData = turnSnap.val();
    const anteData = anteSnap.val() || {};

    const playersList = turnOrderData.players;
    const currentTurnPlayer = turnOrderData.turnPlayer;
    const cardsToDraw = parseInt(anteData.cardsToDraw, 10) || 0;
    const amountToCall = parseInt(anteData.amountToCall, 10) || 0;

    // Compute next player
    const idx = playersList.indexOf(currentTurnPlayer);
    const nextIdx = (idx + 1) % playersList.length;
    const nextTurnPlayer = playersList[nextIdx];

    // Only do the skip/auto‐call if this player was the one to call
    if (
      anteData.playerToCallPosition === currentTurnPlayer &&
      !anteData.didPlayerCall && anteData.amountToCall > 0
    ) {
      // 2) Look up the UID for that position
      const playerSnap = await this.refPlayers
        .child(String(currentTurnPlayer))
        .once("value");
      const uid = playerSnap.val().uid;

      // 3) Pull the top N cards from the deck
      const deckSnap = await this.deckRef
        .orderByKey()
        .limitToLast(cardsToDraw)
        .once("value");
      const deckMap = deckSnap.val() || {};

      // 4) Build the multi‐location update
      const updatePayload = {};

      // — a) Remove those cards from the dealer’s deck
      for (const cardKey of Object.keys(deckMap)) {
        updatePayload[`cards/dealer/deck/${cardKey}`] = null;
      }

      // — b) Push each drawn card into the player’s hand
      const handBase = `cards/playerCards/${uid}/hand`;
      for (const cardName of Object.values(deckMap)) {
        const newKey = this.playerCardsRef.child(uid).child("hand").push().key;
        updatePayload[`${handBase}/${newKey}`] = cardName;
      }

      // — c) Debit their chips and credit the pot
      updatePayload[`chips/${uid}/chipCount`] =
        firebaseAdmin.database.ServerValue.increment(-amountToCall);
      updatePayload[`pot/pot1`] =
        firebaseAdmin.database.ServerValue.increment(amountToCall);

      // — d) Mark that they auto-called/skipped
      updatePayload["anteToCall/didPlayerCall"] = true;

      // 5) Advance the turn as well
      updatePayload["turnOrder/turnPlayer"] = nextTurnPlayer;

      // 6) Commit all at once
      await this.refTable.update(updatePayload);

      console.log(
        `Player ${currentTurnPlayer} auto-called ${amountToCall}, drew ${cardsToDraw} cards, next is ${nextTurnPlayer}`
      );
    } else {
      // Not the caller's turn-skipping case: just advance normally
      await this.turnOrderRef.update({ turnPlayer: nextTurnPlayer });
      console.log(`Turn skipped. Next player is: ${nextTurnPlayer}`);
    }

    return nextTurnPlayer;
  }
}

module.exports = TurnService;
