import type { Board, Card, DeckId, GameState, LedgerKind, Ownership, PendingRent, Player, Space } from '../types';
import { clone, money, rollDie, uid } from './util';

/** Thrown for actions the rules don't allow; the message is shown to players. */
export class RuleError extends Error {}

const fail = (msg: string): never => {
  throw new RuleError(msg);
};

export const BANK = 'bank';
export const JACKPOT = 'jackpot';

// ---------- setup ----------

export function newGame(
  board: Board,
  players: { name: string; color: string }[],
  diceMode: 'app' | 'manual' = 'app',
): GameState {
  if (players.length < 2) fail('Add at least 2 players.');
  const now = Date.now();
  return {
    id: uid('g'),
    board: clone(board),
    players: players.map<Player>((p) => ({
      id: uid('p'),
      name: p.name.trim() || 'Player',
      color: p.color,
      cash: board.rules.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: [],
      bankrupt: false,
    })),
    current: 0,
    turn: 1,
    owned: {},
    ledger: [],
    jackpot: 0,
    phase: { kind: 'roll' },
    dice: null,
    doublesCount: 0,
    rollAgain: false,
    events: [],
    pendingRent: null,
    diceMode,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- lookups ----------

export const currentPlayer = (s: GameState): Player => s.players[s.current];

export function player(s: GameState, id: string): Player {
  return s.players.find((p) => p.id === id) ?? fail('Unknown player');
}

export function nameOf(s: GameState, id: string): string {
  if (id === BANK) return 'Bank';
  if (id === JACKPOT) return 'Jackpot';
  return s.players.find((p) => p.id === id)?.name ?? '?';
}

export const isOwnable = (sp: Space) => sp.type === 'property' || sp.type === 'station' || sp.type === 'utility';

export function groupName(b: Board, groupId?: string): string {
  return b.groups.find((g) => g.id === groupId)?.name ?? '';
}

export function groupSpaces(b: Board, groupId: string): number[] {
  const out: number[] = [];
  b.spaces.forEach((sp, i) => {
    if (sp.type === 'property' && sp.group === groupId) out.push(i);
  });
  return out;
}

export function ownsGroup(s: GameState, ownerId: string, groupId: string): boolean {
  const idx = groupSpaces(s.board, groupId);
  return idx.length > 0 && idx.every((i) => s.owned[i]?.owner === ownerId);
}

export function countOwnedOfType(s: GameState, ownerId: string, type: Space['type']): number {
  return s.board.spaces.filter((sp, i) => sp.type === type && s.owned[i]?.owner === ownerId).length;
}

export function housesLeft(s: GameState): number {
  const used = Object.values(s.owned).reduce((n, o) => n + (o.houses > 0 && o.houses < 5 ? o.houses : 0), 0);
  return s.board.rules.houses - used;
}

export function hotelsLeft(s: GameState): number {
  const used = Object.values(s.owned).filter((o) => o.houses === 5).length;
  return s.board.rules.hotels - used;
}

export function houseLabel(h: number): string {
  if (h === 5) return 'hotel';
  if (h === 0) return 'no houses';
  return `${h} house${h > 1 ? 's' : ''}`;
}

export function propertiesOf(s: GameState, ownerId: string): number[] {
  return Object.entries(s.owned)
    .filter(([, o]) => o.owner === ownerId)
    .map(([i]) => Number(i))
    .sort((a, b) => a - b);
}

export function heldCardIds(s: GameState, deck: DeckId): Set<string> {
  const held = new Set<string>();
  s.players.forEach((p) => p.jailCards.forEach((c) => c.deck === deck && held.add(c.cardId)));
  return held;
}

export const activePlayers = (s: GameState) => s.players.filter((p) => !p.bankrupt);

export function playersInDebt(s: GameState): Player[] {
  return s.players.filter((p) => !p.bankrupt && p.cash < 0);
}

/** Net worth: cash + property value (mortgage value if mortgaged) + buildings at cost. */
export function netWorth(s: GameState, ownerId: string): number {
  const p = player(s, ownerId);
  return propertiesOf(s, ownerId).reduce((sum, i) => {
    const sp = s.board.spaces[i];
    const o = s.owned[i];
    const base = o.mortgaged ? 0 : (sp.mortgage ?? 0);
    return sum + base + o.houses * (sp.houseCost ?? 0);
  }, p.cash);
}

// ---------- money ----------

interface TransferOpts {
  /** show in the current turn's result panel (default true) */
  event?: boolean;
}

function transfer(s: GameState, from: string, to: string, amount: number, kind: LedgerKind, reason: string, opts: TransferOpts = {}) {
  if (amount <= 0) return;
  // Taxes and fines feed the jackpot when the house rule is on.
  if (to === BANK && s.board.rules.freeParkingJackpot && (kind === 'tax' || kind === 'card' || kind === 'jail')) {
    to = JACKPOT;
  }
  if (from === JACKPOT) s.jackpot -= amount;
  else if (from !== BANK) player(s, from).cash -= amount;
  if (to === JACKPOT) s.jackpot += amount;
  else if (to !== BANK) player(s, to).cash += amount;

  s.ledger.push({ id: uid('l'), turn: s.turn, from, to, amount, kind, reason, time: Date.now() });

  if (opts.event !== false) {
    const me = currentPlayer(s).id;
    const signed = to === me ? amount : from === me ? -amount : undefined;
    const arrow = from === me ? `→ ${nameOf(s, to)}` : to === me ? `← ${nameOf(s, from)}` : `${nameOf(s, from)} → ${nameOf(s, to)}`;
    s.events.push({ text: `${arrow} · ${reason}`, amount: signed, money: true });
  }
}

function note(s: GameState, text: string) {
  s.events.push({ text });
}

function log(s: GameState, kind: LedgerKind, reason: string, from = BANK, to = BANK) {
  s.ledger.push({ id: uid('l'), turn: s.turn, from, to, amount: 0, kind, reason, time: Date.now() });
}

// ---------- rent ----------

export interface Rent {
  amount: number;
  why: string;
}

export function rentFor(s: GameState, idx: number, pending: PendingRent | null = null): Rent {
  const sp = s.board.spaces[idx];
  const o = s.owned[idx];
  if (!o || o.mortgaged) return { amount: 0, why: 'mortgaged' };
  const rents = sp.rents ?? [];
  if (sp.type === 'property') {
    if (o.houses > 0) {
      return { amount: rents[o.houses] ?? 0, why: `${sp.name}, ${houseLabel(o.houses)}` };
    }
    const full = s.board.rules.doubleRentOnSet && sp.group && ownsGroup(s, o.owner, sp.group);
    const base = rents[0] ?? 0;
    return full
      ? { amount: base * 2, why: `${sp.name}, full ${groupName(s.board, sp.group)} set (2× ${money(base)})` }
      : { amount: base, why: `${sp.name}` };
  }
  if (sp.type === 'station') {
    const count = countOwnedOfType(s, o.owner, 'station');
    const base = rents[Math.min(count, rents.length) - 1] ?? 0;
    const mult = pending?.multiplier ?? 1;
    const ownedTxt = `${nameOf(s, o.owner)} owns ${count}`;
    return mult > 1
      ? { amount: base * mult, why: `${sp.name}, ${ownedTxt} (${mult}× ${money(base)})` }
      : { amount: base, why: `${sp.name}, ${ownedTxt}` };
  }
  if (sp.type === 'utility') {
    const total = s.dice ? s.dice[0] + s.dice[1] : 0;
    const count = countOwnedOfType(s, o.owner, 'utility');
    const mult = pending?.utilityDice && pending.multiplier ? pending.multiplier : (rents[Math.min(count, rents.length) - 1] ?? 0);
    return { amount: total * mult, why: `${sp.name}, dice ${total} × ${mult}` };
  }
  return { amount: 0, why: '' };
}

// ---------- movement ----------

function collectGo(s: GameState, how: string) {
  const p = currentPlayer(s);
  transfer(s, BANK, p.id, s.board.rules.goSalary, 'go', how);
}

function sendToJail(s: GameState, why: string) {
  const p = currentPlayer(s);
  p.position = s.board.spaces.findIndex((sp) => sp.type === 'jail');
  if (p.position < 0) p.position = 0;
  p.inJail = true;
  p.jailTurns = 0;
  s.rollAgain = false;
  s.doublesCount = 0;
  note(s, `${why} — move pawn to Jail`);
  log(s, 'jail', `${p.name}: ${why}`);
  s.phase = { kind: 'end' };
}

function moveForward(s: GameState, steps: number) {
  const p = currentPlayer(s);
  const len = s.board.spaces.length;
  const raw = p.position + steps;
  p.position = raw % len;
  if (raw >= len) collectGo(s, p.position === 0 ? 'Landed on GO' : 'Passed GO');
  land(s);
}

function moveBack(s: GameState, steps: number) {
  const p = currentPlayer(s);
  const len = s.board.spaces.length;
  p.position = (((p.position - steps) % len) + len) % len;
  land(s);
}

function moveTo(s: GameState, target: number, payGo: boolean) {
  const p = currentPlayer(s);
  if (target < p.position && payGo) collectGo(s, target === 0 ? 'Landed on GO' : 'Passed GO');
  p.position = target;
  land(s);
}

function land(s: GameState) {
  const p = currentPlayer(s);
  const idx = p.position;
  const sp = s.board.spaces[idx];
  s.phase = { kind: 'end' };
  note(s, `Move pawn to ${sp.name}`);

  switch (sp.type) {
    case 'property':
    case 'station':
    case 'utility': {
      const o = s.owned[idx];
      if (!o) {
        s.phase = { kind: 'buy', space: idx };
        return; // pendingRent kept until buy/auction/skip
      }
      if (o.owner === p.id) note(s, 'You own this one');
      else if (o.mortgaged) note(s, `Mortgaged by ${nameOf(s, o.owner)} — no rent`);
      else {
        const r = rentFor(s, idx, s.pendingRent);
        transfer(s, p.id, o.owner, r.amount, 'rent', `Rent: ${r.why}`);
      }
      break;
    }
    case 'tax':
      transfer(s, p.id, BANK, sp.amount ?? 0, 'tax', sp.name);
      break;
    case 'card':
      s.phase = { kind: 'card', deck: sp.deck ?? 'chance' };
      break;
    case 'goToJail':
      sendToJail(s, 'Go to jail');
      break;
    case 'freeParking':
      if (s.board.rules.freeParkingJackpot && s.jackpot > 0) {
        transfer(s, JACKPOT, p.id, s.jackpot, 'jackpot', 'Free Parking jackpot');
      }
      break;
    default:
      break;
  }
  s.pendingRent = null;
}

// ---------- turn actions ----------

function step(s0: GameState, fn: (s: GameState) => void): GameState {
  const s = clone(s0);
  fn(s);
  s.updatedAt = Date.now();
  return s;
}

function requirePhase(s: GameState, kind: GameState['phase']['kind']) {
  if (s.phase.kind !== kind) fail('That action is not available right now.');
}

export function roll(s0: GameState, manual?: [number, number]): GameState {
  return step(s0, (s) => {
    requirePhase(s, 'roll');
    const p = currentPlayer(s);
    const d: [number, number] = manual ?? [rollDie(), rollDie()];
    if (d.some((v) => !Number.isInteger(v) || v < 1 || v > 6)) fail('Each die must be 1–6.');
    s.dice = d;
    s.events = [];
    const total = d[0] + d[1];
    const doubles = d[0] === d[1];

    if (p.inJail) {
      if (doubles) {
        p.inJail = false;
        p.jailTurns = 0;
        s.rollAgain = false;
        note(s, 'Doubles — out of jail');
        moveForward(s, total);
        return;
      }
      p.jailTurns += 1;
      if (p.jailTurns >= s.board.rules.maxJailTurns) {
        transfer(s, p.id, BANK, s.board.rules.jailFine, 'jail', `Jail fine after ${p.jailTurns} tries`);
        p.inJail = false;
        p.jailTurns = 0;
        s.rollAgain = false;
        moveForward(s, total);
        return;
      }
      note(s, `No doubles — stay in jail (try ${p.jailTurns} of ${s.board.rules.maxJailTurns})`);
      s.rollAgain = false;
      s.phase = { kind: 'end' };
      return;
    }

    if (doubles) {
      s.doublesCount += 1;
      if (s.doublesCount >= 3) {
        sendToJail(s, 'Third doubles in a row');
        return;
      }
      s.rollAgain = true;
    } else {
      s.rollAgain = false;
    }
    moveForward(s, total);
  });
}

export function payJailFine(s0: GameState): GameState {
  return step(s0, (s) => {
    requirePhase(s, 'roll');
    const p = currentPlayer(s);
    if (!p.inJail) fail('Not in jail.');
    if (p.cash < s.board.rules.jailFine) fail('Not enough cash to pay the fine.');
    s.events = [];
    transfer(s, p.id, BANK, s.board.rules.jailFine, 'jail', 'Paid to leave jail');
    p.inJail = false;
    p.jailTurns = 0;
  });
}

export function playJailCard(s0: GameState): GameState {
  return step(s0, (s) => {
    requirePhase(s, 'roll');
    const p = currentPlayer(s);
    if (!p.inJail) fail('Not in jail.');
    const c = p.jailCards.shift() ?? fail('No get-out-of-jail card.');
    s.events = [];
    p.inJail = false;
    p.jailTurns = 0;
    note(s, `Used get-out-of-jail card — return it to the ${s.board.deckNames[c.deck]} deck`);
    log(s, 'jail', `${p.name} used a get-out-of-jail card`);
  });
}

export function buy(s0: GameState): GameState {
  return step(s0, (s) => {
    if (s.phase.kind !== 'buy') fail('Nothing to buy.');
    const idx = (s.phase as { space: number }).space;
    const sp = s.board.spaces[idx];
    const p = currentPlayer(s);
    const price = sp.price ?? 0;
    if (p.cash < price) fail(`Not enough cash. ${p.name} has ${money(p.cash)}.`);
    transfer(s, p.id, BANK, price, 'buy', `Bought ${sp.name}`);
    s.owned[idx] = { owner: p.id, houses: 0, mortgaged: false };
    note(s, `Take the ${sp.name} deed`);
    s.pendingRent = null;
    s.phase = { kind: 'end' };
  });
}

export function auction(s0: GameState, winnerId: string, amount: number): GameState {
  return step(s0, (s) => {
    if (s.phase.kind !== 'buy') fail('Nothing to auction.');
    if (!s.board.rules.auctions) fail('Auctions are off in this board’s rules.');
    const idx = (s.phase as { space: number }).space;
    const sp = s.board.spaces[idx];
    const w = player(s, winnerId);
    if (w.bankrupt) fail('That player is out.');
    if (!Number.isInteger(amount) || amount < 1) fail('Enter the winning bid.');
    if (w.cash < amount) fail(`${w.name} only has ${money(w.cash)}.`);
    transfer(s, w.id, BANK, amount, 'auction', `Won auction for ${sp.name}`);
    s.owned[idx] = { owner: w.id, houses: 0, mortgaged: false };
    note(s, `${w.name} takes the ${sp.name} deed`);
    s.pendingRent = null;
    s.phase = { kind: 'end' };
  });
}

export function skipBuy(s0: GameState): GameState {
  return step(s0, (s) => {
    if (s.phase.kind !== 'buy') fail('Nothing to skip.');
    note(s, 'Left unowned');
    s.pendingRent = null;
    s.phase = { kind: 'end' };
  });
}

export function pickCard(s0: GameState, cardId: string): GameState {
  return step(s0, (s) => {
    if (s.phase.kind !== 'card') fail('No card to draw.');
    const deck = (s.phase as { deck: DeckId }).deck;
    const card: Card = s.board.decks[deck].find((c) => c.id === cardId) ?? fail('Unknown card.');
    if (heldCardIds(s, deck).has(cardId)) fail('That card is held by a player.');
    applyCard(s, deck, card);
  });
}

function applyCard(s: GameState, deck: DeckId, c: Card) {
  const p = currentPlayer(s);
  const label = `${s.board.deckNames[deck]} #${c.no}: ${c.text}`;
  note(s, label);
  s.phase = { kind: 'end' };
  const amt = c.amount ?? 0;
  switch (c.action) {
    case 'collect':
      transfer(s, BANK, p.id, amt, 'card', label);
      break;
    case 'pay':
      transfer(s, p.id, BANK, amt, 'card', label);
      break;
    case 'moveTo': {
      const t = c.target ?? 0;
      if (t < 0 || t >= s.board.spaces.length) fail('Card points to a space that does not exist. Fix it in Admin.');
      moveTo(s, t, c.collectGo !== false);
      break;
    }
    case 'moveBy': {
      const steps = c.steps ?? 0;
      if (steps >= 0) moveForward(s, steps);
      else moveBack(s, -steps);
      break;
    }
    case 'nearest': {
      const type = c.nearest ?? 'station';
      const len = s.board.spaces.length;
      let t = -1;
      for (let k = 1; k <= len; k++) {
        const i = (p.position + k) % len;
        if (s.board.spaces[i].type === type) {
          t = i;
          break;
        }
      }
      if (t < 0) fail(`This board has no ${type}.`);
      s.pendingRent = { multiplier: c.multiplier, utilityDice: type === 'utility' };
      moveTo(s, t, c.collectGo !== false);
      break;
    }
    case 'repairs': {
      let houses = 0;
      let hotels = 0;
      propertiesOf(s, p.id).forEach((i) => {
        const h = s.owned[i].houses;
        if (h === 5) hotels++;
        else houses += h;
      });
      const total = houses * (c.perHouse ?? 0) + hotels * (c.perHotel ?? 0);
      if (total > 0) transfer(s, p.id, BANK, total, 'card', `${label} (${houses} houses, ${hotels} hotels)`);
      else note(s, 'No buildings — nothing to pay');
      break;
    }
    case 'payEach':
      activePlayers(s)
        .filter((q) => q.id !== p.id)
        .forEach((q) => transfer(s, p.id, q.id, amt, 'card', label));
      break;
    case 'collectEach':
      activePlayers(s)
        .filter((q) => q.id !== p.id)
        .forEach((q) => transfer(s, q.id, p.id, amt, 'card', label));
      break;
    case 'jail':
      sendToJail(s, label);
      break;
    case 'jailFree':
      p.jailCards.push({ deck, cardId: c.id });
      note(s, 'Keep this card');
      log(s, 'card', `${p.name} keeps ${label}`);
      break;
  }
}

export function endTurn(s0: GameState): GameState {
  return step(s0, (s) => {
    requirePhase(s, 'end');
    const debt = playersInDebt(s);
    if (debt.length) fail(`${debt.map((d) => d.name).join(', ')} must raise cash (sell or mortgage) or declare bankruptcy first.`);
    s.events = [];
    s.dice = null;
    s.pendingRent = null;
    const p = currentPlayer(s);
    if (s.rollAgain && !p.inJail && !p.bankrupt) {
      s.rollAgain = false;
      s.phase = { kind: 'roll' };
      return;
    }
    advancePlayer(s);
  });
}

function advancePlayer(s: GameState) {
  s.rollAgain = false;
  s.doublesCount = 0;
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (s.current + k) % n;
    if (!s.players[i].bankrupt) {
      s.current = i;
      break;
    }
  }
  s.turn += 1;
  s.phase = { kind: 'roll' };
}

// ---------- property management (any time) ----------

function ownership(s: GameState, idx: number): Ownership {
  return s.owned[idx] ?? fail('Nobody owns that.');
}

export function buildError(s: GameState, idx: number): string | null {
  const sp = s.board.spaces[idx];
  const o = s.owned[idx];
  if (sp.type !== 'property' || !sp.group) return 'Only colour-set properties can have houses.';
  if (!o) return 'Nobody owns it.';
  if (!ownsGroup(s, o.owner, sp.group)) return `Needs the full ${groupName(s.board, sp.group)} set.`;
  const group = groupSpaces(s.board, sp.group);
  if (group.some((i) => s.owned[i].mortgaged)) return 'Unmortgage the whole set first.';
  if (o.houses >= 5) return 'Already has a hotel.';
  const min = Math.min(...group.map((i) => s.owned[i].houses));
  if (o.houses > min) return 'Build evenly across the set.';
  if (o.houses < 4 && housesLeft(s) <= 0) return 'The bank has no houses left.';
  if (o.houses === 4 && hotelsLeft(s) <= 0) return 'The bank has no hotels left.';
  if (player(s, o.owner).cash < (sp.houseCost ?? 0)) return 'Not enough cash.';
  return null;
}

export function build(s0: GameState, idx: number): GameState {
  return step(s0, (s) => {
    const err = buildError(s, idx);
    if (err) fail(err);
    const sp = s.board.spaces[idx];
    const o = s.owned[idx];
    o.houses += 1;
    transfer(s, o.owner, BANK, sp.houseCost ?? 0, 'build', `Built ${o.houses === 5 ? 'a hotel' : `house ${o.houses}`} on ${sp.name}`, { event: false });
  });
}

export function sellError(s: GameState, idx: number): string | null {
  const sp = s.board.spaces[idx];
  const o = s.owned[idx];
  if (!o || o.houses === 0) return 'No buildings to sell.';
  const group = groupSpaces(s.board, sp.group ?? '');
  const max = Math.max(...group.map((i) => s.owned[i]?.houses ?? 0));
  if (o.houses < max) return 'Sell evenly across the set.';
  if (o.houses === 5 && housesLeft(s) < 4) return `Bank has only ${housesLeft(s)} houses to swap for the hotel.`;
  return null;
}

export function sellBuilding(s0: GameState, idx: number): GameState {
  return step(s0, (s) => {
    const err = sellError(s, idx);
    if (err) fail(err);
    const sp = s.board.spaces[idx];
    const o = s.owned[idx];
    const what = o.houses === 5 ? 'hotel' : 'house';
    o.houses -= 1;
    transfer(s, BANK, o.owner, Math.floor((sp.houseCost ?? 0) / 2), 'build', `Sold a ${what} on ${sp.name} (half price)`, { event: false });
  });
}

export function mortgageError(s: GameState, idx: number): string | null {
  const sp = s.board.spaces[idx];
  const o = s.owned[idx];
  if (!o) return 'Nobody owns it.';
  if (o.mortgaged) return 'Already mortgaged.';
  if (sp.type === 'property' && sp.group && groupSpaces(s.board, sp.group).some((i) => (s.owned[i]?.houses ?? 0) > 0)) {
    return 'Sell all buildings in the set first.';
  }
  return null;
}

export function mortgage(s0: GameState, idx: number): GameState {
  return step(s0, (s) => {
    const err = mortgageError(s, idx);
    if (err) fail(err);
    const sp = s.board.spaces[idx];
    const o = s.owned[idx];
    o.mortgaged = true;
    transfer(s, BANK, o.owner, sp.mortgage ?? 0, 'mortgage', `Mortgaged ${sp.name}`, { event: false });
  });
}

export function unmortgageCost(s: GameState, idx: number): number {
  const sp = s.board.spaces[idx];
  // Integer maths first: 50 * 1.1 is 55.000000000000007 in floating point.
  return Math.ceil(((sp.mortgage ?? 0) * (100 + s.board.rules.mortgageInterest)) / 100);
}

export function unmortgage(s0: GameState, idx: number): GameState {
  return step(s0, (s) => {
    const o = ownership(s, idx);
    if (!o.mortgaged) fail('Not mortgaged.');
    const cost = unmortgageCost(s, idx);
    if (player(s, o.owner).cash < cost) fail('Not enough cash.');
    o.mortgaged = false;
    const sp = s.board.spaces[idx];
    transfer(s, o.owner, BANK, cost, 'mortgage', `Unmortgaged ${sp.name} (incl. ${s.board.rules.mortgageInterest}% interest)`, { event: false });
  });
}

// ---------- trades ----------

export interface TradeOffer {
  a: string;
  b: string;
  aGives: number[]; // space indexes
  bGives: number[];
  aCash: number; // cash a pays b
  bCash: number; // cash b pays a
  aJailCards?: number; // how many get-out cards a gives
  bJailCards?: number;
}

export function tradeError(s: GameState, t: TradeOffer): string | null {
  if (t.a === t.b) return 'Pick two different players.';
  const a = s.players.find((p) => p.id === t.a);
  const b = s.players.find((p) => p.id === t.b);
  if (!a || !b || a.bankrupt || b.bankrupt) return 'Pick two active players.';
  if (!t.aGives.length && !t.bGives.length && !t.aCash && !t.bCash && !t.aJailCards && !t.bJailCards) return 'The trade is empty.';
  if (t.aCash < 0 || t.bCash < 0) return 'Cash must be positive.';
  if (a.cash < t.aCash) return `${a.name} only has ${money(a.cash)}.`;
  if (b.cash < t.bCash) return `${b.name} only has ${money(b.cash)}.`;
  if ((t.aJailCards ?? 0) > a.jailCards.length || (t.bJailCards ?? 0) > b.jailCards.length) return 'Not enough jail cards.';
  for (const [owner, list] of [
    [t.a, t.aGives],
    [t.b, t.bGives],
  ] as const) {
    for (const i of list) {
      if (s.owned[i]?.owner !== owner) return `${s.board.spaces[i].name} isn’t theirs to trade.`;
      const g = s.board.spaces[i].group;
      if (g && groupSpaces(s.board, g).some((k) => (s.owned[k]?.houses ?? 0) > 0)) {
        return `Sell buildings in the ${groupName(s.board, g)} set before trading ${s.board.spaces[i].name}.`;
      }
    }
  }
  return null;
}

export function trade(s0: GameState, t: TradeOffer): GameState {
  return step(s0, (s) => {
    const err = tradeError(s, t);
    if (err) fail(err);
    const a = player(s, t.a);
    const b = player(s, t.b);
    const names = (l: number[]) => l.map((i) => s.board.spaces[i].name).join(', ');
    const parts: string[] = [];
    if (t.aGives.length) parts.push(`${a.name} gives ${names(t.aGives)}`);
    if (t.bGives.length) parts.push(`${b.name} gives ${names(t.bGives)}`);
    const summary = parts.join('; ') || 'cash only';
    transfer(s, a.id, b.id, t.aCash, 'trade', `Trade: ${summary}`, { event: false });
    transfer(s, b.id, a.id, t.bCash, 'trade', `Trade: ${summary}`, { event: false });
    t.aGives.forEach((i) => (s.owned[i].owner = b.id));
    t.bGives.forEach((i) => (s.owned[i].owner = a.id));
    b.jailCards.push(...a.jailCards.splice(0, t.aJailCards ?? 0));
    a.jailCards.push(...b.jailCards.splice(0, t.bJailCards ?? 0));
    if (!t.aCash && !t.bCash) log(s, 'trade', `Trade: ${summary}`, a.id, b.id);
  });
}

// ---------- bankruptcy ----------

/** Who a player in debt owes: the recipient of their most recent payment. */
export function creditorOf(s: GameState, debtorId: string): string {
  for (let i = s.ledger.length - 1; i >= 0; i--) {
    const e = s.ledger[i];
    if (e.from === debtorId && e.amount > 0) return e.to === JACKPOT ? BANK : e.to;
  }
  return BANK;
}

export function declareBankrupt(s0: GameState, debtorId: string): GameState {
  return step(s0, (s) => {
    const d = player(s, debtorId);
    if (d.bankrupt) fail('Already out.');
    const creditor = creditorOf(s, d.id);
    const props = propertiesOf(s, d.id);

    // Buildings go back to the bank at half price.
    props.forEach((i) => {
      const o = s.owned[i];
      if (o.houses > 0) {
        const sp = s.board.spaces[i];
        const refund = Math.floor(((sp.houseCost ?? 0) / 2) * o.houses);
        transfer(s, BANK, d.id, refund, 'bankrupt', `Bankruptcy: sold buildings on ${sp.name}`, { event: false });
        o.houses = 0;
      }
    });

    if (creditor !== BANK) {
      const c = player(s, creditor);
      if (d.cash < 0) {
        // The creditor was credited the full debt; take back what can't be paid.
        transfer(s, c.id, BANK, -d.cash, 'bankrupt', `Unpayable part of ${d.name}'s debt`, { event: false });
        d.cash = 0;
      } else {
        transfer(s, d.id, c.id, d.cash, 'bankrupt', `Bankruptcy: ${d.name}'s remaining cash`, { event: false });
      }
      props.forEach((i) => (s.owned[i].owner = c.id));
      c.jailCards.push(...d.jailCards);
      log(s, 'bankrupt', `${d.name} is bankrupt — ${c.name} takes their properties`, d.id, c.id);
    } else {
      props.forEach((i) => delete s.owned[i]);
      log(s, 'bankrupt', `${d.name} is bankrupt — properties return to the bank`, d.id, BANK);
    }
    d.cash = 0;
    d.jailCards = [];
    d.inJail = false;
    d.bankrupt = true;

    const left = activePlayers(s);
    if (left.length === 1) {
      s.phase = { kind: 'over', winner: left[0].id };
      return;
    }
    if (currentPlayer(s).id === d.id) {
      s.events = [];
      s.dice = null;
      advancePlayer(s);
    }
  });
}

// ---------- corrections (admin "fix it") ----------

export function adjustCash(s0: GameState, playerId: string, delta: number, why: string): GameState {
  return step(s0, (s) => {
    if (!Number.isInteger(delta) || delta === 0) fail('Enter an amount.');
    const reason = `Correction: ${why.trim() || 'manual adjustment'}`;
    if (delta > 0) transfer(s, BANK, playerId, delta, 'fix', reason, { event: false });
    else transfer(s, playerId, BANK, -delta, 'fix', reason, { event: false });
  });
}

export function setPosition(s0: GameState, playerId: string, pos: number): GameState {
  return step(s0, (s) => {
    const p = player(s, playerId);
    p.position = pos;
    log(s, 'fix', `Correction: ${p.name} moved to ${s.board.spaces[pos].name}`);
  });
}

export function setOwner(s0: GameState, idx: number, ownerId: string | null): GameState {
  return step(s0, (s) => {
    const sp = s.board.spaces[idx];
    if (!isOwnable(sp)) fail('That space can’t be owned.');
    if (ownerId === null) {
      delete s.owned[idx];
      log(s, 'fix', `Correction: ${sp.name} returned to the bank`);
    } else {
      const prev = s.owned[idx];
      s.owned[idx] = { owner: ownerId, houses: prev?.houses ?? 0, mortgaged: prev?.mortgaged ?? false };
      log(s, 'fix', `Correction: ${sp.name} now owned by ${nameOf(s, ownerId)}`);
    }
  });
}

export function setHouses(s0: GameState, idx: number, houses: number): GameState {
  return step(s0, (s) => {
    const o = ownership(s, idx);
    o.houses = Math.max(0, Math.min(5, houses));
    log(s, 'fix', `Correction: ${s.board.spaces[idx].name} set to ${houseLabel(o.houses)}`);
  });
}

export function toggleJail(s0: GameState, playerId: string): GameState {
  return step(s0, (s) => {
    const p = player(s, playerId);
    p.inJail = !p.inJail;
    p.jailTurns = 0;
    if (p.inJail) p.position = Math.max(0, s.board.spaces.findIndex((sp) => sp.type === 'jail'));
    log(s, 'fix', `Correction: ${p.name} ${p.inJail ? 'put in' : 'released from'} jail`);
  });
}
