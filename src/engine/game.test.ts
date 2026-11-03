import { describe, expect, it } from 'vitest';
import { classicBoard } from '../data/classic';
import { validateBoard } from './validate';
import {
  auction,
  build,
  buildError,
  buy,
  declareBankrupt,
  endTurn,
  mortgage,
  newGame,
  payJailFine,
  pickCard,
  rentFor,
  roll,
  sellBuilding,
  skipBuy,
  trade,
  unmortgage,
} from './game';
import type { GameState } from '../types';

const start = (n = 3) =>
  newGame(
    classicBoard(),
    ['Asha', 'Ravi', 'Meera', 'Kabir'].slice(0, n).map((name) => ({ name, color: '#000' })),
  );

const [A, R] = [0, 1];
const cash = (s: GameState, i: number) => s.players[i].cash;
const give = (s: GameState, idx: number[], who: number, houses = 0) => {
  idx.forEach((i) => (s.owned[i] = { owner: s.players[who].id, houses, mortgaged: false }));
  return s;
};

describe('classic board', () => {
  it('is valid', () => {
    expect(validateBoard(classicBoard())).toEqual([]);
  });
});

describe('movement and GO', () => {
  it('moves by the dice total and offers unowned property', () => {
    let s = roll(start(), [2, 4]); // -> 6 Cedar Park
    expect(s.players[A].position).toBe(6);
    expect(s.phase).toEqual({ kind: 'buy', space: 6 });
    s = buy(s);
    expect(cash(s, A)).toBe(1400);
    expect(s.owned[6].owner).toBe(s.players[A].id);
    expect(s.phase.kind).toBe('end');
  });

  it('pays GO salary when passing GO', () => {
    let s = start();
    s.players[A].position = 38;
    s = roll(s, [1, 3]); // -> 2 (Chest)
    expect(s.players[A].position).toBe(2);
    expect(cash(s, A)).toBe(1700);
    expect(s.phase).toEqual({ kind: 'card', deck: 'chest' });
  });

  it('three doubles sends to jail', () => {
    let s = roll(start(), [1, 1]); // 2 chest
    s = pickCard(s, 'k2'); // +200
    s = endTurn(s);
    expect(s.phase.kind).toBe('roll');
    expect(s.current).toBe(A);
    s = roll(s, [2, 2]); // 6
    s = skipBuy(s);
    s = endTurn(s);
    s = roll(s, [3, 3]);
    expect(s.players[A].inJail).toBe(true);
    expect(s.players[A].position).toBe(10);
    s = endTurn(s);
    expect(s.current).toBe(R);
  });
});

describe('rent', () => {
  it('base, full set double, and houses', () => {
    let s = give(start(), [16], R); // Harbor Road
    expect(rentFor(s, 16).amount).toBe(14);
    s = give(s, [18, 19], R);
    expect(rentFor(s, 16).amount).toBe(28);
    s.owned[16].houses = 3;
    expect(rentFor(s, 16).amount).toBe(550);
  });

  it('is paid automatically on landing', () => {
    let s = give(start(), [16, 18, 19], R, 3);
    s.players[A].position = 10;
    s = roll(s, [2, 4]); // -> 16
    expect(cash(s, A)).toBe(1500 - 550);
    expect(cash(s, R)).toBe(1500 + 550);
    expect(s.events.some((e) => e.amount === -550)).toBe(true);
  });

  it('stations scale with count, utilities use dice', () => {
    let s = give(start(), [5, 15], R);
    expect(rentFor(s, 5).amount).toBe(50);
    s = give(s, [12], R);
    s.dice = [3, 4];
    expect(rentFor(s, 12).amount).toBe(28);
    s = give(s, [28], R);
    expect(rentFor(s, 12).amount).toBe(70);
  });

  it('no rent on mortgaged property', () => {
    let s = give(start(), [16], R);
    s.owned[16].mortgaged = true;
    s.players[A].position = 10;
    s = roll(s, [2, 4]);
    expect(cash(s, A)).toBe(1500);
  });
});

describe('cards', () => {
  it('nearest station pays double rent', () => {
    let s = give(start(), [15], R);
    s.players[A].position = 3;
    s = roll(s, [1, 3]); // -> 7 Chance
    s = pickCard(s, 'c6');
    expect(s.players[A].position).toBe(15);
    expect(cash(s, A)).toBe(1500 - 50);
  });

  it('repairs charge per building', () => {
    let s = give(start(), [1, 3], A, 2);
    s.owned[3].houses = 5;
    s.players[A].position = 5;
    s = roll(s, [1, 1]); // -> 7 Chance
    s = pickCard(s, 'c13'); // 25/house, 100/hotel
    expect(cash(s, A)).toBe(1500 - (2 * 25 + 100));
  });

  it('pay each player', () => {
    let s = start(3);
    s.players[A].position = 3;
    s = roll(s, [1, 3]);
    s = pickCard(s, 'c15');
    expect(cash(s, A)).toBe(1400);
    expect(cash(s, R)).toBe(1550);
  });

  it('jail-free card is kept and hidden from the picker', () => {
    let s = start();
    s.players[A].position = 3;
    s = roll(s, [1, 3]);
    s = pickCard(s, 'c10');
    expect(s.players[A].jailCards).toHaveLength(1);
    s = endTurn(s);
    s.players[R].position = 3;
    s = roll(s, [1, 3]);
    expect(() => pickCard(s, 'c10')).toThrow();
  });
});

describe('jail', () => {
  it('pay fine then roll', () => {
    let s = start();
    s.players[A].inJail = true;
    s.players[A].position = 10;
    s = payJailFine(s);
    expect(cash(s, A)).toBe(1450);
    s = roll(s, [1, 2]);
    expect(s.players[A].position).toBe(13);
  });

  it('forced fine after max tries', () => {
    let s = start();
    s.players[A].inJail = true;
    s.players[A].position = 10;
    s.players[A].jailTurns = 2;
    s = roll(s, [1, 2]);
    expect(s.players[A].inJail).toBe(false);
    expect(cash(s, A)).toBe(1450);
    expect(s.players[A].position).toBe(13);
  });
});

describe('building and mortgage', () => {
  it('requires full set and even building', () => {
    let s = give(start(), [1], A);
    expect(buildError(s, 1)).toMatch(/full/);
    s = give(s, [3], A);
    s = build(s, 1);
    expect(cash(s, A)).toBe(1450);
    expect(buildError(s, 1)).toMatch(/evenly/);
    s = build(s, 3);
    s = sellBuilding(s, 3);
    expect(cash(s, A)).toBe(1400 + 25);
  });

  it('mortgage and unmortgage with interest', () => {
    let s = give(start(), [6], A);
    s = mortgage(s, 6);
    expect(cash(s, A)).toBe(1550);
    s = unmortgage(s, 6);
    expect(cash(s, A)).toBe(1495);
  });
});

describe('auction, trade, bankruptcy', () => {
  it('auction winner pays bid', () => {
    let s = roll(start(), [2, 4]);
    s = auction(s, s.players[R].id, 80);
    expect(cash(s, R)).toBe(1420);
    expect(s.owned[6].owner).toBe(s.players[R].id);
  });

  it('trade swaps properties and cash', () => {
    let s = give(start(), [6], A);
    s = give(s, [8], R);
    s = trade(s, { a: s.players[A].id, b: s.players[R].id, aGives: [6], bGives: [8], aCash: 30, bCash: 0 });
    expect(s.owned[6].owner).toBe(s.players[R].id);
    expect(s.owned[8].owner).toBe(s.players[A].id);
    expect(cash(s, A)).toBe(1470);
  });

  it('debt blocks the turn until bankruptcy hands assets to creditor', () => {
    let s = give(start(3), [37, 39], R, 5); // Dark blue hotels
    s.players[A].cash = 100;
    s = give(s, [1], A);
    s.players[A].position = 35;
    s = roll(s, [1, 3]); // -> 39 Crown Plaza, rent 2000
    expect(cash(s, A)).toBe(-1900);
    expect(() => endTurn(s)).toThrow(/bankruptcy/);
    s = declareBankrupt(s, s.players[A].id);
    expect(s.players[A].bankrupt).toBe(true);
    expect(s.owned[1].owner).toBe(s.players[R].id);
    expect(cash(s, R)).toBe(1500 + 100);
    expect(s.current).toBe(R);
  });
});
