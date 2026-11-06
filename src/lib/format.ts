export function fmtDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', opts);
}

export function fmtDateTime(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz ?? undefined,
      timeZoneName: 'short',
    });
  } catch {
    return d.toLocaleString('en-GB');
  }
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (Math.abs(m) < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fmtDate(iso);
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

export function deadlineLabel(iso: string | null | undefined): {
  text: string;
  tone: 'bad' | 'warn' | 'ok' | 'muted';
} {
  const d = daysUntil(iso);
  if (d === null) return { text: 'No deadline published', tone: 'muted' };
  if (d < 0) return { text: `Closed ${fmtDate(iso)}`, tone: 'muted' };
  if (d === 0) return { text: 'Closes today', tone: 'bad' };
  if (d <= 3) return { text: `Closes in ${d} day${d === 1 ? '' : 's'}`, tone: 'bad' };
  if (d <= 14) return { text: `Closes in ${d} days`, tone: 'warn' };
  return { text: `Closes ${fmtDate(iso)}`, tone: 'ok' };
}

export const ugx = (n: number) => `UGX ${n.toLocaleString('en-US')}`;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
