import { useState } from 'react';
import { useSession } from '../SessionContext.jsx';

export default function SessionHeader() {
  const { session, closeSession } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState(null);

  if (!session) return null;

  async function onConfirmClose() {
    setClosing(true);
    setError(null);
    try {
      await closeSession();
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
      setConfirming(false);
    }
  }

  return (
    <section className="card session-header">
      <div className="row">
        <div>
          <h2>
            Session · day {session.dayNumber} of 90
          </h2>
          <p className="muted">
            Started {session.start_date} · {session.calorie_target} kcal /{' '}
            {session.protein_target}g protein
          </p>
        </div>
        {!confirming && (
          <button onClick={() => setConfirming(true)}>Close session</button>
        )}
      </div>

      {confirming && (
        <div className="confirm">
          <p>
            Close this session? Meal entries will be deleted; daily totals are preserved
            in the archive.
          </p>
          <div className="row">
            <button onClick={onConfirmClose} disabled={closing} className="danger">
              {closing ? 'Closing…' : 'Confirm close'}
            </button>
            <button onClick={() => setConfirming(false)} disabled={closing}>
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
