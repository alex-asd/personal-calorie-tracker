import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

export default function WeightLogger({ disabled = false }) {
  const [weight, setWeight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { weight } = await api.get('/api/weights/today');
      setWeight(weight);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onLog(e) {
    e.preventDefault();
    if (!(Number(input) > 0)) return;
    setSubmitting(true);
    setError(null);
    try {
      const { weight } = await api.post('/api/weights', {
        weight_kg: Number(input),
      });
      setWeight(weight);
      setInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onClear() {
    setSubmitting(true);
    setError(null);
    try {
      await api.delete('/api/weights/today');
      setWeight(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card weight-logger">
      <div className="row">
        <h3>Today's weight</h3>
        {weight ? (
          <div className="actions">
            <span className="weight-value">{weight.weight_kg} kg</span>
            <button onClick={onClear} disabled={submitting} aria-label="Clear weight">
              ×
            </button>
          </div>
        ) : loading ? (
          <span className="muted">Loading…</span>
        ) : (
          <form onSubmit={onLog} className="row inline-form">
            <input
              type="number"
              min="0"
              step="0.1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="kg"
              disabled={submitting || disabled}
            />
            <button type="submit" disabled={submitting || disabled || !(Number(input) > 0)}>
              {submitting ? 'Saving…' : 'Log weight'}
            </button>
          </form>
        )}
      </div>
      {disabled && !weight && (
        <p className="muted small">Session is past day 90 — close it to log weight.</p>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
