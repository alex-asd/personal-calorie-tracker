import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import { useSession } from './useSession.js';

// The open session's full weight picture: start/goal weight plus every daily
// log. One query, shared by the chart, the Today card, the day modal and the
// history rows so a single invalidation keeps them all in sync.
export function useWeightHistory() {
  const { data: session } = useSession();
  const sessionId = session?.id;
  return useQuery({
    queryKey: sessionId ? queryKeys.weights.history(sessionId) : ['weights', 'history', 'idle'],
    queryFn: () => api.get('/api/weights'),
    enabled: !!sessionId,
  });
}

// Log or correct the weight for any day of the open session (upsert).
export function useSetWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, weight_kg }) => {
      const { weight } = await api.put(`/api/weights/${date}`, { weight_kg });
      return weight;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.weights.all });
    },
  });
}

export function useClearWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date }) => api.delete(`/api/weights/${date}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.weights.all });
    },
  });
}
