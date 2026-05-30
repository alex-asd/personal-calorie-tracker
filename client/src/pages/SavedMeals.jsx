import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import { useCategories } from '../hooks/useCategories.js';
import SavedMealEditor from '../components/SavedMealEditor.jsx';
import CategoryManager from '../components/CategoryManager.jsx';

function groupByCategory(savedMeals, categories) {
  const byId = new Map();
  const uncategorized = [];
  for (const m of savedMeals) {
    if (m.category_id == null) {
      uncategorized.push(m);
    } else {
      if (!byId.has(m.category_id)) byId.set(m.category_id, []);
      byId.get(m.category_id).push(m);
    }
  }
  const groups = categories
    .map((c) => ({ key: `cat-${c.id}`, label: c.name, meals: byId.get(c.id) ?? [] }))
    .filter((g) => g.meals.length > 0);
  if (uncategorized.length > 0) {
    groups.push({ key: 'uncategorized', label: 'Uncategorized', meals: uncategorized });
  }
  return groups;
}

function fmtMeta(m) {
  const parts = [`${Math.round(m.calories)} kcal`, `${Math.round(m.protein)}g protein`];
  if (m.carbs != null) parts.push(`${Math.round(m.carbs)}g carbs`);
  if (m.fat != null) parts.push(`${Math.round(m.fat)}g fat`);
  return parts.join(' · ');
}

export default function SavedMeals() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const {
    data: savedMeals = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.savedMeals.list(),
    queryFn: async () => {
      const { savedMeals } = await api.get('/api/saved-meals');
      return savedMeals;
    },
  });

  const { data: categories = [] } = useCategories();

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/saved-meals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedMeals.list() });
    },
  });

  function onDelete(id) {
    if (
      !window.confirm(
        'Delete this saved meal? Historical entries created from it will keep their values.'
      )
    )
      return;
    deleteMutation.mutate(id);
  }

  const groups = groupByCategory(savedMeals, categories);

  function renderMealItem(s) {
    const busy = deleteMutation.isPending && deleteMutation.variables === s.id;
    return (
      <li key={s.id} className="meal-item">
        {editingId === s.id ? (
          <SavedMealEditor
            meal={s}
            onSave={() => setEditingId(null)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div className="row">
            <div className="meal-info">
              <div className="meal-name">{s.name}</div>
              <div className="muted small">{fmtMeta(s)}</div>
            </div>
            <div className="actions">
              <button onClick={() => setEditingId(s.id)} disabled={busy}>
                Edit
              </button>
              <button onClick={() => onDelete(s.id)} disabled={busy} className="danger">
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <main className="container">
      <header className="page-header">
        <h1>Saved meals</h1>
        {!adding && (
          <button className="primary" onClick={() => setAdding(true)}>
            + Add saved meal
          </button>
        )}
      </header>

      {adding && (
        <section className="card">
          <h2>New saved meal</h2>
          <SavedMealEditor onSave={() => setAdding(false)} onCancel={() => setAdding(false)} />
        </section>
      )}

      <section className="card">
        <h2>Library</h2>
        {isLoading && <p className="muted">Loading…</p>}
        {error && <p className="error">{error.message}</p>}
        {deleteMutation.error && <p className="error">{deleteMutation.error.message}</p>}

        {!isLoading && !error && savedMeals.length === 0 && (
          <p className="muted">
            No saved meals yet. Add one above, or check "Also save to library" when logging a meal.
          </p>
        )}

        {savedMeals.length > 0 && (
          <div className="category-groups">
            {groups.map((g) => (
              <div key={g.key} className="category-group">
                <h3 className="category-heading">{g.label}</h3>
                <ul className="meal-list">{g.meals.map(renderMealItem)}</ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <CategoryManager />
    </main>
  );
}
