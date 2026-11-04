import { uid } from '../engine/util';

// Bank-only mode: no board, no rules. Just players, a bank with unlimited
// money, and a list of transfers. Balances are always derived from the
// transfer list, so removing any entry fixes every balance at once.

export const BANK = 'bank';

export interface BankPlayer {
  id: string;
  name: string;
  color: string;
}

export interface Transfer {
  id: string;
  /** player id or BANK */
  from: string;
  /** player id or BANK */
  to: string;
  amount: number;
  at: number;
}

export interface BankSession {
  players: BankPlayer[];
  startingCash: number;
  /** one-tap "Pass GO" amount; 0 hides the button */
  salary: number;
  transfers: Transfer[];
  createdAt: number;
}

export function newSession(players: { name: string; color: string }[], startingCash: number, salary: number): BankSession {
  if (players.length < 2) throw new Error('Add at least two players.');
  if (!Number.isInteger(startingCash) || startingCash < 0) throw new Error('Starting cash must be a whole number, 0 or more.');
  return {
    players: players.map((p, i) => ({ id: uid('p'), name: p.name.trim() || `Player ${i + 1}`, color: p.color })),
    startingCash,
    salary: Math.max(0, Math.trunc(salary) || 0),
    transfers: [],
    createdAt: Date.now(),
  };
}

export function balances(s: BankSession): Record<string, number> {
  const b: Record<string, number> = {};
  for (const p of s.players) b[p.id] = s.startingCash;
  for (const t of s.transfers) {
    if (t.from !== BANK) b[t.from] -= t.amount;
    if (t.to !== BANK) b[t.to] += t.amount;
  }
  return b;
}

export function transfer(s: BankSession, from: string, to: string, amount: number): BankSession {
  if (from === to) throw new Error('Pick two different accounts.');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Enter an amount above zero.');
  const ids = new Set([BANK, ...s.players.map((p) => p.id)]);
  if (!ids.has(from) || !ids.has(to)) throw new Error('Unknown account.');
  return { ...s, transfers: [...s.transfers, { id: uid('t'), from, to, amount, at: Date.now() }] };
}

export function removeTransfer(s: BankSession, id: string): BankSession {
  return { ...s, transfers: s.transfers.filter((t) => t.id !== id) };
}

export function accountName(s: BankSession, id: string): string {
  if (id === BANK) return 'Bank';
  return s.players.find((p) => p.id === id)?.name ?? 'Unknown';
}

/** Distinct recent amounts, newest first — offered as one-tap presets. */
export function recentAmounts(s: BankSession, limit = 4): number[] {
  const out: number[] = [];
  for (let i = s.transfers.length - 1; i >= 0 && out.length < limit; i--) {
    const a = s.transfers[i].amount;
    if (!out.includes(a)) out.push(a);
  }
  return out;
}
