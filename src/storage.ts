import { classicBoard } from './data/classic';
import type { Board, GameState } from './types';

// Everything lives in this browser's localStorage. Reads and writes are
// wrapped so a private window or blocked storage never breaks the app.

const BOARDS = 'boardbank.boards.v1';
const GAME = 'boardbank.game.v1';
const HISTORY = 'boardbank.history.v1';
const HISTORY_LIMIT = 40;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadBoards(): Board[] {
  const boards = read<Board[]>(BOARDS);
  if (boards && boards.length) return boards;
  const seeded = [classicBoard()];
  write(BOARDS, seeded);
  return seeded;
}

export const saveBoards = (boards: Board[]) => write(BOARDS, boards);

export interface SavedGame {
  game: GameState;
  history: GameState[];
}

export function loadGame(): SavedGame | null {
  const game = read<GameState>(GAME);
  if (!game) return null;
  return { game, history: read<GameState[]>(HISTORY) ?? [] };
}

export function saveGame(saved: SavedGame | null) {
  if (!saved) {
    write(GAME, null);
    write(HISTORY, null);
    return;
  }
  write(GAME, saved.game);
  write(HISTORY, saved.history.slice(-HISTORY_LIMIT));
}

export { HISTORY_LIMIT };

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file chosen'));
      file
        .text()
        .then((t) => resolve(JSON.parse(t)))
        .catch(() => reject(new Error('That file is not valid JSON')));
    };
    input.click();
  });
}
