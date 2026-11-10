// Thin wrapper around https://deckofcardsapi.com/

const BASE = "https://deckofcardsapi.com/api/deck";
export const CARD_BACK = "https://deckofcardsapi.com/static/img/back.png";

async function request(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Couldn't reach the card dealer. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(`Deck of Cards API error (${res.status}).`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Deck of Cards API request failed.");
  return data;
}

export class Shoe {
  constructor(deckCount) {
    this.deckCount = deckCount;
    this.deckId = null;
    this.remaining = 0;
  }

  get total() {
    return this.deckCount * 52;
  }

  /** Create a new shoe, or put every card back and reshuffle the existing one. */
  async shuffle() {
    let data;
    if (this.deckId) {
      try {
        data = await request(`${BASE}/${this.deckId}/shuffle/`);
      } catch {
        data = null; // deck expired or vanished — fall through to a fresh one
      }
    }
    data ??= await request(`${BASE}/new/shuffle/?deck_count=${this.deckCount}`);
    this.deckId = data.deck_id;
    this.remaining = data.remaining;
  }

  async draw(count = 1) {
    if (!this.deckId) await this.shuffle();
    const data = await request(`${BASE}/${this.deckId}/draw/?count=${count}`);
    this.remaining = data.remaining;
    if (data.cards.length < count) throw new Error("The shoe ran out of cards.");
    return data.cards;
  }
}
