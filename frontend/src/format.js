export const STATUS = {
  QUEUED: { label: 'Queued', tone: 'pending' },
  RUNNING: { label: 'Running', tone: 'pending' },
  ACCEPTED: { label: 'Accepted', tone: 'ok' },
  WRONG_ANSWER: { label: 'Wrong answer', tone: 'wa' },
  TIME_LIMIT_EXCEEDED: { label: 'Time limit exceeded', tone: 'tle' },
  MEMORY_LIMIT_EXCEEDED: { label: 'Memory limit exceeded', tone: 'err' },
  RUNTIME_ERROR: { label: 'Runtime error', tone: 'err' },
  OUTPUT_LIMIT_EXCEEDED: { label: 'Output limit exceeded', tone: 'err' },
  INTERNAL_ERROR: { label: 'Internal error', tone: 'err' },
};

export function statusInfo(status) {
  return STATUS[status] || { label: status || 'Unknown', tone: 'pending' };
}

export function isFinal(status) {
  return status !== 'QUEUED' && status !== 'RUNNING';
}

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

export function difficultyLabel(d) {
  return { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }[d] || d;
}

export function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  return `${seconds.toFixed(2)} s`;
}

// The backend may send naive UTC timestamps; treat those as UTC.
function parseDate(value) {
  if (!value) return null;
  const hasZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function formatWhen(value) {
  const d = parseDate(value);
  if (!d) return '';
  const secs = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(secs);
  if (abs < 60) return relative.format(secs, 'second');
  if (abs < 3600) return relative.format(Math.round(secs / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(secs / 3600), 'hour');
  if (abs < 86400 * 7) return relative.format(Math.round(secs / 86400), 'day');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatFullDate(value) {
  const d = parseDate(value);
  return d ? d.toLocaleString() : '';
}
