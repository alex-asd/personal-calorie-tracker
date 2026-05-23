import { useEffect, useState } from 'react';
import { api } from '../api.js';

function fmtMeta(m) {
  const parts = [`${Math.round(m.calories)} kcal`, `${Math.round(m.protein)}g protein`];
  if (m.carbs != null) parts.push(`${Math.round(m.carbs)}g carbs`);
  if (m.fat != null) parts.push(`${Math.round(m.fat)}g fat`);
  return parts.join(' · ');
}

export default function AddMealModal({ onClose, onAdded }) {
  const [mode, setMode] = useState('pick');
  const [savedMeals, setSavedMeals] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get('/api/saved-meals')
      .then(({ savedMeals }) => {
        if (active) setSavedMeals(savedMeals);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoadingSaved(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function pickSaved(saved) {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/meals', {
        name: saved.name,
        calories: saved.calories,
        protein: saved.protein,
        carbs: saved.carbs,
        fat: saved.fat,
        source_saved_meal_id: saved.id,
      });
      onAdded();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  async function submitNew(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/meals', {
        name,
        calories: Number(calories),
        protein: Number(protein),
        carbs: carbs === '' ? null : Number(carbs),
        fat: fat === '' ? null : Number(fat),
        save_to_library: saveToLibrary,
      });
      onAdded();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const newValid = name.trim() && Number(calories) >= 0 && Number(protein) >= 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add a meal"
      >
        <div className="modal-header">
          <h2>Add a meal</h2>
          <button onClick={onClose} aria-label="Close" className="close">
            ×
          </button>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={mode === 'pick' ? 'tab active' : 'tab'}
            onClick={() => setMode('pick')}
          >
            Pick saved
          </button>
          <button
            type="button"
            className={mode === 'new' ? 'tab active' : 'tab'}
            onClick={() => setMode('new')}
          >
            New meal
          </button>
        </div>

        {mode === 'pick' && (
          <div className="tab-body">
            {loadingSaved && <p className="muted">Loading saved meals…</p>}
            {!loadingSaved && savedMeals.length === 0 && (
              <p className="muted">
                No saved meals yet. Switch to "New meal" and tick "Also save to library" to create
                one.
              </p>
            )}
            {savedMeals.length > 0 && (
              <ul className="saved-list">
                {savedMeals.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="saved-item"
                      onClick={() => pickSaved(s)}
                      disabled={submitting}
                    >
                      <div className="meal-name">{s.name}</div>
                      <div className="muted small">{fmtMeta(s)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === 'new' && (
          <form onSubmit={submitNew} className="form tab-body">
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </label>
            <div className="form-grid">
              <label>
                <span>Calories</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>Protein (g)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>Carbs (g, optional)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                />
              </label>
              <label>
                <span>Fat (g, optional)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                />
              </label>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={saveToLibrary}
                onChange={(e) => setSaveToLibrary(e.target.checked)}
              />
              <span>Also save to library</span>
            </label>
            <button type="submit" className="primary" disabled={!newValid || submitting}>
              {submitting ? 'Adding…' : 'Add meal'}
            </button>
          </form>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
