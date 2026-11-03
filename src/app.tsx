import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RuleError } from './engine/game';
import { HISTORY_LIMIT, loadBoards, loadGame, saveBoards, saveGame, type SavedGame } from './storage';
import type { Board, GameState } from './types';

export type View =
  | { name: 'home' }
  | { name: 'game' }
  | { name: 'ledger' }
  | { name: 'properties'; playerId?: string }
  | { name: 'trade' }
  | { name: 'fix' }
  | { name: 'admin'; boardId?: string };

interface AppCtx {
  view: View;
  go: (v: View) => void;
  boards: Board[];
  setBoards: (b: Board[]) => void;
  game: GameState | null;
  /** apply an engine action; rule errors become a toast. Returns true on success. */
  act: (fn: (g: GameState) => GameState) => boolean;
  undo: () => void;
  canUndo: boolean;
  startGame: (g: GameState) => void;
  quitGame: () => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

export function useGame(): GameState {
  const { game } = useApp();
  if (!game) throw new Error('No game');
  return game;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [boards, setBoardsState] = useState<Board[]>(() => loadBoards());
  const [saved, setSaved] = useState<SavedGame | null>(() => loadGame());
  const [view, setView] = useState<View>(() => (loadGame() ? { name: 'game' } : { name: 'home' }));
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => saveGame(saved), [saved]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const setBoards = useCallback(
    (b: Board[]) => {
      setBoardsState(b);
      if (!saveBoards(b)) toast('Could not save — browser storage is unavailable.');
    },
    [toast],
  );

  const act = useCallback(
    (fn: (g: GameState) => GameState) => {
      if (!saved) return false;
      try {
        const next = fn(saved.game);
        setSaved({ game: next, history: [...saved.history, saved.game].slice(-HISTORY_LIMIT) });
        return true;
      } catch (e) {
        if (e instanceof RuleError) toast(e.message);
        else {
          console.error(e);
          toast('Something went wrong with that action.');
        }
        return false;
      }
    },
    [saved, toast],
  );

  const undo = useCallback(() => {
    if (!saved || !saved.history.length) return;
    const history = saved.history.slice(0, -1);
    setSaved({ game: saved.history[saved.history.length - 1], history });
    toast('Undone');
  }, [saved, toast]);

  const value = useMemo<AppCtx>(
    () => ({
      view,
      go: (v) => {
        setView(v);
        window.scrollTo(0, 0);
      },
      boards,
      setBoards,
      game: saved?.game ?? null,
      act,
      undo,
      canUndo: !!saved?.history.length,
      startGame: (g) => {
        setSaved({ game: g, history: [] });
        setView({ name: 'game' });
      },
      quitGame: () => {
        setSaved(null);
        setView({ name: 'home' });
      },
      toast,
    }),
    [view, boards, setBoards, saved, act, undo, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="toast" role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}
    </Ctx.Provider>
  );
}
