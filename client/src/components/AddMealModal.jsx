import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import { formatLabel } from '../dates.js';
import { useCategories, useCreateCategory } from '../hooks/useCategories.js';

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

  // Category selection in the "New meal" tab: '' = none, '__new__' = create inline, else an id.
  const [newMealCategory, setNewMealCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  // Category filter in the "Pick saved" tab: 'all' | 'uncategorized' | '<id>'.
  const [filter, setFilter] = useState('all');

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

  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();

  const addMutation = useMutation({
    mutationFn: (payload) => api.post('/api/meals', payload),
    onSuccess: (_data, variables) => {
      invalidateMealsAndDays(queryClient);
      if (variables.save_to_library) {
        queryClient.invalidateQueries({ queryKey: queryKeys.savedMeals.list() });
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.list() });
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

  async function submitNew(e) {
    e.preventDefault();

    let categoryId = null;
    if (saveToLibrary) {
      if (newMealCategory === '__new__') {
        const trimmed = newCategoryName.trim();
        if (trimmed) {
          try {
            const cat = await createCategory.mutateAsync(trimmed);
            categoryId = cat.id;
          } catch {
            return; // error surfaced via createCategory.error
          }
        }
      } else if (newMealCategory !== '') {
        categoryId = Number(newMealCategory);
      }
    }

    addMutation.mutate({
      name,
      calories: Number(calories),
      protein: Number(protein),
      carbs: carbs === '' ? null : Number(carbs),
      fat: fat === '' ? null : Number(fat),
      save_to_library: saveToLibrary,
      ...(categoryId != null ? { category_id: categoryId } : {}),
      ...(date ? { date } : {}),
    });
  }

  const uncategorizedCount = savedMeals.filter((s) => s.category_id == null).length;
  const visibleSaved = savedMeals.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'uncategorized') return s.category_id == null;
    return String(s.category_id) === filter;
  });

  const newValid = name.trim() && Number(calories) >= 0 && Number(protein) >= 0;
  const submitting = addMutation.isPending || createCategory.isPending;
  const error = savedError?.message || addMutation.error?.message || createCategory.error?.message;

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
            {savedMeals.length > 0 && (
              <label className="field">
                <span>Category</span>
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All meals ({savedMeals.length})</option>
                  {uncategorizedCount > 0 && (
                    <option value="uncategorized">Uncategorized ({uncategorizedCount})</option>
                  )}
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.meal_count})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {loadingSaved && <p className="muted">Loading saved meals…</p>}
            {!loadingSaved && savedMeals.length === 0 && (
              <p className="muted">
                No saved meals yet. Switch to "New meal" and tick "Also save to library" to create
                one.
              </p>
            )}
            {!loadingSaved && savedMeals.length > 0 && visibleSaved.length === 0 && (
              <p className="muted">No meals in this category.</p>
            )}
            {visibleSaved.length > 0 && (
              <ul className="saved-list">
                {visibleSaved.map((s) => (
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
            {saveToLibrary && (
              <label>
                <span>Category</span>
                <select
                  value={newMealCategory}
                  onChange={(e) => setNewMealCategory(e.target.value)}
                >
                  <option value="">— None —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__new__">+ New category…</option>
                </select>
              </label>
            )}
            {saveToLibrary && newMealCategory === '__new__' && (
              <label>
                <span>New category name</span>
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Breakfast"
                />
              </label>
            )}
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
