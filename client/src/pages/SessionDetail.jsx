import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
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
  const [session, setSession] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(`/api/sessions/${id}`), api.get(`/api/sessions/${id}/days`)])
      .then(([sRes, dRes]) => {
        if (cancelled) return;
        setSession(sRes.session);
        setDays(dRes.days);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dayCount = days.length;

  return (
    <main className="container">
      <header className="page-header">
        <h1>Session</h1>
        <Link to="/archive" className="link-back">
          ← Archive
        </Link>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

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
