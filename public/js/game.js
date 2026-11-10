import { Shoe, CARD_BACK } from "./api.js";
import {
  RULES,
  handValue,
  isBlackjack,
  isBust,
  cardPoints,
  dealerShouldHit,
  canSplit,
  canDouble,
  settleHand,
} from "./rules.js";

const STARTING_BANKROLL = 1000;
const STORAGE_KEY = "blackjack.bankroll";
const DEALER_DELAY = 600;

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (n) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const shoe = new Shoe(RULES.decks);

const state = {
  phase: "betting", // betting | player | dealer | done
  busy: false,
  bankroll: loadBankroll(),
  bet: 0,
  lastBet: 0,
  dealer: [],
  holeHidden: true,
  hands: [], // { cards, bet, done, fromSplit, result }
  active: 0,
};

// ---------- persistence ----------

function loadBankroll() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : STARTING_BANKROLL;
  } catch {
    return STARTING_BANKROLL;
  }
}

function saveBankroll() {
  try {
    localStorage.setItem(STORAGE_KEY, String(state.bankroll));
  } catch {
    /* storage unavailable — bankroll just won't persist */
  }
}

// ---------- rendering ----------

function cardEl(card, faceDown = false) {
  const el = document.createElement("div");
  el.className = "card";
  const img = document.createElement("img");
  img.src = faceDown ? CARD_BACK : card.image;
  img.alt = faceDown ? "Face-down card" : `${card.value} of ${card.suit}`;
  img.onerror = () => {
    // Image host unreachable: fall back to a text card.
    el.classList.add("text-card");
    if (faceDown) {
      el.classList.add("back");
      el.textContent = "";
    } else {
      const red = card.suit === "HEARTS" || card.suit === "DIAMONDS";
      const sym = { HEARTS: "♥", DIAMONDS: "♦", CLUBS: "♣", SPADES: "♠" }[card.suit];
      const rank = card.code[0] === "0" ? "10" : card.code[0];
      el.classList.toggle("red", red);
      el.textContent = `${rank}${sym}`;
    }
  };
  el.appendChild(img);
  return el;
}

function totalLabel(cards) {
  if (!cards.length) return "";
  if (isBlackjack(cards)) return "Blackjack";
  const { total, soft } = handValue(cards);
  return soft && total < 21 ? `${total - 10} / ${total}` : String(total);
}

const RESULT_TEXT = {
  blackjack: "Blackjack!",
  win: "Win",
  push: "Push",
  lose: "Lose",
  bust: "Bust",
};

function render() {
  $("bankroll").textContent = money(state.bankroll);
  $("bet").textContent = money(state.bet);
  $("shoe").textContent = shoe.deckId ? `${shoe.remaining} cards` : "—";

  // Dealer
  const dealerCards = $("dealer-cards");
  dealerCards.replaceChildren(
    ...state.dealer.map((c, i) => cardEl(c, i === 1 && state.holeHidden))
  );
  $("dealer-total").textContent = state.holeHidden
    ? state.dealer.length
      ? String(cardPoints(state.dealer[0]))
      : ""
    : totalLabel(state.dealer);

  // Player hands
  const handsEl = $("player-hands");
  handsEl.replaceChildren(
    ...state.hands.map((hand, i) => {
      const el = document.createElement("div");
      el.className = "hand";
      if (state.phase === "player" && i === state.active) el.classList.add("active");
      if (hand.result) el.classList.add(`result-${hand.result}`);

      const head = document.createElement("h2");
      const label = state.hands.length > 1 ? `Hand ${i + 1}` : "You";
      head.innerHTML = `${label} <span class="total">${totalLabel(hand.cards)}</span>`;

      const cards = document.createElement("div");
      cards.className = "cards";
      cards.append(...hand.cards.map((c) => cardEl(c)));

      const foot = document.createElement("div");
      foot.className = "hand-foot";
      foot.textContent = hand.result
        ? `${RESULT_TEXT[hand.result]} · ${money(hand.bet)}`
        : `Bet ${money(hand.bet)}`;

      el.append(head, cards, foot);
      return el;
    })
  );

  // Controls
  const betting = state.phase === "betting" || state.phase === "done";
  const broke = betting && state.bankroll + state.bet < 5;
  $("betting").hidden = !betting || broke;
  $("actions").hidden = state.phase !== "player";
  $("broke").hidden = !broke;

  $("deal").disabled = state.busy || state.bet <= 0;
  $("clear-bet").disabled = state.busy || state.bet <= 0;
  document.querySelectorAll("[data-chip]").forEach((b) => {
    b.disabled = state.busy || Number(b.dataset.chip) > state.bankroll;
  });

  const hand = state.hands[state.active];
  const playing = state.phase === "player" && !state.busy && hand;
  $("hit").disabled = !playing;
  $("stand").disabled = !playing;
  $("double").disabled = !playing || !canDouble(hand, state.bankroll);
  $("split").disabled = !playing || !canSplit(hand, state.hands.length, state.bankroll);
}

function say(text) {
  $("message").textContent = text;
}

async function withBusy(fn) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    await fn();
  } catch (err) {
    console.error(err);
    say(err.message || "Something went wrong.");
  } finally {
    state.busy = false;
    render();
  }
}

// ---------- betting ----------

function startNewBetIfDone() {
  if (state.phase !== "done") return;
  state.phase = "betting";
  state.dealer = [];
  state.hands = [];
}

function addChip(value) {
  startNewBetIfDone();
  if (value > state.bankroll) return;
  state.bankroll -= value;
  state.bet += value;
  say("Place your bet, then deal.");
  render();
}

function clearBet() {
  state.bankroll += state.bet;
  state.bet = 0;
  render();
}

// ---------- round flow ----------

async function deal() {
  if (state.bet <= 0) return;
  await withBusy(async () => {
    if (!shoe.deckId || shoe.remaining < shoe.total * (1 - RULES.reshufflePenetration)) {
      say("Shuffling the shoe…");
      await shoe.shuffle();
    }

    const [p1, d1, p2, d2] = await shoe.draw(4);
    const bet = state.bet;
    state.bet = 0;
    state.lastBet = bet;
    saveBankroll();

    state.dealer = [d1, d2];
    state.holeHidden = true;
    state.hands = [{ cards: [p1, p2], bet, done: false, fromSplit: false, result: null }];
    state.active = 0;
    state.phase = "player";

    const playerBJ = isBlackjack(state.hands[0].cards);
    const dealerPeeks = cardPoints(d1) >= 10; // ace or ten showing
    const dealerBJ = dealerPeeks && isBlackjack(state.dealer);

    if (playerBJ || dealerBJ) {
      state.hands[0].done = true;
      finishRound();
      return;
    }
    say("Hit, stand, double or split?");
  });
}

async function hit() {
  await withBusy(async () => {
    const hand = state.hands[state.active];
    const [card] = await shoe.draw(1);
    hand.cards.push(card);
    if (isBust(hand.cards) || handValue(hand.cards).total === 21) {
      hand.done = true;
      await advance();
    }
  });
}

async function stand() {
  await withBusy(async () => {
    state.hands[state.active].done = true;
    await advance();
  });
}

async function doubleDown() {
  await withBusy(async () => {
    const hand = state.hands[state.active];
    if (!canDouble(hand, state.bankroll)) return;
    const [card] = await shoe.draw(1);
    state.bankroll -= hand.bet;
    hand.bet *= 2;
    hand.cards.push(card);
    hand.done = true;
    saveBankroll();
    await advance();
  });
}

async function split() {
  await withBusy(async () => {
    const hand = state.hands[state.active];
    if (!canSplit(hand, state.hands.length, state.bankroll)) return;
    const [a, b] = await shoe.draw(2);
    state.bankroll -= hand.bet;
    saveBankroll();

    const splittingAces = hand.cards[0].value === "ACE";
    const second = {
      cards: [hand.cards[1], b],
      bet: hand.bet,
      done: splittingAces,
      fromSplit: true,
      result: null,
    };
    hand.cards = [hand.cards[0], a];
    hand.fromSplit = true;
    hand.done = splittingAces; // split aces get one card each
    state.hands.splice(state.active + 1, 0, second);

    // A 21 after a split is auto-stood (it's not a blackjack).
    for (const h of state.hands) {
      if (handValue(h.cards).total === 21) h.done = true;
    }
    await advance();
  });
}

/** Move to the next unfinished hand, or let the dealer play. */
async function advance() {
  const next = state.hands.findIndex((h) => !h.done);
  if (next !== -1) {
    state.active = next;
    say(state.hands.length > 1 ? `Playing hand ${next + 1}.` : "Hit or stand?");
    return;
  }
  await dealerTurn();
}

async function dealerTurn() {
  state.phase = "dealer";
  state.holeHidden = false;
  render();

  const allBust = state.hands.every((h) => isBust(h.cards));
  if (!allBust) {
    say("Dealer plays…");
    while (dealerShouldHit(state.dealer)) {
      await sleep(DEALER_DELAY);
      const [card] = await shoe.draw(1);
      state.dealer.push(card);
      render();
    }
  }
  finishRound();
}

function finishRound() {
  state.holeHidden = false;
  let returned = 0;
  let staked = 0;
  for (const hand of state.hands) {
    const { result, payout } = settleHand(hand, state.dealer);
    hand.result = result;
    returned += payout;
    staked += hand.bet;
  }
  state.bankroll += returned;
  state.phase = "done";
  saveBankroll();

  const net = returned - staked;
  const dealerTotal = handValue(state.dealer).total;
  let text;
  if (isBlackjack(state.dealer) && state.hands.length === 1 && state.hands[0].result === "lose") {
    text = "Dealer has blackjack.";
  } else if (state.hands.length === 1) {
    text = {
      blackjack: "Blackjack! You win 3:2.",
      win: dealerTotal > 21 ? "Dealer busts — you win!" : "You win!",
      push: "Push. Your bet is returned.",
      lose: isBlackjack(state.dealer) ? "Dealer has blackjack." : "Dealer wins.",
      bust: "Bust! Dealer wins.",
    }[state.hands[0].result];
  } else {
    text = net > 0 ? "You came out ahead." : net < 0 ? "Dealer takes this round." : "Broke even.";
  }
  const netText = net > 0 ? ` (+${money(net)})` : net < 0 ? ` (−${money(-net)})` : "";

  // Re-offer the same bet for the next round if affordable.
  if (state.lastBet > 0 && state.lastBet <= state.bankroll) {
    state.bankroll -= state.lastBet;
    state.bet = state.lastBet;
    say(`${text}${netText} Deal again, or change your bet.`);
  } else {
    say(`${text}${netText}`);
  }
}

function resetBankroll() {
  state.bankroll = STARTING_BANKROLL;
  state.bet = 0;
  state.phase = "betting";
  state.dealer = [];
  state.hands = [];
  saveBankroll();
  say("Bankroll reset. Place your bet to begin.");
  render();
}

// ---------- wiring ----------

document.querySelectorAll("[data-chip]").forEach((b) =>
  b.addEventListener("click", () => addChip(Number(b.dataset.chip)))
);
$("clear-bet").addEventListener("click", () => {
  startNewBetIfDone();
  clearBet();
});
$("deal").addEventListener("click", deal);
$("hit").addEventListener("click", hit);
$("stand").addEventListener("click", stand);
$("double").addEventListener("click", doubleDown);
$("split").addEventListener("click", split);
$("reset").addEventListener("click", resetBankroll);

document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;
  // Don't steal keys while typing in a form or while a dialog is open.
  if (e.target.closest?.("input, textarea, select, dialog") || document.querySelector("dialog[open]")) return;
  const key = e.key.toLowerCase();
  const map = { h: "hit", s: "stand", d: "double", p: "split" };
  if (state.phase === "player" && map[key]) $(map[key]).click();
  else if ((key === "enter" || key === " ") && !$("deal").disabled && !$("betting").hidden) {
    e.preventDefault();
    $("deal").click();
  }
});

render();
