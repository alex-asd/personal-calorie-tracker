import { useState } from 'react';
import { api } from '../api.js';

export default function MealEditor({ meal, onSave, onCancel }) {
  const [name, setName] = useState(meal.name);
  const [calories, setCalories] = useState(String(meal.calories));
  const [protein, setProtein] = useState(String(meal.protein));
  const [carbs, setCarbs] = useState(meal.carbs == null ? '' : String(meal.carbs));
  const [fat, setFat] = useState(meal.fat == null ? '' : String(meal.fat));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const valid =
    name.trim() && Number(calories) >= 0 && Number(protein) >= 0;

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/meals/${meal.id}`, {
        name,
        calories: Number(calories),
        protein: Number(protein),
        carbs: carbs === '' ? null : Number(carbs),
        fat: fat === '' ? null : Number(fat)
      });
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="form inline-form">
      <label>
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
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
          <span>Carbs (g)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
        </label>
        <label>
          <span>Fat (g)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={!valid || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
