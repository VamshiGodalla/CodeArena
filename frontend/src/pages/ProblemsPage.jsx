import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DifficultyTag, ErrorMessage } from '../components.jsx';
import { DIFFICULTIES, difficultyLabel } from '../format.js';

export default function ProblemsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const difficulty = DIFFICULTIES.includes(params.get('difficulty')) ? params.get('difficulty') : '';

  const [problems, setProblems] = useState(null);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    let active = true;
    setProblems(null);
    setError('');
    api
      .problems(difficulty || undefined)
      .then((data) => active && setProblems(data))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [difficulty]);

  useEffect(() => {
    if (!user) {
      setSubmissions([]);
      return;
    }
    let active = true;
    api
      .mySubmissions({ limit: 200 })
      .then((data) => active && setSubmissions(data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const progress = useMemo(() => {
    const map = new Map();
    for (const s of submissions) {
      if (s.status === 'ACCEPTED') map.set(s.problem_id, 'solved');
      else if (!map.has(s.problem_id)) map.set(s.problem_id, 'tried');
    }
    return map;
  }, [submissions]);

  function setFilter(value) {
    setParams(value ? { difficulty: value } : {}, { replace: true });
  }

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Problems</h1>
        <div className="segmented" role="group" aria-label="Filter by difficulty">
          {['', ...DIFFICULTIES].map((d) => (
            <button
              key={d || 'all'}
              type="button"
              aria-pressed={difficulty === d}
              className={difficulty === d ? 'active' : ''}
              onClick={() => setFilter(d)}
            >
              {d ? difficultyLabel(d) : 'All'}
            </button>
          ))}
        </div>
      </div>

      <ErrorMessage>{error}</ErrorMessage>

      {!error && problems === null && <p className="muted page-status">Loading problems…</p>}

      {problems && problems.length === 0 && (
        <div className="card empty">
          <p>No problems{difficulty ? ` at ${difficultyLabel(difficulty).toLowerCase()} difficulty` : ''} yet.</p>
        </div>
      )}

      {problems && problems.length > 0 && (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th scope="col" className="col-num">#</th>
                <th scope="col">Title</th>
                <th scope="col">Difficulty</th>
                {user && <th scope="col">Status</th>}
              </tr>
            </thead>
            <tbody>
              {problems.map((p) => {
                const state = progress.get(p.id);
                return (
                  <tr key={p.id}>
                    <td className="col-num muted">{p.id}</td>
                    <td>
                      <Link to={`/problems/${p.id}`} className="row-link">
                        {p.title}
                      </Link>
                    </td>
                    <td>
                      <DifficultyTag difficulty={p.difficulty} />
                    </td>
                    {user && (
                      <td>
                        {state === 'solved' && <span className="progress solved">Solved</span>}
                        {state === 'tried' && <span className="progress tried">Tried</span>}
                        {!state && <span className="muted">—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!user && problems && problems.length > 0 && (
        <p className="muted small">
          <Link to="/login">Sign in</Link> to run code, submit and track which problems you've solved.
        </p>
      )}
    </div>
  );
}
