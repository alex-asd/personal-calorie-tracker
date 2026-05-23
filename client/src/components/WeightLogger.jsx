import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';

export default function WeightLogger({ disabled = false }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');

  const {
    data: weight,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.weights.today(),
    queryFn: async () => {
      const { weight } = await api.get('/api/weights/today');
      return weight;
    },
  });

  const logMutation = useMutation({
    mutationFn: (weight_kg) => api.post('/api/weights', { weight_kg }),
    onSuccess: ({ weight }) => {
      queryClient.setQueryData(queryKeys.weights.today(), weight);
      setInput('');
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/api/weights/today'),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.weights.today(), null);
    },
  });

  function onLog(e) {
    e.preventDefault();
    if (!(Number(input) > 0)) return;
    logMutation.mutate(Number(input));
  }

  const submitting = logMutation.isPending || clearMutation.isPending;
  const mutationError = logMutation.error?.message || clearMutation.error?.message;

  return (
    <section className="card weight-logger">
      <div className="row">
        <h3>Today's weight</h3>
        {weight ? (
          <div className="actions">
            <span className="weight-value">{weight.weight_kg} kg</span>
            <button
              onClick={() => clearMutation.mutate()}
              disabled={submitting}
              aria-label="Clear weight"
            >
              ×
            </button>
          </div>
        ) : isLoading ? (
          <span className="muted">Loading…</span>
        ) : (
          <form onSubmit={onLog} className="row inline-form">
            <input
              type="number"
              min="0"
              step="0.1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="kg"
              disabled={submitting || disabled}
            />
            <button type="submit" disabled={submitting || disabled || !(Number(input) > 0)}>
              {submitting ? 'Saving…' : 'Log weight'}
            </button>
          </form>
        )}
      </div>
      {disabled && !weight && (
        <p className="muted small">Session is past day 90 — close it to log weight.</p>
      )}
      {error && <p className="error">{error.message}</p>}
      {mutationError && <p className="error">{mutationError}</p>}
    </section>
  );
}
