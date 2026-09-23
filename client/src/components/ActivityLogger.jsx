import { useState } from 'react';
import { useActivities, useActivityLogs } from '../hooks/useActivities.js';
import { todayString } from '../dates.js';
import ActivityEntry from './ActivityEntry.jsx';
import ActivityManager from './ActivityManager.jsx';

// Today's activity totals: one row per activity (presets first, then custom),
// plus a Manage mode for adding / renaming / deleting custom activities.
export default function ActivityLogger({ disabled = false }) {
  const date = todayString();
  const activitiesQuery = useActivities();
  const logsQuery = useActivityLogs(date);
  const [managing, setManaging] = useState(false);

  const activities = activitiesQuery.data ?? [];
  const logs = logsQuery.data ?? {};
  const loading = activitiesQuery.isLoading || logsQuery.isLoading;
  const error = activitiesQuery.error || logsQuery.error;

  return (
    <section className="card activity-logger">
      <div className="card-header">
        <h2>{managing ? 'Manage activities' : 'Activities'}</h2>
        <button onClick={() => setManaging((m) => !m)} disabled={loading}>
          {managing ? 'Done' : 'Manage'}
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error.message}</p>}

      {!loading && managing && <ActivityManager activities={activities} />}

      {!loading && !managing && (
        <>
          {disabled && (
            <p className="muted small">Session is past day 90 — close it to log activities.</p>
          )}
          <ul className="activity-rows">
            {activities.map((a) => (
              <ActivityEntry
                key={a.id}
                activity={a}
                amount={logs[a.id]}
                date={date}
                disabled={disabled}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
