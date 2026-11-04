import { describe, expect, it } from 'vitest';
import { BANK, balances, newSession, recentAmounts, removeTransfer, transfer } from './engine';

const mk = () =>
  newSession(
    [
      { name: 'Ana', color: '#000' },
      { name: '', color: '#111' },
      { name: 'Cy', color: '#222' },
    ],
    1500,
    200,
  );

describe('bank mode', () => {
  it('starts everyone with the starting cash and names blanks', () => {
    const s = mk();
    expect(s.players[1].name).toBe('Player 2');
    expect(Object.values(balances(s))).toEqual([1500, 1500, 1500]);
  });

  it('moves money player to player, bank to player and player to bank', () => {
    let s = mk();
    const [a, b, c] = s.players.map((p) => p.id);
    s = transfer(s, a, b, 250);
    s = transfer(s, BANK, c, 200);
    s = transfer(s, b, BANK, 100);
    expect(balances(s)).toEqual({ [a]: 1250, [b]: 1650, [c]: 1700 });
  });

  it('rejects bad transfers', () => {
    const s = mk();
    const a = s.players[0].id;
    expect(() => transfer(s, a, a, 10)).toThrow();
    expect(() => transfer(s, a, BANK, 0)).toThrow();
    expect(() => transfer(s, a, BANK, 1.5)).toThrow();
    expect(() => transfer(s, a, 'nobody', 10)).toThrow();
    expect(() => transfer(s, BANK, BANK, 10)).toThrow();
  });

  it('removing a transfer restores balances', () => {
    let s = mk();
    const [a, b] = s.players.map((p) => p.id);
    s = transfer(s, a, b, 300);
    const id = s.transfers[0].id;
    s = transfer(s, b, a, 50);
    s = removeTransfer(s, id);
    expect(balances(s)[a]).toBe(1550);
    expect(balances(s)[b]).toBe(1450);
  });

  it('lists distinct recent amounts newest first', () => {
    let s = mk();
    const [a, b] = s.players.map((p) => p.id);
    for (const n of [50, 200, 50, 10, 75, 10]) s = transfer(s, a, b, n);
    expect(recentAmounts(s)).toEqual([10, 75, 50, 200]);
  });
});
