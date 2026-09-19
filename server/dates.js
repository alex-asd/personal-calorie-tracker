export function today() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(startStr, endStr) {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Validate a `YYYY-MM-DD` string against the open session's editable range
// (`start_date` through today). Missing/empty defaults to today. `what` names
// the thing being logged for the future-date error ("meals", "weight").
// Returns `{ date }` or `{ error }`.
export function validateSessionDate(session, raw, what = 'entries') {
  if (raw == null || raw === '') return { date: today() };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || addDays(raw, 0) !== raw) {
    return { error: 'invalid date format' };
  }
  if (raw < session.start_date) return { error: 'date is before the session start' };
  if (raw > today()) return { error: `cannot log ${what} for a future day` };
  return { date: raw };
}
