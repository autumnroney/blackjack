import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handValue,
  isBlackjack,
  dealerShouldHit,
  canSplit,
  settleHand,
} from "../public/js/rules.js";

const c = (value) => ({ value });

test("hand values count aces as 11 or 1", () => {
  assert.deepEqual(handValue([c("ACE"), c("6")]), { total: 17, soft: true });
  assert.deepEqual(handValue([c("ACE"), c("6"), c("KING")]), { total: 17, soft: false });
  assert.deepEqual(handValue([c("ACE"), c("ACE"), c("9")]), { total: 21, soft: true });
  assert.equal(handValue([c("KING"), c("QUEEN"), c("2")]).total, 22);
});

test("blackjack is a two-card 21 only", () => {
  assert.ok(isBlackjack([c("ACE"), c("JACK")]));
  assert.ok(!isBlackjack([c("7"), c("7"), c("7")]));
});

test("dealer stands on all 17s by default", () => {
  assert.ok(dealerShouldHit([c("10"), c("6")]));
  assert.ok(!dealerShouldHit([c("ACE"), c("6")]));
  assert.ok(dealerShouldHit([c("ACE"), c("6")], true));
  assert.ok(!dealerShouldHit([c("10"), c("7")]));
});

test("split needs matching values, a hand slot and money", () => {
  const hand = { cards: [c("KING"), c("10")], bet: 10 };
  assert.ok(canSplit(hand, 1, 10));
  assert.ok(!canSplit(hand, 1, 5));
  assert.ok(!canSplit(hand, 4, 100));
  assert.ok(!canSplit({ cards: [c("9"), c("10")], bet: 10 }, 1, 100));
});

test("settlement payouts", () => {
  const dealer20 = [c("KING"), c("QUEEN")];
  const dealerBJ = [c("ACE"), c("KING")];
  const bust = [c("10"), c("6"), c("9")];

  assert.deepEqual(settleHand({ cards: [c("ACE"), c("KING")], bet: 10 }, dealer20), { result: "blackjack", payout: 25 });
  assert.deepEqual(settleHand({ cards: [c("ACE"), c("KING")], bet: 10 }, dealerBJ), { result: "push", payout: 10 });
  assert.deepEqual(settleHand({ cards: [c("ACE"), c("KING")], bet: 10, fromSplit: true }, dealer20), { result: "win", payout: 20 });
  assert.deepEqual(settleHand({ cards: [c("10"), c("QUEEN")], bet: 10 }, dealerBJ), { result: "lose", payout: 0 });
  assert.deepEqual(settleHand({ cards: [c("10"), c("QUEEN")], bet: 10 }, dealer20), { result: "push", payout: 10 });
  assert.deepEqual(settleHand({ cards: [c("10"), c("8")], bet: 10 }, bust), { result: "win", payout: 20 });
  assert.deepEqual(settleHand({ cards: bust, bet: 10 }, bust), { result: "bust", payout: 0 });
  // An unsplit 17 is not a blackjack.
  assert.deepEqual(settleHand({ cards: [c("10"), c("7")], bet: 10 }, [c("9"), c("8")]), { result: "push", payout: 10 });
  assert.deepEqual(settleHand({ cards: [c("5"), c("6"), c("KING")], bet: 10 }, dealer20), { result: "win", payout: 20 });
});
