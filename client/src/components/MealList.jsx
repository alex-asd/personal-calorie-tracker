import { useState } from 'react';
import { api } from '../api.js';
import MealEditor from './MealEditor.jsx';

function fmtMeta(m) {
  const parts = [`${Math.round(m.calories)} kcal`, `${Math.round(m.protein)}g protein`];
  if (m.carbs != null) parts.push(`${Math.round(m.carbs)}g carbs`);
  if (m.fat != null) parts.push(`${Math.round(m.fat)}g fat`);
  return parts.join(' · ');
}

export default function MealList({ meals, loading, error, canEdit, onChange }) {
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [opError, setOpError] = useState(null);

  async function onDelete(id) {
    if (!window.confirm('Delete this meal?')) return;
    setBusyId(id);
    setOpError(null);
    try {
      await api.delete(`/api/meals/${id}`);
      onChange();
    } catch (e) {
      setOpError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card">
      <h2>Meals</h2>
      {loading && <p className="muted">Loading meals…</p>}
      {error && <p className="error">{error}</p>}
      {opError && <p className="error">{opError}</p>}
      {!loading && !error && meals.length === 0 && (
        <p className="muted">No meals logged today yet.</p>
      )}
      {meals.length > 0 && (
        <ul className="meal-list">
          {meals.map((m) => (
            <li key={m.id} className="meal-item">
              {editingId === m.id ? (
                <MealEditor
                  meal={m}
                  onSave={() => {
                    setEditingId(null);
                    onChange();
                  }}
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
                      <button
                        onClick={() => setEditingId(m.id)}
                        disabled={busyId === m.id}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(m.id)}
                        disabled={busyId === m.id}
                        className="danger"
                      >
                        {busyId === m.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
