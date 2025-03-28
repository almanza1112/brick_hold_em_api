const Cards = require("./cards");

/**
 * Sets the starting hand for the players
 * @param {*} numOfPlayers
 * @return {array}
 */
function setCards(numOfPlayers) {
  const playersCardList = [];
  const startingHandNum = 5;
  const cardsData = new Cards();
  const remainingCards = shuffleArray(cardsData.getCards());
  const faceUpCard = [];

  // Dynamically creating arrays for players card list
  for (let i = 0; i < numOfPlayers; i++) {
    playersCardList.push([]);
  }

  for (let i = 0; i < startingHandNum; i++) {
    // Add cards to arrays (playersCardList)
    for (let j = 0; j < playersCardList.length; j++) {
      // Add card that is at the last position of the remainingCards array
      playersCardList[j].push(remainingCards[remainingCards.length - 1]);

      // Remove card that is at the last position of the array
      remainingCards.pop();
    }
  }

  faceUpCard.push(remainingCards[remainingCards.length - 1]);
  remainingCards.pop();

  // Shuffle the hands one more time
  const shuffledArray = shuffleArray(playersCardList);

  const startingHandAndDeck = {
    playersCards: shuffledArray,
    deck: remainingCards,
    faceUpCard: faceUpCard,
  };

  return startingHandAndDeck;
}

/**
 * Shuffles the cards a bit more
 * @param {*} array
 * @return {array}
 */
function shuffleArray(array) {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

module.exports = {setCards, shuffleArray};
