import { useState } from 'react';
import { useActivitySeries } from '../hooks/useActivities.js';
import { formatShort } from '../dates.js';
import { formatAmount } from '../numbers.js';

const BAR_FILL = 0.7; // share of each day's slot the bar covers
const MIN_BAR = 0.08; // shortest visible bar, as a share of the strip height

// One bar strip per logged activity, each on its own scale, so 10,000 steps and
// 12 pull-ups are equally readable. Hovering (or dragging on touch) picks a day
// and every row switches from its session total to that day's amount.
export default function ActivityDailyChart({ session }) {
  const { data, isLoading, error } = useActivitySeries(session);
  const [hoverDay, setHoverDay] = useState(null);

  let body;
  if (isLoading) {
    body = <p className="muted">Loading…</p>;
  } else if (error) {
    body = <p className="error">{error.message}</p>;
  } else if (data.series.length === 0) {
    // Archived sessions (including ones from before activity tracking) have
    // nothing to add, so skip the card rather than show an empty one.
    if (session.status === 'closed') return null;
    body = <p className="muted">Log an activity to see it here.</p>;
  }
  if (body) {
    return (
      <section className="card activity-chart">
        <h2>Activity by day</h2>
        {body}
      </section>
    );
  }

  const { start, dayCount, windowDays, endLabel, dayLabel, series } = data;

  function onPointer(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const day = Math.floor(((e.clientX - rect.left) / rect.width) * windowDays);
    setHoverDay(day >= 0 && day < dayCount ? day : null);
  }

  return (
    <section className="card activity-chart">
      <div className="card-header">
        <h2>Activity by day</h2>
        <span className="muted small">
          {hoverDay != null ? dayLabel(hoverDay) : 'Session total'}
        </span>
      </div>

      <div
        className="strips"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHoverDay(null)}
      >
        {series.map(({ activity, values, total }) => {
          const max = Math.max(...values);
          const shown = hoverDay != null ? values[hoverDay] : total;
          return (
            <div key={activity.id} className="strip">
              <div className="strip-head">
                <span className="strip-name">{activity.name}</span>
                <span className="strip-value">
                  {formatAmount(shown)} <span className="muted small">{activity.unit}</span>
                </span>
              </div>
              <svg
                className="strip-bars"
                viewBox={`0 0 ${windowDays} 1`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {hoverDay != null && (
                  <rect className="strip-cursor" x={hoverDay} y={0} width={1} height={1} />
                )}
                {values.map((v, i) => {
                  if (!v) return null;
                  const h = Math.max(MIN_BAR, v / max);
                  return (
                    <rect
                      key={i}
                      className="strip-bar"
                      x={i + (1 - BAR_FILL) / 2}
                      y={1 - h}
                      width={BAR_FILL}
                      height={h}
                    />
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>

      <div className="chart-axis">
        <span>{formatShort(start)}</span>
        <span>{endLabel}</span>
      </div>
    </section>
  );
}
