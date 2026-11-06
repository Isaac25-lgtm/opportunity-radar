export const nowIso = (d: Date = new Date()) => d.toISOString();

export function newId(prefix: string): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return `${prefix}_${[...b]
    .map((x) => x.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 20)}`;
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}

export function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/** Structured log line. Callers must never pass personal data, document contents or secrets. */
export function log(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, ...data, t: new Date().toISOString() });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
