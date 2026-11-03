import { useState } from 'react';
import { useApp } from '../app';
import { newGame, RuleError } from '../engine/game';
import { money } from '../engine/util';
import { validateBoard } from '../engine/validate';
import { Icon, NumberField } from '../ui/kit';

export const PLAYER_COLORS = ['#0E6E5C', '#1F4FD1', '#C2410C', '#7A3FC4', '#B91C1C', '#0E7490', '#A16207', '#BE185D'];

export function Setup() {
  const { boards, game, go, startGame, toast } = useApp();
  const [boardId, setBoardId] = useState(boards[0]?.id ?? '');
  const [players, setPlayers] = useState([
    { name: '', color: PLAYER_COLORS[0] },
    { name: '', color: PLAYER_COLORS[1] },
  ]);
  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  const [cash, setCash] = useState<number | undefined>(undefined);
  const [diceMode, setDiceMode] = useState<'app' | 'manual'>('app');
  const issues = board ? validateBoard(board) : [];

  const update = (i: number, patch: Partial<(typeof players)[number]>) => setPlayers(players.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= players.length) return;
    const next = [...players];
    [next[i], next[j]] = [next[j], next[i]];
    setPlayers(next);
  };
  const add = () => {
    const used = new Set(players.map((p) => p.color));
    setPlayers([...players, { name: '', color: PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0] }]);
  };

  const start = () => {
    if (!board) return;
    const named = players.map((p, i) => ({ ...p, name: p.name.trim() || `Player ${i + 1}` }));
    try {
      const b = { ...board, rules: { ...board.rules, startingCash: cash ?? board.rules.startingCash } };
      startGame(newGame(b, named, diceMode));
    } catch (e) {
      toast(e instanceof RuleError ? e.message : 'Could not start the game.');
    }
  };

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="title" style={{ fontSize: 28 }}>
          New game
        </h1>
        <button className="btn" onClick={() => go({ name: 'admin', boardId: board?.id })}>
          Admin
        </button>
      </div>

      {game && (
        <div className="card pad row">
          <div className="grow">
            <div className="t" style={{ fontWeight: 600 }}>
              Saved game in progress
            </div>
            <div className="small muted">
              Turn {game.turn} · {game.players.map((p) => p.name).join(', ')}
            </div>
          </div>
          <button className="btn primary" onClick={() => go({ name: 'game' })}>
            Resume
          </button>
        </div>
      )}

      <div className="field">
        <label htmlFor="board">Board</label>
        <select id="board" className="input" value={board?.id} onChange={(e) => setBoardId(e.target.value)}>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {board && (
          <div className="small muted">
            {board.spaces.length} spaces · {board.decks.chance.length} {board.deckNames.chance} · {board.decks.chest.length} {board.deckNames.chest} cards
          </div>
        )}
      </div>
      {issues.length > 0 && (
        <div className="warn">
          <Icon name="warn" size={18} />
          <div>
            This board has {issues.length} setup issue{issues.length > 1 ? 's' : ''} (e.g. {issues[0].where}: {issues[0].message}).{' '}
            <button className="btn link sm" style={{ color: 'inherit', padding: 0, minHeight: 0 }} onClick={() => go({ name: 'admin', boardId: board?.id })}>
              Fix in Admin
            </button>
          </div>
        </div>
      )}

      <div className="stack">
        <div className="label">Players (in turn order)</div>
        {players.map((p, i) => (
          <div key={i} className="card row" style={{ padding: '6px 6px 6px 12px' }}>
            <label className="visually-hidden" htmlFor={`color-${i}`}>
              Colour for player {i + 1}
            </label>
            <select
              id={`color-${i}`}
              value={p.color}
              onChange={(e) => update(i, { color: e.target.value })}
              style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: p.color, color: 'transparent', appearance: 'none', flexShrink: 0 }}
            >
              {PLAYER_COLORS.map((c) => (
                <option key={c} value={c} style={{ background: c, color: '#fff' }}>
                  {c}
                </option>
              ))}
            </select>
            <label className="visually-hidden" htmlFor={`name-${i}`}>
              Player {i + 1} name
            </label>
            <input
              id={`name-${i}`}
              className="input grow"
              style={{ border: 'none', height: 44, padding: '0 4px' }}
              placeholder={`Player ${i + 1}`}
              value={p.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button className="btn icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} style={{ border: 'none' }}>
              <Icon name="up" size={18} />
            </button>
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

      <div className="grid2">
        <NumberField id="cash" label="Starting cash" value={cash} placeholder={board ? String(board.rules.startingCash) : ''} onChange={setCash} min={0} />
        <div className="field">
          <label htmlFor="dice">Dice</label>
          <select id="dice" className="input" value={diceMode} onChange={(e) => setDiceMode(e.target.value as 'app' | 'manual')}>
            <option value="app">App rolls</option>
            <option value="manual">Enter physical roll</option>
          </select>
        </div>
      </div>
      {board && (
        <div className="small muted">
          GO pays {money(board.rules.goSalary)} · Jail fine {money(board.rules.jailFine)} · Auctions {board.rules.auctions ? 'on' : 'off'} · Free Parking jackpot{' '}
          {board.rules.freeParkingJackpot ? 'on' : 'off'}. Change rules in Admin.
        </div>
      )}

      <div className="spacer" />
      <button className="btn primary big" onClick={() => (game ? confirm('Start a new game? The saved game will be replaced.') && start() : start())}>
        Start game
      </button>
    </div>
  );
}
