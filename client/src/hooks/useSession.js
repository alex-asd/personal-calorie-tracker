import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';

export function useSession() {
  return useQuery({
    queryKey: queryKeys.sessions.current(),
    queryFn: async () => {
      const { session } = await api.get('/api/sessions/current');
      return session;
    },
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      calorie_target,
      protein_target,
      start_weight_kg,
      goal_weight_kg,
      phase,
    }) => {
      const { session } = await api.post('/api/sessions', {
        calorie_target,
        protein_target,
        start_weight_kg,
        goal_weight_kg,
        phase,
      });
      return session;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.sessions.current(), session);
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useCloseSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, end_weight_kg }) => {
      const { session } = await api.post(`/api/sessions/${id}/close`, { end_weight_kg });
      return session;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.sessions.current(), null);
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}
