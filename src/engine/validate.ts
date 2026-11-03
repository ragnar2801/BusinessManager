import type { Board, Card, DeckId } from '../types';

export interface Issue {
  where: string;
  message: string;
  /** space index, or card ref, to jump to */
  space?: number;
  card?: { deck: DeckId; id: string };
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function cardIssue(b: Board, c: Card): string | null {
  switch (c.action) {
    case 'collect':
    case 'pay':
    case 'payEach':
    case 'collectEach':
      return num(c.amount) && c.amount! > 0 ? null : 'needs an amount';
    case 'moveTo':
      return Number.isInteger(c.target) && c.target! >= 0 && c.target! < b.spaces.length ? null : 'needs a target space';
    case 'moveBy':
      return Number.isInteger(c.steps) && c.steps !== 0 ? null : 'needs a number of spaces';
    case 'nearest':
      if (!b.spaces.some((s) => s.type === (c.nearest ?? 'station'))) return `board has no ${c.nearest ?? 'station'}`;
      return null;
    case 'repairs':
      return num(c.perHouse) && num(c.perHotel) ? null : 'needs per-house and per-hotel amounts';
    default:
      return null;
  }
}

export function validateBoard(b: Board): Issue[] {
  const out: Issue[] = [];
  const push = (where: string, message: string, extra: Partial<Issue> = {}) => out.push({ where, message, ...extra });

  if (b.spaces.length < 8) push('Board', 'Needs at least 8 spaces.');
  if (b.spaces[0]?.type !== 'go') push('Space 0', 'Space 0 should be GO.', { space: 0 });
  const hasJail = b.spaces.some((s) => s.type === 'jail');
  if (!hasJail) push('Board', 'There is no Jail space.');

  b.spaces.forEach((s, i) => {
    const where = `${i} · ${s.name || 'Unnamed'}`;
    if (!s.name?.trim()) push(where, 'Missing name.', { space: i });
    if (s.type === 'property') {
      if (!b.groups.some((g) => g.id === s.group)) push(where, 'Pick a colour set.', { space: i });
      if (!num(s.price) || !s.price) push(where, 'Missing price.', { space: i });
      if (!num(s.houseCost) || !s.houseCost) push(where, 'Missing house cost.', { space: i });
      const labels = ['base rent', '1-house rent', '2-house rent', '3-house rent', '4-house rent', 'hotel rent'];
      labels.forEach((l, k) => {
        if (!num(s.rents?.[k])) push(where, `Missing ${l}.`, { space: i });
      });
    }
    if (s.type === 'station') {
      if (!num(s.price) || !s.price) push(where, 'Missing price.', { space: i });
      if (!s.rents || s.rents.length < 1 || !s.rents.every(num)) push(where, 'Missing rents.', { space: i });
    }
    if (s.type === 'utility') {
      if (!num(s.price) || !s.price) push(where, 'Missing price.', { space: i });
      if (!s.rents || s.rents.length < 1 || !s.rents.every(num)) push(where, 'Missing dice multipliers.', { space: i });
    }
    if (s.type === 'tax' && (!num(s.amount) || !s.amount)) push(where, 'Missing tax amount.', { space: i });
    if (s.type === 'card' && !b.decks[s.deck ?? 'chance']?.length) push(where, `The ${b.deckNames[s.deck ?? 'chance']} deck is empty.`, { space: i });
  });

  b.groups.forEach((g) => {
    const count = b.spaces.filter((s) => s.type === 'property' && s.group === g.id).length;
    if (count === 1) push(`Set · ${g.name}`, 'Only one property in this set.');
  });

  (['chance', 'chest'] as DeckId[]).forEach((d) => {
    const nos = new Set<number>();
    b.decks[d].forEach((c) => {
      const where = `${b.deckNames[d]} #${c.no}`;
      if (nos.has(c.no)) push(where, 'Duplicate card number.', { card: { deck: d, id: c.id } });
      nos.add(c.no);
      if (!c.text.trim()) push(where, 'Missing card text.', { card: { deck: d, id: c.id } });
      const err = cardIssue(b, c);
      if (err) push(where, `Card ${err}.`, { card: { deck: d, id: c.id } });
    });
  });

  return out;
}

/** Light structural check for imported JSON. */
export function looksLikeBoard(v: unknown): v is Board {
  const b = v as Board;
  return !!b && typeof b === 'object' && Array.isArray(b.spaces) && Array.isArray(b.groups) && !!b.decks && Array.isArray(b.decks.chance) && Array.isArray(b.decks.chest) && !!b.rules;
}
