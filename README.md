# Board Bank

An automatic banker for property-trading board games. Keep playing on your
physical board with pawns, deeds, cards and houses — the app rolls the dice,
tells you where to move, and settles every payment with a plain-English
explanation. No one has to be the banker.

## What it does

- **Rolls the dice** (or lets you enter a physical roll) and says which space to move to.
- **Settles money automatically**: GO salary, rent (colour sets, houses, hotels,
  stations, utilities), taxes, jail fines and card effects.
- **Asks only when it must**: buy / auction / skip, which card you drew, jail choices.
- **Properties screen** to build or sell houses (even-building and bank stock
  enforced) and to mortgage or unmortgage.
- **Trades** between players: properties, cash and get-out-of-jail cards.
- **Ledger** of every transaction with the reason, filterable by player.
- **Undo** and a **Fix a mistake** screen for when the table and the app disagree.
- **Debt and bankruptcy**: a player who can't pay must raise cash or declare
  bankruptcy; assets go to the creditor.

## Bank-only mode

Pick **Bank only** at the top of the setup screen when you want to play the
board game yourselves and only need someone to look after the money.

- Setup is all taps: names are optional, and starting cash and the "Pass GO" amount are chips.
- To move money, **tap who pays, then tap who gets paid**. That covers player → player,
  player → bank and bank → player. The bank has unlimited money.
- **Everyone** is a tile too: "Everyone → Ana" collects from each other player,
  "Ana → Everyone" pays each other player, and "Bank → Everyone" pays every player.
  Each of these is one payment, so one undo reverses it.
- After each payment the tiles show what changed (+$250 / −$250) for a moment.
- Enter the amount by tapping notes (+1, +5, +10, +20, +50, +100, +500), by picking a
  recent amount, or on the built-in keypad (the app remembers which you prefer).
  The phone keyboard never opens.
- Each player tile has a one-tap **GO +$200** button.
- **Undo** the last payment from the main screen, or remove any payment from **History**.
  Balances are worked out from the list of payments, so removing one fixes both balances.

## Admin

Configure the board you own. Starts from a classic-style default board with
generic names. Rename the spaces to match yours.

- **Spaces**: name, type, colour set, price, rent table, house cost, mortgage value.
- **Cards**: number each physical card and enter what it does, so picking the
  drawn card in the game is one tap.
- **Sets** and **Rules**: starting cash, GO salary, jail fine, house/hotel limits,
  auctions, Free Parking jackpot, mortgage interest.
- Import / export boards as JSON to back them up or share them.

Everything is stored in your browser (localStorage). There is no server or login.

## Development

```bash
npm install
npm run dev      # start a dev server
npm test         # engine tests
npm run build    # production build into dist/
```

The built `dist/` folder is static and works from any host or subfolder.

### Layout

- `src/engine/game.ts`: game rules as pure functions (state in, new state out)
- `src/engine/validate.ts`: board setup checks shown in Admin
- `src/data/classic.ts`: the default board and card decks
- `src/screens/`: Setup, Game, Ledger, Properties, Trade, Fix, Admin, Bank (bank-only mode)
- `src/bank/`: bank-only mode: transfers engine and its storage
- `src/storage.ts`: localStorage persistence and JSON import/export

## Deployment

Hosted on Cloudflare Pages (project `bank-manager`), connected to this GitHub repo:
**https://bank-manager.pages.dev**

Cloudflare builds and deploys every push on its own, with no GitHub Actions or secrets:

- `main` deploys to production.
- Every other branch gets a preview at `https://<branch>.bank-manager.pages.dev`.
- Build command: `npm test && npm run build`. Output: `dist`. Node: `NODE_VERSION=22`.
  A push whose tests fail is not deployed.
