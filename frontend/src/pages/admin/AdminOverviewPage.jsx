import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminErrorMessage, api } from '../../api.js';
import { DifficultyTag, ErrorMessage } from '../../components.jsx';
import { DIFFICULTIES } from '../../format.js';

export default function AdminOverviewPage() {
  const [problems, setProblems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .adminProblems()
      .then((data) => active && setProblems(data))
      .catch((err) => active && setError(adminErrorMessage(err)));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="container page">
        <h1>Overview</h1>
        <ErrorMessage>{error}</ErrorMessage>
      </div>
    );
  }
  if (!problems) return <p className="container muted page-status">Loading…</p>;

  const published = problems.filter((p) => p.is_published).length;
  const byDifficulty = DIFFICULTIES.map((d) => {
    const list = problems.filter((p) => p.difficulty === d);
    return {
      d,
      total: list.length,
      published: list.filter((p) => p.is_published).length,
    };
  });
  const noSamples = problems.filter((p) => !(p.test_cases || []).some((t) => !t.is_hidden));
  const noTests = problems.filter((p) => !(p.test_cases || []).length);

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Overview</h1>
        <Link to="/admin/problems/new" className="btn btn-admin">
          New problem
        </Link>
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <span className="stat-label">Total problems</span>
          <span className="stat-value">{problems.length}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Published</span>
          <span className="stat-value">{published}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Drafts</span>
          <span className="stat-value">{problems.length - published}</span>
        </div>
      </div>

      <section className="card section">
        <h2>Problems by difficulty</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Difficulty</th>
                <th scope="col">Total</th>
                <th scope="col">Published</th>
                <th scope="col">Drafts</th>
              </tr>
            </thead>
            <tbody>
              {byDifficulty.map(({ d, total, published: pub }) => (
                <tr key={d}>
                  <td>
                    <DifficultyTag difficulty={d} />
                  </td>
                  <td className="num">{total}</td>
                  <td className="num">{pub}</td>
                  <td className="num">{total - pub}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(noTests.length > 0 || noSamples.length > 0) && (
        <section className="card section">
          <h2>Needs attention</h2>
          <ul className="attention">
            {noTests.map((p) => (
              <li key={`t${p.id}`}>
                <Link to={`/admin/problems/${p.id}/edit`}>{p.title}</Link>
                <span className="muted small"> has no test cases, so submissions can't be judged.</span>
              </li>
            ))}
            {noSamples
              .filter((p) => (p.test_cases || []).length)
              .map((p) => (
                <li key={`s${p.id}`}>
                  <Link to={`/admin/problems/${p.id}/edit`}>{p.title}</Link>
                  <span className="muted small">
                    {' '}
                    has no visible test case, so users get no examples and "Run samples" fails.
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
