import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BankSession } from './engine';

const KEY = 'boardbank.bankmode.v1';

function load(): BankSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BankSession) : null;
  } catch {
    return null;
  }
}

function save(s: BankSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session still works for this tab */
  }
}

export const hasSavedBank = () => load() !== null;

interface BankCtx {
  session: BankSession | null;
  /** apply a change; errors become the returned message */
  apply: (fn: (s: BankSession) => BankSession) => string | null;
  start: (s: BankSession) => void;
  end: () => void;
}

const Ctx = createContext<BankCtx | null>(null);

export function BankProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<BankSession | null>(load);
  // A ref keeps the newest session so two quick taps in a row both land,
  // even before React re-renders between them.
  const latest = useRef(session);
  const setSession = useCallback((s: BankSession | null) => {
    latest.current = s;
    setSessionState(s);
  }, []);
  useEffect(() => save(session), [session]);

  const apply = useCallback(
    (fn: (s: BankSession) => BankSession) => {
      if (!latest.current) return 'No bank session.';
      try {
        setSession(fn(latest.current));
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Something went wrong.';
      }
    },
    [setSession],
  );

  const value = useMemo<BankCtx>(() => ({ session, apply, start: setSession, end: () => setSession(null) }), [session, apply, setSession]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBank(): BankCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useBank outside provider');
  return c;
}
