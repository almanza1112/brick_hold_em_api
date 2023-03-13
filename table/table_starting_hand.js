var cards = [
    'club2',
    'club3',
    'club4',
    'club5',
    'club6',
    'club7',
    'club8',
    'club9',
    'clubAce',
    'diamond2',
    'diamond3',
    'diamond4',
    'diamond5',
    'diamond6',
    'diamond7',
    'diamond8',
    'diamond9',
    'diamondAce',
    'hearts2',
    'hearts3',
    'hearts4',
    'hearts5',
    'hearts6',
    'hearts7',
    'hearts8',
    'hearts9',
    'heartsAce',
    'spade2',
    'spade3',
    'spade4',
    'spade5',
    'spade6',
    'spade7',
    'spade8',
    'spade9',
    'spadeAce',
    'brick',
    'brick',
    'brick',
]

function setCards(numOfPlayers) {
    var playersCardList = [];
    let startingHandNum = 5;
    var remainingCards = shuffleArray(cards);

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

    // Shuffle the hands one more time
    var shuffledArray = shuffleArray(playersCardList);

    var startingHandAndDeck = {
        "playersCards" : shuffledArray,
        "deck" : remainingCards
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

module.exports = {setCards}