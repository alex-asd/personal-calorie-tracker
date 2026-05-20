import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../SessionContext.jsx';
import { api } from '../api.js';
import CreateSessionForm from '../components/CreateSessionForm.jsx';
import SessionHeader from '../components/SessionHeader.jsx';
import TodayTotals from '../components/TodayTotals.jsx';
import MealList from '../components/MealList.jsx';
import AddMealModal from '../components/AddMealModal.jsx';
import DayHistoryTable from '../components/DayHistoryTable.jsx';
import WeightLogger from '../components/WeightLogger.jsx';

export default function Home() {
  const { session, loading: sessionLoading, error: sessionError } = useSession();
  const [meals, setMeals] = useState([]);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [mealsError, setMealsError] = useState(null);
  const [days, setDays] = useState([]);
  const [daysError, setDaysError] = useState(null);
  const [adding, setAdding] = useState(false);

  const refreshMeals = useCallback(async () => {
    if (!session) {
      setMeals([]);
      return;
    }
    setMealsLoading(true);
    setMealsError(null);
    try {
      const { meals } = await api.get('/api/meals');
      setMeals(meals);
    } catch (e) {
      setMealsError(e.message);
    } finally {
      setMealsLoading(false);
    }
  }, [session]);

  const refreshDays = useCallback(async () => {
    if (!session) {
      setDays([]);
      return;
    }
    setDaysError(null);
    try {
      const { days } = await api.get(`/api/sessions/${session.id}/days`);
      setDays(days);
    } catch (e) {
      setDaysError(e.message);
    }
  }, [session]);

  useEffect(() => {
    refreshMeals();
    refreshDays();
  }, [refreshMeals, refreshDays]);

  const onMealChange = useCallback(() => {
    refreshMeals();
    refreshDays();
  }, [refreshMeals, refreshDays]);

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
      {sessionError && <p className="error">{sessionError}</p>}

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
            loading={mealsLoading}
            error={mealsError}
            canEdit={!session.blocked}
            onChange={onMealChange}
          />
          {daysError && <p className="error">{daysError}</p>}
          <DayHistoryTable days={days} session={session} />
        </>
      )}

      {adding && (
        <AddMealModal
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            onMealChange();
          }}
        />
      )}
    </main>
  );
}
