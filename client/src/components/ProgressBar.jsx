function caloriesHue(pct) {
  if (pct <= 75) return 120;
  if (pct >= 100) return 0;
  return 120 * (1 - (pct - 75) / 25);
}

function proteinHue(pct) {
  const p = Math.min(100, pct);
  if (p <= 50) return (30 / 50) * p;
  return 30 + (90 / 50) * (p - 50);
}

export default function ProgressBar({ value, target, variant, phase = 'cut' }) {
  const safeTarget = target > 0 ? target : 0;
  const ratio = safeTarget > 0 ? (value / safeTarget) * 100 : 0;
  const pct = Math.min(100, ratio);
  // On a bulk the calorie target is a floor — mirror the protein curve so
  // the bar rises from red toward green as the target is met.
  let hue;
  if (variant === 'calories') {
    hue = phase === 'bulk' ? proteinHue(pct) : caloriesHue(pct);
  } else {
    hue = proteinHue(pct);
  }

  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemax={safeTarget}
      aria-valuemin={0}
    >
      <div className="fill" style={{ width: `${pct}%`, '--bar-hue': hue }} />
    </div>
  );
}
