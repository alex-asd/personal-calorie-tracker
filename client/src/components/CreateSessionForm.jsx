import { useState } from 'react';
import { useCreateSession } from '../hooks/useSession.js';

export default function CreateSessionForm() {
  const createSession = useCreateSession();
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [phase, setPhase] = useState('cut');

  const valid =
    Number(calories) > 0 &&
    Number(protein) > 0 &&
    (weight === '' || Number(weight) > 0) &&
    (goalWeight === '' || Number(goalWeight) > 0);

  // Placeholders model the selected phase: a bulk eats in a surplus toward a
  // higher goal weight, a cut eats in a deficit toward a lower one.
  const placeholders =
    phase === 'bulk'
      ? { calories: 'e.g. 3000', protein: 'e.g. 180', weight: 'e.g. 75.5', goalWeight: 'e.g. 80.0' }
      : { calories: 'e.g. 2200', protein: 'e.g. 160', weight: 'e.g. 75.5', goalWeight: 'e.g. 72.0' };

  function onSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    createSession.mutate({
      calorie_target: Number(calories),
      protein_target: Number(protein),
      start_weight_kg: weight === '' ? null : Number(weight),
      goal_weight_kg: goalWeight === '' ? null : Number(goalWeight),
      phase,
    });
  }

  const submitting = createSession.isPending;
  const error = createSession.error;

  return (
    <section className="card">
      <h2>Start a new session</h2>
      <p className="muted">A session spans up to 90 days. Set your daily targets to begin.</p>
      <form onSubmit={onSubmit} className="form">
        <fieldset className="phase-picker">
          <legend>Phase</legend>
          <label className={`phase-option ${phase === 'cut' ? 'active' : ''}`}>
            <input
              type="radio"
              name="phase"
              value="cut"
              checked={phase === 'cut'}
              onChange={() => setPhase('cut')}
            />
            <span className="phase-option-title">Cut</span>
            <span className="phase-option-sub">Calories are a ceiling — staying under is good.</span>
          </label>
          <label className={`phase-option ${phase === 'bulk' ? 'active' : ''}`}>
            <input
              type="radio"
              name="phase"
              value="bulk"
              checked={phase === 'bulk'}
              onChange={() => setPhase('bulk')}
            />
            <span className="phase-option-title">Bulk</span>
            <span className="phase-option-sub">Calories are a floor — hitting the target is good.</span>
          </label>
        </fieldset>
        <label>
          <span>Daily calorie target</span>
          <input
            type="number"
            min="1"
            step="1"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder={placeholders.calories}
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
            placeholder={placeholders.protein}
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
            placeholder={placeholders.weight}
          />
        </label>
        <label>
          <span>Goal weight (kg) — optional</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={goalWeight}
            onChange={(e) => setGoalWeight(e.target.value)}
            placeholder={placeholders.goalWeight}
          />
        </label>
        {error && <p className="error">{error.message}</p>}
        <button type="submit" disabled={!valid || submitting} className="primary">
          {submitting ? 'Creating…' : 'Create session'}
        </button>
      </form>
    </section>
  );
}
