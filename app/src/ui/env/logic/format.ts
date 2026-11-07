// Sizes, counts and ages as people read them. Pure (zero RN imports).

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** 1234567 → "1.2 MB". Decimal units, like Android's own storage screens. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits).replace(/\.0$/, '')} ${BYTE_UNITS[unit]}`;
}

/** 1234567 → "1.2M" (pull counts). */
export function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return '';
  const steps: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of steps) {
    if (n >= size) {
      const v = n / size;
      return `${v.toFixed(v >= 100 ? 0 : 1).replace(/\.0$/, '')}${suffix}`;
    }
  }
  return String(Math.round(n));
}

const DAY = 24 * 60 * 60 * 1000;

/** An ISO date or epoch ms → "today", "3 days ago", "2 months ago", "1 year ago". */
export function formatAgo(when: string | number | null | undefined, now: number): string {
  if (when == null || when === '') return '';
  const t = typeof when === 'number' ? when : Date.parse(when);
  if (!Number.isFinite(t)) return '';
  const days = Math.floor(Math.max(0, now - t) / DAY);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const months = Math.floor(days / 30.4);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
