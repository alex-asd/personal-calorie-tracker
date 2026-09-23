import { useState } from 'react';
import { useAddActivity, useSetActivity, useClearActivity } from '../hooks/useActivities.js';
import { formatAmount } from '../numbers.js';

// One activity's total for a single day, with controls to add to it (a set of
// push-ups), replace it (a step count off a watch) or clear it. `date` is a
// YYYY-MM-DD string within the open session.
export default function ActivityEntry({ activity, amount, date, disabled = false }) {
  const addActivity = useAddActivity();
  const setActivity = useSetActivity();
  const clearActivity = useClearActivity();
  const [input, setInput] = useState('');

  const value = Number(input);
  const valid = value > 0;
  const submitting = addActivity.isPending || setActivity.isPending || clearActivity.isPending;
  const mutationError =
    addActivity.error?.message || setActivity.error?.message || clearActivity.error?.message;
  const vars = { activityId: activity.id, date, amount: value };

  function onAdd(e) {
    e.preventDefault();
    if (!valid) return;
    addActivity.mutate(vars, { onSuccess: () => setInput('') });
  }

  function onSet() {
    if (!valid) return;
    setActivity.mutate(vars, { onSuccess: () => setInput('') });
  }

  return (
    <li className="activity-row">
      <div className="activity-name">{activity.name}</div>
      <div className="activity-total">
        <span className={amount ? 'activity-value' : 'activity-value empty'}>
          {formatAmount(amount ?? 0)}
        </span>{' '}
        <span className="muted small">{activity.unit}</span>
      </div>
      {!disabled && (
        <form onSubmit={onAdd} className="activity-form">
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activity.unit}
            aria-label={`${activity.name} amount`}
            disabled={submitting}
          />
          <button
            type="submit"
            className="primary"
            disabled={submitting || !valid}
            title="Add to the total"
            aria-label={`Add to ${activity.name}`}
          >
            Add
          </button>
          <button
            type="button"
            onClick={onSet}
            disabled={submitting || !valid}
            title="Replace the total"
            aria-label={`Set ${activity.name} total`}
          >
            Set
          </button>
          <button
            type="button"
            className={amount ? 'activity-clear' : 'activity-clear invisible'}
            onClick={() => clearActivity.mutate({ activityId: activity.id, date })}
            disabled={submitting || !amount}
            aria-label={`Clear ${activity.name}`}
            aria-hidden={!amount}
            tabIndex={amount ? undefined : -1}
          >
            ×
          </button>
        </form>
      )}
      {mutationError && <p className="error small activity-error">{mutationError}</p>}
    </li>
  );
}
