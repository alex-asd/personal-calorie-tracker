import { useState } from 'react';
import { useSession } from '../SessionContext.jsx';

export default function SessionHeader() {
  const { session, closeSession } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [endWeight, setEndWeight] = useState('');
  const [error, setError] = useState(null);

  if (!session) return null;

  async function onConfirmClose() {
    if (endWeight !== '' && !(Number(endWeight) > 0)) {
      setError('Final weight must be a positive number');
      return;
    }
    setClosing(true);
    setError(null);
    try {
      await closeSession({
        end_weight_kg: endWeight === '' ? null : Number(endWeight),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
      setConfirming(false);
      setEndWeight('');
    }
  }

  return (
    <section className="card session-header">
      <div className="row">
        <div>
          <h2>Session · day {session.dayNumber} of 90</h2>
          <p className="muted">
            Started {session.start_date} · {session.calorie_target} kcal / {session.protein_target}g
            protein
            {session.start_weight_kg != null && <> · start {session.start_weight_kg} kg</>}
          </p>
        </div>
        <div className="actions">
          <a href="/api/export" download className="button-link">
            Export JSON
          </a>
          {!confirming && <button onClick={() => setConfirming(true)}>Close session</button>}
        </div>
      </div>

      {confirming && (
        <div className="confirm">
          <p>
            Close this session? Meal entries and daily weight logs will be deleted; daily totals and
            start/end weights are preserved in the archive.
          </p>
          <label>
            <span>Final weight (kg) — optional</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={endWeight}
              onChange={(e) => setEndWeight(e.target.value)}
              placeholder="e.g. 73.0"
              disabled={closing}
            />
          </label>
          <div className="row">
            <button onClick={onConfirmClose} disabled={closing} className="danger">
              {closing ? 'Closing…' : 'Confirm close'}
            </button>
            <button
              onClick={() => {
                setConfirming(false);
                setEndWeight('');
                setError(null);
              }}
              disabled={closing}
            >
              Cancel
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {session.warning && (
        <p className="banner warning">
          Today is day 90 — the last day of this session. Close it to start a new one.
        </p>
      )}
      {session.blocked && (
        <p className="banner error-banner">
          This session has exceeded 90 days. Close it to log new meals.
        </p>
      )}
    </section>
  );
}
