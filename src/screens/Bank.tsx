import { useEffect, useState } from 'react';
import { useApp } from '../app';
import { accountName, BANK, balances, newSession, recentAmounts, removeTransfer, transfer, type BankSession } from '../bank/engine';
import { useBank } from '../bank/store';
import { money } from '../engine/util';
import { BackBar, Confirm, Icon, ModeSwitch, Sheet } from '../ui/kit';
import { PLAYER_COLORS } from './Setup';

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

const CASH_CHOICES = [1000, 1500, 2000, 2500];
const SALARY_CHOICES = [0, 100, 200, 400];

export function BankSetup() {
  const { go } = useApp();
  const { session, start } = useBank();
  const [players, setPlayers] = useState([
    { name: '', color: PLAYER_COLORS[0] },
    { name: '', color: PLAYER_COLORS[1] },
    { name: '', color: PLAYER_COLORS[2] },
  ]);
  const [cash, setCash] = useState(1500);
  const [otherCash, setOtherCash] = useState(false);
  const [salary, setSalary] = useState(200);
  const [replace, setReplace] = useState(false);

  const update = (i: number, patch: Partial<(typeof players)[number]>) => setPlayers(players.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const nextColor = (c: string) => PLAYER_COLORS[(PLAYER_COLORS.indexOf(c) + 1) % PLAYER_COLORS.length];
  const add = () => {
    const used = new Set(players.map((p) => p.color));
    setPlayers([...players, { name: '', color: PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0] }]);
  };

  const begin = () => {
    start(newSession(players, cash, salary));
    go({ name: 'bank' });
  };

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="title" style={{ fontSize: 28 }}>
          Bank only
        </h1>
      </div>
      <ModeSwitch mode="bank" />
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>
        Play the board game as usual. The app only keeps everyone’s money: tap who pays, tap who gets paid, tap the amount.
      </p>

      {session && (
        <div className="card pad row">
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Bank in progress</div>
            <div className="small muted">
              {session.players.map((p) => p.name).join(', ')} · {session.transfers.length} payments
            </div>
          </div>
          <button className="btn primary" onClick={() => go({ name: 'bank' })}>
            Resume
          </button>
        </div>
      )}

      <div className="stack">
        <div className="label">Players · names are optional</div>
        {players.map((p, i) => (
          <div key={i} className="card row" style={{ padding: '6px 6px 6px 10px' }}>
            <button
              className="color-dot"
              style={{ background: p.color }}
              aria-label={`Change colour for player ${i + 1}`}
              onClick={() => update(i, { color: nextColor(p.color) })}
            />
            <label className="visually-hidden" htmlFor={`bname-${i}`}>
              Player {i + 1} name
            </label>
            <input
              id={`bname-${i}`}
              className="input grow"
              style={{ border: 'none', height: 44, padding: '0 4px' }}
              placeholder={`Player ${i + 1}`}
              value={p.name}
              enterKeyHint="next"
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button className="btn icon" aria-label="Remove player" disabled={players.length <= 2} onClick={() => setPlayers(players.filter((_, k) => k !== i))} style={{ border: 'none' }}>
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
        {players.length < 8 && (
          <button className="btn dashed" onClick={add}>
            + Add player
          </button>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="label">Everyone starts with</div>
        <div className="chips" role="group" aria-label="Starting cash">
          {CASH_CHOICES.map((c) => (
            <button
              key={c}
              className="chip lg"
              aria-pressed={!otherCash && cash === c}
              onClick={() => {
                setOtherCash(false);
                setCash(c);
              }}
            >
              {money(c)}
            </button>
          ))}
          <button className="chip lg" aria-pressed={otherCash} onClick={() => setOtherCash(true)}>
            Other
          </button>
        </div>
        {otherCash && (
          <input
            className="input"
            aria-label="Starting cash"
            inputMode="numeric"
            type="number"
            min={0}
            autoFocus
            value={cash}
            onChange={(e) => setCash(Math.max(0, Math.trunc(Number(e.target.value)) || 0))}
          />
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="label">One-tap “Pass GO” button pays</div>
        <div className="chips" role="group" aria-label="Pass GO amount">
          {SALARY_CHOICES.map((c) => (
            <button key={c} className="chip lg" aria-pressed={salary === c} onClick={() => setSalary(c)}>
              {c ? money(c) : 'Off'}
            </button>
          ))}
        </div>
      </div>

      <div className="spacer" />
      <button className="btn primary big" onClick={() => (session ? setReplace(true) : begin())}>
        Open the bank
      </button>
      {replace && <Confirm text="This replaces the bank in progress and its history." yes="Start new" onNo={() => setReplace(false)} onYes={begin} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main screen: tap who pays, tap who gets paid                        */
/* ------------------------------------------------------------------ */

export function BankHome() {
  const { session } = useBank();
  if (!session) return <BankSetup />;
  return <BankBoard session={session} />;
}

function BankBoard({ session }: { session: BankSession }) {
  const { go, toast } = useApp();
  const { apply, end } = useBank();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [ending, setEnding] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const bal = balances(session);
  const last = session.transfers[session.transfers.length - 1];

  // Briefly highlight the tiles whose balance just changed.
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 900);
    return () => window.clearTimeout(t);
  }, [flash]);

  const tap = (id: string) => {
    if (!from) setFrom(id);
    else if (from === id) setFrom(null);
    else setTo(id);
  };

  const pay = (a: string, b: string, amount: number) => {
    const err = apply((s) => transfer(s, a, b, amount));
    if (err) return toast(err);
    setFrom(null);
    setTo(null);
    setFlash(`${a}|${b}`);
  };

  const flashed = (id: string) => !!flash && flash.split('|').includes(id);
  const role = (id: string) => (from === id ? 'from' : from ? 'target' : '');

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="title">Bank</h1>
        <div className="actions">
          <button className="btn" onClick={() => go({ name: 'bankHistory' })}>
            History
          </button>
          <div className="rel">
            <button className="btn icon" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <Icon name="more" />
            </button>
            {menu && (
              <div className="menu" onClick={() => setMenu(false)}>
                <button onClick={() => go({ name: 'bankSetup' })}>Setup screen</button>
                <button onClick={() => setEnding(true)}>End this bank</button>
                <button onClick={() => go({ name: 'home' })}>Switch to full game</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`hint ${from ? 'on' : ''}`} aria-live="polite">
        {from ? (
          <>
            <span>
              <b>{accountName(session, from)}</b> pays… now tap who gets paid
            </span>
            <button className="btn sm" onClick={() => setFrom(null)}>
              Cancel
            </button>
          </>
        ) : (
          <span>Tap who pays</span>
        )}
      </div>

      <button className={`tile bank ${role(BANK)} ${flashed(BANK) ? 'flash' : ''}`} onClick={() => tap(BANK)} aria-label={from ? (from === BANK ? 'Bank, selected as payer. Tap to cancel' : 'Bank gets paid') : 'Bank pays'}>
        <span className="tile-name">
          <BankIcon /> Bank
        </span>
        <span className="tile-tag">{from === BANK ? 'Paying' : from ? 'Gets paid' : 'Unlimited'}</span>
      </button>

      <div className="tiles">
        {session.players.map((p) => {
          const r = role(p.id);
          return (
            <div key={p.id} className={`tile ${r} ${flashed(p.id) ? 'flash' : ''}`} style={{ ['--pc' as string]: p.color }}>
              <button
                className="tile-hit"
                onClick={() => tap(p.id)}
                aria-label={`${p.name}, ${money(bal[p.id])}. ${r === 'from' ? 'Selected as payer. Tap to cancel' : r === 'target' ? 'Gets paid' : 'Pays'}`}
              />
              <span className="tile-name">
                <span className="dot" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className={`tile-amt ${bal[p.id] < 0 ? 'loss' : ''}`}>{money(bal[p.id])}</span>
              <span className="tile-foot">
                <span className="tile-tag">{r === 'from' ? 'Paying' : r === 'target' ? 'Gets paid' : ''}</span>
                {session.salary > 0 && !from && (
                  <button className="go-btn" onClick={() => pay(BANK, p.id, session.salary)} aria-label={`${p.name} passes GO: bank pays ${money(session.salary)}`}>
                    GO +{money(session.salary)}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="spacer" />

      {last && (
        <div className="last card row" aria-live="polite">
          <div className="grow">
            <div className="small muted">Last payment</div>
            <div style={{ fontWeight: 600 }}>
              {accountName(session, last.from)} → {accountName(session, last.to)} <span className="display">{money(last.amount)}</span>
            </div>
          </div>
          <button className="btn" onClick={() => apply((s) => removeTransfer(s, last.id))}>
            Undo
          </button>
        </div>
      )}

      {from && to && (
        <AmountSheet
          session={session}
          from={from}
          to={to}
          onSwap={() => {
            setFrom(to);
            setTo(from);
          }}
          onPay={(n) => pay(from, to, n)}
          onClose={() => setTo(null)}
        />
      )}

      {ending && (
        <Confirm
          text="End this bank? All balances and history will be cleared."
          yes="End bank"
          onNo={() => setEnding(false)}
          onYes={() => {
            end();
            go({ name: 'bankSetup' });
          }}
        />
      )}
    </div>
  );
}

function BankIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10l9-6 9 6M5 10v8M19 10v8M9.5 10v8M14.5 10v8M3 21h18" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Amount: tap notes to add up, or switch to a keypad                  */
/* ------------------------------------------------------------------ */

const NOTES = [1, 5, 10, 20, 50, 100, 500];

function AmountSheet({
  session,
  from,
  to,
  onPay,
  onSwap,
  onClose,
}: {
  session: BankSession;
  from: string;
  to: string;
  onPay: (n: number) => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'notes' | 'keypad'>('notes');
  // Notes mode keeps each tap so ⌫ removes the last note added.
  const [taps, setTaps] = useState<number[]>([]);
  const [digits, setDigits] = useState('');
  const amount = mode === 'notes' ? taps.reduce((a, b) => a + b, 0) : Number(digits || 0);
  const setAmount = (n: number) => {
    setTaps([n]);
    setDigits(String(n));
  };
  const back = () => (mode === 'notes' ? setTaps(taps.slice(0, -1)) : setDigits(digits.slice(0, -1)));
  const switchMode = (m: 'notes' | 'keypad') => {
    if (m === mode) return;
    // carry the current amount across
    if (m === 'keypad') setDigits(amount ? String(amount) : '');
    else setTaps(amount ? [amount] : []);
    setMode(m);
  };

  const presets = [...(from === BANK && session.salary ? [session.salary] : []), ...recentAmounts(session)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
  const bal = balances(session);
  const short = from !== BANK && amount > bal[from];
  const fromName = accountName(session, from);
  const toName = accountName(session, to);

  return (
    <Sheet title="How much?" onClose={onClose}>
      <div className="who">
        <span className="who-chip">{fromName}</span>
        <button className="btn icon sm-icon" aria-label="Swap who pays and who gets paid" onClick={onSwap}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 7h13l-4-4M17 17H4l4 4" />
          </svg>
        </button>
        <span className="who-chip">{toName}</span>
      </div>

      <div className="amount-display" aria-live="polite">
        <span className={`big-cash ${amount ? '' : 'muted'}`}>{money(amount)}</span>
        <button className="btn icon" aria-label="Remove last" disabled={!amount} onClick={back}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 5H9l-7 7 7 7h12V5zM17 9l-6 6M11 9l6 6" />
          </svg>
        </button>
      </div>

      {presets.length > 0 && (
        <div className="chips" role="group" aria-label="Quick amounts">
          {presets.map((n) => (
            <button key={n} className="chip lg" onClick={() => setAmount(n)}>
              {money(n)}
            </button>
          ))}
        </div>
      )}

      <div className="seg" role="group" aria-label="Input">
        <button aria-pressed={mode === 'notes'} onClick={() => switchMode('notes')}>
          Tap notes
        </button>
        <button aria-pressed={mode === 'keypad'} onClick={() => switchMode('keypad')}>
          Keypad
        </button>
      </div>

      {mode === 'notes' ? (
        <div className="notes">
          {NOTES.map((n) => (
            <button key={n} className="note" onClick={() => setTaps([...taps, n])} aria-label={`Add ${money(n)}`}>
              +{n}
            </button>
          ))}
          <button className="note clear" disabled={!amount} onClick={() => setTaps([])}>
            Clear
          </button>
        </div>
      ) : (
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '000'].map((k) => (
            <button key={k} className="note" onClick={() => setDigits((digits + k).replace(/^0+/, '').slice(0, 7))}>
              {k}
            </button>
          ))}
        </div>
      )}

      {short && (
        <div className="warn">
          <Icon name="warn" size={18} />
          <div>
            {fromName} only has {money(bal[from])}. They’ll be at {money(bal[from] - amount)}.
          </div>
        </div>
      )}

      <button className="btn primary big" disabled={!amount} onClick={() => onPay(amount)}>
        {amount ? `${fromName} pays ${toName} ${money(amount)}` : 'Pick an amount'}
      </button>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export function BankHistory() {
  const { go } = useApp();
  const { session, apply } = useBank();
  const [who, setWho] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  if (!session) return <BankSetup />;

  const rows = [...session.transfers].reverse().filter((t) => !who || t.from === who || t.to === who);
  const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="screen">
      <BackBar title="History" sub={`${session.transfers.length} payments`} onBack={() => go({ name: 'bank' })} />
      <div className="chips" role="group" aria-label="Filter">
        <button className="chip" aria-pressed={!who} onClick={() => setWho(null)}>
          All
        </button>
        {session.players.map((p) => (
          <button key={p.id} className="chip" aria-pressed={who === p.id} onClick={() => setWho(p.id)}>
            <span className="dot" style={{ background: p.color }} />
            {p.name}
          </button>
        ))}
        <button className="chip" aria-pressed={who === BANK} onClick={() => setWho(BANK)}>
          Bank
        </button>
      </div>
      <div className="list">
        {rows.map((t) => {
          const sign = who ? (t.to === who ? 1 : -1) : 0;
          return (
            <div key={t.id} className="item">
              <div className="grow">
                <div className="t">
                  {accountName(session, t.from)} → {accountName(session, t.to)}
                </div>
                <div className="s">{time(t.at)}</div>
              </div>
              <div className={`display ${sign > 0 ? 'gain' : sign < 0 ? 'loss' : ''}`} style={{ fontSize: 17, whiteSpace: 'nowrap' }}>
                {sign > 0 ? '+' : sign < 0 ? '−' : ''}
                {money(t.amount)}
              </div>
              <button className="btn sm" onClick={() => setRemoving(t.id)} aria-label="Remove this payment">
                Remove
              </button>
            </div>
          );
        })}
        {!rows.length && <div className="item muted">No payments yet.</div>}
      </div>
      {removing && (
        <Confirm
          text="Remove this payment? Both balances go back as if it never happened."
          yes="Remove"
          onNo={() => setRemoving(null)}
          onYes={() => {
            apply((s) => removeTransfer(s, removing));
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}
