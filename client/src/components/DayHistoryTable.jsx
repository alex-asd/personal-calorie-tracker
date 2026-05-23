import ProgressBar from './ProgressBar.jsx';

function parseLocal(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDateString(s, deltaDays) {
  const d = parseLocal(s);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLabel(dateStr, today) {
  if (today && dateStr === today) return 'Today';
  if (today && dateStr === shiftDateString(today, -1)) return 'Yesterday';
  return parseLocal(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function DayHistoryTable({ days, session, showRelative = true }) {
  if (!days || days.length === 0) return null;
  const today = showRelative ? todayString() : null;

  return (
    <section className="card">
      <h2>History</h2>
      <div className="day-rows">
        {days.map((d) => (
          <div key={d.date} className="day-row">
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
