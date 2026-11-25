import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../theme.jsx';
import {
  ErrorMessage,
  Spinner,
  StatusBadge,
  TestSquares,
  When,
} from '../components.jsx';
import { formatTime, isFinal, statusInfo } from '../format.js';
import { ProblemStatement, STARTER } from '../problemView.jsx';


const POLL_MS = 1000;
const MAX_POLL_FAILURES = 5;

const draftKey = (id) => `codearena:draft:${id}`;

function loadDraft(id) {
  try {
    return localStorage.getItem(draftKey(id)) ?? STARTER;
  } catch {
    return STARTER;
  }
}

function saveDraft(id, code) {
  try {
    localStorage.setItem(draftKey(id), code);
  } catch {
    /* ignore */
  }
}

export default function ProblemPage({ problemId }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();

  const [problem, setProblem] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [code, setCode] = useState(() => loadDraft(problemId));
  const [busy, setBusy] = useState(null); // 'run' | 'submit' | null
  const [output, setOutput] = useState(null); // {kind: 'run'|'submission'|'error', ...}
  const [history, setHistory] = useState([]);

  const alive = useRef(true);
  const pollTimer = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    api
      .problem(problemId)
      .then((p) => alive.current && setProblem(p))
      .catch((err) => alive.current && setLoadError(err.message));
  }, [problemId]);

  useEffect(() => {
    if (problem) document.title = `${problem.title} · CodeArena`;
    return () => {
      document.title = 'CodeArena';
    };
  }, [problem]);

  const refreshHistory = useCallback(() => {
    if (!user) return;
    api
      .mySubmissions({ problemId })
      .then((h) => alive.current && setHistory(h))
      .catch(() => {});
  }, [user, problemId]);

  useEffect(() => {
    if (user) refreshHistory();
    else setHistory([]);
  }, [user, refreshHistory]);

  function handleCodeChange(value) {
    const next = value ?? '';
    setCode(next);
    saveDraft(problemId, next);
  }

  function resetCode() {
    if (code !== STARTER && !window.confirm('Replace your code with the starter template?')) return;
    handleCodeChange(STARTER);
  }

  function showOutput(next) {
    setOutput(next);
    // Bring results into view on small screens, where they sit below the editor.
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    );
  }

  function ensureCode() {
    if (code.trim()) return true;
    showOutput({ kind: 'error', message: 'Write some code first.' });
    return false;
  }

  async function handleRun() {
    if (busy || !ensureCode()) return;
    setBusy('run');
    showOutput({ kind: 'run', data: null });
    try {
      const data = await api.run(problemId, code);
      if (alive.current) setOutput({ kind: 'run', data });
    } catch (err) {
      if (alive.current) setOutput({ kind: 'error', message: err.message });
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  const poll = useCallback(
    (submissionId, failures = 0, past = false) => {
      clearTimeout(pollTimer.current);
      pollTimer.current = setTimeout(async () => {
        if (!alive.current) return;
        try {
          const data = await api.submission(submissionId);
          if (!alive.current) return;
          setOutput({ kind: 'submission', data, past });
          if (isFinal(data.status)) {
            setBusy(null);
            refreshHistory();
          } else {
            poll(submissionId, 0, past);
          }
        } catch (err) {
          if (!alive.current) return;
          if (failures + 1 >= MAX_POLL_FAILURES) {
            setOutput({
              kind: 'error',
              message: `Lost contact while judging submission #${submissionId}: ${err.message}`,
            });
            setBusy(null);
          } else {
            poll(submissionId, failures + 1, past);
          }
        }
      }, POLL_MS);
    },
    [refreshHistory],
  );

  async function handleSubmit() {
    if (busy || !ensureCode()) return;
    setBusy('submit');
    try {
      const sub = await api.submit(problemId, code);
      if (!alive.current) return;
      showOutput({ kind: 'submission', data: { ...sub, results: [] } });
      refreshHistory();
      poll(sub.id);
    } catch (err) {
      if (!alive.current) return;
      showOutput({ kind: 'error', message: err.message });
      setBusy(null);
    }
  }

  async function viewSubmission(id) {
    if (busy) return;
    try {
      const data = await api.submission(id);
      if (!alive.current) return;
      showOutput({ kind: 'submission', data, past: true });
      if (!isFinal(data.status)) {
        setBusy('submit');
        poll(id, 0, true);
      }
    } catch (err) {
      if (alive.current) showOutput({ kind: 'error', message: err.message });
    }
  }

  if (loadError) {
    return (
      <div className="container page">
        <ErrorMessage>{loadError}</ErrorMessage>
        <p>
          <Link to="/problems">Back to problems</Link>
        </p>
      </div>
    );
  }

  const samples = problem?.sample_test_cases ?? problem?.samples ?? [];

  return (
    <div className="workspace">
      <section className="pane statement" aria-labelledby="problem-title">
        {!problem ? (
          <p className="muted">Loading problem…</p>
        ) : (
          <>
            <p className="breadcrumb">
              <Link to="/problems">Problems</Link>
              <span aria-hidden="true"> / </span>
              <span className="muted">#{problem.id}</span>
            </p>
            {user?.is_admin && (
              <p className="admin-edit-link small">
                <Link to={`/admin/problems/${problem.id}/edit`}>Edit this problem in admin</Link>
              </p>
            )}
            <ProblemStatement problem={problem} samples={samples} />

            {user && (
              <>
                <h2>Your submissions</h2>
                {history.length === 0 ? (
                  <p className="muted small">You haven't submitted this problem yet.</p>
                ) : (
                  <ul className="history">
                    {history.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="history-row"
                          onClick={() => viewSubmission(s.id)}
                          disabled={Boolean(busy)}
                        >
                          <StatusBadge status={s.status} />
                          <span className="mono small">{formatTime(s.execution_time)}</span>
                          <span className="muted small history-when">
                            <When value={s.created_at} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section className="pane editor-pane" aria-label="Code editor">
        <div className="editor-toolbar">
          <span className="lang">Python 3</span>
          <button type="button" className="btn btn-ghost btn-small" onClick={resetCode}>
            Reset
          </button>
        </div>
        <div className="editor-frame">
          <Editor
            language="python"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={code}
            onChange={handleCodeChange}
            loading={<span className="muted">Loading editor…</span>}
            onMount={(_editor, monaco) => {
              // Monaco measures glyphs once; re-measure after IBM Plex Mono finishes loading.
              document.fonts?.ready.then(() => monaco.editor.remeasureFonts());
            }}
            options={{
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: 14,
              lineHeight: 21,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              insertSpaces: true,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'line',
              ariaLabel: 'Python source code',
            }}
          />
        </div>

        <div className="editor-actions">
          {user ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRun}
                disabled={Boolean(busy) || !problem}
              >
                {busy === 'run' ? 'Running…' : 'Run samples'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={Boolean(busy) || !problem}
              >
                {busy === 'submit' ? 'Judging…' : 'Submit'}
              </button>
            </>
          ) : (
            <Link to="/login" state={{ from: location }} className="btn btn-primary">
              Sign in to run and submit
            </Link>
          )}
        </div>

        <div ref={resultsRef} className="results" aria-live="polite">
          {output?.kind === 'error' && <ErrorMessage>{output.message}</ErrorMessage>}
          {output?.kind === 'run' && <RunResult data={output.data} />}
          {output?.kind === 'submission' && (
            <SubmissionResult
              data={output.data}
              past={output.past}
              onLoadCode={
                output.past && output.data.source_code
                  ? () => handleCodeChange(output.data.source_code)
                  : null
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

function RunResult({ data }) {
  if (!data) {
    return (
      <div className="result-pending">
        <Spinner label="Running samples" /> Running your code on the examples…
      </div>
    );
  }
  const passed = data.cases.filter((c) => c.verdict === 'ACCEPTED').length;
  return (
    <div className="run-result">
      <div className="result-head">
        <StatusBadge status={data.status} />
        <span className="muted small">
          {passed} of {data.cases.length} examples passed
        </span>
      </div>
      {data.cases.map((c, i) => (
        <details key={i} className="case" open={c.verdict !== 'ACCEPTED' || data.cases.length === 1}>
          <summary>
            <span>Example {i + 1}</span>
            <StatusBadge status={c.verdict} />
            <span className="mono small muted">{formatTime(c.execution_time)}</span>
          </summary>
          <div className="case-body">
            <span className="io-label">Input</span>
            <pre className="code">{c.input}</pre>
            <div className="io-grid">
              <div>
                <span className="io-label">Expected output</span>
                <pre className="code">{c.expected_output}</pre>
              </div>
              <div>
                <span className="io-label">Your output</span>
                <pre className={`code ${c.verdict === 'ACCEPTED' ? '' : 'code-diff'}`}>
                  {c.actual_output || <span className="muted">(no output)</span>}
                </pre>
              </div>
            </div>
            {c.error && (
              <>
                <span className="io-label">Error output</span>
                <pre className="code code-error">{c.error}</pre>
              </>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

function SubmissionResult({ data, past, onLoadCode }) {
  const final = isFinal(data.status);
  const { label, tone } = statusInfo(data.status);
  return (
    <div className="submission-result">
      {past && <p className="muted small">Submission #{data.id}</p>}
      <div className={`verdict tone-text-${tone}`}>
        {!final && <Spinner label="Judging" />}
        <span>{final ? label : `${label}…`}</span>
      </div>
      {final && data.execution_time != null && (
        <p className="muted small">Slowest test ran in {formatTime(data.execution_time)}</p>
      )}
      <TestSquares results={data.results} />
      {data.error_message && <pre className="code code-error">{data.error_message}</pre>}
      {onLoadCode && (
        <button type="button" className="btn btn-ghost btn-small" onClick={onLoadCode}>
          Load this code into the editor
        </button>
      )}
    </div>
  );
}
