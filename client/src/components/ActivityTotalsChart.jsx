import { useState } from 'react';
import { useActivitySeries } from '../hooks/useActivities.js';
import { useElementWidth } from '../hooks/useElementWidth.js';
import { formatShort } from '../dates.js';
import { formatAmount, formatCompact } from '../numbers.js';

const HEIGHT = 200;
const PAD = { top: 12, bottom: 22, left: 40 };
const SERIES_COLORS = 8; // --series-1..8 in styles.css; later series fall back to muted
const DEFAULT_UNIT = 'reps';
const LABEL_GAP = 13; // min vertical spacing between end-of-line labels
const CHAR_PX = 6.5; // rough 11px glyph width, to reserve room for end labels

function unitKey(unit) {
  return unit.trim().toLowerCase();
}

function niceCeil(v) {
  if (!(v > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].find((m) => m * mag >= v) * mag;
}

// Spread end-of-line labels so they never overlap: push each one below its
// upper neighbour, then pull the stack back up if it ran past the bottom.
function spreadLabels(items, minY, maxY) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    sorted[i].y = Math.max(sorted[i].y, sorted[i - 1].y + LABEL_GAP);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const limit = i === sorted.length - 1 ? maxY : sorted[i + 1].y - LABEL_GAP;
    sorted[i].y = Math.max(minY, Math.min(sorted[i].y, limit));
  }
  return sorted;
}

// Running session total per activity. Only activities that share a unit can
// share an axis, so the chart shows one unit at a time (reps by default) with a
// switch when several are logged; chips toggle individual lines.
export default function ActivityTotalsChart({ session }) {
  const { data, isLoading, error } = useActivitySeries(session);
  const [chartRef, width] = useElementWidth();
  const [pickedUnit, setPickedUnit] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());
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
    body = <p className="muted">Log an activity to see your running totals.</p>;
  }
  if (body) {
    return (
      <section className="card activity-chart">
        <h2>Session totals</h2>
        {body}
      </section>
    );
  }

  const { start, dayCount, windowDays, endLabel, dayLabel, activities, series } = data;

  const units = [];
  for (const s of series) {
    const key = unitKey(s.activity.unit);
    if (!units.some((u) => u.key === key)) units.push({ key, label: s.activity.unit });
  }
  const fallbackUnit = units.some((u) => u.key === DEFAULT_UNIT) ? DEFAULT_UNIT : units[0].key;
  const unit = units.some((u) => u.key === pickedUnit) ? pickedUnit : fallbackUnit;

  // Colour follows the activity, not its rank on screen: its position among
  // every catalog activity with this unit, so toggling never repaints a line.
  const sameUnit = activities.filter((a) => unitKey(a.unit) === unit);
  const lines = series
    .filter((s) => unitKey(s.activity.unit) === unit)
    .map((s) => {
      const slot = sameUnit.findIndex((a) => a.id === s.activity.id) + 1;
      let run = 0;
      return {
        ...s,
        cum: s.values.map((v) => (run += v)),
        color: slot <= SERIES_COLORS ? `var(--series-${slot})` : 'var(--muted)',
      };
    });
  const visible = lines.filter((l) => !hidden.has(l.activity.id));

  function toggle(id) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const last = dayCount - 1;
  const shownDay = hoverDay ?? last;
  const longestName = Math.max(0, ...visible.map((l) => l.activity.name.length));
  const padRight = Math.min(width * 0.35, 16 + longestName * CHAR_PX);
  const plotW = Math.max(1, width - PAD.left - padRight);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const top = niceCeil(Math.max(0, ...visible.map((l) => l.cum[last])));
  const span = Math.max(1, windowDays - 1); // a one-day session is a single point
  const xPx = (i) => PAD.left + (i / span) * plotW;
  const yPx = (v) => PAD.top + (1 - v / top) * plotH;

  const endLabels = spreadLabels(
    visible.map((l) => ({ line: l, y: yPx(l.cum[last]) + 4 })),
    PAD.top + 4,
    PAD.top + plotH + 4
  );

  function onPointer(e) {
    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - PAD.left) / plotW) * span);
    setHoverDay(Math.max(0, Math.min(last, i)));
  }

  return (
    <section className="card activity-chart">
      <div className="card-header">
        <h2>Session totals</h2>
        <span className="muted small">
          {hoverDay != null ? dayLabel(hoverDay) : 'Session total'}
        </span>
      </div>

      {units.length > 1 && (
        <div className="unit-switch" role="group" aria-label="Unit">
          {units.map((u) => (
            <button
              key={u.key}
              className={u.key === unit ? 'active' : ''}
              aria-pressed={u.key === unit}
              onClick={() => setPickedUnit(u.key)}
            >
              {u.label}
            </button>
          ))}
        </div>
      )}

      <div className="chart-chips">
        {lines.map((l) => {
          const on = !hidden.has(l.activity.id);
          return (
            <button
              key={l.activity.id}
              className="chart-chip"
              aria-pressed={on}
              onClick={() => toggle(l.activity.id)}
            >
              <span
                className="chart-chip-swatch"
                style={{ background: on ? l.color : 'transparent', borderColor: l.color }}
              />
              {l.activity.name}
              <span className="chart-chip-value">{formatAmount(l.cum[shownDay])}</span>
            </button>
          );
        })}
      </div>

      <div ref={chartRef}>
        {width > 0 && (
          <svg
            className="chart-svg"
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={`Running ${unit} totals for the session`}
          >
            {[top, top / 2, 0].map((v) => (
              <g key={v}>
                <line
                  className="chart-grid"
                  x1={PAD.left}
                  x2={PAD.left + plotW}
                  y1={yPx(v)}
                  y2={yPx(v)}
                />
                <text className="chart-axis-text" x={PAD.left - 6} y={yPx(v) + 4} textAnchor="end">
                  {formatCompact(v)}
                </text>
              </g>
            ))}
            <text className="chart-axis-text" x={PAD.left} y={HEIGHT - 6}>
              {formatShort(start)}
            </text>
            <text className="chart-axis-text" x={PAD.left + plotW} y={HEIGHT - 6} textAnchor="end">
              {endLabel}
            </text>

            {hoverDay != null && (
              <line
                className="chart-cursor"
                x1={xPx(hoverDay)}
                x2={xPx(hoverDay)}
                y1={PAD.top}
                y2={PAD.top + plotH}
              />
            )}

            {visible.map((l) => (
              <g key={l.activity.id} style={{ '--line': l.color }}>
                <path
                  className="chart-line"
                  d={l.cum.map((v, i) => `${i ? 'L' : 'M'} ${xPx(i)} ${yPx(v)}`).join(' ')}
                />
                <circle className="chart-dot" cx={xPx(shownDay)} cy={yPx(l.cum[shownDay])} r={4} />
              </g>
            ))}

            {endLabels.map(({ line, y }) => (
              <text key={line.activity.id} className="chart-end-label" x={xPx(last) + 8} y={y}>
                {line.activity.name}
              </text>
            ))}

            {visible.length === 0 && (
              <text
                className="chart-axis-text"
                x={PAD.left + plotW / 2}
                y={PAD.top + plotH / 2}
                textAnchor="middle"
              >
                All lines hidden
              </text>
            )}

            <rect
              x={PAD.left}
              y={PAD.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={() => setHoverDay(null)}
            />
          </svg>
        )}
      </div>
    </section>
  );
}
