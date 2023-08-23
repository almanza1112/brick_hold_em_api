var cards = [
    'clubs2',
    'clubs3',
    'clubs4',
    'clubs5',
    'clubs5',
    'clubs6',
    'clubs6',
    'clubs7',
    'clubs7',
    'clubs8',
    'clubs8',
    'clubs9',
    'clubs9',
    'clubs10',
    'clubs10',
    'clubsAce',
    'clubsAce',
    'diamonds2',
    'diamonds3',
    'diamonds4',
    'diamonds5',
    'diamonds5',
    'diamonds6',
    'diamonds7',
    'diamonds6',
    'diamonds7',
    'diamonds8',
    'diamonds8',
    'diamonds9',
    'diamonds9',
    'diamonds10',
    'diamonds10',
    'diamondsAce',
    'diamondsAce',
    'hearts2',
    'hearts3',
    'hearts4',
    'hearts5',
    'hearts5',
    'hearts6',
    'hearts6',
    'hearts7',
    'hearts7',
    'hearts8',
    'hearts8',
    'hearts9',
    'hearts9',
    'hearts10',
    'hearts10',
    'heartsAce',
    'heartsAce',
    'spades2',
    'spades3',
    'spades4',
    'spades5',
    'spades5',
    'spades6',
    'spades6',
    'spades7',
    'spades7',
    'spades8',
    'spades8',
    'spades9',
    'spades9',
    'spades10',
    'spades10',
    'spadesAce',
    'spadesAce',
    'brick',
    'brick',
    'brick',
]

function setCards(numOfPlayers) {
    var playersCardList = [];
    let startingHandNum = 5;
    var remainingCards = shuffleArray(cards);
    var faceUpCard = [];

    // Dynamically creating arrays for players card list
    for ( i = 0; i < numOfPlayers; i++ ) {
        playersCardList.push([])
    }

    for (i = 0; i < startingHandNum; i++){
        // Add cards to arrays (playersCardList)
        for(j = 0; j < playersCardList.length; j++){
            // Add card that is at the last position of the remainingCards array
            playersCardList[j].push(remainingCards[remainingCards.length - 1])

            // Remove card that is at the last position of the array
            remainingCards.pop()
        }
    }

    faceUpCard.push(remainingCards[remainingCards.length - 1]);
    remainingCards.pop();

    // Shuffle the hands one more time
    var shuffledArray = shuffleArray(playersCardList);

    var startingHandAndDeck = {
        "playersCards" : shuffledArray,
        "deck" : remainingCards,
        "faceUpCard" : faceUpCard
    }

    return startingHandAndDeck
}

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

module.exports = {setCards, shuffleArray}