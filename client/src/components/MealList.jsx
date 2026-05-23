import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import MealEditor from './MealEditor.jsx';

function fmtMeta(m) {
  const parts = [`${Math.round(m.calories)} kcal`, `${Math.round(m.protein)}g protein`];
  if (m.carbs != null) parts.push(`${Math.round(m.carbs)}g carbs`);
  if (m.fat != null) parts.push(`${Math.round(m.fat)}g fat`);
  return parts.join(' · ');
}

export default function MealList({ meals, loading, error, canEdit }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/meals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meals.list() });
      const current = queryClient.getQueryData(queryKeys.sessions.current());
      if (current?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions.days(current.id) });
      }
    },
  });

  function onDelete(id) {
    if (!window.confirm('Delete this meal?')) return;
    deleteMutation.mutate(id);
  }

  return (
    <section className="card">
      <h2>Meals</h2>
      {loading && <p className="muted">Loading meals…</p>}
      {error && <p className="error">{error.message}</p>}
      {deleteMutation.error && <p className="error">{deleteMutation.error.message}</p>}
      {!loading && !error && meals.length === 0 && (
        <p className="muted">No meals logged today yet.</p>
      )}
      {meals.length > 0 && (
        <ul className="meal-list">
          {meals.map((m) => {
            const busy = deleteMutation.isPending && deleteMutation.variables === m.id;
            return (
              <li key={m.id} className="meal-item">
                {editingId === m.id ? (
                  <MealEditor
                    meal={m}
                    onSave={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="row">
                    <div className="meal-info">
                      <div className="meal-name">{m.name}</div>
                      <div className="muted small">{fmtMeta(m)}</div>
                    </div>
                    {canEdit && (
                      <div className="actions">
                        <button onClick={() => setEditingId(m.id)} disabled={busy}>
                          Edit
                        </button>
                        <button onClick={() => onDelete(m.id)} disabled={busy} className="danger">
                          {busy ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
