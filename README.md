# Banana Quest — React website

An animated jungle arcade game built with React 19 and TypeScript, converted from the Banana Quest desktop game, with a Vinext/Vite server and Cloudflare D1 account storage.

## Run locally

Requires Node.js 22.13 or later. Dependencies are already installed in this checkout.

Double-click `start-website.bat`, then open http://127.0.0.1:5173.
Or run `npm run dev -- --port 5173` from this folder.

For a fresh checkout:
1. Run `npm ci`.
2. Run `npm run build`.
3. Apply each SQL migration in `drizzle/` once, in filename order:
   `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fixed_captain_britain.sql`
   Then apply `drizzle/0001_fat_the_renegades.sql` with the same command, substituting that filename. Existing checkouts must only apply new, unapplied migrations.
4. Run `npm run dev -- --port 5173`.

## Features

- Minimal game screens: video/title/Start on the intro, concise forms and game controls, and rules shown only on demand.
- Persistent coins: 10 per correct answer, stage-clear bonuses of 25/50/75, and a 100-coin victory bonus. Animated coin collection updates the wallet immediately.
- Score and coin leaderboard tabs with stable ranking, highlighted current player and a pinned own rank outside the top ten.
- Optimistic session revisions and an atomic reward ledger protect balances from duplicate or concurrent claims.

- Cartoon jungle world with a monkey guide, fireflies, drifting leaves, dimensional wooden panels and gold arcade controls.
- Word-free monkey stage selector with animated faces, number badges, stars and locks. Available monkey buttons start or resume the correct stage; clearing a stage unlocks the next button. The menu also includes the score HUD and leaderboard.
- Correct-answer points bursts/confetti, wrong-answer board shake, urgent timer animation, optional synthesized sound effects and reduced-motion styling.

- Full-viewport monkeys-and-bananas MP4 intro, looping with a poster, sound toggle, pause and fullscreen controls. Browsers autoplay it muted; enable sound with the sound button.
- Separate registration and login screens. Register a 3–20 character username and a password with at least six characters, one letter and one number.
- Server-side PBKDF2 password hashing, HttpOnly session cookies, account lockout and origin checks.
- Registered-user-only gameplay and a saved session that resumes after refresh.
- Banana API: https://marcconrad.com/uob/banana/api.php?out=json. Puzzle images load server-side before the timer begins. Offline SVG banana puzzles cover API or image failures.
- Three stages: 3 puzzles/45 seconds, 5 puzzles/30 seconds, 7 puzzles/18 seconds. Stages 2 and 3 award streak bonuses. Stage 3 deducts 25 points per wrong answer and ends at three strikes; timeout ends the adventure.
- Server-authoritative timing, answers and scores; a leaderboard and saved personal bests.
- Responsive desktop and mobile layouts, keyboard answers, visible focus styles and reduced-motion CSS.

The website uses its own account database. Desktop account files remain unchanged and are not uploaded. Local preview and hosted databases are also separate. Register in the environment you want to play in.

## Check

- `npx tsc --noEmit`
- `npm run build`
- Start the local preview, then `node scripts/game-browser-test.mjs`. The test uses Chrome at its standard Windows install path and creates isolated test accounts in the local database. Screenshots are written to ignored `outputs/`.

- `node scripts/coin-rewards-test.mjs`: checks exact rewards, duplicate/concurrent completion protection, leaderboard ordering and persisted balances. It uses a temporary local test account and removes it afterward.

## Source map

- `app/page.tsx`: React screens and gameplay UI.
- `app/globals.css`: responsive jungle arcade styling, dimensional controls and animations.
- `public/jungle-world.png` and `public/monkey-guide.png`: original generated game artwork.
- `app/api/[action]/route.ts`: accounts, sessions, Banana API, game rules and scores.
- `db/schema.ts` and `drizzle/`: account/session schema and migration.
- `public/intro.mp4`: your uploaded monkeys-and-bananas video.
- `.openai/hosting.json`: private Sites identity and D1 binding.

The original Java desktop application remains in `../Game`.