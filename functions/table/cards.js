/**
 * This class is for the cards for the game.
 */
class Cards {
  /**
     * Constructor containing all the cards
     */
  constructor() {
    this.cards = [
      "clubs2",
      "clubs3",
      "clubs4",
      "clubs5",
      "clubs6",
      "clubs7",
      "clubs8",
      "clubs9",
      "clubs10",
      "clubsJ",
      "clubsQ",
      "clubsK",
      "clubsAce",
      "diamonds2",
      "diamonds3",
      "diamonds4",
      "diamonds5",
      "diamonds6",
      "diamonds7",
      "diamonds8",
      "diamonds9",
      "diamonds10",
      "diamondsJ",
      "diamondsQ",
      "diamondsK",
      "diamondsAce",
      "hearts2",
      "hearts3",
      "hearts4",
      "hearts5",
      "hearts6",
      "hearts7",
      "hearts8",
      "hearts9",
      "hearts10",
      "heartsJ",
      "heartsQ",
      "heartsK",
      "heartsAce",
      "spades2",
      "spades3",
      "spades4",
      "spades5",
      "spades6",
      "spades7",
      "spades8",
      "spades9",
      "spades10",
      "spadesJ",
      "spadesQ",
      "spadesK",
      "spadesAce",
      "brick",
      "brick",
    ];
  }

  /**
   * @return {cards}
   */
  getCards() {
    return this.cards;
  }
}

module.exports = Cards;
