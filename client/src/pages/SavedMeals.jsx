import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import SavedMealEditor from '../components/SavedMealEditor.jsx';

function fmtMeta(m) {
  const parts = [`${Math.round(m.calories)} kcal`, `${Math.round(m.protein)}g protein`];
  if (m.carbs != null) parts.push(`${Math.round(m.carbs)}g carbs`);
  if (m.fat != null) parts.push(`${Math.round(m.fat)}g fat`);
  return parts.join(' · ');
}

export default function SavedMeals() {
  const [savedMeals, setSavedMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [opError, setOpError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { savedMeals } = await api.get('/api/saved-meals');
      setSavedMeals(savedMeals);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onDelete(id) {
    if (
      !window.confirm(
        'Delete this saved meal? Historical entries created from it will keep their values.'
      )
    )
      return;
    setBusyId(id);
    setOpError(null);
    try {
      await api.delete(`/api/saved-meals/${id}`);
      refresh();
    } catch (e) {
      setOpError(e.message);
    } finally {
      setBusyId(null);
    }
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
          <SavedMealEditor
            onSave={() => {
              setAdding(false);
              refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        </section>
      )}

      <section className="card">
        <h2>Library</h2>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="error">{error}</p>}
        {opError && <p className="error">{opError}</p>}

        {!loading && !error && savedMeals.length === 0 && (
          <p className="muted">
            No saved meals yet. Add one above, or check "Also save to library" when logging a meal.
          </p>
        )}

        {savedMeals.length > 0 && (
          <ul className="meal-list">
            {savedMeals.map((s) => (
              <li key={s.id} className="meal-item">
                {editingId === s.id ? (
                  <SavedMealEditor
                    meal={s}
                    onSave={() => {
                      setEditingId(null);
                      refresh();
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="row">
                    <div className="meal-info">
                      <div className="meal-name">{s.name}</div>
                      <div className="muted small">{fmtMeta(s)}</div>
                    </div>
                    <div className="actions">
                      <button onClick={() => setEditingId(s.id)} disabled={busyId === s.id}>
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(s.id)}
                        disabled={busyId === s.id}
                        className="danger"
                      >
                        {busyId === s.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
