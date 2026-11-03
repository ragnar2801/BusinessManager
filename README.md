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
- `src/screens/`: Setup, Game, Ledger, Properties, Trade, Fix, Admin
- `src/storage.ts`: localStorage persistence and JSON import/export

## Deployment

`.github/workflows/deploy.yml` builds and tests every push and publishes the
default branch to GitHub Pages. One-time setup in the repository:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
The app is then served at `https://<owner>.github.io/<repo>/`.
