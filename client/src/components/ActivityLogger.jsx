import { useState } from 'react';
import { useActivities } from '../hooks/useActivities.js';
import { todayString } from '../dates.js';
import ActivityList from './ActivityList.jsx';
import ActivityManager from './ActivityManager.jsx';

// Today's activity totals, plus a Manage mode for adding / renaming / deleting
// custom activities.
export default function ActivityLogger({ disabled = false }) {
  const { data: activities = [], isLoading } = useActivities();
  const [managing, setManaging] = useState(false);

  return (
    <section className="card activity-logger">
      <div className="card-header">
        <h2>{managing ? 'Manage activities' : 'Activities'}</h2>
        <button onClick={() => setManaging((m) => !m)} disabled={isLoading}>
          {managing ? 'Done' : 'Manage'}
        </button>
      </div>

      {managing ? (
        <ActivityManager activities={activities} />
      ) : (
        <ActivityList
          date={todayString()}
          disabled={disabled}
          blockedMessage="Session is past day 90 — close it to log activities."
        />
      )}
    </section>
  );
}
