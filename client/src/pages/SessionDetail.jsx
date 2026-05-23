import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';
import DayHistoryTable from '../components/DayHistoryTable.jsx';

function parseLocal(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtRange(start, end) {
  const s = parseLocal(start);
  const e = end ? parseLocal(end) : new Date();
  const sameYear = s.getFullYear() === e.getFullYear();
  const sOpts = sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  const eOpts = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${s.toLocaleDateString(undefined, sOpts)} – ${e.toLocaleDateString(undefined, eOpts)}`;
}

export default function SessionDetail() {
  const { id } = useParams();

  const sessionQuery = useQuery({
    queryKey: queryKeys.sessions.detail(id),
    queryFn: async () => {
      const { session } = await api.get(`/api/sessions/${id}`);
      return session;
    },
  });

  const daysQuery = useQuery({
    queryKey: queryKeys.sessions.days(id),
    queryFn: async () => {
      const { days } = await api.get(`/api/sessions/${id}/days`);
      return days;
    },
  });

  const session = sessionQuery.data;
  const days = daysQuery.data ?? [];
  const isLoading = sessionQuery.isLoading || daysQuery.isLoading;
  const error = sessionQuery.error || daysQuery.error;
  const dayCount = days.length;

  return (
    <main className="container">
      <header className="page-header">
        <h1>Session</h1>
        <Link to="/archive" className="link-back">
          ← Archive
        </Link>
      </header>

      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error.message}</p>}

      {session && (
        <>
          <section className="card">
            <h2>{fmtRange(session.start_date, session.end_date)}</h2>
            <p className="muted">
              {dayCount} day{dayCount === 1 ? '' : 's'} · Targets: {session.calorie_target} kcal /{' '}
              {session.protein_target}g protein
              {session.status === 'open' && ' · (still open)'}
            </p>
            {(session.start_weight_kg != null || session.end_weight_kg != null) && (
              <p className="muted">
                Weight: {session.start_weight_kg != null ? `${session.start_weight_kg} kg` : '—'} →{' '}
                {session.end_weight_kg != null ? `${session.end_weight_kg} kg` : '—'}
              </p>
            )}
          </section>
          <DayHistoryTable days={days} session={session} showRelative={false} />
        </>
      )}
    </main>
  );
}
