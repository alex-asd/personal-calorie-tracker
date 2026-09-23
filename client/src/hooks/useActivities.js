import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import { daysBetween, shiftDateString, todayString } from '../dates.js';
import { useSession } from './useSession.js';

// Charts span at least this many days so a new session isn't drawn as one
// full-width bar; the unused tail is simply empty.
const MIN_WINDOW_DAYS = 14;

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

// Every day-total logged in one session (open or closed). Lives under
// `activityLogs.all`, so every log mutation refreshes it.
export function useActivityHistory(sessionId) {
  return useQuery({
    queryKey: queryKeys.activityLogs.history(sessionId),
    queryFn: () => api.get(`/api/sessions/${sessionId}/activity-logs`),
    enabled: sessionId != null,
  });
}

// What the activity charts draw for one session: the day window (start date to
// end date, or today while open) and one series per activity logged at least
// once, in catalog order. `values[i]` is day i's total, 0 on days not logged.
export function useActivitySeries(session) {
  const activitiesQuery = useActivities();
  const historyQuery = useActivityHistory(session?.id);
  const today = todayString();
  const activities = activitiesQuery.data;
  const history = historyQuery.data;

  const data = useMemo(() => {
    if (!session || !activities || !history) return null;
    const start = session.start_date;
    const dayCount = daysBetween(start, session.end_date ?? today) + 1;

    const byActivity = new Map();
    for (const log of history.logs) {
      const i = daysBetween(start, log.date);
      if (i < 0 || i >= dayCount) continue;
      if (!byActivity.has(log.activity_id)) {
        byActivity.set(log.activity_id, new Array(dayCount).fill(0));
      }
      byActivity.get(log.activity_id)[i] = log.amount;
    }

    const series = activities
      .filter((a) => byActivity.has(a.id))
      .map((activity) => {
        const values = byActivity.get(activity.id);
        return { activity, values, total: values.reduce((sum, v) => sum + v, 0) };
      });

    const windowDays = Math.max(dayCount, MIN_WINDOW_DAYS);
    return {
      start,
      dayCount,
      windowDays,
      windowEnd: shiftDateString(start, windowDays - 1),
      activities,
      series,
    };
  }, [session, activities, history, today]);

  return {
    data,
    isLoading: activitiesQuery.isLoading || historyQuery.isLoading,
    error: activitiesQuery.error || historyQuery.error,
  };
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
