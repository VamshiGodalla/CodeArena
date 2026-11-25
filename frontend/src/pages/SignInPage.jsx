import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ErrorMessage } from '../components.jsx';
import { ThemeToggle } from '../theme.jsx';

const NO_ACCESS = "This account doesn't have admin access.";

// Where to go after signing in. Admin destinations only count for admins, user ones only for users.
function destination(location, isAdmin) {
  const from = location.state?.from;
  const path = from?.pathname || '';
  if (isAdmin) return path.startsWith('/admin') && path !== '/admin/login' ? path + (from.search || '') : '/admin';
  if (!path || path === '/' || path === '/login' || path.startsWith('/admin')) return '/problems';
  return `${path}${from.search || ''}${from.hash || ''}`;
}

function RoleOption({ value, role, onChange, title, text }) {
  const selected = role === value;
  return (
    <label className={`role-option ${selected ? 'is-selected' : ''} role-${value}`}>
      <input
        type="radio"
        name="role"
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
      />
      <span className="role-title">{title}</span>
      <span className="role-text">{text}</span>
    </label>
  );
}

export default function SignInPage({ initialRole = 'user' }) {
  const { user, loading, login, register, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [role, setRole] = useState(initialRole);
  const [mode, setMode] = useState('login'); // user role only: 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in: skip this page. A non-admin on the admin option can still sign in as someone else.
  if (!loading && user && !busy && !(role === 'admin' && !user.is_admin)) {
    return <Navigate to={destination(location, user.is_admin)} replace />;
  }

  const isAdmin = role === 'admin';
  const isRegister = !isAdmin && mode === 'register';

  function chooseRole(next) {
    setRole(next);
    setMode('login');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const me = isRegister
        ? await register(username.trim(), email.trim(), password)
        : await login(username.trim(), password);
      if (isAdmin && !me.is_admin) {
        logout();
        setError(NO_ACCESS);
        setBusy(false);
        return;
      }
      navigate(destination(location, me.is_admin), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className={`signin-page ${isAdmin ? 'admin-area' : ''}`}>
      <header className={`site-header ${isAdmin ? 'admin-header' : ''}`}>
        <div className="header-inner">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true">&gt;_</span>
            CodeArena
            {isAdmin && <span className="admin-pill">Admin</span>}
          </span>
          <div className="header-actions">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="container page auth-page">
        <div className="auth-column">
          <div className={`card auth-card ${isAdmin ? 'admin-auth-card' : ''}`}>
            <h1>{isAdmin ? 'CodeArena Admin' : isRegister ? 'Create your account' : 'Sign in to CodeArena'}</h1>
            <p className="auth-sub">
              {isAdmin
                ? 'Manage problems and test cases.'
                : 'Solve problems in Python and track your progress.'}
            </p>

            <fieldset className="role-picker">
              <legend>Sign in as</legend>
              <RoleOption
                value="user"
                role={role}
                onChange={chooseRole}
                title="User"
                text="Solve problems"
              />
              <RoleOption
                value="admin"
                role={role}
                onChange={chooseRole}
                title="Admin"
                text="Manage problems"
              />
            </fieldset>

            {!isAdmin && (
              <div className="segmented" role="group" aria-label="Choose form">
                <button
                  type="button"
                  aria-pressed={!isRegister}
                  className={!isRegister ? 'active' : ''}
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  aria-pressed={isRegister}
                  className={isRegister ? 'active' : ''}
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                >
                  Create account
                </button>
              </div>
            )}

            {isAdmin && user && !user.is_admin && !error && (
              <p className="notice small">
                You're signed in as {user.username}, which isn't an admin account. Signing in here
                replaces that session.
              </p>
            )}

            <form onSubmit={handleSubmit} className="form" noValidate>
              <label className="field">
                <span>{isRegister ? 'Username' : 'Username or email'}</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
                {isRegister && (
                  <small className="hint">3–50 characters: letters, numbers and underscores.</small>
                )}
              </label>

              {isRegister && (
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
              )}

              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                />
                {isRegister && <small className="hint">At least 8 characters.</small>}
              </label>

              <ErrorMessage>{error}</ErrorMessage>

              <button
                type="submit"
                className={`btn btn-block ${isAdmin ? 'btn-admin' : 'btn-primary'}`}
                disabled={busy}
              >
                {busy
                  ? 'Please wait…'
                  : isAdmin
                    ? 'Sign in as admin'
                    : isRegister
                      ? 'Create account'
                      : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
