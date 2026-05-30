import ProgressBar from './ProgressBar.jsx';
import { todayString, formatLabel } from '../dates.js';

export default function DayHistoryTable({ days, session, showRelative = true, onSelectDay }) {
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
            </div>
            <div className="day-bars">
              <div className="bar-row">
                <ProgressBar
                  value={d.calories}
                  target={session.calorie_target}
                  variant="calories"
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
          </div>
        ))}
      </div>
    </section>
  );
}
