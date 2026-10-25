import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import { parseMacros } from '../macros.js';
import MacroInput from './MacroInput.jsx';

export default function MealEditor({ meal, onSave, onCancel }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(meal.name);
  const [calories, setCalories] = useState(String(meal.calories));
  const [protein, setProtein] = useState(String(meal.protein));
  const [carbs, setCarbs] = useState(meal.carbs == null ? '' : String(meal.carbs));
  const [fat, setFat] = useState(meal.fat == null ? '' : String(meal.fat));

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put(`/api/meals/${meal.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meals.all });
      const current = queryClient.getQueryData(queryKeys.sessions.current());
      if (current?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions.days(current.id) });
      }
      onSave();
    },
  });

  const macros = parseMacros({ calories, protein, carbs, fat });
  const valid = name.trim() && macros;

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    saveMutation.mutate({ name, ...macros });
  }

  const saving = saveMutation.isPending;

  return (
    <form onSubmit={submit} className="form inline-form">
      <label>
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <div className="form-grid">
        <MacroInput label="Calories" value={calories} onChange={setCalories} required />
        <MacroInput label="Protein (g)" value={protein} onChange={setProtein} required />
        <MacroInput label="Carbs (g)" value={carbs} onChange={setCarbs} />
        <MacroInput label="Fat (g)" value={fat} onChange={setFat} />
      </div>
      {saveMutation.error && <p className="error">{saveMutation.error.message}</p>}
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
