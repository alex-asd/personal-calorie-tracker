import { useState } from 'react';
import { useWeightHistory, useSetWeight, useClearWeight } from '../hooks/useWeights.js';

// Log / edit / clear the weight for a single day. `label` is rendered on the
// left of the row (e.g. an <h3>); `date` is a YYYY-MM-DD string within the
// open session. Reads from the shared history query so the Today card, the
// day modal and the history rows never disagree.
export default function WeightEntry({ date, label, disabled = false, blockedMessage }) {
  const { data, isLoading, error } = useWeightHistory();
  const setWeight = useSetWeight();
  const clearWeight = useClearWeight();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  const entry = data?.weights.find((w) => w.date === date) ?? null;
  const submitting = setWeight.isPending || clearWeight.isPending;
  const mutationError = setWeight.error?.message || clearWeight.error?.message;

  function startEdit() {
    setInput(String(entry.weight_kg));
    setEditing(true);
  }

  function cancelEdit() {
    setInput('');
    setEditing(false);
  }

  function onSubmit(e) {
    e.preventDefault();
    const value = Number(input);
    if (!(value > 0)) return;
    setWeight.mutate({ date, weight_kg: value }, { onSuccess: cancelEdit });
  }

  let body;
  if (isLoading) {
    body = <span className="muted">Loading…</span>;
  } else if (entry && !editing) {
    body = (
      <div className="actions">
        <span className="weight-value">{entry.weight_kg} kg</span>
        {!disabled && (
          <>
            <button onClick={startEdit} disabled={submitting}>
              Edit
            </button>
            <button
              onClick={() => clearWeight.mutate({ date })}
              disabled={submitting}
              aria-label="Clear weight"
            >
              ×
            </button>
          </>
        )}
      </div>
    );
  } else {
    body = (
      <form onSubmit={onSubmit} className="row inline-form">
        <input
          type="number"
          min="0"
          step="0.1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="kg"
          disabled={submitting || disabled}
          autoFocus={editing}
          onFocus={(e) => e.target.select()}
        />
        <button type="submit" disabled={submitting || disabled || !(Number(input) > 0)}>
          {submitting ? 'Saving…' : editing ? 'Save' : 'Log weight'}
        </button>
        {editing && (
          <button type="button" onClick={cancelEdit} disabled={submitting}>
            Cancel
          </button>
        )}
      </form>
    );
  }

  return (
    <div className="weight-entry">
      <div className="row">
        {label}
        {body}
      </div>
      {disabled && !entry && blockedMessage && <p className="muted small">{blockedMessage}</p>}
      {error && <p className="error">{error.message}</p>}
      {mutationError && <p className="error">{mutationError}</p>}
    </div>
  );
}
