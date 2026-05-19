import { useSession } from '../SessionContext.jsx';
import CreateSessionForm from '../components/CreateSessionForm.jsx';
import SessionHeader from '../components/SessionHeader.jsx';

export default function Home() {
  const { session, loading, error } = useSession();

  if (loading) {
    return (
      <main className="container">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="page-header">
        <h1>Calorie Tracker</h1>
      </header>

      {error && <p className="error">{error}</p>}

      {!session && <CreateSessionForm />}

      {session && (
        <>
          <SessionHeader />
          <section className="card">
            <h2>Today's overview</h2>
            <p className="muted">Meal logging UI lands in Phase 3.</p>
          </section>
        </>
      )}
    </main>
  );
}
