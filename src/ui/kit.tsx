import type { ReactNode } from 'react';
import { useApp } from '../app';
import { money, signedMoney } from '../engine/util';
import type { GameState } from '../types';

const paths: Record<string, ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9 18l6-6-6-6" />,
  warn: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </>
  ),
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  down: <path d="M12 5v14M19 12l-7 7-7-7" />,
};

export function Icon({ name, size = 20 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function BackBar({ title, sub, onBack, right }: { title: string; sub?: string; onBack?: () => void; right?: ReactNode }) {
  const { go } = useApp();
  return (
    <div className="topbar">
      <div className="back grow">
        <button className="btn icon" aria-label="Back" onClick={onBack ?? (() => go({ name: 'game' }))}>
          <Icon name="back" />
        </button>
        <div className="grow">
          <h1 className="title">{title}</h1>
          {sub && <div className="small muted">{sub}</div>}
        </div>
      </div>
      {right && <div className="actions">{right}</div>}
    </div>
  );
}

export function Amount({ value, className = '' }: { value: number; className?: string }) {
  return <span className={`display ${value >= 0 ? 'gain' : 'loss'} ${className}`}>{signedMoney(value)}</span>;
}

export function BalanceStrip({ game, onPick }: { game: GameState; onPick?: (id: string) => void }) {
  return (
    <div className="strip" aria-label="Balances">
      {game.players.map((p, i) => {
        const cls = `p ${i === game.current && !p.bankrupt ? 'on' : ''} ${p.bankrupt ? 'out' : ''}`;
        const body = (
          <>
            <span className="name">
              <span className="dot" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className={`amt ${p.cash < 0 ? 'loss' : ''}`}>{p.bankrupt ? 'Out' : money(p.cash)}</span>
          </>
        );
        return onPick ? (
          <button key={p.id} className={cls} onClick={() => onPick(p.id)} aria-label={`${p.name}, ${money(p.cash)}. Show properties`}>
            {body}
          </button>
        ) : (
          <div key={p.id} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="title grow" style={{ fontSize: 20 }}>
            {title}
          </h2>
          <button className="btn icon" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Integer input that keeps a string while typing. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  placeholder,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        inputMode="numeric"
        type="number"
        min={min}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Math.trunc(Number(v)));
        }}
      />
    </div>
  );
}

export function Confirm({ text, onYes, onNo, yes = 'Confirm' }: { text: string; onYes: () => void; onNo: () => void; yes?: string }) {
  return (
    <Sheet title="Are you sure?" onClose={onNo}>
      <p style={{ margin: 0 }}>{text}</p>
      <div className="grid2">
        <button className="btn" onClick={onNo}>
          Cancel
        </button>
        <button className="btn primary" onClick={onYes}>
          {yes}
        </button>
      </div>
    </Sheet>
  );
}
