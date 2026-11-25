import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminErrorMessage, api } from '../../api.js';
import { DifficultyTag, ErrorMessage } from '../../components.jsx';

export default function AdminProblemsPage() {
  const [problems, setProblems] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

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

  async function togglePublish(p) {
    setBusyId(p.id);
    setError('');
    setNotice('');
    try {
      const updated = await api.adminUpdateProblem(p.id, { is_published: !p.is_published });
      setProblems((list) => list.map((x) => (x.id === p.id ? updated : x)));
      setNotice(`"${updated.title}" is now ${updated.is_published ? 'published' : 'a draft'}.`);
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p) {
    const ok = window.confirm(
      `Delete "${p.title}"?\n\nThis also deletes its ${p.test_cases?.length ?? 0} test case(s). This can't be undone.`,
    );
    if (!ok) return;
    setBusyId(p.id);
    setError('');
    setNotice('');
    try {
      await api.adminDeleteProblem(p.id);
      setProblems((list) => list.filter((x) => x.id !== p.id));
      setNotice(`Deleted "${p.title}".`);
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container page container-wide">
      <div className="page-head">
        <h1>Problems</h1>
        <Link to="/admin/problems/new" className="btn btn-admin">
          New problem
        </Link>
      </div>

      <ErrorMessage>{error}</ErrorMessage>
      {notice && (
        <p className="notice small" role="status">
          {notice}
        </p>
      )}

      {problems === null && !error && <p className="muted page-status">Loading…</p>}

      {problems && problems.length === 0 && (
        <div className="card empty">
          <p>
            No problems yet. <Link to="/admin/problems/new">Create the first one.</Link>
          </p>
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
                <th scope="col">Status</th>
                <th scope="col">Tests</th>
                <th scope="col" className="col-actions">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p) => {
                const tests = p.test_cases || [];
                const visible = tests.filter((t) => !t.is_hidden).length;
                const busy = busyId === p.id;
                return (
                  <tr key={p.id}>
                    <td className="col-num muted">{p.id}</td>
                    <td>
                      <Link to={`/admin/problems/${p.id}/edit`} className="row-link">
                        {p.title}
                      </Link>
                    </td>
                    <td>
                      <DifficultyTag difficulty={p.difficulty} />
                    </td>
                    <td>
                      <span className={`pub-label ${p.is_published ? 'is-published' : 'is-draft'}`}>
                        {p.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="small">
                      {tests.length}
                      <span className="muted"> · {visible} visible</span>
                      {visible === 0 && (
                        <span className="warn-dot" title="No visible test case" aria-label="No visible test case">
                          !
                        </span>
                      )}
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <Link to={`/admin/problems/${p.id}/edit`} className="btn btn-secondary btn-small">
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => togglePublish(p)}
                          disabled={busy}
                        >
                          {p.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        {p.is_published ? (
                          <a
                            href={`/problems/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-small"
                          >
                            Preview
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            disabled
                            title="Drafts aren't visible on the site. Publish to preview."
                          >
                            Preview
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => remove(p)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
