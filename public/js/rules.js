// Pure blackjack rules — no DOM, no network. Easy to unit test.

export const RULES = {
  decks: 6,
  reshufflePenetration: 0.75, // reshuffle once 75% of the shoe has been dealt
  blackjackPayout: 1.5,       // 3:2
  dealerHitsSoft17: false,    // dealer stands on all 17s
  maxHands: 4,                // up to 3 splits
};

/** Blackjack point value of a single card from the Deck of Cards API. */
export function cardPoints(card) {
  switch (card.value) {
    case "ACE":
      return 11;
    case "KING":
    case "QUEEN":
    case "JACK":
      return 10;
    default:
      return Number(card.value);
  }
}

/**
 * Best total for a hand. Aces count as 11 unless that would bust.
 * Returns { total, soft } where soft means an ace is still counted as 11.
 */
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardPoints(card);
    if (card.value === "ACE") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards) {
  return handValue(cards).total > 21;
}

export function dealerShouldHit(cards, hitsSoft17 = RULES.dealerHitsSoft17) {
  const { total, soft } = handValue(cards);
  if (total < 17) return true;
  return total === 17 && soft && hitsSoft17;
}

export function canSplit(hand, handCount, bankroll) {
  return (
    hand.cards.length === 2 &&
    cardPoints(hand.cards[0]) === cardPoints(hand.cards[1]) &&
    handCount < RULES.maxHands &&
    bankroll >= hand.bet
  );
}

export function canDouble(hand, bankroll) {
  return hand.cards.length === 2 && bankroll >= hand.bet;
}

/**
 * Outcome of one player hand against the dealer.
 * A two-card 21 counts as blackjack only on a hand that didn't come from a split.
 * Returns { result, payout } where payout is the total returned to the
 * player (stake included); 0 means the stake is lost.
 */
export function settleHand({ cards, bet, fromSplit = false }, dealerCards) {
  const natural = !fromSplit && isBlackjack(cards);
  const player = handValue(cards).total;
  const dealer = handValue(dealerCards).total;
  const dealerNatural = isBlackjack(dealerCards);

  if (player > 21) return { result: "bust", payout: 0 };
  if (natural && dealerNatural) return { result: "push", payout: bet };
  if (natural) return { result: "blackjack", payout: bet + bet * RULES.blackjackPayout };
  if (dealerNatural) return { result: "lose", payout: 0 };
  if (dealer > 21) return { result: "win", payout: bet * 2 };
  if (player > dealer) return { result: "win", payout: bet * 2 };
  if (player === dealer) return { result: "push", payout: bet };
  return { result: "lose", payout: 0 };
}
