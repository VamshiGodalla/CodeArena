import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { adminErrorMessage, api } from '../../api.js';
import { ErrorMessage } from '../../components.jsx';
import { DIFFICULTIES, difficultyLabel } from '../../format.js';
import { ProblemStatement, STARTER } from '../../problemView.jsx';

const EMPTY = {
  title: '',
  description: '',
  difficulty: 'EASY',
  constraints: '',
  time_limit: '2',
  memory_limit: '256',
  is_published: false,
};

let keySeq = 0;
const newTest = (isHidden) => ({
  key: `new-${++keySeq}`,
  input: '',
  expected_output: '',
  is_hidden: isHidden,
});

function fromProblem(p) {
  return {
    title: p.title,
    description: p.description,
    difficulty: p.difficulty,
    constraints: p.constraints ?? '',
    time_limit: String(p.time_limit),
    memory_limit: String(p.memory_limit),
    is_published: p.is_published,
  };
}

function validate(f) {
  const problems = [];
  if (!f.title.trim()) problems.push('Title is required.');
  if (f.title.trim().length > 200) problems.push('Title must be 200 characters or fewer.');
  if (!f.description.trim()) problems.push('Description is required.');
  const t = Number(f.time_limit);
  if (!(t > 0 && t <= 10)) problems.push('Time limit must be more than 0 and at most 10 seconds.');
  const m = Number(f.memory_limit);
  if (!(Number.isInteger(m) && m >= 16 && m <= 1024))
    problems.push('Memory limit must be a whole number from 16 to 1024 MB.');
  return problems;
}

function payload(f) {
  return {
    title: f.title.trim(),
    description: f.description,
    difficulty: f.difficulty,
    constraints: f.constraints.trim() ? f.constraints : null,
    time_limit: Number(f.time_limit),
    memory_limit: Number(f.memory_limit),
    is_published: f.is_published,
  };
}

const testBody = (t) => ({ input: t.input, expected_output: t.expected_output, is_hidden: t.is_hidden });

// A saved test whose input, output or Hidden flag differs from what's on the server.
const isEdited = (t) =>
  Boolean(t.id) &&
  !t.remove &&
  (t.input !== t.orig.input ||
    t.expected_output !== t.orig.expected_output ||
    t.is_hidden !== t.orig.is_hidden);

const fromSaved = (t) => ({ ...t, key: `saved-${t.id}`, orig: testBody(t) });

export default function AdminProblemFormPage({ problemId }) {
  const isEdit = Boolean(problemId);
  const navigate = useNavigate();
  const location = useLocation();

  const [fields, setFields] = useState(EMPTY);
  // Each test: {key, id?, orig?, input, expected_output, is_hidden, remove?}. Tests with an id are saved.
  const [tests, setTests] = useState(() => (isEdit ? [] : [newTest(false)]));
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.flash || '');
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('edit'); // 'edit' | 'preview'
  const errorRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    api
      .adminProblem(problemId)
      .then((p) => {
        if (!active) return;
        setFields(fromProblem(p));
        setTests((p.test_cases || []).map(fromSaved));
      })
      .catch((err) => active && setLoadError(adminErrorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isEdit, problemId]);

  // Clear the "created" flash from history so a reload doesn't show it again.
  useEffect(() => {
    if (location.state?.flash) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const set = (name) => (e) =>
    setFields((f) => ({
      ...f,
      [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));

  function updateTest(key, patch) {
    setTests((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  function removeTest(t) {
    if (t.id) updateTest(t.key, { remove: !t.remove });
    else setTests((ts) => ts.filter((x) => x.key !== t.key));
  }

  function addTest() {
    const active = tests.filter((t) => !t.remove);
    setTests((ts) => [...ts, newTest(active.some((t) => !t.is_hidden))]);
  }

  function fail(message) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    const problems = validate(fields);
    if (problems.length) {
      setView('edit');
      return fail(problems.join('\n'));
    }

    setSaving(true);
    if (!isEdit) {
      try {
        const created = await api.adminCreateProblem({
          ...payload(fields),
          test_cases: tests.map(testBody),
        });
        navigate(`/admin/problems/${created.id}/edit`, {
          replace: true,
          state: { flash: `Created "${created.title}".` },
        });
      } catch (err) {
        fail(adminErrorMessage(err));
        setSaving(false);
      }
      return;
    }

    // Edit: PATCH the fields, add new tests, replace edited ones, then delete removed ones.
    // The API can't update a test case, so an edit is saved as "add the new version, delete the old".
    // Local state is updated after each step so the form always shows what is saved.
    let changed = false;
    try {
      const updated = await api.adminUpdateProblem(problemId, payload(fields));
      setFields(fromProblem(updated));
      changed = true;

      for (const t of tests.filter((x) => !x.id)) {
        const saved = await api.adminAddTestCase(problemId, testBody(t));
        setTests((ts) => ts.map((x) => (x.key === t.key ? fromSaved(saved) : x)));
      }
      for (const t of tests.filter(isEdited)) {
        const saved = await api.adminAddTestCase(problemId, testBody(t));
        await api.adminDeleteTestCase(t.id);
        setTests((ts) => ts.map((x) => (x.key === t.key ? fromSaved(saved) : x)));
      }
      for (const t of tests.filter((x) => x.id && x.remove)) {
        await api.adminDeleteTestCase(t.id);
        setTests((ts) => ts.filter((x) => x.key !== t.key));
      }
      setNotice('Changes saved.');
    } catch (err) {
      fail(
        adminErrorMessage(err) +
          (changed ? '\n\nSome changes were saved before this error. The form shows what is saved now.' : ''),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="container page">
        <h1>Edit problem</h1>
        <ErrorMessage>{loadError}</ErrorMessage>
        <p>
          <Link to="/admin/problems">Back to problems</Link>
        </p>
      </div>
    );
  }
  if (loading) return <p className="container muted page-status">Loading problem…</p>;

  const activeTests = tests.filter((t) => !t.remove);
  const noTests = activeTests.length === 0;
  const noVisible = !noTests && !activeTests.some((t) => !t.is_hidden);
  const pendingChanges = tests.some((t) => !t.id || t.remove || isEdited(t));

  return (
    <div className="container page form-page">
      <p className="breadcrumb">
        <Link to="/admin/problems">Problems</Link>
        <span aria-hidden="true"> / </span>
        <span className="muted">{isEdit ? `#${problemId}` : 'New'}</span>
      </p>
      <div className="page-head">
        <h1>{isEdit ? 'Edit problem' : 'New problem'}</h1>
        <div className="head-actions">
          {isEdit && fields.is_published && (
            <a href={`/problems/${problemId}`} target="_blank" rel="noreferrer" className="btn btn-ghost">
              Open on site
            </a>
          )}
          <div className="segmented" role="group" aria-label="Edit or preview">
            <button
              type="button"
              aria-pressed={view === 'edit'}
              className={view === 'edit' ? 'active' : ''}
              onClick={() => setView('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              aria-pressed={view === 'preview'}
              className={view === 'preview' ? 'active' : ''}
              onClick={() => setView('preview')}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <p className="notice small" role="status">
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="admin-form">
        {view === 'preview' && <ProblemPreview fields={fields} tests={tests} />}

        <div className="admin-form" hidden={view !== 'edit'}>
        <section className="card section form-section">
          <h2>Details</h2>
          <label className="field">
            <span>Title</span>
            <input value={fields.title} onChange={set('title')} maxLength={200} required />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea value={fields.description} onChange={set('description')} rows={10} required />
            <small className="hint">Shown as written, line breaks included.</small>
          </label>

          <label className="field">
            <span>
              Constraints <span className="muted">(optional)</span>
            </span>
            <textarea
              value={fields.constraints}
              onChange={set('constraints')}
              rows={3}
              className="mono-input"
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Difficulty</span>
              <select value={fields.difficulty} onChange={set('difficulty')}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {difficultyLabel(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Time limit (seconds)</span>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={fields.time_limit}
                onChange={set('time_limit')}
                required
              />
            </label>
            <label className="field">
              <span>Memory limit (MB)</span>
              <input
                type="number"
                min="16"
                max="1024"
                step="1"
                value={fields.memory_limit}
                onChange={set('memory_limit')}
                required
              />
            </label>
          </div>

          <label className="checkbox">
            <input type="checkbox" checked={fields.is_published} onChange={set('is_published')} />
            <span>
              Published
              <small className="hint"> Published problems appear on the site.</small>
            </span>
          </label>
        </section>

        <section className="card section form-section">
          <div className="section-head">
            <h2>Test cases</h2>
            <button type="button" className="btn btn-secondary btn-small" onClick={addTest}>
              Add test case
            </button>
          </div>
          <p className="hint">
            Visible tests are shown to users as examples and used by "Run samples". Hidden tests are
            only used when judging submissions.
            {isEdit &&
              ' Editing a saved test replaces it with a new one when you save, so earlier submissions lose their result for that test.'}
          </p>

          {noTests && (
            <p className="warning" role="status">
              There are no test cases, so submissions to this problem can't be judged.
            </p>
          )}
          {noVisible && (
            <p className="warning" role="status">
              No test case is visible. Users will see no examples and "Run samples" won't work. Untick
              "Hidden" on at least one test.
            </p>
          )}

          <ol className="test-list">
            {tests.map((t, i) => {
              const saved = Boolean(t.id);
              return (
                <li key={t.key} className={`test-item ${t.remove ? 'is-removed' : ''}`}>
                  <div className="test-head">
                    <span className="test-title">
                      Test {i + 1}
                      {saved && !isEdited(t) && <span className="muted small"> · saved</span>}
                      {isEdited(t) && <span className="new-label small"> · edited, not saved yet</span>}
                      {!saved && isEdit && <span className="new-label small"> · new, not saved yet</span>}
                      {t.remove && <span className="removed-label small"> · will be removed on save</span>}
                    </span>
                    <label className="checkbox checkbox-inline">
                      <input
                        type="checkbox"
                        checked={t.is_hidden}
                        disabled={t.remove}
                        onChange={(e) => updateTest(t.key, { is_hidden: e.target.checked })}
                      />
                      <span>Hidden</span>
                    </label>
                    <button
                      type="button"
                      className={`btn btn-small ${t.remove ? 'btn-secondary' : 'btn-ghost'}`}
                      onClick={() => removeTest(t)}
                      aria-label={t.remove ? `Keep test ${i + 1}` : `Remove test ${i + 1}`}
                    >
                      {t.remove ? 'Keep' : 'Remove'}
                    </button>
                  </div>
                  <div className="io-grid">
                      <label className="field">
                        <span className="io-label">Input</span>
                        <textarea
                          className="mono-input"
                          rows={4}
                          value={t.input}
                          onChange={(e) => updateTest(t.key, { input: e.target.value })}
                          readOnly={t.remove}
                          spellCheck={false}
                        />
                      </label>
                      <label className="field">
                        <span className="io-label">Expected output</span>
                        <textarea
                          className="mono-input"
                          rows={4}
                          value={t.expected_output}
                          onChange={(e) => updateTest(t.key, { expected_output: e.target.value })}
                          readOnly={t.remove}
                          spellCheck={false}
                        />
                      </label>
                    </div>
                </li>
              );
            })}
          </ol>
          {tests.length > 0 && (
            <button type="button" className="btn btn-secondary btn-small" onClick={addTest}>
              Add test case
            </button>
          )}
        </section>

        </div>

        <div ref={errorRef}>
          <ErrorMessage>{error}</ErrorMessage>
        </div>

        <div className="form-actions">
          <Link to="/admin/problems" className="btn btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn btn-admin" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create problem'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setView(view === 'edit' ? 'preview' : 'edit');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            {view === 'edit' ? 'Preview' : 'Back to editing'}
          </button>
          {isEdit && pendingChanges && !saving && (
            <span className="muted small">Test case changes are saved when you press Save.</span>
          )}
        </div>
      </form>
    </div>
  );
}

// What a user will see on the problem page, built from the unsaved form.
function ProblemPreview({ fields, tests }) {
  const active = tests.filter((t) => !t.remove);
  const samples = active.filter((t) => !t.is_hidden);
  const hiddenCount = active.length - samples.length;
  const problem = {
    title: fields.title.trim(),
    difficulty: fields.difficulty,
    description: fields.description,
    constraints: fields.constraints.trim() ? fields.constraints : null,
    time_limit: fields.time_limit,
    memory_limit: fields.memory_limit,
  };

  return (
    <section className="preview" aria-label="Preview of the problem page">
      <p className="preview-note small">
        This is how the problem page will look to users
        {fields.is_published ? '.' : ' once it is published. It is a draft right now.'}{' '}
        {hiddenCount > 0 &&
          `${hiddenCount} hidden test${hiddenCount === 1 ? ' is' : 's are'} not shown to users.`}
      </p>
      <div className="workspace preview-workspace">
        <div className="pane statement">
          <ProblemStatement problem={problem} samples={samples} />
          {samples.length === 0 && (
            <p className="warning">No visible test case, so users will see no examples.</p>
          )}
        </div>
        <div className="pane editor-pane">
          <div className="editor-toolbar">
            <span className="lang">Python 3</span>
          </div>
          <pre className="preview-editor">{STARTER}</pre>
          <div className="editor-actions">
            <button type="button" className="btn btn-secondary" disabled>
              Run samples
            </button>
            <button type="button" className="btn btn-primary" disabled>
              Submit
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
