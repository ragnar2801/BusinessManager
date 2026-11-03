import { useState } from 'react';
import { useApp, useGame } from '../app';
import { activePlayers, currentPlayer, propertiesOf, trade, tradeError, type TradeOffer } from '../engine/game';
import { money } from '../engine/util';
import type { GameState } from '../types';
import { BackBar, NumberField } from '../ui/kit';

export function Trade() {
  const g = useGame();
  const { act, go } = useApp();
  const players = activePlayers(g);
  const me = currentPlayer(g);
  const [a, setA] = useState(me.id);
  const [b, setB] = useState(players.find((p) => p.id !== me.id)?.id ?? '');
  const [aGives, setAGives] = useState<number[]>([]);
  const [bGives, setBGives] = useState<number[]>([]);
  const [aCash, setACash] = useState<number | undefined>();
  const [bCash, setBCash] = useState<number | undefined>();
  const [aJail, setAJail] = useState(0);
  const [bJail, setBJail] = useState(0);

  const offer: TradeOffer = { a, b, aGives, bGives, aCash: aCash ?? 0, bCash: bCash ?? 0, aJailCards: aJail, bJailCards: bJail };
  const err = tradeError(g, offer);

  const pick = (who: 'a' | 'b', id: string) => {
    if (who === 'a') {
      setA(id);
      setAGives([]);
      setAJail(0);
      if (id === b) setB(players.find((p) => p.id !== id)?.id ?? '');
    } else {
      setB(id);
      setBGives([]);
      setBJail(0);
    }
  };

  return (
    <div className="screen">
      <BackBar title="Trade" sub="Agree the deal at the table, then record it here." />
      <Side g={g} label="From" players={players} who={a} onWho={(id) => pick('a', id)} gives={aGives} setGives={setAGives} cash={aCash} setCash={setACash} jail={aJail} setJail={setAJail} />
      <Side
        g={g}
        label="With"
        players={players.filter((p) => p.id !== a)}
        who={b}
        onWho={(id) => pick('b', id)}
        gives={bGives}
        setGives={setBGives}
        cash={bCash}
        setCash={setBCash}
        jail={bJail}
        setJail={setBJail}
      />
      <div className="small muted">Mortgaged properties stay mortgaged for the new owner. Sets with buildings can’t be traded until the buildings are sold.</div>
      <div className="spacer" />
      {err && <div className="small center muted">{err}</div>}
      <button
        className="btn primary big"
        disabled={!!err}
        onClick={() => {
          if (act((s) => trade(s, offer))) go({ name: 'game' });
        }}
      >
        Confirm trade
      </button>
    </div>
  );
}

function Side(props: {
  g: GameState;
  label: string;
  players: GameState['players'];
  who: string;
  onWho: (id: string) => void;
  gives: number[];
  setGives: (v: number[]) => void;
  cash: number | undefined;
  setCash: (v: number | undefined) => void;
  jail: number;
  setJail: (v: number) => void;
}) {
  const { g, label, players, who, onWho, gives, setGives, cash, setCash, jail, setJail } = props;
  const p = g.players.find((x) => x.id === who);
  const own = p ? propertiesOf(g, p.id) : [];
  return (
    <div className="card pad stack">
      <div className="label">{label}</div>
      <div className="chips">
        {players.map((x) => (
          <button key={x.id} className="chip" aria-pressed={x.id === who} onClick={() => onWho(x.id)}>
            <span className="dot" style={{ background: x.color }} />
            {x.name}
          </button>
        ))}
      </div>
      {p && (
        <>
          <div className="small muted">
            {p.name} gives ({money(p.cash)} cash):
          </div>
          {own.length ? (
            <div className="stack" style={{ gap: 0 }}>
              {own.map((i) => {
                const sp = g.board.spaces[i];
                const color = g.board.groups.find((gr) => gr.id === sp.group)?.color ?? '#64748B';
                const id = `${label}-${i}`;
                return (
                  <label key={i} className="check" htmlFor={id}>
                    <input id={id} type="checkbox" checked={gives.includes(i)} onChange={(e) => setGives(e.target.checked ? [...gives, i] : gives.filter((k) => k !== i))} />
                    <span className="swatch" style={{ background: color, height: 18 }} />
                    <span className="grow">
                      {sp.name}
                      {g.owned[i].mortgaged ? ' (mortgaged)' : ''}
                      {g.owned[i].houses ? ` (${g.owned[i].houses === 5 ? 'hotel' : `${g.owned[i].houses} houses`})` : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="small muted">No properties.</div>
          )}
          <NumberField id={`${label}-cash`} label="Plus cash" value={cash} onChange={setCash} min={0} placeholder="0" />
          {p.jailCards.length > 0 && (
            <label className="check">
              <input type="checkbox" checked={jail > 0} onChange={(e) => setJail(e.target.checked ? 1 : 0)} />
              Get-out-of-jail card
            </label>
          )}
        </>
      )}
    </div>
  );
}
