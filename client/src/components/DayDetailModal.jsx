import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import { formatLabel } from '../dates.js';
import MealList from './MealList.jsx';
import AddMealModal from './AddMealModal.jsx';
import WeightEntry from './WeightEntry.jsx';
import ActivityList from './ActivityList.jsx';

export default function DayDetailModal({ date, session, onClose }) {
  const [adding, setAdding] = useState(false);

  const mealsQuery = useQuery({
    queryKey: queryKeys.meals.list(date),
    queryFn: async () => {
      const { meals } = await api.get(`/api/meals?date=${date}`);
      return meals;
    },
    enabled: !!session,
  });

  // Only close on Escape when the nested add modal isn't open — otherwise the
  // add modal's own Escape handler and this one would both fire and close both.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !adding) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, adding]);

  // Swap to the add form in place (rather than stacking a second overlay) so
  // there's a single overlay and a single set of Escape/backdrop handlers.
  if (adding) {
    return (
      <AddMealModal date={date} onClose={() => setAdding(false)} onAdded={() => setAdding(false)} />
    );
  }

  const meals = mealsQuery.data ?? [];
  const canEdit = !session.blocked;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Day ${date}`}
      >
        <div className="modal-header">
          <h2>
            {formatLabel(date)} <span className="muted small">{date}</span>
          </h2>
          <button onClick={onClose} aria-label="Close" className="close">
            ×
          </button>
        </div>

        <div className="modal-weight">
          <WeightEntry
            date={date}
            label={<h3>Weight</h3>}
            disabled={!canEdit}
            blockedMessage="Session is past day 90 — close it to edit weight."
          />
        </div>

        {canEdit && (
          <div className="modal-actions">
            <button className="primary" onClick={() => setAdding(true)}>
              + Add meal
            </button>
          </div>
        )}

        <MealList
          meals={meals}
          loading={mealsQuery.isLoading}
          error={mealsQuery.error}
          canEdit={canEdit}
          emptyMessage="No meals logged for this day yet."
        />

        <section className="card modal-activities">
          <h2>Activities</h2>
          <ActivityList
            date={date}
            disabled={!canEdit}
            blockedMessage="Session is past day 90 — close it to edit activities."
          />
        </section>
      </div>
    </div>
  );
}
