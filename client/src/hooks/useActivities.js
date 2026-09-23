import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import { useSession } from './useSession.js';

// The activity catalog: the five presets plus any custom activities.
export function useActivities() {
  return useQuery({
    queryKey: queryKeys.activities.list(),
    queryFn: async () => {
      const { activities } = await api.get('/api/activities');
      return activities;
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, unit }) => {
      const { activity } = await api.post('/api/activities', { name, unit });
      return activity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.list() });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, unit }) => {
      const { activity } = await api.put(`/api/activities/${id}`, { name, unit });
      return activity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.list() });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/api/activities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.list() });
      // The activity's daily logs are cascade-deleted server-side.
      queryClient.invalidateQueries({ queryKey: queryKeys.activityLogs.all });
    },
  });
}

// `{ [activity_id]: amount }` for one day of the open session.
export function useActivityLogs(date) {
  const { data: session } = useSession();
  const sessionId = session?.id;
  return useQuery({
    queryKey: sessionId
      ? queryKeys.activityLogs.list(sessionId, date)
      : ['activityLogs', 'idle', date],
    queryFn: async () => {
      const { logs } = await api.get(`/api/activity-logs?date=${date}`);
      return Object.fromEntries(logs.map((l) => [l.activity_id, l.amount]));
    },
    enabled: !!sessionId,
  });
}

// Every log write also refreshes the catalog, whose `log_count` feeds the
// delete confirmation in the manager.
function useLogMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activityLogs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.list() });
    },
  });
}

// Add to the day's running total (e.g. another set of push-ups).
export function useAddActivity() {
  return useLogMutation(async ({ activityId, date, amount }) => {
    const { log } = await api.post('/api/activity-logs', { activity_id: activityId, date, amount });
    return log;
  });
}

// Replace the day's total (corrections, or a step count copied off a watch).
export function useSetActivity() {
  return useLogMutation(async ({ activityId, date, amount }) => {
    const { log } = await api.put(`/api/activity-logs/${date}/${activityId}`, { amount });
    return log;
  });
}

export function useClearActivity() {
  return useLogMutation(({ activityId, date }) =>
    api.delete(`/api/activity-logs/${date}/${activityId}`)
  );
}
