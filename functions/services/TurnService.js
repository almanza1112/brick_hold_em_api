const {setCards} = require("../table/table_starting_hand");

/**
 */
class TurnService {
  /**
   * @param {*} param0
   */
  constructor({db, firebaseAdmin, fs}) {
    this.db = db;
    this.admin = firebaseAdmin;
    this.fs = fs;
  }

  /**
   * Build all the RTDB refs for a given tableId
   * @param {*} tableId
   * @return {Object}
   */
  _refs(tableId) {
    const base = `tables/${tableId}`;
    return {
      tableRef: this.db.ref(base),
      roundInProgressRef: this.db.ref(`${base}/roundInProgress`),
      playerCardsRef: this.db.ref(`${base}/cards/playerCards`),
      deckRef: this.db.ref(`${base}/cards/dealer/deck`),
      deckCountRef: this.db.ref(`${base}/cards/dealer/deckCount`),
      discardPileRef: this.db.ref(`${base}/cards/discardPile`),
      potRef: this.db.ref(`${base}/pot/pot1`),
      winnerRef: this.db.ref(`${base}/winner`),
      turnOrderRef: this.db.ref(`${base}/turnOrder`),
      turnPlayerRef: this.db.ref(`${base}/turnOrder/turnPlayer`),
    };
  }

  /**
   * @param {*} playersData
   * @param {*} numPlayers
   * @param {*} tableId
   */
  async startGame(playersData, numPlayers, tableId) {
    const {
      roundInProgressRef,
      deckRef,
      deckCountRef,
      discardPileRef,
      potRef,
      winnerRef,
      turnOrderRef,
      turnPlayerRef,
    } = this._refs(tableId);

    // 1) mark in-progress, reset pot & winner
    await roundInProgressRef.set(true);
    await potRef.set(0);
    await winnerRef.set("none");

    // 2) get your pre-coded shuffle/deal
    const {playersCards, deck, faceUpCard} = setCards(numPlayers);

    // 3) write the remaining deck under /cards/dealer/deck & deckCount
    const deckMap = {};
    deck.forEach((name) => {
      const key = deckRef.push().key;
      deckMap[key] = name;
    });
    await deckRef.set(deckMap);
    await deckCountRef.set(deck.length);

    // 4) write the single face-up card under /cards/dealer/discardPile
    await discardPileRef.set({}); // clear any old
    const upMap = {};
    faceUpCard.forEach((name) => {
      const key = discardPileRef.push().key;
      upMap[key] = name;
    });
    await discardPileRef.set(upMap);

    // 5) deal each player's hand under /cards/playerCards/{uid}/hand
    //    Use the seat order from playersData keys sorted numerically
    const seats = Object.keys(playersData)
        .sort((a, b) => Number(a) - Number(b));
    for (let i = 0; i < seats.length; i++) {
      const {uid} = playersData[seats[i]];
      const hand = playersCards[i] || [];
      const playerRef = this.db
          .ref(`tables/${tableId}/cards/playerCards/${uid}`);
      // build hand map
      const handMap = {};
      hand.forEach((cardName) => {
        const key = playerRef.child("hand").push().key;
        handMap[key] = cardName;
      });
      await playerRef.set({
        hand: handMap,
        cardCount: hand.length,
      });
    }

    // 6) Rotate turn order using numerical 'position' field
    // Collect and sort positions, then advance firstTurnPlayer
    const positions = Object.values(playersData)
        .map((p) => p.position)
        .sort((a, b) => a - b);

    // Read previous firstTurnPlayer (an integer)
    const prevFirstSnap = await turnOrderRef
        .child("firstTurnPlayer")
        .once("value");
    const prevFirst = prevFirstSnap.val();

    // Determine new starting position
    let startPos;
    if (Number.isInteger(prevFirst) && positions.includes(prevFirst)) {
      const idx = positions.indexOf(prevFirst);
      startPos = idx < positions.length - 1 ? positions[idx + 1] : positions[0];
    } else {
      startPos = positions[0];
    }

    // Rotate the positions array so startPos is first
    const startIndex = positions.indexOf(startPos);
    const newOrder = [
      ...positions.slice(startIndex),
      ...positions.slice(0, startIndex),
    ];

    // 7) Persist new numeric order and firstTurnPlayer, then set current turn
    await turnOrderRef.set({firstTurnPlayer: startPos, order: newOrder});
    await turnPlayerRef.set(startPos);
  }

  /**
   * Skip the current player's turn and advance to the next in `turnOrder`.
   * @param {string} tableId
   */
  async skipPlayerTurn(tableId) {
    const {turnOrderRef, turnPlayerRef} = this._refs(tableId);

    const snapOrder = await turnOrderRef.child("order").once("value");
    const order = snapOrder.val() || [];

    const snapCurrent = await turnPlayerRef.once("value");
    const current = snapCurrent.val();

    const idx = order.indexOf(current);
    const next = order[idx < 0 || idx === order.length - 1 ? 0 : idx + 1];
    if (next) {
      await turnPlayerRef.set(next);
      console.log(`Table ${tableId}: turned from ${current} → ${next}`);
    }
  }
}

module.exports = TurnService;
