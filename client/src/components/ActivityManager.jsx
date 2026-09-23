import { useState } from 'react';
import { useCreateActivity, useUpdateActivity, useDeleteActivity } from '../hooks/useActivities.js';

// Add / rename / delete custom activities. Presets are listed for context but
// can't be changed (the server rejects it too).
export default function ActivityManager({ activities }) {
  const createMutation = useCreateActivity();
  const updateMutation = useUpdateActivity();
  const deleteMutation = useDeleteActivity();

  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');

  function addActivity(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(
      { name, unit: newUnit },
      {
        onSuccess: () => {
          setNewName('');
          setNewUnit('');
        },
      }
    );
  }

  function startEdit(activity) {
    setEditingId(activity.id);
    setEditName(activity.name);
    setEditUnit(activity.unit);
  }

  function saveEdit(e) {
    e.preventDefault();
    const name = editName.trim();
    if (!name) return;
    updateMutation.mutate(
      { id: editingId, name, unit: editUnit },
      { onSuccess: () => setEditingId(null) }
    );
  }

  function onDelete(activity) {
    const days = activity.log_count;
    const msg =
      days > 0
        ? `Delete "${activity.name}"? Its ${days} logged day${days === 1 ? '' : 's'} will be deleted too.`
        : `Delete "${activity.name}"?`;
    if (!window.confirm(msg)) return;
    deleteMutation.mutate(activity.id);
  }

  const mutationError =
    createMutation.error?.message || updateMutation.error?.message || deleteMutation.error?.message;
  const custom = activities.filter((a) => !a.is_preset);
  const presets = activities.filter((a) => a.is_preset);

  return (
    <div className="activity-manager">
      <form onSubmit={addActivity} className="activity-new">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New activity, e.g. Plank"
          aria-label="New activity name"
        />
        <input
          value={newUnit}
          onChange={(e) => setNewUnit(e.target.value)}
          placeholder="unit (reps)"
          aria-label="New activity unit"
          className="activity-unit-input"
        />
        <button
          type="submit"
          className="primary"
          disabled={!newName.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? 'Adding…' : 'Add'}
        </button>
      </form>

      {mutationError && <p className="error">{mutationError}</p>}

      {custom.length === 0 ? (
        <p className="muted small">
          No custom activities yet. Add one above — anything you want to count, in whatever unit
          suits it (reps, sec, km…).
        </p>
      ) : (
        <ul className="meal-list">
          {custom.map((a) => {
            const busy = deleteMutation.isPending && deleteMutation.variables === a.id;
            return (
              <li key={a.id} className="meal-item">
                {editingId === a.id ? (
                  <form onSubmit={saveEdit} className="activity-new">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="Activity name"
                      autoFocus
                    />
                    <input
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      placeholder="reps"
                      aria-label="Activity unit"
                      className="activity-unit-input"
                    />
                    <button
                      type="submit"
                      className="primary"
                      disabled={!editName.trim() || updateMutation.isPending}
                    >
                      {updateMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="row">
                    <div className="meal-info">
                      <div className="meal-name">{a.name}</div>
                      <div className="muted small">
                        {a.unit} · {a.log_count} logged day{a.log_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="actions">
                      <button onClick={() => startEdit(a)} disabled={busy}>
                        Edit
                      </button>
                      <button onClick={() => onDelete(a)} disabled={busy} className="danger">
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

      <p className="muted small">Always tracked: {presets.map((a) => a.name).join(', ')}.</p>
    </div>
  );
}
