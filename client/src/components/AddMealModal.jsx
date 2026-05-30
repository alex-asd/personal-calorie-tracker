import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import { formatLabel } from '../dates.js';

function fmtMeta(m) {
  const parts = [`${Math.round(m.calories)} kcal`, `${Math.round(m.protein)}g protein`];
  if (m.carbs != null) parts.push(`${Math.round(m.carbs)}g carbs`);
  if (m.fat != null) parts.push(`${Math.round(m.fat)}g fat`);
  return parts.join(' · ');
}

function invalidateMealsAndDays(queryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.meals.all });
  const current = queryClient.getQueryData(queryKeys.sessions.current());
  if (current?.id) {
    queryClient.invalidateQueries({ queryKey: queryKeys.sessions.days(current.id) });
  }
}

export default function AddMealModal({ onClose, onAdded, date }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('pick');

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  const {
    data: savedMeals = [],
    isLoading: loadingSaved,
    error: savedError,
  } = useQuery({
    queryKey: queryKeys.savedMeals.list(),
    queryFn: async () => {
      const { savedMeals } = await api.get('/api/saved-meals');
      return savedMeals;
    },
  });

  const addMutation = useMutation({
    mutationFn: (payload) => api.post('/api/meals', payload),
    onSuccess: (_data, variables) => {
      invalidateMealsAndDays(queryClient);
      if (variables.save_to_library) {
        queryClient.invalidateQueries({ queryKey: queryKeys.savedMeals.list() });
      }
      onAdded();
    },
  });

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function pickSaved(saved) {
    addMutation.mutate({
      name: saved.name,
      calories: saved.calories,
      protein: saved.protein,
      carbs: saved.carbs,
      fat: saved.fat,
      source_saved_meal_id: saved.id,
      ...(date ? { date } : {}),
    });
  }

  function submitNew(e) {
    e.preventDefault();
    addMutation.mutate({
      name,
      calories: Number(calories),
      protein: Number(protein),
      carbs: carbs === '' ? null : Number(carbs),
      fat: fat === '' ? null : Number(fat),
      save_to_library: saveToLibrary,
      ...(date ? { date } : {}),
    });
  }

  const newValid = name.trim() && Number(calories) >= 0 && Number(protein) >= 0;
  const submitting = addMutation.isPending;
  const error = savedError?.message || addMutation.error?.message;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add a meal"
      >
        <div className="modal-header">
          <h2>{date ? `Add a meal · ${formatLabel(date)}` : 'Add a meal'}</h2>
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
