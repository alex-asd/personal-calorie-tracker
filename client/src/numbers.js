// Display helpers for activity amounts — steps, reps, or custom units that may
// be decimal (km, min).
export function formatAmount(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

// Short axis labels: 1,200 → "1.2K", 45,000 → "45K".
export function formatCompact(n) {
  return compact.format(n);
}
