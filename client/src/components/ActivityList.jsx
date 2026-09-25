import { useActivities, useActivityLogs } from '../hooks/useActivities.js';
import ActivityEntry from './ActivityEntry.jsx';

// Every activity (presets first, then custom) with its total for one day of the
// open session, each row editable. Used for today on Home and for past days in
// the day modal.
export default function ActivityList({ date, disabled = false, blockedMessage }) {
  const activitiesQuery = useActivities();
  const logsQuery = useActivityLogs(date);

  if (activitiesQuery.isLoading || logsQuery.isLoading) {
    return <p className="muted">Loading…</p>;
  }
  const error = activitiesQuery.error || logsQuery.error;
  if (error) return <p className="error">{error.message}</p>;

  const logs = logsQuery.data ?? {};
  return (
    <>
      {disabled && blockedMessage && <p className="muted small">{blockedMessage}</p>}
      <ul className="activity-rows">
        {(activitiesQuery.data ?? []).map((a) => (
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
  );
}
