import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import { useCategories } from '../hooks/useCategories.js';
import { parseMacros } from '../macros.js';
import MacroInput from './MacroInput.jsx';

export default function SavedMealEditor({ meal, onSave, onCancel }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(meal);
  const { data: categories = [] } = useCategories();
  const [name, setName] = useState(meal?.name ?? '');
  const [calories, setCalories] = useState(meal ? String(meal.calories) : '');
  const [protein, setProtein] = useState(meal ? String(meal.protein) : '');
  const [carbs, setCarbs] = useState(meal?.carbs == null ? '' : String(meal.carbs));
  const [fat, setFat] = useState(meal?.fat == null ? '' : String(meal.fat));
  const [categoryId, setCategoryId] = useState(
    meal?.category_id == null ? '' : String(meal.category_id)
  );

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

  const macros = parseMacros({ calories, protein, carbs, fat });
  const valid = name.trim() && macros;

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    saveMutation.mutate({
      name,
      ...macros,
      category_id: categoryId === '' ? null : Number(categoryId),
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
        <MacroInput label="Calories" value={calories} onChange={setCalories} required />
        <MacroInput label="Protein (g)" value={protein} onChange={setProtein} required />
        <MacroInput label="Carbs (g)" value={carbs} onChange={setCarbs} />
        <MacroInput label="Fat (g)" value={fat} onChange={setFat} />
      </div>
      <label>
        <span>Category</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">— None —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
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
