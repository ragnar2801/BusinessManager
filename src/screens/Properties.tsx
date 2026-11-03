import { useState } from 'react';
import { useApp, useGame } from '../app';
import {
  build,
  buildError,
  countOwnedOfType,
  currentPlayer,
  hotelsLeft,
  houseLabel,
  housesLeft,
  mortgage,
  mortgageError,
  ownsGroup,
  propertiesOf,
  rentFor,
  sellBuilding,
  sellError,
  unmortgage,
  unmortgageCost,
} from '../engine/game';
import { money } from '../engine/util';
import { BackBar } from '../ui/kit';
import { contrastText } from './Game';

export function Properties({ playerId }: { playerId?: string }) {
  const g = useGame();
  const { act, go, toast } = useApp();
  const [who, setWho] = useState(playerId ?? currentPlayer(g).id);
  const p = g.players.find((x) => x.id === who) ?? currentPlayer(g);
  const mine = propertiesOf(g, p.id);

  // Group: colour sets in board order, then stations, then utilities.
  const sections: { key: string; title: string; color: string; idx: number[]; note?: string }[] = [];
  g.board.groups.forEach((gr) => {
    const idx = mine.filter((i) => g.board.spaces[i].group === gr.id && g.board.spaces[i].type === 'property');
    if (!idx.length) return;
    const total = g.board.spaces.filter((s) => s.type === 'property' && s.group === gr.id).length;
    const sp = g.board.spaces[idx[0]];
    sections.push({ key: gr.id, title: `${gr.name} · ${idx.length === total ? 'full set' : `${idx.length} of ${total}`}`, color: gr.color, idx, note: `House ${money(sp.houseCost ?? 0)}` });
  });
  const st = mine.filter((i) => g.board.spaces[i].type === 'station');
  if (st.length) sections.push({ key: 'st', title: `Stations · ${countOwnedOfType(g, p.id, 'station')} of ${g.board.spaces.filter((s) => s.type === 'station').length}`, color: '#374151', idx: st });
  const ut = mine.filter((i) => g.board.spaces[i].type === 'utility');
  if (ut.length) sections.push({ key: 'ut', title: `Utilities · ${ut.length}`, color: '#64748B', idx: ut });

  const tryAct = (err: string | null, fn: Parameters<typeof act>[0]) => (err ? toast(err) : act(fn));

  return (
    <div className="screen">
      <BackBar title={`${p.name}'s properties`} sub={`Cash ${money(p.cash)} · Bank has ${housesLeft(g)} houses, ${hotelsLeft(g)} hotels`} />
      <div className="chips" role="group" aria-label="Player">
        {g.players
          .filter((x) => !x.bankrupt)
          .map((x) => (
            <button key={x.id} className="chip" aria-pressed={x.id === p.id} onClick={() => setWho(x.id)}>
              <span className="dot" style={{ background: x.color }} />
              {x.name}
            </button>
          ))}
      </div>

      {!sections.length && <div className="card pad muted center">No properties yet.</div>}

      {sections.map((sec) => (
        <div key={sec.key} className="list">
          <div className="group-head" style={{ background: sec.color, color: contrastText(sec.color) }}>
            <span>{sec.title}</span>
            {sec.note && <span>{sec.note}</span>}
          </div>
          {sec.idx.map((i) => {
            const sp = g.board.spaces[i];
            const o = g.owned[i];
            const r = rentFor(g, i);
            const status = o.mortgaged
              ? 'Mortgaged · no rent'
              : sp.type === 'property'
                ? `${houseLabel(o.houses)} · rent ${money(r.amount)}`
                : sp.type === 'station'
                  ? `Rent ${money(r.amount)}`
                  : `Dice × ${sp.rents?.[Math.min(countOwnedOfType(g, p.id, 'utility'), sp.rents.length) - 1] ?? 0}`;
            const bErr = buildError(g, i);
            const sErr = sellError(g, i);
            const mErr = mortgageError(g, i);
            return (
              <div key={i} className="item" style={{ flexWrap: 'wrap' }}>
                <div className="grow">
                  <div className="t">{sp.name}</div>
                  <div className={`s ${o.mortgaged ? 'loss' : ''}`}>{status}</div>
                </div>
                {sp.type === 'property' && !o.mortgaged && sp.group && ownsGroup(g, p.id, sp.group) && (
                  <>
                    <button className="btn square" aria-label={`Sell a building on ${sp.name}`} disabled={!!sErr} title={sErr ?? ''} onClick={() => tryAct(sErr, (s) => sellBuilding(s, i))}>
                      −
                    </button>
                    <button
                      className="btn square primary"
                      aria-label={`Build on ${sp.name}`}
                      title={bErr ?? `Costs ${money(sp.houseCost ?? 0)}`}
                      style={bErr ? { opacity: 0.45 } : undefined}
                      onClick={() => tryAct(bErr, (s) => build(s, i))}
                    >
                      +
                    </button>
                  </>
                )}
                {o.mortgaged ? (
                  <button className="btn sm" onClick={() => act((s) => unmortgage(s, i))}>
                    Unmortgage −{money(unmortgageCost(g, i))}
                  </button>
                ) : (
                  (sp.type !== 'property' || o.houses === 0) && (
                    <button className="btn sm" onClick={() => tryAct(mErr, (s) => mortgage(s, i))} style={mErr ? { opacity: 0.45 } : undefined}>
                      Mortgage +{money(sp.mortgage ?? 0)}
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="small muted">
        Own a full colour set to build. Build and sell evenly — the app takes the cost, updates rent, and pays half back when you sell. Place the physical houses on the board.
      </div>
      <div className="spacer" />
      <button className="btn big" onClick={() => go({ name: 'trade' })}>
        Trade with a player
      </button>
    </div>
  );
}
