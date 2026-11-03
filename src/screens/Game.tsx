import { useEffect, useRef, useState } from 'react';
import { useApp, useGame } from '../app';
import {
  auction,
  buy,
  creditorOf,
  currentPlayer,
  declareBankrupt,
  endTurn,
  groupName,
  heldCardIds,
  nameOf,
  netWorth,
  payJailFine,
  pickCard,
  playersInDebt,
  propertiesOf,
  roll,
  skipBuy,
  playJailCard,
} from '../engine/game';
import { money } from '../engine/util';
import type { DeckId, GameState } from '../types';
import { Amount, BalanceStrip, Confirm, Icon, NumberField, Sheet } from '../ui/kit';

export function Game() {
  const g = useGame();
  const { go, undo, canUndo, quitGame } = useApp();
  const [menu, setMenu] = useState(false);
  const [quit, setQuit] = useState(false);
  const p = currentPlayer(g);

  return (
    <div className="screen">
      <div className="topbar">
        <div className="eyebrow">
          Turn {g.turn}
          {g.phase.kind !== 'roll' && ` · ${p.name}`}
        </div>
        <div className="actions">
          <button className="btn" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button className="btn" onClick={() => go({ name: 'ledger' })}>
            Ledger
          </button>
          <div className="rel">
            <button className="btn icon" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <Icon name="more" />
            </button>
            {menu && (
              <div className="menu" onClick={() => setMenu(false)}>
                <button onClick={() => go({ name: 'properties' })}>Properties &amp; building</button>
                <button onClick={() => go({ name: 'trade' })}>Trade</button>
                <button onClick={() => go({ name: 'fix' })}>Fix a mistake</button>
                <button onClick={() => go({ name: 'home' })}>Setup screen</button>
                <button onClick={() => setQuit(true)} style={{ color: 'var(--loss)' }}>
                  End game
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DebtBanner g={g} />

      {g.phase.kind === 'roll' && <RollPanel g={g} />}
      {g.phase.kind === 'buy' && <BuyPanel g={g} space={g.phase.space} />}
      {g.phase.kind === 'card' && <CardPanel g={g} deck={g.phase.deck} />}
      {g.phase.kind === 'end' && <ResultPanel g={g} />}
      {g.phase.kind === 'over' && <OverPanel g={g} winner={g.phase.winner} />}

      <BalanceStrip game={g} onPick={(id) => go({ name: 'properties', playerId: id })} />

      {quit && (
        <Confirm
          text="End this game and clear it from this device? Export or note the results first if you need them."
          yes="End game"
          onNo={() => setQuit(false)}
          onYes={quitGame}
        />
      )}
    </div>
  );
}

function DebtBanner({ g }: { g: GameState }) {
  const { act, go } = useApp();
  const [confirm, setConfirm] = useState<string | null>(null);
  const debt = playersInDebt(g);
  if (!debt.length) return null;
  return (
    <>
      {debt.map((d) => (
        <div key={d.id} className="warn" style={{ flexDirection: 'column' }}>
          <div className="row">
            <Icon name="warn" size={18} />
            <div>
              <b>{d.name}</b> is short by {money(-d.cash)}. Sell houses or mortgage to raise cash, or declare bankruptcy (owed to {nameOf(g, creditorOf(g, d.id))}).
            </div>
          </div>
          <div className="grid2" style={{ width: '100%' }}>
            <button className="btn sm" onClick={() => go({ name: 'properties', playerId: d.id })}>
              Raise cash
            </button>
            <button className="btn sm danger" onClick={() => setConfirm(d.id)}>
              Declare bankrupt
            </button>
          </div>
        </div>
      ))}
      {confirm && (
        <Confirm
          text={`${nameOf(g, confirm)} is out of the game. Their properties go to ${nameOf(g, creditorOf(g, confirm))}.`}
          yes="Declare bankrupt"
          onNo={() => setConfirm(null)}
          onYes={() => {
            act((s) => declareBankrupt(s, confirm));
            setConfirm(null);
          }}
        />
      )}
    </>
  );
}

function RollPanel({ g }: { g: GameState }) {
  const { act } = useApp();
  const p = currentPlayer(g);
  const space = g.board.spaces[p.position];
  const props = propertiesOf(g, p.id).length;
  const [manual, setManual] = useState<[number, number] | [null, null] | [number, null] | [null, number]>([null, null]);
  const last = [...g.ledger].reverse().find((e) => e.amount > 0);

  const doRoll = () => {
    if (g.diceMode === 'manual') {
      if (manual[0] == null || manual[1] == null) return;
      if (act((s) => roll(s, [manual[0] as number, manual[1] as number]))) setManual([null, null]);
    } else act((s) => roll(s));
  };

  return (
    <div className="hero">
      <div className="row" style={{ justifyContent: 'center' }}>
        <span className="dot" style={{ width: 14, height: 14, background: p.color }} />
        <div style={{ fontSize: 16, fontWeight: 600 }} className="muted">
          {p.name}'s turn
        </div>
      </div>
      <div className={`big-cash ${p.cash < 0 ? 'loss' : ''}`}>{money(p.cash)}</div>
      <div className="muted" style={{ fontSize: 15 }}>
        {p.inJail ? 'In jail' : 'On'} <b style={{ color: 'var(--ink)' }}>{p.inJail ? `(try ${p.jailTurns + 1} of ${g.board.rules.maxJailTurns})` : space.name}</b> · {props} propert{props === 1 ? 'y' : 'ies'}
        {p.jailCards.length > 0 && ` · ${p.jailCards.length} jail card`}
      </div>

      {p.inJail && (
        <div className="grid2" style={{ width: '100%', marginTop: 12 }}>
          <button className="btn" onClick={() => act(payJailFine)}>
            Pay {money(g.board.rules.jailFine)} fine
          </button>
          <button className="btn" disabled={!p.jailCards.length} onClick={() => act(playJailCard)}>
            Use jail card
          </button>
        </div>
      )}

      {g.diceMode === 'manual' && (
        <div className="stack" style={{ marginTop: 16, alignItems: 'center' }}>
          {[0, 1].map((d) => (
            <div key={d} className="row" role="group" aria-label={`Die ${d + 1}`}>
              {[1, 2, 3, 4, 5, 6].map((v) => (
                <button
                  key={v}
                  className="die pick"
                  aria-pressed={manual[d] === v}
                  onClick={() => {
                    const next = [...manual] as typeof manual;
                    next[d] = v;
                    setManual(next);
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <button className="roll-btn" onClick={doRoll} disabled={g.diceMode === 'manual' && (manual[0] == null || manual[1] == null)}>
        <Icon name="dice" size={48} />
        <span>{g.diceMode === 'manual' ? 'Move' : p.inJail ? 'Roll for doubles' : 'Roll'}</span>
      </button>

      {last && (
        <div className="small muted" style={{ marginTop: 20 }}>
          Last: {nameOf(g, last.from)} → {nameOf(g, last.to)} {money(last.amount)} · {last.reason}
        </div>
      )}
    </div>
  );
}

function Dice({ g, small }: { g: GameState; small?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = g.dice ? `${g.dice[0]}-${g.dice[1]}-${g.ledger.length}` : '';
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('rolling');
    void el.offsetWidth;
    el.classList.add('rolling');
  }, [key]);
  if (!g.dice) return null;
  return (
    <div className="dice" ref={ref} aria-label={`Rolled ${g.dice[0]} and ${g.dice[1]}`}>
      <div className={`die ${small ? 'sm' : ''}`}>{g.dice[0]}</div>
      <div className={`die ${small ? 'sm' : ''}`}>{g.dice[1]}</div>
    </div>
  );
}

function Events({ g }: { g: GameState }) {
  const money_ = g.events.filter((e) => e.money);
  const notes = g.events.filter((e) => !e.money);
  return (
    <>
      {notes.length > 0 && (
        <div className="stack" style={{ gap: 4 }}>
          {notes.map((e, i) => (
            <div key={i} className="center" style={{ fontSize: 15 }}>
              {e.text}
            </div>
          ))}
        </div>
      )}
      {money_.length > 0 && (
        <div className="card pad">
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Settled automatically
          </div>
          {money_.map((e, i) => (
            <div key={i} className="event">
              <div style={{ fontSize: 15, lineHeight: 1.4 }}>{e.text}</div>
              {e.amount !== undefined && <Amount value={e.amount} className="amt" />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ResultPanel({ g }: { g: GameState }) {
  const { act } = useApp();
  const p = currentPlayer(g);
  const space = g.board.spaces[p.position];
  const next = g.rollAgain && !p.inJail ? null : g.players[nextIndex(g)];
  const before = p.cash - g.events.reduce((n, e) => n + (e.amount ?? 0), 0);
  return (
    <>
      <Dice g={g} />
      {g.dice && <div className="center muted">Rolled {g.dice[0] + g.dice[1]}{g.dice[0] === g.dice[1] ? ' — doubles!' : ''}</div>}
      <div className="land-name">{space.name}</div>
      <Events g={g} />
      {before !== p.cash && (
        <div className="center muted small">
          {p.name}: {money(before)} → <b style={{ color: 'var(--ink)' }}>{money(p.cash)}</b>
        </div>
      )}
      <div className="spacer" />
      <button className="btn primary big" onClick={() => act(endTurn)}>
        {next ? `Next: ${next.name}'s turn` : `${p.name} rolls again`}
      </button>
    </>
  );
}

function nextIndex(g: GameState): number {
  const n = g.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (g.current + k) % n;
    if (!g.players[i].bankrupt) return i;
  }
  return g.current;
}

function BuyPanel({ g, space }: { g: GameState; space: number }) {
  const { act } = useApp();
  const p = currentPlayer(g);
  const sp = g.board.spaces[space];
  const group = g.board.groups.find((x) => x.id === sp.group);
  const [auctionOpen, setAuctionOpen] = useState(false);
  const price = sp.price ?? 0;
  const inSet = sp.group ? g.board.spaces.filter((s) => s.group === sp.group && s.type === 'property') : [];
  const mine = inSet.filter((s) => g.owned[g.board.spaces.indexOf(s)]?.owner === p.id).length;
  const band = group?.color ?? (sp.type === 'station' ? '#374151' : '#64748B');
  const label = sp.type === 'property' ? `${groupName(g.board, sp.group)} set` : sp.type === 'station' ? 'Station' : 'Utility';

  return (
    <>
      <Dice g={g} small />
      <Events g={g} />
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="deed-band" style={{ background: band, color: contrastText(band) }}>
          {label}
        </div>
        <div className="stack" style={{ padding: 16, alignItems: 'center', textAlign: 'center' }}>
          <div className="display" style={{ fontSize: 28 }}>
            {sp.name}
          </div>
          <div className="small muted">
            Unowned{sp.type === 'property' && ` · ${p.name} owns ${mine} of ${inSet.length} in this set`}
          </div>
          <div className="grid3" style={{ width: '100%' }}>
            <div className="stat">
              <div className="k">Price</div>
              <div className="v">{money(price)}</div>
            </div>
            <div className="stat">
              <div className="k">{sp.type === 'utility' ? 'Dice ×' : 'Rent'}</div>
              <div className="v">{sp.type === 'utility' ? (sp.rents?.[0] ?? 0) : money(sp.rents?.[0] ?? 0)}</div>
            </div>
            <div className="stat">
              <div className="k">{sp.type === 'property' ? 'House' : 'Mortgage'}</div>
              <div className="v">{money(sp.type === 'property' ? (sp.houseCost ?? 0) : (sp.mortgage ?? 0))}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="spacer" />
      <div className="center small muted">
        {p.name} has {money(p.cash)}
        {p.cash >= price ? (
          <>
            {' '}
            → <b style={{ color: 'var(--ink)' }}>{money(p.cash - price)}</b> after buying
          </>
        ) : (
          ' — not enough to buy (mortgage something first, or auction)'
        )}
      </div>
      <button className="btn primary big" disabled={p.cash < price} onClick={() => act(buy)}>
        Buy for {money(price)}
      </button>
      <div className={g.board.rules.auctions ? 'grid2' : 'stack'}>
        {g.board.rules.auctions && (
          <button className="btn" onClick={() => setAuctionOpen(true)}>
            Auction
          </button>
        )}
        <button className="btn" onClick={() => act(skipBuy)}>
          Skip
        </button>
      </div>
      {auctionOpen && <AuctionSheet g={g} name={sp.name} onClose={() => setAuctionOpen(false)} />}
    </>
  );
}

function AuctionSheet({ g, name, onClose }: { g: GameState; name: string; onClose: () => void }) {
  const { act } = useApp();
  const active = g.players.filter((p) => !p.bankrupt);
  const [winner, setWinner] = useState(active[0]?.id);
  const [bid, setBid] = useState<number | undefined>();
  return (
    <Sheet title={`Auction · ${name}`} onClose={onClose}>
      <div className="small muted">Run the auction at the table, then enter who won and the final bid.</div>
      <div className="label">Winner</div>
      <div className="chips">
        {active.map((p) => (
          <button key={p.id} className="chip" aria-pressed={winner === p.id} onClick={() => setWinner(p.id)}>
            <span className="dot" style={{ background: p.color }} />
            {p.name} · {money(p.cash)}
          </button>
        ))}
      </div>
      <NumberField id="bid" label="Winning bid" value={bid} onChange={setBid} min={1} />
      <button
        className="btn primary big"
        disabled={!winner || !bid}
        onClick={() => {
          if (winner && bid && act((s) => auction(s, winner, bid))) onClose();
        }}
      >
        Confirm sale
      </button>
      <button
        className="btn"
        onClick={() => {
          if (act(skipBuy)) onClose();
        }}
      >
        No bids — leave unowned
      </button>
    </Sheet>
  );
}

function CardPanel({ g, deck }: { g: GameState; deck: DeckId }) {
  const { act } = useApp();
  const [q, setQ] = useState('');
  const held = heldCardIds(g, deck);
  const deckName = g.board.deckNames[deck];
  const cards = g.board.decks[deck]
    .filter((c) => !held.has(c.id))
    .filter((c) => {
      const t = q.trim().toLowerCase();
      return !t || String(c.no) === t || c.text.toLowerCase().includes(t);
    })
    .sort((a, b) => a.no - b.no);

  return (
    <>
      <Events g={g} />
      <div className="stack" style={{ gap: 4 }}>
        <div className="display" style={{ fontSize: 28 }}>
          {deckName}
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.45 }}>Draw the top {deckName} card from the table and tap the same card below.</div>
      </div>
      <div className="field">
        <label htmlFor="cardq">Card number or text</label>
        <input id="cardq" className="input" type="search" placeholder="e.g. 7 or “station”" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {cards.map((c) => (
          <button key={c.id} className="item card" style={{ minHeight: 60 }} onClick={() => act((s) => pickCard(s, c.id))}>
            <span className="cardno">{c.no}</span>
            <span className="grow">
              <span className="t" style={{ display: 'block' }}>
                {c.text}
              </span>
              <span className="s">{describeCard(g, c)}</span>
            </span>
          </button>
        ))}
        {!cards.length && <div className="muted center">No matching card.</div>}
      </div>
      {held.size > 0 && (
        <div className="small muted center">
          {held.size} card{held.size > 1 ? 's are' : ' is'} held by players
        </div>
      )}
    </>
  );
}

export function describeCard(g: Pick<GameState, 'board'>, c: import('../types').Card): string {
  const sp = (i?: number) => g.board.spaces[i ?? -1]?.name ?? '?';
  switch (c.action) {
    case 'collect':
      return `Collect ${money(c.amount ?? 0)}`;
    case 'pay':
      return `Pay ${money(c.amount ?? 0)}`;
    case 'moveTo':
      return `Move to ${sp(c.target)}${c.collectGo === false ? ' (no GO)' : ''}`;
    case 'moveBy':
      return (c.steps ?? 0) < 0 ? `Back ${-(c.steps ?? 0)} spaces` : `Forward ${c.steps} spaces`;
    case 'nearest':
      return c.nearest === 'utility' ? `Nearest utility · dice × ${c.multiplier ?? 10}` : `Nearest station · ${c.multiplier ?? 1}× rent`;
    case 'repairs':
      return `${money(c.perHouse ?? 0)} per house, ${money(c.perHotel ?? 0)} per hotel`;
    case 'payEach':
      return `Pay each player ${money(c.amount ?? 0)}`;
    case 'collectEach':
      return `Collect ${money(c.amount ?? 0)} from each player`;
    case 'jail':
      return 'Go to jail';
    case 'jailFree':
      return 'Keep until used';
  }
}

function OverPanel({ g, winner }: { g: GameState; winner: string }) {
  const { quitGame } = useApp();
  const ranking = [...g.players].sort((a, b) => netWorth(g, b.id) - netWorth(g, a.id));
  return (
    <div className="hero">
      <div className="eyebrow">Game over</div>
      <div className="big-cash">{nameOf(g, winner)} wins</div>
      <div className="list" style={{ width: '100%', marginTop: 16 }}>
        {ranking.map((p) => (
          <div key={p.id} className="item">
            <span className="dot" style={{ background: p.color }} />
            <span className="grow t">{p.name}</span>
            <span className="s">{p.bankrupt ? 'Bankrupt' : `Net worth ${money(netWorth(g, p.id))}`}</span>
          </div>
        ))}
      </div>
      <button className="btn primary big" style={{ marginTop: 16 }} onClick={quitGame}>
        New game
      </button>
    </div>
  );
}

export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#111827';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111827' : '#ffffff';
}
