import ProgressBar from './ProgressBar.jsx';
import { todayString, formatLabel } from '../dates.js';
import { formatAmount } from '../numbers.js';

// "Push-ups 35", "Steps 8,432", "Plank 90 sec": the unit is left off when the
// name already implies it (reps, or a unit that is the name itself).
function activityAmount({ activity, amount }) {
  const unit = activity.unit.trim().toLowerCase();
  const implied = unit === 'reps' || unit === activity.name.trim().toLowerCase();
  return implied ? formatAmount(amount) : `${formatAmount(amount)} ${activity.unit}`;
}

export default function DayHistoryTable({
  days,
  session,
  showRelative = true,
  onSelectDay,
  weightsByDate,
  activitiesByDate,
}) {
  if (!days || days.length === 0) return null;
  const today = showRelative ? todayString() : null;
  const clickable = Boolean(onSelectDay);

  return (
    <section className="card">
      <h2>History</h2>
      <div className="day-rows">
        {days.map((d) => (
          <div
            key={d.date}
            className={clickable ? 'day-row clickable' : 'day-row'}
            {...(clickable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  onClick: () => onSelectDay(d.date),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectDay(d.date);
                    }
                  },
                }
              : {})}
          >
            <div className="day-label">
              <div className="day-label-main">{formatLabel(d.date, today)}</div>
              <div className="muted small">{d.date}</div>
              {weightsByDate &&
                (weightsByDate[d.date] != null ? (
                  <div className="small day-weight">{weightsByDate[d.date]} kg</div>
                ) : (
                  <div className="muted small day-weight">no weight</div>
                ))}
            </div>
            <div className="day-bars">
              <div className="bar-row">
                <ProgressBar
                  value={d.calories}
                  target={session.calorie_target}
                  variant="calories"
                  phase={session.phase}
                />
                <div className="bar-numeric">
                  {Math.round(d.calories)}
                  <span className="muted"> / {session.calorie_target}</span>
                </div>
              </div>
              <div className="bar-row">
                <ProgressBar value={d.protein} target={session.protein_target} variant="protein" />
                <div className="bar-numeric">
                  {Math.round(d.protein)}g
                  <span className="muted"> / {session.protein_target}g</span>
                </div>
              </div>
            </div>
            {activitiesByDate?.[d.date] && (
              <div className="day-activities">
                {activitiesByDate[d.date].map((entry) => (
                  <span key={entry.activity.id} className="day-activity">
                    <span className="muted">{entry.activity.name}</span> {activityAmount(entry)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
