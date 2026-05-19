import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../SessionContext.jsx';
import { api } from '../api.js';
import CreateSessionForm from '../components/CreateSessionForm.jsx';
import SessionHeader from '../components/SessionHeader.jsx';
import TodayTotals from '../components/TodayTotals.jsx';
import MealList from '../components/MealList.jsx';
import AddMealModal from '../components/AddMealModal.jsx';

export default function Home() {
  const { session, loading: sessionLoading, error: sessionError } = useSession();
  const [meals, setMeals] = useState([]);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [mealsError, setMealsError] = useState(null);
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

  useEffect(() => {
    refreshMeals();
  }, [refreshMeals]);

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
      <header className="page-header">
        <h1>Calorie Tracker</h1>
        {canAdd && (
          <button className="primary" onClick={() => setAdding(true)}>
            + Add meal
          </button>
        )}
      </header>

      {sessionError && <p className="error">{sessionError}</p>}

      {!session && <CreateSessionForm />}

      {session && (
        <>
          <SessionHeader />
          <TodayTotals meals={meals} session={session} />
          <MealList
            meals={meals}
            loading={mealsLoading}
            error={mealsError}
            canEdit={!session.blocked}
            onChange={refreshMeals}
          />
        </>
      )}

      {adding && (
        <AddMealModal
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            refreshMeals();
          }}
        />
      )}
    </main>
  );
}
