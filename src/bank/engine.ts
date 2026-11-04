import { uid } from '../engine/util';

// Bank-only mode: no board, no rules. Just players, a bank with unlimited
// money, and a list of transfers. Balances are always derived from the
// transfer list, so removing any entry fixes every balance at once.

export const BANK = 'bank';
/** Stands for "every other player" on one side of a transfer. */
export const EVERYONE = 'everyone';

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

/**
 * How one transfer changes each player's balance. EVERYONE expands to every
 * player except the one on the other side, so "Ana → Everyone $50" means Ana
 * pays $50 to each other player, and "Everyone → Bank $50" means each player
 * pays the bank $50.
 */
export function effect(s: BankSession, t: Pick<Transfer, 'from' | 'to' | 'amount'>): Record<string, number> {
  const all = s.players.map((p) => p.id);
  const payers = t.from === EVERYONE ? all.filter((id) => id !== t.to) : [t.from];
  const payees = t.to === EVERYONE ? all.filter((id) => id !== t.from) : [t.to];
  const d: Record<string, number> = {};
  const add = (id: string, n: number) => {
    if (id !== BANK) d[id] = (d[id] ?? 0) + n;
  };
  for (const a of payers)
    for (const b of payees) {
      if (a === b) continue;
      add(a, -t.amount);
      add(b, t.amount);
    }
  return d;
}

export function balances(s: BankSession): Record<string, number> {
  const b: Record<string, number> = {};
  for (const p of s.players) b[p.id] = s.startingCash;
  for (const t of s.transfers) for (const [id, n] of Object.entries(effect(s, t))) b[id] += n;
  return b;
}

/** Number of individual payments one transfer stands for (for "× 3" labels). */
export function fanOut(s: BankSession, from: string, to: string): number {
  if (from === EVERYONE || to === EVERYONE) return s.players.length - (from === BANK || to === BANK ? 0 : 1);
  return 1;
}

export function transfer(s: BankSession, from: string, to: string, amount: number): BankSession {
  if (from === to) throw new Error('Pick two different accounts.');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Enter an amount above zero.');
  const ids = new Set([BANK, EVERYONE, ...s.players.map((p) => p.id)]);
  if (!ids.has(from) || !ids.has(to)) throw new Error('Unknown account.');
  return { ...s, transfers: [...s.transfers, { id: uid('t'), from, to, amount, at: Date.now() }] };
}

export function removeTransfer(s: BankSession, id: string): BankSession {
  return { ...s, transfers: s.transfers.filter((t) => t.id !== id) };
}

export function accountName(s: BankSession, id: string): string {
  if (id === BANK) return 'Bank';
  if (id === EVERYONE) return 'Everyone';
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
