// Average weight per week, over fixed seven-day blocks counted from the session
// start: days 1–7 are week 1, days 8–14 week 2, and so on. Weeks are blocks of
// calendar days, not a rolling "last seven days" window and not "the last seven
// logs", so once a week is over its average never moves again and the weeks
// can be compared with one another. The week in progress averages whatever has
// been logged in it so far; days without a log simply don't contribute.
export const WEEK_DAYS = 7;

// `points` is the chart's series: `{ x, weight }` with `x` the day index from
// the session start (0 = start date). A negative day (the start weight when it
// is drawn a day early to make room for a same-day log) belongs to no week.
// Returns `[{ week, avg, count }]` ascending by week, only for weeks with data.
export function weeklyAverages(points) {
  const acc = new Map();
  for (const p of points) {
    if (p.x < 0) continue;
    const week = Math.floor(p.x / WEEK_DAYS) + 1;
    const entry = acc.get(week) ?? { week, sum: 0, count: 0 };
    entry.sum += p.weight;
    entry.count += 1;
    acc.set(week, entry);
  }
  return [...acc.values()]
    .sort((a, b) => a.week - b.week)
    .map(({ week, sum, count }) => ({ week, avg: sum / count, count }));
}

// The week `todayIdx` falls in, how far into it we are, its running average
// (`current`, null until something is logged in it) and the latest earlier
// week that has an average (`previous`) to compare against. `weeks` lists
// every week from the first to the current one, in order and including the
// empty ones, each with its average (null when nothing was logged), the latest
// earlier week with an average and the change against it — the list under
// the chart.
export function weekSummary(points, todayIdx) {
  const day = Math.max(0, todayIdx);
  const week = Math.floor(day / WEEK_DAYS) + 1;
  const byWeek = new Map(weeklyAverages(points).map((w) => [w.week, w]));

  const weeks = [];
  let previous = null;
  for (let n = 1; n <= week; n++) {
    const data = byWeek.get(n) ?? null;
    weeks.push({
      week: n,
      avg: data ? data.avg : null,
      count: data ? data.count : 0,
      previous,
      delta: data && previous ? data.avg - previous.avg : null,
    });
    if (data) previous = data;
  }

  return {
    week,
    dayOfWeek: (day % WEEK_DAYS) + 1,
    current: byWeek.get(week) ?? null,
    previous: weeks[week - 1].previous,
    weeks,
  };
}
