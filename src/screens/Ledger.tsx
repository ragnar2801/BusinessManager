import { useState } from 'react';
import { useGame } from '../app';
import { nameOf } from '../engine/game';
import { money } from '../engine/util';
import { BackBar } from '../ui/kit';

export function Ledger() {
  const g = useGame();
  const [who, setWho] = useState<string | null>(null);
  const rows = [...g.ledger].reverse().filter((e) => !who || e.from === who || e.to === who);

  return (
    <div className="screen">
      <BackBar title="Ledger" sub={`${g.ledger.length} entries`} />
      <div className="chips" role="group" aria-label="Filter by player">
        <button className="chip" aria-pressed={!who} onClick={() => setWho(null)}>
          All
        </button>
        {g.players.map((p) => (
          <button key={p.id} className="chip" aria-pressed={who === p.id} onClick={() => setWho(p.id)}>
            <span className="dot" style={{ background: p.color }} />
            {p.name}
          </button>
        ))}
      </div>
      {g.jackpot > 0 && <div className="pill">Free Parking jackpot: {money(g.jackpot)}</div>}
      <div className="list">
        {rows.map((e) => {
          // Gain/loss colour only makes sense from one player's point of view.
          const sign = e.to === who ? 1 : -1;
          return (
            <div key={e.id} className="item" style={{ alignItems: 'flex-start' }}>
              <div className="small muted" style={{ width: 34, flexShrink: 0, paddingTop: 2, fontWeight: 600 }}>
                T{e.turn}
              </div>
              <div className="grow">
                <div className="t">{e.amount > 0 ? `${nameOf(g, e.from)} → ${nameOf(g, e.to)}` : 'Note'}</div>
                <div className="s" style={{ lineHeight: 1.4 }}>
                  {e.reason}
                </div>
              </div>
              {e.amount > 0 && (
                <div className={`display ${who ? (sign > 0 ? 'gain' : 'loss') : ''}`} style={{ fontSize: 16, whiteSpace: 'nowrap' }}>
                  {who ? (sign > 0 ? '+' : '−') : ''}
                  {money(e.amount)}
                </div>
              )}
            </div>
          );
        })}
        {!rows.length && <div className="item muted">Nothing yet.</div>}
      </div>
    </div>
  );
}
