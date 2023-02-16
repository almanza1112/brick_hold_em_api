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

function shuffle() {
    let currentIndex = cards.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [cards[currentIndex], cards[randomIndex]] = [
            cards[randomIndex], cards[currentIndex]];
    }

    return cards;
}

function setCards(numOfPlayers) {
    var playersCardList = [];
    let startingHandNum = 5;
    var remainingCards = cards;
    let currentIndex = remainingCards.length;


    var testPlayer = []

    // Dynamically creating arrays for players card list
    for ( i = 0; i < numOfPlayers; i++ ) {
        var playerNum = i + 1;
        playersCardList.push(["player" + playerNum])
    }

    for (i = 0; i < startingHandNum; i++){
        randomIndex = Math.floor(Math.random() * currentIndex) // random set of numbers from 0 - current index
        console.log(randomIndex)
        var card = remainingCards[randomIndex];
        testPlayer.push(card)
        var index = remainingCards.indexOf(card)
        if (index > -1 ) {
            remainingCards.splice(index, 1);
        }
        currentIndex = remainingCards.length; 
    }

    console.log(testPlayer)
    console.log(remainingCards)

}

module.exports = {shuffle, setCards}