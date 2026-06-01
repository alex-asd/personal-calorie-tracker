import { useState } from 'react';
import {
  useCategories,
  useCreateCategory,
  useRenameCategory,
  useDeleteCategory,
} from '../hooks/useCategories.js';

export default function CategoryManager() {
  const { data: categories = [], isLoading, error } = useCategories();
  const createMutation = useCreateCategory();
  const renameMutation = useRenameCategory();
  const deleteMutation = useDeleteCategory();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  function addCategory(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(name, { onSuccess: () => setNewName('') });
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  function saveEdit(e) {
    e.preventDefault();
    const name = editName.trim();
    if (!name) return;
    renameMutation.mutate({ id: editingId, name }, { onSuccess: () => setEditingId(null) });
  }

  function onDelete(cat) {
    const msg =
      cat.meal_count > 0
        ? `Delete "${cat.name}"? Its ${cat.meal_count} meal${cat.meal_count === 1 ? '' : 's'} will become Uncategorized.`
        : `Delete "${cat.name}"?`;
    if (!window.confirm(msg)) return;
    deleteMutation.mutate(cat.id);
  }

  const mutationError =
    createMutation.error?.message || renameMutation.error?.message || deleteMutation.error?.message;

  return (
    <section className="card">
      <h2>Categories</h2>

      <form onSubmit={addCategory} className="form inline-form">
        <div className="row">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            aria-label="New category name"
          />
          <button type="submit" className="primary" disabled={!newName.trim() || createMutation.isPending}>
            {createMutation.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      {isLoading && <p className="muted">Loading categories…</p>}
      {error && <p className="error">{error.message}</p>}
      {mutationError && <p className="error">{mutationError}</p>}

      {!isLoading && categories.length === 0 && (
        <p className="muted">No categories yet. Add one above to start organising your library.</p>
      )}

      {categories.length > 0 && (
        <ul className="meal-list">
          {categories.map((cat) => {
            const busy = deleteMutation.isPending && deleteMutation.variables === cat.id;
            return (
              <li key={cat.id} className="meal-item">
                {editingId === cat.id ? (
                  <form onSubmit={saveEdit} className="form inline-form">
                    <div className="row">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="Category name"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="primary"
                        disabled={!editName.trim() || renameMutation.isPending}
                      >
                        {renameMutation.isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="row">
                    <div className="meal-info">
                      <div className="meal-name">{cat.name}</div>
                      <div className="muted small">
                        {cat.meal_count} meal{cat.meal_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="actions">
                      <button onClick={() => startEdit(cat)} disabled={busy}>
                        Rename
                      </button>
                      <button onClick={() => onDelete(cat)} disabled={busy} className="danger">
                        {busy ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
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
