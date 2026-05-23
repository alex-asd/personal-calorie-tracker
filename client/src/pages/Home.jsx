import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../hooks/useSession.js';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import CreateSessionForm from '../components/CreateSessionForm.jsx';
import SessionHeader from '../components/SessionHeader.jsx';
import TodayTotals from '../components/TodayTotals.jsx';
import MealList from '../components/MealList.jsx';
import AddMealModal from '../components/AddMealModal.jsx';
import DayHistoryTable from '../components/DayHistoryTable.jsx';
import WeightLogger from '../components/WeightLogger.jsx';

export default function Home() {
  const { data: session, isLoading: sessionLoading, error: sessionError } = useSession();
  const [adding, setAdding] = useState(false);

  const mealsQuery = useQuery({
    queryKey: queryKeys.meals.list(),
    queryFn: async () => {
      const { meals } = await api.get('/api/meals');
      return meals;
    },
    enabled: !!session,
  });

  const daysQuery = useQuery({
    queryKey: session ? queryKeys.sessions.days(session.id) : ['sessions', 'days', 'idle'],
    queryFn: async () => {
      const { days } = await api.get(`/api/sessions/${session.id}/days`);
      return days;
    },
    enabled: !!session,
  });

  const meals = mealsQuery.data ?? [];
  const days = daysQuery.data ?? [];

  if (sessionLoading) {
    return (
      <main className="container">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const canAdd = session && !session.blocked;

  return (
    <main className="container">
      {sessionError && <p className="error">{sessionError.message}</p>}

      {!session && <CreateSessionForm />}

      {session && (
        <>
          <header className="page-header">
            <h1>Today</h1>
            {canAdd && (
              <button className="primary" onClick={() => setAdding(true)}>
                + Add meal
              </button>
            )}
          </header>
          <SessionHeader />
          <WeightLogger disabled={session.blocked} />
          <TodayTotals meals={meals} session={session} />
          <MealList
            meals={meals}
            loading={mealsQuery.isLoading}
            error={mealsQuery.error}
            canEdit={!session.blocked}
          />
          {daysQuery.error && <p className="error">{daysQuery.error.message}</p>}
          <DayHistoryTable days={days} session={session} />
        </>
      )}

      {adding && <AddMealModal onClose={() => setAdding(false)} onAdded={() => setAdding(false)} />}
    </main>
  );
}
