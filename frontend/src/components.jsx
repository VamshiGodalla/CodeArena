import { difficultyLabel, formatFullDate, formatTime, formatWhen, statusInfo } from './format.js';

export function StatusBadge({ status }) {
  const { label, tone } = statusInfo(status);
  return <span className={`badge tone-${tone}`}>{label}</span>;
}

export function DifficultyTag({ difficulty }) {
  return (
    <span className={`difficulty diff-${String(difficulty).toLowerCase()}`}>
      {difficultyLabel(difficulty)}
    </span>
  );
}

export function When({ value }) {
  return (
    <time dateTime={value} title={formatFullDate(value)}>
      {formatWhen(value)}
    </time>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function ErrorMessage({ children }) {
  if (!children) return null;
  return (
    <div className="alert" role="alert">
      {children}
    </div>
  );
}

export function TestSquares({ results }) {
  if (!results?.length) return null;
  const passed = results.filter((r) => r.verdict === 'ACCEPTED').length;
  return (
    <div className="squares-wrap">
      <p className="muted small">
        {passed} of {results.length} tests passed
      </p>
      <ul className="squares" aria-label="Test results">
        {results.map((r, i) => {
          const { label, tone } = statusInfo(r.verdict);
          const text = `Test ${i + 1}: ${label}, ${formatTime(r.execution_time)}`;
          return (
            <li key={r.test_case_id ?? i} className={`square tone-${tone}`} title={text}>
              <span className="visually-hidden">{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
