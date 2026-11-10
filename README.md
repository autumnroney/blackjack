# Blackjack

Blackjack in the browser. Cards are dealt from a six-deck shoe by the free
[Deck of Cards API](https://deckofcardsapi.com/). It's plain HTML, CSS and
JavaScript, with no framework and no build step.

## Rules

- 6 decks, reshuffled once about 75% of the shoe has been dealt
- Dealer stands on all 17s and peeks for blackjack when showing an ace or a ten
- Blackjack pays 3:2
- Double on any first two cards
- Split matching pairs up to 4 hands; split aces get one card each
- Bankroll starts at $1,000 and is saved in your browser (localStorage)

Keyboard: **H** hit · **S** stand · **D** double · **P** split · **Enter** deal

## How the API is used

| Call | When |
| --- | --- |
| `GET /api/deck/new/shuffle/?deck_count=6` | First deal: creates the shoe and returns a `deck_id` |
| `GET /api/deck/{deck_id}/draw/?count=N` | Initial 4 cards, every hit, double, split and dealer card |
| `GET /api/deck/{deck_id}/shuffle/` | Puts every card back in the shoe and reshuffles at the cut card |
| `https://deckofcardsapi.com/static/img/back.png` | Dealer's face-down card |

The API's piles don't work with multi-deck shoes, so the game tracks hands
itself.

## Project layout

```
public/            ← everything Netlify serves
  index.html
  css/styles.css
  js/api.js        Deck of Cards API wrapper (Shoe class)
  js/rules.js      pure blackjack rules (hand values, payouts)
  js/game.js       game state, UI and controls
tests/rules.test.js
netlify.toml       publish = "public", no build command
```

## Run locally

ES modules need to be served over HTTP, so opening the file directly won't work:

```bash
npm start          # serves public/ at http://localhost:3000
```

(or `python3 -m http.server -d public 8000`)

Run the rule tests (Node 18+):

```bash
npm test
```

## Deploy to Netlify

`netlify.toml` already sets the publish directory to `public` with no build
command, so either of these works:

- **Connect the repo**: Netlify → Add new site → Import from GitHub → pick
  this repo and the `main` branch. The settings come from `netlify.toml`.
- **Manual drag-and-drop**: drag the `public/` folder onto
  https://app.netlify.com/drop.
