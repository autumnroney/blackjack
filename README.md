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

## Google sign-in (Supabase)

Players can sign in with Google through Supabase Auth. Once signed in, the
header shows their Google profile picture and name, with a greeting. Signing in
is optional: guests can still play.

- `public/js/auth.js` holds the Supabase project URL and **publishable** key.
  That key is meant to be public, so it's fine in browser code. Never put the
  `service_role`/secret key in this repo.
- supabase-js is loaded from jsDelivr (pinned version). If it fails to load,
  only sign-in is disabled; the game keeps working.

Supabase dashboard settings this relies on:

1. **Authentication → Sign In / Providers → Google** enabled with your Google
   OAuth client ID and secret. In Google Cloud, the OAuth client's authorized
   redirect URI is `https://ymomfylsgfkipdnohzgp.supabase.co/auth/v1/callback`.
2. **Authentication → URL Configuration → Redirect URLs**: add
   `https://blackjack57.netlify.app/**` (plus `http://localhost:3000/**` for
   local testing). Without it, Supabase sends users back to the Site URL
   instead of the blackjack page. This project is shared with Basketwise, so
   leave the **Site URL** set to Basketwise; adding a redirect URL is enough.

## Player profiles

Signed-in players can create a profile: a username (unique, 3–20 lowercase
letters, numbers or underscores), a display name, a short bio, and the choice of
showing their Google photo. The first time someone signs in, the profile form
opens on its own. After that, clicking their avatar in the header opens it.

Profiles live in the `public.blackjack_profiles` table. This Supabase project
is shared with Basketwise, which has its own `public.profiles` table, so the
blackjack table is kept separate and doesn't touch it. Row-level security lets
each player read, create, edit and delete only their own row; logged-out
visitors can't read the table at all. The SQL is in
`supabase/migrations/20261110035600_create_blackjack_profiles.sql` (already
applied).

## Project layout

```
public/            ← everything Netlify serves
  index.html
  css/styles.css
  js/api.js        Deck of Cards API wrapper (Shoe class)
  js/rules.js      pure blackjack rules (hand values, payouts)
  js/game.js       game state, UI and controls
  js/auth.js       Google sign-in via Supabase, greeting, profile form
tests/rules.test.js
supabase/migrations/   SQL for the blackjack_profiles table
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
