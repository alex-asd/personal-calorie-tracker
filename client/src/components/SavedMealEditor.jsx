import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';

export default function SavedMealEditor({ meal, onSave, onCancel }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(meal);
  const [name, setName] = useState(meal?.name ?? '');
  const [calories, setCalories] = useState(meal ? String(meal.calories) : '');
  const [protein, setProtein] = useState(meal ? String(meal.protein) : '');
  const [carbs, setCarbs] = useState(meal?.carbs == null ? '' : String(meal.carbs));
  const [fat, setFat] = useState(meal?.fat == null ? '' : String(meal.fat));

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isEdit
        ? api.put(`/api/saved-meals/${meal.id}`, payload)
        : api.post('/api/saved-meals', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedMeals.list() });
      onSave();
    },
  });

  const valid = name.trim() && Number(calories) >= 0 && Number(protein) >= 0;

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    saveMutation.mutate({
      name,
      calories: Number(calories),
      protein: Number(protein),
      carbs: carbs === '' ? null : Number(carbs),
      fat: fat === '' ? null : Number(fat),
    });
  }

  const saving = saveMutation.isPending;

  return (
    <form onSubmit={submit} className="form inline-form">
      <label>
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus={!isEdit}
        />
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
      {saveMutation.error && <p className="error">{saveMutation.error.message}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={!valid || saving}>
          {saving ? 'Saving…' : isEdit ? 'Save' : 'Add'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
