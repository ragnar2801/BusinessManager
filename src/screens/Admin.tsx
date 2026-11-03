import { useState } from 'react';
import { useApp } from '../app';
import { classicBoard } from '../data/classic';
import { uid } from '../engine/util';
import { cardIssue, looksLikeBoard, validateBoard, type Issue } from '../engine/validate';
import { downloadJson, pickJsonFile } from '../storage';
import type { Board, Card, CardAction, DeckId, Rules, Space, SpaceType } from '../types';
import { BackBar, Confirm, Icon, NumberField } from '../ui/kit';
import { describeCard } from './Game';

type Tab = 'spaces' | 'cards' | 'sets' | 'rules';
type Editing = { kind: 'space'; index: number } | { kind: 'card'; deck: DeckId; id: string } | null;

const TYPE_LABEL: Record<SpaceType, string> = {
  go: 'GO',
  property: 'Property',
  station: 'Station',
  utility: 'Utility',
  tax: 'Tax',
  card: 'Card',
  jail: 'Jail',
  freeParking: 'Free Parking',
  goToJail: 'Go To Jail',
};

const ACTION_LABEL: Record<CardAction, string> = {
  collect: 'Collect from bank',
  pay: 'Pay the bank',
  moveTo: 'Move to a space',
  moveBy: 'Move N spaces',
  nearest: 'Move to nearest',
  repairs: 'Pay per house / hotel',
  payEach: 'Pay each player',
  collectEach: 'Collect from each player',
  jail: 'Go to jail',
  jailFree: 'Get out of jail free',
};

export function Admin({ boardId }: { boardId?: string }) {
  const { boards, setBoards, go, toast, game } = useApp();
  const [id, setId] = useState(boardId ?? boards[0]?.id);
  const [tab, setTab] = useState<Tab>('spaces');
  const [editing, setEditing] = useState<Editing>(null);
  const [deck, setDeck] = useState<DeckId>('chance');
  const [showIssues, setShowIssues] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const board = boards.find((b) => b.id === id) ?? boards[0];
  const issues = validateBoard(board);

  const save = (next: Board) => setBoards(boards.map((b) => (b.id === next.id ? { ...next, updatedAt: Date.now() } : b)));
  const addBoard = (b: Board) => {
    setBoards([...boards, b]);
    setId(b.id);
    setEditing(null);
  };

  const jump = (i: Issue) => {
    setShowIssues(false);
    if (i.space !== undefined) {
      setTab('spaces');
      setEditing({ kind: 'space', index: i.space });
    } else if (i.card) {
      setTab('cards');
      setDeck(i.card.deck);
      setEditing({ kind: 'card', ...i.card });
    } else setTab(i.where.startsWith('Set') ? 'sets' : 'spaces');
  };

  if (editing?.kind === 'space' && board.spaces[editing.index]) {
    return <SpaceEditor board={board} index={editing.index} onSave={save} onDone={() => setEditing(null)} onOpen={(index) => setEditing({ kind: 'space', index })} />;
  }
  if (editing?.kind === 'card') {
    const c = board.decks[editing.deck].find((x) => x.id === editing.id);
    if (c) return <CardEditor board={board} deck={editing.deck} card={c} onSave={save} onDone={() => setEditing(null)} />;
  }

  return (
    <div className="screen">
      <BackBar
        title="Admin"
        sub={game ? 'Changes apply to new games — the running game keeps its own copy.' : 'Saved in this browser.'}
        onBack={() => go({ name: 'home' })}
      />

      <div className="row">
        <div className="field grow">
          <label htmlFor="adm-board">Board</label>
          <select id="adm-board" className="input" value={board.id} onChange={(e) => (setId(e.target.value), setEditing(null))}>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="adm-name">Board name</label>
        <input id="adm-name" className="input" value={board.name} onChange={(e) => save({ ...board, name: e.target.value })} />
      </div>
      <div className="chips">
        <button className="chip" onClick={() => addBoard({ ...structuredClone(board), id: uid('b'), name: `${board.name} copy` })}>
          Duplicate
        </button>
        <button className="chip" onClick={() => addBoard({ ...classicBoard(), id: uid('b'), name: 'Classic-style (fresh)' })}>
          New from classic
        </button>
        <button className="chip" onClick={() => downloadJson(`${board.name.replace(/[^\w-]+/g, '_') || 'board'}.json`, board)}>
          Export
        </button>
        <button
          className="chip"
          onClick={() =>
            pickJsonFile()
              .then((data) => {
                if (!looksLikeBoard(data)) throw new Error('That file is not a board export.');
                addBoard({ ...data, id: uid('b'), name: data.name || 'Imported board', updatedAt: Date.now() });
                toast('Board imported');
              })
              .catch((e: Error) => toast(e.message))
          }
        >
          Import
        </button>
        {boards.length > 1 && (
          <button className="chip" style={{ color: 'var(--loss)' }} onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
      </div>

      <div className="seg" role="group" aria-label="Section">
        {(['spaces', 'cards', 'sets', 'rules'] as Tab[]).map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {issues.length > 0 && (
        <div className="warn" style={{ flexDirection: 'column' }}>
          <button className="row" style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textAlign: 'left', width: '100%' }} onClick={() => setShowIssues(!showIssues)} aria-expanded={showIssues}>
            <Icon name="warn" size={18} />
            <span className="grow">
              {issues.length} issue{issues.length > 1 ? 's' : ''}: {issues[0].where} — {issues[0].message}
            </span>
            <span className="small">{showIssues ? 'Hide' : 'Show all'}</span>
          </button>
          {showIssues &&
            issues.map((i, k) => (
              <button key={k} className="btn sm" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => jump(i)}>
                {i.where}: {i.message}
              </button>
            ))}
        </div>
      )}

      {tab === 'spaces' && <SpacesTab board={board} onOpen={(index) => setEditing({ kind: 'space', index })} />}
      {tab === 'cards' && <CardsTab board={board} deck={deck} setDeck={setDeck} onSave={save} onOpen={(cid) => setEditing({ kind: 'card', deck, id: cid })} />}
      {tab === 'sets' && <SetsTab board={board} onSave={save} />}
      {tab === 'rules' && <RulesTab board={board} onSave={save} />}

      {confirmDelete && (
        <Confirm
          text={`Delete “${board.name}” from this browser? Export it first if you want a backup.`}
          yes="Delete"
          onNo={() => setConfirmDelete(false)}
          onYes={() => {
            const rest = boards.filter((b) => b.id !== board.id);
            setBoards(rest);
            setId(rest[0].id);
            setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
}

// ---------- Spaces ----------

function spaceMeta(b: Board, s: Space): string {
  switch (s.type) {
    case 'property':
      return `${b.groups.find((g) => g.id === s.group)?.name ?? 'No set'} · $${s.price ?? '?'}`;
    case 'station':
    case 'utility':
      return `${TYPE_LABEL[s.type]} · $${s.price ?? '?'}`;
    case 'tax':
      return `Tax · $${s.amount ?? '?'}`;
    case 'card':
      return `Card · ${b.deckNames[s.deck ?? 'chance']} deck`;
    default:
      return TYPE_LABEL[s.type];
  }
}

function swatchFor(b: Board, s: Space): string {
  if (s.type === 'property') return b.groups.find((g) => g.id === s.group)?.color ?? 'var(--line)';
  if (s.type === 'station') return '#374151';
  if (s.type === 'utility') return '#64748B';
  return 'var(--line)';
}

function SpacesTab({ board, onOpen }: { board: Board; onOpen: (i: number) => void }) {
  return (
    <>
      <div className="list">
        {board.spaces.map((s, i) => (
          <button key={s.id} className="item" onClick={() => onOpen(i)}>
            <span className="small muted" style={{ width: 24, fontWeight: 600 }}>
              {i}
            </span>
            <span className="swatch" style={{ background: swatchFor(board, s) }} />
            <span className="grow">
              <span className="t" style={{ display: 'block' }}>
                {s.name || 'Unnamed'}
              </span>
              <span className="s">{spaceMeta(board, s)}</span>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        ))}
      </div>
      <div className="small muted center">{board.spaces.length} spaces, in order from GO. Tap one to edit.</div>
    </>
  );
}

function defaultsFor(type: SpaceType, b: Board): Partial<Space> {
  switch (type) {
    case 'property':
      return { group: b.groups[0]?.id, price: 100, houseCost: 50, mortgage: 50, rents: [6, 30, 90, 270, 400, 550] };
    case 'station':
      return { price: 200, mortgage: 100, rents: [25, 50, 100, 200] };
    case 'utility':
      return { price: 150, mortgage: 75, rents: [4, 10] };
    case 'tax':
      return { amount: 100 };
    case 'card':
      return { deck: 'chance' };
    default:
      return {};
  }
}

function SpaceEditor({ board, index, onSave, onDone, onOpen }: { board: Board; index: number; onSave: (b: Board) => void; onDone: () => void; onOpen: (i: number) => void }) {
  const s = board.spaces[index];
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (patch: Partial<Space>) => onSave({ ...board, spaces: board.spaces.map((x, i) => (i === index ? { ...x, ...patch } : x)) });
  const setRent = (k: number, v: number | undefined) => {
    const rents = [...(s.rents ?? [])];
    rents[k] = v as number;
    set({ rents });
  };
  const changeType = (type: SpaceType) => onSave({ ...board, spaces: board.spaces.map((x, i) => (i === index ? { id: x.id, name: x.name, type, ...defaultsFor(type, board) } : x)) });
  const insertAfter = () => {
    const spaces = [...board.spaces];
    spaces.splice(index + 1, 0, { id: uid('s'), name: 'New space', type: 'freeParking' });
    onSave({ ...board, spaces });
    onOpen(index + 1);
  };
  const moveBy = (d: number) => {
    const j = index + d;
    if (j < 1 || j >= board.spaces.length || index === 0) return;
    const spaces = [...board.spaces];
    [spaces[index], spaces[j]] = [spaces[j], spaces[index]];
    onSave({ ...board, spaces });
    onOpen(j);
  };

  const rentLabels =
    s.type === 'property'
      ? ['Base', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel']
      : s.type === 'station'
        ? ['1 owned', '2 owned', '3 owned', '4 owned']
        : s.type === 'utility'
          ? ['1 owned: dice ×', '2 owned: dice ×']
          : [];

  return (
    <div className="screen">
      <BackBar title={`Edit ${TYPE_LABEL[s.type].toLowerCase()}`} sub={`Space ${index} of ${board.spaces.length - 1}`} onBack={onDone} />
      <div className="field">
        <label htmlFor="sp-name">Name (as printed on your board)</label>
        <input id="sp-name" className="input" value={s.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="sp-type">Type</label>
          <select id="sp-type" className="input" value={s.type} onChange={(e) => changeType(e.target.value as SpaceType)}>
            {(Object.keys(TYPE_LABEL) as SpaceType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {s.type === 'property' && (
          <div className="field">
            <label htmlFor="sp-group">Colour set</label>
            <select id="sp-group" className="input" value={s.group ?? ''} onChange={(e) => set({ group: e.target.value })}>
              <option value="">Pick a set…</option>
              {board.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {s.type === 'card' && (
          <div className="field">
            <label htmlFor="sp-deck">Deck</label>
            <select id="sp-deck" className="input" value={s.deck ?? 'chance'} onChange={(e) => set({ deck: e.target.value as DeckId })}>
              <option value="chance">{board.deckNames.chance}</option>
              <option value="chest">{board.deckNames.chest}</option>
            </select>
          </div>
        )}
        {s.type === 'tax' && <NumberField id="sp-amount" label="Amount to pay" value={s.amount} onChange={(v) => set({ amount: v })} min={0} />}
        {(s.type === 'property' || s.type === 'station' || s.type === 'utility') && (
          <>
            <NumberField id="sp-price" label="Price" value={s.price} onChange={(v) => set({ price: v })} min={0} />
            <NumberField id="sp-mort" label="Mortgage value" value={s.mortgage} onChange={(v) => set({ mortgage: v })} min={0} />
          </>
        )}
        {s.type === 'property' && <NumberField id="sp-house" label="House cost" value={s.houseCost} onChange={(v) => set({ houseCost: v })} min={0} />}
      </div>

      {rentLabels.length > 0 && (
        <div className="card pad stack">
          <div className="eyebrow">{s.type === 'utility' ? 'Rent = dice total ×' : 'Rent table'}</div>
          <div className={s.type === 'property' ? 'grid3' : 'grid2'}>
            {rentLabels.map((l, k) => (
              <NumberField key={k} id={`rent-${k}`} label={l} value={s.rents?.[k]} onChange={(v) => setRent(k, v)} min={0} />
            ))}
          </div>
          {s.type === 'property' && board.rules.doubleRentOnSet && <div className="small muted">A full set with no houses doubles base rent (see Rules).</div>}
        </div>
      )}

      <div className="chips">
        <button className="chip" disabled={index <= 1} onClick={() => moveBy(-1)}>
          Move earlier
        </button>
        <button className="chip" disabled={index === 0 || index >= board.spaces.length - 1} onClick={() => moveBy(1)}>
          Move later
        </button>
        <button className="chip" onClick={insertAfter}>
          Insert space after
        </button>
        {index > 0 && (
          <button className="chip" style={{ color: 'var(--loss)' }} onClick={() => setConfirmDel(true)}>
            Remove
          </button>
        )}
      </div>

      <div className="spacer" />
      <div className="grid2">
        <button className="btn" disabled={index === 0} onClick={() => onOpen(index - 1)}>
          ← Previous
        </button>
        <button className="btn" disabled={index >= board.spaces.length - 1} onClick={() => onOpen(index + 1)}>
          Next →
        </button>
      </div>
      <button className="btn primary big" onClick={onDone}>
        Done
      </button>
      {confirmDel && (
        <Confirm
          text={`Remove “${s.name}”? Card targets after this space will shift — check your “Move to” cards.`}
          yes="Remove"
          onNo={() => setConfirmDel(false)}
          onYes={() => {
            onSave({ ...board, spaces: board.spaces.filter((_, i) => i !== index) });
            onDone();
          }}
        />
      )}
    </div>
  );
}

// ---------- Cards ----------

function CardsTab({ board, deck, setDeck, onSave, onOpen }: { board: Board; deck: DeckId; setDeck: (d: DeckId) => void; onSave: (b: Board) => void; onOpen: (id: string) => void }) {
  const cards = [...board.decks[deck]].sort((a, b) => a.no - b.no);
  const add = () => {
    const no = Math.max(0, ...board.decks[deck].map((c) => c.no)) + 1;
    const c: Card = { id: uid('c'), no, text: '', action: 'collect', amount: 50 };
    onSave({ ...board, decks: { ...board.decks, [deck]: [...board.decks[deck], c] } });
    onOpen(c.id);
  };
  return (
    <>
      <div className="seg" role="group" aria-label="Deck">
        {(['chance', 'chest'] as DeckId[]).map((d) => (
          <button key={d} aria-pressed={deck === d} onClick={() => setDeck(d)}>
            {board.deckNames[d]} · {board.decks[d].length}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="deck-name">Deck name</label>
        <input id="deck-name" className="input" value={board.deckNames[deck]} onChange={(e) => onSave({ ...board, deckNames: { ...board.deckNames, [deck]: e.target.value } })} />
      </div>
      <div className="list">
        {cards.map((c) => {
          const err = cardIssue(board, c);
          return (
            <button key={c.id} className="item" onClick={() => onOpen(c.id)}>
              <span className="cardno">{c.no}</span>
              <span className="grow">
                <span className="t" style={{ display: 'block' }}>
                  {c.text || 'Untitled card'}
                </span>
                <span className={`s ${err ? 'loss' : ''}`}>{err ? `Needs fixing: ${err}` : describeCard({ board }, c)}</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          );
        })}
        {!cards.length && <div className="item muted">No cards yet.</div>}
      </div>
      <button className="btn dashed" onClick={add}>
        + Add card
      </button>
      <div className="small muted">Number each physical card (a small pencil mark works) and use the same number here — picking a card in the game is then one tap.</div>
    </>
  );
}

function CardEditor({ board, deck, card, onSave, onDone }: { board: Board; deck: DeckId; card: Card; onSave: (b: Board) => void; onDone: () => void }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (patch: Partial<Card>) => onSave({ ...board, decks: { ...board.decks, [deck]: board.decks[deck].map((c) => (c.id === card.id ? { ...c, ...patch } : c)) } });
  const err = cardIssue(board, card);
  const a = card.action;
  return (
    <div className="screen">
      <BackBar title={`${board.deckNames[deck]} card`} sub={err ? `Needs fixing: ${err}` : describeCard({ board }, card)} onBack={onDone} />
      <div className="grid2" style={{ gridTemplateColumns: '90px minmax(0,1fr)' }}>
        <NumberField id="c-no" label="Card no." value={card.no} onChange={(v) => set({ no: v ?? 0 })} min={1} />
        <div className="field">
          <label htmlFor="c-text">Card text (short)</label>
          <input id="c-text" className="input" value={card.text} onChange={(e) => set({ text: e.target.value })} placeholder="As printed on the card" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-action">What it does</label>
        <select id="c-action" className="input" value={a} onChange={(e) => set({ action: e.target.value as CardAction })}>
          {(Object.keys(ACTION_LABEL) as CardAction[]).map((k) => (
            <option key={k} value={k}>
              {ACTION_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid2">
        {(a === 'collect' || a === 'pay' || a === 'payEach' || a === 'collectEach') && <NumberField id="c-amt" label="Amount" value={card.amount} onChange={(v) => set({ amount: v })} min={0} />}
        {a === 'moveTo' && (
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="c-target">Target space</label>
            <select id="c-target" className="input" value={card.target ?? ''} onChange={(e) => set({ target: Number(e.target.value) })}>
              <option value="" disabled>
                Pick a space…
              </option>
              {board.spaces.map((s, i) => (
                <option key={s.id} value={i}>
                  {i} · {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {a === 'moveBy' && <NumberField id="c-steps" label="Spaces (negative = back)" value={card.steps} onChange={(v) => set({ steps: v })} />}
        {a === 'nearest' && (
          <>
            <div className="field">
              <label htmlFor="c-near">Nearest</label>
              <select id="c-near" className="input" value={card.nearest ?? 'station'} onChange={(e) => set({ nearest: e.target.value as 'station' | 'utility' })}>
                <option value="station">Station</option>
                <option value="utility">Utility</option>
              </select>
            </div>
            <NumberField id="c-mult" label={card.nearest === 'utility' ? 'Pay dice ×' : 'Rent multiplier'} value={card.multiplier} onChange={(v) => set({ multiplier: v })} min={1} />
          </>
        )}
        {a === 'repairs' && (
          <>
            <NumberField id="c-ph" label="Per house" value={card.perHouse} onChange={(v) => set({ perHouse: v })} min={0} />
            <NumberField id="c-pt" label="Per hotel" value={card.perHotel} onChange={(v) => set({ perHotel: v })} min={0} />
          </>
        )}
      </div>
      {(a === 'moveTo' || a === 'nearest') && (
        <label className="check">
          <input type="checkbox" checked={card.collectGo !== false} onChange={(e) => set({ collectGo: e.target.checked })} />
          Collect GO salary if passing GO
        </label>
      )}
      <div className="spacer" />
      <button className="btn danger" onClick={() => setConfirmDel(true)}>
        Delete card
      </button>
      <button className="btn primary big" onClick={onDone}>
        Done
      </button>
      {confirmDel && (
        <Confirm
          text={`Delete card #${card.no}?`}
          yes="Delete"
          onNo={() => setConfirmDel(false)}
          onYes={() => {
            onSave({ ...board, decks: { ...board.decks, [deck]: board.decks[deck].filter((c) => c.id !== card.id) } });
            onDone();
          }}
        />
      )}
    </div>
  );
}

// ---------- Sets ----------

function SetsTab({ board, onSave }: { board: Board; onSave: (b: Board) => void }) {
  const setGroup = (id: string, patch: { name?: string; color?: string }) => onSave({ ...board, groups: board.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  return (
    <>
      <div className="list">
        {board.groups.map((g) => {
          const count = board.spaces.filter((s) => s.type === 'property' && s.group === g.id).length;
          return (
            <div key={g.id} className="item">
              <label className="visually-hidden" htmlFor={`gc-${g.id}`}>
                {g.name} colour
              </label>
              <input id={`gc-${g.id}`} type="color" value={g.color} onChange={(e) => setGroup(g.id, { color: e.target.value })} style={{ width: 44, height: 44, border: 'none', background: 'none', padding: 0 }} />
              <label className="visually-hidden" htmlFor={`gn-${g.id}`}>
                Set name
              </label>
              <input id={`gn-${g.id}`} className="input grow" value={g.name} onChange={(e) => setGroup(g.id, { name: e.target.value })} />
              <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                {count} prop.
              </span>
              <button className="btn icon" aria-label={`Remove ${g.name}`} disabled={count > 0} title={count ? 'Move its properties to another set first' : ''} onClick={() => onSave({ ...board, groups: board.groups.filter((x) => x.id !== g.id) })}>
                <Icon name="close" size={18} />
              </button>
            </div>
          );
        })}
      </div>
      <button className="btn dashed" onClick={() => onSave({ ...board, groups: [...board.groups, { id: uid('g'), name: 'New set', color: '#94A3B8' }] })}>
        + Add colour set
      </button>
      <div className="small muted">A set can be removed once no property uses it.</div>
    </>
  );
}

// ---------- Rules ----------

function RulesTab({ board, onSave }: { board: Board; onSave: (b: Board) => void }) {
  const r = board.rules;
  const set = (patch: Partial<Rules>) => onSave({ ...board, rules: { ...r, ...patch } });
  const num = (k: keyof Rules, label: string) => <NumberField id={`r-${k}`} label={label} value={r[k] as number} onChange={(v) => set({ [k]: v ?? 0 } as Partial<Rules>)} min={0} />;
  return (
    <>
      <div className="grid2">
        {num('startingCash', 'Starting cash')}
        {num('goSalary', 'GO salary')}
        {num('jailFine', 'Jail fine')}
        {num('maxJailTurns', 'Tries for doubles in jail')}
        {num('houses', 'Houses in the bank')}
        {num('hotels', 'Hotels in the bank')}
        {num('mortgageInterest', 'Unmortgage interest %')}
      </div>
      <div className="card pad">
        <label className="check">
          <input type="checkbox" checked={r.doubleRentOnSet} onChange={(e) => set({ doubleRentOnSet: e.target.checked })} />
          Full colour set doubles base rent
        </label>
        <label className="check">
          <input type="checkbox" checked={r.auctions} onChange={(e) => set({ auctions: e.target.checked })} />
          Auction unbought properties
        </label>
        <label className="check">
          <input type="checkbox" checked={r.freeParkingJackpot} onChange={(e) => set({ freeParkingJackpot: e.target.checked })} />
          Free Parking jackpot (taxes and fines go to the middle)
        </label>
      </div>
    </>
  );
}
