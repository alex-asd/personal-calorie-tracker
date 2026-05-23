import { useState } from 'react';
import { useSession } from '../SessionContext.jsx';

export default function CreateSessionForm() {
  const { createSession } = useSession();
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [weight, setWeight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const valid =
    Number(calories) > 0 && Number(protein) > 0 && (weight === '' || Number(weight) > 0);

  async function onSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSession({
        calorie_target: Number(calories),
        protein_target: Number(protein),
        start_weight_kg: weight === '' ? null : Number(weight),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2>Start a new session</h2>
      <p className="muted">A session spans up to 90 days. Set your daily targets to begin.</p>
      <form onSubmit={onSubmit} className="form">
        <label>
          <span>Daily calorie target</span>
          <input
            type="number"
            min="1"
            step="1"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="e.g. 2200"
            required
            autoFocus
          />
        </label>
        <label>
          <span>Daily protein target (g)</span>
          <input
            type="number"
            min="1"
            step="1"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="e.g. 160"
            required
          />
        </label>
        <label>
          <span>Starting weight (kg) — optional</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 75.5"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={!valid || submitting} className="primary">
          {submitting ? 'Creating…' : 'Create session'}
        </button>
      </form>
    </section>
  );
}
