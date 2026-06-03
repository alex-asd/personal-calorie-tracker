export default function ProgressBar({ value, target, variant, phase = 'cut' }) {
  const safeTarget = target > 0 ? target : 0;
  const pct = safeTarget > 0 ? Math.min(100, (value / safeTarget) * 100) : 0;

  // Calories on a cut: staying under is good — green up to the target, red once over.
  // Calories on a bulk: reaching the target is good, so the scale mirrors the protein bar.
  // Protein in either phase: hitting the target is good — red until met, green at/above.
  let colorClass;
  if (variant === 'calories') {
    if (phase === 'bulk') {
      colorClass = value >= safeTarget ? 'bar-green' : 'bar-red';
    } else {
      colorClass = value > safeTarget ? 'bar-red' : 'bar-green';
    }
  } else {
    colorClass = value >= safeTarget ? 'bar-green' : 'bar-red';
  }

  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemax={safeTarget}
      aria-valuemin={0}
    >
      <div className={`fill ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
