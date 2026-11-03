import { useState } from 'react';
import { useApp, useGame } from '../app';
import { adjustCash, isOwnable, nameOf, setHouses, setOwner, setPosition, toggleJail } from '../engine/game';
import { money } from '../engine/util';
import { BackBar, NumberField } from '../ui/kit';

/** Corrections for when the table and the app disagree. Every change is logged. */
export function Fix() {
  const g = useGame();
  const { act, toast } = useApp();
  const [pid, setPid] = useState(g.players[0].id);
  const [delta, setDelta] = useState<number | undefined>();
  const [why, setWhy] = useState('');
  const [space, setSpace] = useState<number>(() => g.board.spaces.findIndex(isOwnable));
  const p = g.players.find((x) => x.id === pid)!;
  const own = g.owned[space];
  const sp = g.board.spaces[space];

  const apply = (sign: 1 | -1) => {
    if (!delta) return toast('Enter an amount.');
    if (act((s) => adjustCash(s, pid, sign * delta, why))) {
      toast(`${p.name} ${sign > 0 ? '+' : '−'}${money(delta)} recorded`);
      setDelta(undefined);
      setWhy('');
    }
  };

  return (
    <div className="screen">
      <BackBar title="Fix a mistake" sub="Every correction is written to the ledger." />

      <div className="card pad stack">
        <div className="label">Player</div>
        <div className="chips">
          {g.players.map((x) => (
            <button key={x.id} className="chip" aria-pressed={x.id === pid} onClick={() => setPid(x.id)}>
              <span className="dot" style={{ background: x.color }} />
              {x.name} · {money(x.cash)}
            </button>
          ))}
        </div>
        <div className="grid2">
          <NumberField id="fix-amt" label="Amount" value={delta} onChange={setDelta} min={1} />
          <div className="field">
            <label htmlFor="fix-why">Reason</label>
            <input id="fix-why" className="input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. missed rent" />
          </div>
        </div>
        <div className="grid2">
          <button className="btn" onClick={() => apply(-1)}>
            Take from {p.name}
          </button>
          <button className="btn" onClick={() => apply(1)}>
            Give to {p.name}
          </button>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="fix-pos">Pawn is on</label>
            <select id="fix-pos" className="input" value={p.position} onChange={(e) => act((s) => setPosition(s, pid, Number(e.target.value)))}>
              {g.board.spaces.map((s, i) => (
                <option key={s.id} value={i}>
                  {i} · {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="label">Jail</span>
            <button className="btn" onClick={() => act((s) => toggleJail(s, pid))}>
              {p.inJail ? 'Release from jail' : 'Put in jail'}
            </button>
          </div>
        </div>
      </div>

      <div className="card pad stack">
        <div className="label">Property ownership</div>
        <div className="field">
          <label htmlFor="fix-space">Property</label>
          <select id="fix-space" className="input" value={space} onChange={(e) => setSpace(Number(e.target.value))}>
            {g.board.spaces.map((s, i) =>
              isOwnable(s) ? (
                <option key={s.id} value={i}>
                  {s.name} — {g.owned[i] ? nameOf(g, g.owned[i].owner) : 'Bank'}
                </option>
              ) : null,
            )}
          </select>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="fix-owner">Owner</label>
            <select id="fix-owner" className="input" value={own?.owner ?? ''} onChange={(e) => act((s) => setOwner(s, space, e.target.value || null))}>
              <option value="">Bank (unowned)</option>
              {g.players
                .filter((x) => !x.bankrupt)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </div>
          {sp?.type === 'property' && own && (
            <div className="field">
              <label htmlFor="fix-houses">Buildings</label>
              <select id="fix-houses" className="input" value={own.houses} onChange={(e) => act((s) => setHouses(s, space, Number(e.target.value)))}>
                {[0, 1, 2, 3, 4, 5].map((h) => (
                  <option key={h} value={h}>
                    {h === 5 ? 'Hotel' : `${h} house${h === 1 ? '' : 's'}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="small muted">Ownership and building fixes don’t move money. Use the amount fields above if cash also needs correcting.</div>
      </div>
    </div>
  );
}
