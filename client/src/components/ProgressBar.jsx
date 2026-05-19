export default function ProgressBar({ value, target, variant }) {
  const safeTarget = target > 0 ? target : 0;
  const pct = safeTarget > 0 ? Math.min(100, (value / safeTarget) * 100) : 0;

  let colorClass;
  if (variant === 'calories') {
    colorClass = value > safeTarget ? 'bar-red' : 'bar-green';
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
