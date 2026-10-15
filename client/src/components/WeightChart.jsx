import { useEffect, useId, useRef, useState } from 'react';
import { useSession } from '../hooks/useSession.js';
import { useWeightHistory } from '../hooks/useWeights.js';
import { formatRange, formatShort, parseLocal, shiftDateString, todayString } from '../dates.js';
import { WEEK_DAYS, weekSummary } from '../weeklyAverage.js';

const VBW = 600;
const VBH = 220;
const PAD = { top: 22, right: 56, bottom: 30, left: 44 };
const PLOT_W = VBW - PAD.left - PAD.right;
const PLOT_H = VBH - PAD.top - PAD.bottom;
const GOAL_NEAR_KG = 1;
const GOAL_NEAR_FRAC = 0.5;

function dayIndex(dateStr, startDateStr) {
  return Math.round((parseLocal(dateStr) - parseLocal(startDateStr)) / 86400000);
}

function regression(pts) {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

function fmtDelta(v) {
  if (Math.abs(v) < 0.05) return '±0.0 kg';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} kg`;
}

// The per-week list under the chart: one card per week of the session, the
// week in progress outlined. The row scrolls sideways once the weeks outgrow
// the card and starts at the current week, the one still being filled in.
function WeeklyAverages({ weeks, currentWeek, startDate }) {
  const rowRef = useRef(null);
  const count = weeks.length;
  useEffect(() => {
    const el = rowRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [count]);

  return (
    <div className="weekly-averages">
      <div className="muted small">Weekly averages</div>
      <div className="weekly-averages-row" ref={rowRef}>
        {weeks.map((w) => {
          const isCurrent = w.week === currentWeek;
          const from = shiftDateString(startDate, (w.week - 1) * WEEK_DAYS);
          const to = shiftDateString(startDate, w.week * WEEK_DAYS - 1);
          let sub = w.week === 1 ? 'first week' : 'no earlier logs';
          let tone = '';
          if (w.avg == null) {
            sub = 'no logs';
          } else if (w.delta != null) {
            sub = fmtDelta(w.delta);
            if (w.previous.week !== w.week - 1) sub += ` vs wk ${w.previous.week}`;
            tone = w.delta < -0.05 ? 'good' : w.delta > 0.05 ? 'bad' : '';
          }
          return (
            <div key={w.week} className={`week-card ${isCurrent ? 'current' : ''}`}>
              <div className="week-card-label">
                Week {w.week}
                {isCurrent ? ' · so far' : ''}
              </div>
              <div className="week-card-range">{formatRange(from, to)}</div>
              <div className="week-card-value">
                {w.avg == null ? '—' : `${w.avg.toFixed(1)} kg`}
              </div>
              <div className={`week-card-sub ${tone}`}>{sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WeightChart() {
  const { data: session } = useSession();
  const { data, isLoading, error } = useWeightHistory();

  const gradientId = useId();
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!session) return null;
  if (isLoading) {
    return (
      <section className="card weight-chart">
        <h2>Weight progress</h2>
        <p className="muted">Loading…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="card weight-chart">
        <h2>Weight progress</h2>
        <p className="error">{error.message}</p>
      </section>
    );
  }

  const startDate = data.start_date;
  const goal = data.goal_weight_kg;
  const startW = data.start_weight_kg;

  // One point per daily log, plus the (optional) starting weight. The start
  // weight normally sits on day 0; if a weight was also logged on the start
  // date, neither is dropped — the start weight is drawn one day earlier so
  // the two form a segment instead of landing on the same x.
  const byDate = new Map();
  for (const w of data.weights) {
    byDate.set(w.date, {
      date: w.date,
      weight: w.weight_kg,
      kind: 'log',
      x: dayIndex(w.date, startDate),
    });
  }
  if (startW != null) {
    const shifted = byDate.has(startDate);
    const date = shifted ? shiftDateString(startDate, -1) : startDate;
    byDate.set(date, { date, weight: startW, kind: 'start', x: shifted ? -1 : 0 });
  }
  const points = [...byDate.values()].sort((a, b) => a.x - b.x);

  if (points.length === 0) {
    return (
      <section className="card weight-chart">
        <h2>Weight progress</h2>
        <p className="muted">Log your weight to start tracking progress.</p>
        {goal != null && <p className="muted small">Goal: {goal.toFixed(1)} kg</p>}
      </section>
    );
  }

  const todayIdx = Math.max(0, dayIndex(todayString(), startDate));
  const lastIdx = points[points.length - 1].x;
  const xMin = Math.min(0, points[0].x);
  const xMax = Math.max(todayIdx, lastIdx, 1);

  // The y-axis fits the logged weights. A goal far outside them would flatten
  // the progress line, so it only joins the chart once it's near — within
  // GOAL_NEAR_KG or GOAL_NEAR_FRAC of the weights' spread, whichever is larger.
  let yMin = Math.min(...points.map((p) => p.weight));
  let yMax = Math.max(...points.map((p) => p.weight));
  const goalGap = goal == null ? null : Math.max(0, yMin - goal, goal - yMax);
  const showGoal =
    goalGap != null && goalGap <= Math.max(GOAL_NEAR_KG, (yMax - yMin) * GOAL_NEAR_FRAC);
  if (showGoal) {
    yMin = Math.min(yMin, goal);
    yMax = Math.max(yMax, goal);
  }
  if (yMax - yMin < 1) {
    const mid = (yMax + yMin) / 2;
    yMin = mid - 0.6;
    yMax = mid + 0.6;
  } else {
    const pad = (yMax - yMin) * 0.18;
    yMin -= pad;
    yMax += pad;
  }

  const xPx = (idx) => PAD.left + ((idx - xMin) / (xMax - xMin)) * PLOT_W;
  const yPx = (w) => PAD.top + (1 - (w - yMin) / (yMax - yMin)) * PLOT_H;

  const xy = points.map((p) => ({ ...p, px: xPx(p.x), py: yPx(p.weight) }));

  const linePath = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px} ${p.py}`).join(' ');
  const bottomY = PAD.top + PLOT_H;
  const areaPath =
    xy.length >= 2
      ? `${linePath} L ${xy[xy.length - 1].px} ${bottomY} L ${xy[0].px} ${bottomY} Z`
      : null;

  const reg = regression(xy.map((p) => ({ x: p.x, y: p.weight })));
  const trend =
    reg && xy.length >= 2
      ? {
          x1: xPx(xMin),
          y1: yPx(reg.intercept + reg.slope * xMin),
          x2: xPx(xMax),
          y2: yPx(reg.intercept + reg.slope * xMax),
          slopePerWeek: reg.slope * 7,
        }
      : null;

  const current = xy[xy.length - 1].weight;
  const baseline = startW ?? xy[0].weight;
  const deltaFromStart = current - baseline;
  const toGo = goal != null ? current - goal : null;

  // Average per fixed seven-day week since the start (see weeklyAverage.js):
  // the week in progress builds up day by day, and is compared with the
  // latest earlier week that has an average.
  const weekly = weekSummary(points, todayIdx);
  const weekDelta =
    weekly.current && weekly.previous ? weekly.current.avg - weekly.previous.avg : null;

  const yTicks = [yMax, (yMax + yMin) / 2, yMin];

  // Faint verticals at the week boundaries, so the weekly list under the chart
  // maps onto stretches of the line.
  const weekDividers = [];
  for (let d = WEEK_DAYS; d < xMax; d += WEEK_DAYS) weekDividers.push(d);

  function onMove(e) {
    const svg = e.currentTarget.ownerSVGElement;
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const xInVb = ((clientX - rect.left) / rect.width) * VBW;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < xy.length; i++) {
      const d = Math.abs(xy[i].px - xInVb);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHoverIdx(best);
  }

  const active = hoverIdx != null ? xy[hoverIdx] : null;
  const goalY = showGoal ? yPx(goal) : null;

  // Tooltip box position — clamp inside the plot so it never spills off the edge.
  let tipX = 0;
  let tipAnchor = 'middle';
  if (active) {
    tipX = active.px;
    if (active.px < PAD.left + 60) tipAnchor = 'start';
    else if (active.px > VBW - PAD.right - 60) tipAnchor = 'end';
  }

  return (
    <section className="card weight-chart">
      <header className="weight-chart-head">
        <h2>Weight progress</h2>
        <div className="weight-stats">
          <div className="weight-stat">
            <div className="muted small">Current</div>
            <div className="weight-stat-value">{current.toFixed(1)} kg</div>
          </div>
          <div className="weight-stat">
            <div className="muted small">From start</div>
            <div
              className={`weight-stat-value ${
                deltaFromStart < -0.05 ? 'good' : deltaFromStart > 0.05 ? 'bad' : ''
              }`}
            >
              {fmtDelta(deltaFromStart)}
            </div>
          </div>
          {goal != null && (
            <div className="weight-stat">
              <div className="muted small">{toGo > 0 ? 'To goal' : 'Past goal'}</div>
              <div className={`weight-stat-value ${toGo <= 0.05 ? 'good' : ''}`}>
                {fmtDelta(toGo)}
              </div>
            </div>
          )}
          {trend && (
            <div className="weight-stat">
              <div className="muted small">Trend</div>
              <div
                className={`weight-stat-value ${
                  trend.slopePerWeek < -0.05 ? 'good' : trend.slopePerWeek > 0.05 ? 'bad' : ''
                }`}
              >
                {fmtDelta(trend.slopePerWeek)}/wk
              </div>
            </div>
          )}
          <div className="weight-stat">
            <div className="muted small">Week {weekly.week} avg</div>
            <div className="weight-stat-value">
              {weekly.current ? `${weekly.current.avg.toFixed(1)} kg` : '—'}
            </div>
            {weekDelta != null ? (
              <div
                className={`small weight-stat-sub ${
                  weekDelta < -0.05 ? 'good' : weekDelta > 0.05 ? 'bad' : ''
                }`}
              >
                {fmtDelta(weekDelta)} vs week {weekly.previous.week}
              </div>
            ) : weekly.previous ? (
              <div className="muted small weight-stat-sub">
                week {weekly.previous.week} avg {weekly.previous.avg.toFixed(1)} kg
              </div>
            ) : (
              <div className="muted small weight-stat-sub">day {weekly.dayOfWeek} of 7</div>
            )}
          </div>
        </div>
      </header>

      <svg
        className="weight-chart-svg"
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Weight over time"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--ok)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={VBW - PAD.right}
              y1={yPx(v)}
              y2={yPx(v)}
              className="weight-chart-grid"
            />
            <text x={PAD.left - 8} y={yPx(v) + 4} textAnchor="end" className="weight-chart-axis">
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {weekDividers.map((d) => (
          <line
            key={d}
            x1={xPx(d)}
            x2={xPx(d)}
            y1={PAD.top}
            y2={bottomY}
            className="weight-chart-week"
          />
        ))}

        <text x={PAD.left} y={VBH - 8} textAnchor="start" className="weight-chart-axis">
          {formatShort(xMin < 0 ? xy[0].date : startDate)}
        </text>
        <text x={VBW - PAD.right} y={VBH - 8} textAnchor="end" className="weight-chart-axis">
          Today
        </text>

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

        {goalY != null && (
          <>
            <line
              x1={PAD.left}
              x2={VBW - PAD.right}
              y1={goalY}
              y2={goalY}
              className="weight-chart-goal"
            />
            <text x={VBW - PAD.right + 4} y={goalY + 4} className="weight-chart-goal-label">
              goal {goal.toFixed(1)}
            </text>
          </>
        )}

        {trend && (
          <line
            x1={trend.x1}
            y1={trend.y1}
            x2={trend.x2}
            y2={trend.y2}
            className="weight-chart-trend"
          />
        )}

        {xy.length >= 2 && <path d={linePath} className="weight-chart-line" />}

        {xy.map((p, i) => (
          <circle
            key={p.date}
            cx={p.px}
            cy={p.py}
            r={i === xy.length - 1 ? 4 : 3}
            className={`weight-chart-dot ${p.kind === 'start' ? 'start' : ''} ${
              i === xy.length - 1 ? 'latest' : ''
            }`}
          />
        ))}

        {active && (
          <>
            <line
              x1={active.px}
              x2={active.px}
              y1={PAD.top}
              y2={bottomY}
              className="weight-chart-cursor"
            />
            <circle cx={active.px} cy={active.py} r={5.5} className="weight-chart-dot active" />
            <g transform={`translate(${tipX}, ${Math.max(PAD.top + 12, active.py - 14)})`}>
              <text className="weight-chart-tooltip" textAnchor={tipAnchor} y={-2}>
                {active.weight.toFixed(1)} kg · {formatShort(active.date)}
                {active.kind === 'start' ? ' · start' : ''}
              </text>
            </g>
          </>
        )}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchStart={onMove}
          onTouchMove={onMove}
          onTouchEnd={() => setHoverIdx(null)}
        />
      </svg>

      {xy.length < 2 && (
        <p className="muted small">Log a few more days to see your trend take shape.</p>
      )}

      <WeeklyAverages weeks={weekly.weeks} currentWeek={weekly.week} startDate={startDate} />
    </section>
  );
}
