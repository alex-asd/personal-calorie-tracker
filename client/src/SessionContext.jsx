import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { session } = await api.get('/api/sessions/current');
      setSession(session);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createSession = useCallback(
    async ({ calorie_target, protein_target, start_weight_kg }) => {
      const { session } = await api.post('/api/sessions', {
        calorie_target,
        protein_target,
        start_weight_kg
      });
      setSession(session);
      return session;
    },
    []
  );

  const closeSession = useCallback(
    async ({ end_weight_kg } = {}) => {
      if (!session) return null;
      const { session: closed } = await api.post(`/api/sessions/${session.id}/close`, {
        end_weight_kg
      });
      setSession(null);
      return closed;
    },
    [session]
  );

  const value = { session, loading, error, refresh, createSession, closeSession };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
