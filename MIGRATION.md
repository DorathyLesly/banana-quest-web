# Jungle Digits: Java to React migration

The browser application uses React 19, TypeScript, Vinext/Vite and a
Cloudflare Worker-compatible server with D1 storage. No Java classes or JVM
are loaded by this version. React handles presentation and events; server
TypeScript handles credentials, sessions, puzzle solutions and scoring.

## Responsibility mapping

| Java source | Web implementation |
| --- | --- |
| Main.java | app/layout.tsx, app/page.tsx and worker/index.ts |
| IntroGUI.java | Intro screen in app/page.tsx and public/intro.mp4 |
| LoginGUI.java | React login/registration forms in app/page.tsx |
| MainMenuGUI.java | React menu, stage selection and leaderboard |
| GameGUI.java | React puzzle screen, countdown, keypad and results |
| GameButton.java, ModernButton.java | HTML buttons with React event handlers and CSS |
| Theme.java, ThemedBackgroundPanel.java, RoundedCard.java, PuzzleBoardPlaque.java | app/globals.css and semantic JSX containers |
| BananaArt.java, CharacterCompanionDialog.java | public artwork, monkey guide, rules modal and CSS animations |
| GameEngine.java | start, continue and answer handlers in app/api/[action]/route.ts |
| GameEventListener.java | React onClick/onSubmit, keyboard listeners, effects and asynchronous responses |
| LevelConfig.java | Shared LEVELS in lib/game.ts, used by browser and server |
| Puzzle.java, UserSession.java, LevelSummary.java, GameOverReason.java | TypeScript game/identity data, server session records and result states |
| BananaApiClient.java | Server-side HTTPS fetch and response validation in app/api/[action]/route.ts |
| FallbackPuzzleGenerator.java | Server-generated SVG fallback puzzles |
| AuthService.java, PasswordUtils.java | Server-side PBKDF2, account routes, cookies and D1 queries |
| Java authentication, intro and integration tests | scripts/game-browser-test.mjs and scripts/coin-rewards-test.mjs |
| BananaAssetBuilder.java | SVG generation and static public assets; no Java asset build required |

## Preserved gameplay

Three stages require 3, 5 and 7 puzzles, with 45, 30 and 18 seconds per
puzzle. Higher stages award streak bonuses. Stage 3 penalizes incorrect
answers and ends after three strikes. Timeouts end the run. The game
includes registration, login, saved best scores, keyboard input, an
animated intro, a monkey guide, feedback, rules and a leaderboard.
The browser version also includes persistent coins and reward protection.

The removed player summary bar stays removed. Best score appears in
the navigation bar beside the coin wallet.

## Intentional browser differences

- Passwords use salted PBKDF2-SHA-256 with 100,000 iterations.
- Random login tokens use HttpOnly, SameSite cookies and server-side
  hashed-token records, rather than Java session objects.
- Accounts live in D1; desktop users.dat credentials are not imported.
- The server is authoritative for scores, deadlines and solutions.
- The browser sends answers immediately on a digit click/key press.
- SVG puzzles are generated when the external API fails; the server
  must still be running. This is not a fully offline browser application.
- Java paint routines and Swing listeners are replaced by React, CSS
  and browser APIs, rather than being translated line by line.
- Browser stage summaries do not reproduce every Java statistics field.
- The Java disk puzzle cache is replaced by generated fallback puzzles.

## Assignment evidence and acknowledgements

This migration and related interface changes were implemented with
OpenAI Codex assistance in this conversation. AI-assisted code must not
be represented as independently authored work. Add your own contribution
record and any additional sources used before submission.

External puzzle service: Marc Conrad's Banana API,
https://marcconrad.com/uob/banana/api.php?out=json.

The project uses the OpenAI Sites/Vinext starter and the libraries
declared in package.json, including React, Vinext, Vite, Lucide React,
Cloudflare tooling and Drizzle. Preserve supplied license notices.

The jungle and monkey artwork is described as generated artwork in
README.md. The intro video was supplied with the original project;
its original creator/license is not established here and should be
documented by the submitter.

Use Git diffs as version-control evidence. Demonstrate the running
browser game and explain browser-specific code in the video.