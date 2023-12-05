const Cards = require("./cards");

function setCards(numOfPlayers) {
  var playersCardList = [];
  let startingHandNum = 5;
  const cardsData = new Cards();
  var remainingCards = shuffleArray(cardsData.getCards());
  var faceUpCard = [];

  // Dynamically creating arrays for players card list
  for (i = 0; i < numOfPlayers; i++) {
    playersCardList.push([]);
  }

  for (i = 0; i < startingHandNum; i++) {
    // Add cards to arrays (playersCardList)
    for (j = 0; j < playersCardList.length; j++) {
      // Add card that is at the last position of the remainingCards array
      playersCardList[j].push(remainingCards[remainingCards.length - 1]);

      // Remove card that is at the last position of the array
      remainingCards.pop();
    }
  }

  faceUpCard.push(remainingCards[remainingCards.length - 1]);
  remainingCards.pop();

  // Shuffle the hands one more time
  var shuffledArray = shuffleArray(playersCardList);

  var startingHandAndDeck = {
    playersCards: shuffledArray,
    deck: remainingCards,
    faceUpCard: faceUpCard,
  };

  return startingHandAndDeck;
}

function shuffleArray(array) {
  let currentIndex = array.length,
    randomIndex;

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

module.exports = { setCards, shuffleArray };
