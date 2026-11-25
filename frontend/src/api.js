export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

const TOKEN_KEY = 'codearena:token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable: the session just won't persist */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// FastAPI errors are {"detail": "text"} or, for validation errors, {"detail": [{loc, msg}, ...]}.
function formatDetail(detail) {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== 'body').join('.') : '';
        const msg = (d.msg || '').replace(/^Value error, /, '');
        return field ? `${field}: ${msg}` : msg;
      })
      .join('\n');
  }
  return JSON.stringify(detail);
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(
      `No response from the server at ${API_URL}. Check that the backend is running, or look at its logs if it crashed on this request.`,
      0,
    );
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event('codearena:logout'));
    }
    throw new ApiError(formatDetail(data?.detail) || `Request failed (${res.status})`, res.status);
  }
  return data;
}

function query(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const api = {
  register: (username, email, password) =>
    request('/auth/register', { method: 'POST', body: { username, email, password } }),
  login: (username, password) =>
    request('/auth/login', { method: 'POST', form: { username, password } }),
  me: () => request('/users/me'),

  problems: (difficulty) => request(`/problems${query({ difficulty })}`),
  problem: (id) => request(`/problems/${id}`),

  run: (problemId, sourceCode) =>
    request('/submissions/run', {
      method: 'POST',
      body: { problem_id: problemId, source_code: sourceCode },
    }),
  submit: (problemId, sourceCode) =>
    request('/submissions', {
      method: 'POST',
      body: { problem_id: problemId, source_code: sourceCode, language: 'python' },
    }),
  submission: (id) => request(`/submissions/${id}`),

  mySubmissions: ({ problemId, limit } = {}) =>
    request(`/users/me/submissions${query({ problem_id: problemId, limit })}`),
  stats: () => request('/users/me/stats'),

  // ----- Admin -----
  adminProblems: () => request('/admin/problems'),
  // The backend has no GET /admin/problems/{id}; the list already includes every test case.
  adminProblem: async (id) => {
    const all = await request('/admin/problems');
    const found = all.find((p) => p.id === Number(id));
    if (!found) throw new ApiError('Problem not found', 404);
    return found;
  },
  adminCreateProblem: (data) => request('/admin/problems', { method: 'POST', body: data }),
  adminUpdateProblem: (id, data) => request(`/admin/problems/${id}`, { method: 'PATCH', body: data }),
  adminDeleteProblem: (id) => request(`/admin/problems/${id}`, { method: 'DELETE' }),
  adminAddTestCase: (problemId, data) =>
    request(`/admin/problems/${problemId}/test-cases`, { method: 'POST', body: data }),
  adminDeleteTestCase: (id) => request(`/admin/test-cases/${id}`, { method: 'DELETE' }),
};

export function adminErrorMessage(err) {
  return err?.status === 403 ? 'Admin access required' : err?.message || 'Something went wrong';
}
