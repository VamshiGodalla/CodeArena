import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DifficultyTag, ErrorMessage, StatusBadge, When } from '../components.jsx';
import { DIFFICULTIES, formatTime } from '../format.js';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.stats(), api.mySubmissions({ limit: 10 }), api.problems()])
      .then(([stats, recent, problems]) => {
        if (!active) return;
        const totals = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0]));
        for (const p of problems) totals[p.difficulty] = (totals[p.difficulty] || 0) + 1;
        setData({ stats, recent, totals, problemCount: problems.length });
      })
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="container page">
        <h1>Dashboard</h1>
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    );
  }
  if (!data) return <p className="container muted page-status">Loading your stats…</p>;

  const { stats, recent, totals, problemCount } = data;

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Welcome back, {user.username}</h1>
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <span className="stat-label">Problems solved</span>
          <span className="stat-value">
            {stats.problems_solved}
            <span className="stat-of"> / {problemCount}</span>
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">Acceptance rate</span>
          <span className="stat-value">{stats.acceptance_rate.toFixed(1)}%</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Submissions</span>
          <span className="stat-value">{stats.total_submissions}</span>
        </div>
      </div>

      <section className="card section">
        <h2>Solved by difficulty</h2>
        <ul className="bars">
          {DIFFICULTIES.map((d) => {
            const solved = stats.solved_by_difficulty?.[d] ?? 0;
            const total = totals[d] || 0;
            const pct = total ? Math.min(100, (solved / total) * 100) : 0;
            return (
              <li key={d} className="bar-row">
                <DifficultyTag difficulty={d} />
                <div
                  className="bar"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={solved}
                  aria-label={`${d.toLowerCase()} problems solved`}
                >
                  <div className={`bar-fill diff-bg-${d.toLowerCase()}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="bar-count">
                  {solved} / {total}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card section">
        <h2>Recent submissions</h2>
        {recent.length === 0 ? (
          <p className="muted">
            No submissions yet. <Link to="/problems">Pick a problem</Link> to get started.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  <th scope="col">Result</th>
                  <th scope="col">Time</th>
                  <th scope="col">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/problems/${s.problem_id}`} className="row-link">
                        {s.problem_title}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="mono small">{formatTime(s.execution_time)}</td>
                    <td className="muted small">
                      <When value={s.created_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
