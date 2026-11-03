export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function money(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US')}`;
}

export function signedMoney(n: number): string {
  if (n === 0) return '$0';
  return (n > 0 ? '+' : '−') + '$' + Math.abs(n).toLocaleString('en-US');
}

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}
