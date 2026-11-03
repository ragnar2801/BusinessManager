// ---------- Board configuration (edited in Admin) ----------

export type SpaceType =
  | 'go'
  | 'property'
  | 'station'
  | 'utility'
  | 'tax'
  | 'card'
  | 'jail'
  | 'freeParking'
  | 'goToJail';

export type DeckId = 'chance' | 'chest';

export interface ColorGroup {
  id: string;
  name: string;
  color: string; // hex
}

export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  /** property: colour group id */
  group?: string;
  /** ownable spaces */
  price?: number;
  mortgage?: number;
  /**
   * property: [base, 1 house, 2, 3, 4, hotel]
   * station: rent by number of stations owned [1, 2, 3, 4]
   * utility: dice multiplier by number of utilities owned [1, 2]
   */
  rents?: number[];
  /** property: cost of one house (hotel costs the same) */
  houseCost?: number;
  /** tax: amount to pay */
  amount?: number;
  /** card: which deck */
  deck?: DeckId;
}

export type CardAction =
  | 'collect' // collect amount from bank
  | 'pay' // pay amount to bank
  | 'moveTo' // move to target space
  | 'moveBy' // move steps (may be negative)
  | 'nearest' // move to nearest station / utility
  | 'repairs' // pay perHouse / perHotel
  | 'payEach' // pay amount to every other player
  | 'collectEach' // collect amount from every other player
  | 'jail' // go to jail
  | 'jailFree'; // keep: get out of jail free

export interface Card {
  id: string;
  /** number written on the physical card, for quick picking */
  no: number;
  text: string;
  action: CardAction;
  amount?: number;
  /** moveTo: space index */
  target?: number;
  /** moveTo / nearest: collect GO salary if passing GO (default true) */
  collectGo?: boolean;
  /** moveBy */
  steps?: number;
  /** nearest */
  nearest?: 'station' | 'utility';
  /** nearest: station → rent × multiplier; utility → dice × multiplier */
  multiplier?: number;
  /** repairs */
  perHouse?: number;
  perHotel?: number;
}

export interface Rules {
  startingCash: number;
  goSalary: number;
  jailFine: number;
  /** turns a player may try to roll doubles before paying */
  maxJailTurns: number;
  /** total houses / hotels the bank owns */
  houses: number;
  hotels: number;
  /** unimproved full colour set doubles base rent */
  doubleRentOnSet: boolean;
  auctions: boolean;
  /** taxes and fines go into a Free Parking jackpot */
  freeParkingJackpot: boolean;
  /** mortgage interest, percent, paid when unmortgaging */
  mortgageInterest: number;
}

export interface Board {
  id: string;
  name: string;
  groups: ColorGroup[];
  spaces: Space[];
  decks: Record<DeckId, Card[]>;
  deckNames: Record<DeckId, string>;
  rules: Rules;
  updatedAt: number;
}

// ---------- Game state ----------

export interface Player {
  id: string;
  name: string;
  color: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  /** ids of get-out-of-jail cards held */
  jailCards: { deck: DeckId; cardId: string }[];
  bankrupt: boolean;
}

export interface Ownership {
  owner: string; // player id
  /** 0-4 houses, 5 = hotel */
  houses: number;
  mortgaged: boolean;
}

export type LedgerKind = 'rent' | 'buy' | 'tax' | 'card' | 'go' | 'build' | 'mortgage' | 'jail' | 'trade' | 'auction' | 'jackpot' | 'fix' | 'bankrupt';

export interface LedgerEntry {
  id: string;
  turn: number;
  /** player id, or 'bank' */
  from: string;
  to: string;
  amount: number;
  kind: LedgerKind;
  reason: string;
  time: number;
}

export type Phase =
  | { kind: 'roll' }
  | { kind: 'buy'; space: number }
  | { kind: 'card'; deck: DeckId }
  | { kind: 'end' }
  | { kind: 'over'; winner: string };

/** One line shown in the turn result ("what just happened") */
export interface TurnEvent {
  text: string;
  /** signed amount for the current player, if money moved */
  amount?: number;
  /** true when this line is a money movement */
  money?: boolean;
}

/** Context carried while a card resolves (e.g. "nearest station pays 2×") */
export interface PendingRent {
  multiplier?: number;
  utilityDice?: boolean;
}

export interface GameState {
  id: string;
  board: Board; // snapshot, so admin edits don't change a running game
  players: Player[];
  current: number; // index into players
  turn: number;
  owned: Record<number, Ownership>;
  ledger: LedgerEntry[];
  jackpot: number;
  phase: Phase;
  dice: [number, number] | null;
  doublesCount: number;
  /** current player may roll again (rolled doubles) */
  rollAgain: boolean;
  events: TurnEvent[];
  pendingRent: PendingRent | null;
  /** 'app' rolls the dice; 'manual' lets players enter a physical roll */
  diceMode: 'app' | 'manual';
  createdAt: number;
  updatedAt: number;
}
