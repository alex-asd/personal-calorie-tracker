import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { queryKeys } from '../queryKeys.js';

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

function fmtWeight(start, end) {
  if (start == null && end == null) return null;
  if (start != null && end != null) return `${start} → ${end} kg`;
  if (start != null) return `start ${start} kg`;
  return `end ${end} kg`;
}

export default function Archive() {
  const {
    data: sessions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.sessions.list(),
    queryFn: async () => {
      const { sessions } = await api.get('/api/sessions');
      return sessions;
    },
  });

  return (
    <main className="container">
      <header className="page-header">
        <h1>Archive</h1>
      </header>

      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error.message}</p>}

      {!isLoading && !error && sessions.length === 0 && (
        <section className="card">
          <p className="muted">
            No closed sessions yet. Sessions appear here once you close them from the Today page.
          </p>
        </section>
      )}

      {sessions.length > 0 && (
        <ul className="archive-list">
          {sessions.map((s) => {
            const w = fmtWeight(s.start_weight_kg, s.end_weight_kg);
            return (
              <li key={s.id}>
                <Link to={`/archive/${s.id}`} className="archive-item card">
                  <div className="row">
                    <div>
                      <div className="archive-title">{fmtRange(s.start_date, s.end_date)}</div>
                      <div className="muted small">
                        {s.day_count} day{s.day_count === 1 ? '' : 's'} · {s.calorie_target} kcal /{' '}
                        {s.protein_target}g protein
                        {w && <> · {w}</>}
                      </div>
                    </div>
                    <div className="archive-chevron" aria-hidden="true">
                      ›
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
