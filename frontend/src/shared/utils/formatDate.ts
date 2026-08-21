const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;

/** Turns an API date (`YYYY-MM-DD`) into `ДД.ММ.ГГГГ`. Unknown shapes pass through. */
export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return '';
  const match = value.trim().match(ISO_DATE);
  if (!match) return value.trim();
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/**
 * Accepts `ДД.ММ.ГГГГ`, `ДД/ММ/ГГГГ` or ISO. Empty → `''`.
 * Incomplete/invalid typing returns `null` so the caller can keep local text
 * without wiping a previously valid value.
 */
export function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const iso = trimmed.match(ISO_DATE);
  if (iso) return isValidYmd(iso[1], iso[2], iso[3]) ? trimmed : null;

  const dmy = trimmed.match(DMY_DATE);
  if (!dmy) return null;
  const day = dmy[1].padStart(2, '0');
  const month = dmy[2].padStart(2, '0');
  const year = dmy[3];
  return isValidYmd(year, month, day) ? `${year}-${month}-${day}` : null;
}

function isValidYmd(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
