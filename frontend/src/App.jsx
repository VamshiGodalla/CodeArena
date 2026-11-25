import { Link, NavLink, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { RequireAdmin, RequireAuth, useAuth } from './auth.jsx';
import { ThemeToggle } from './theme.jsx';
import SignInPage from './pages/SignInPage.jsx';
import ProblemsPage from './pages/ProblemsPage.jsx';
import ProblemPage from './pages/ProblemPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AdminOverviewPage from './pages/admin/AdminOverviewPage.jsx';
import AdminProblemsPage from './pages/admin/AdminProblemsPage.jsx';
import AdminProblemFormPage from './pages/admin/AdminProblemFormPage.jsx';

function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to content
    </a>
  );
}

// ---------- User area ----------

function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function signOut() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <>
      <SkipLink />
      <header className="site-header">
        <div className="header-inner">
          <Link to="/problems" className="brand">
            <span className="brand-mark" aria-hidden="true">&gt;_</span>
            CodeArena
          </Link>
          <nav className="main-nav" aria-label="Main">
            <NavLink to="/problems">Problems</NavLink>
            {user && <NavLink to="/dashboard">Dashboard</NavLink>}
          </nav>
          <div className="header-actions">
            {/* Only an account the backend marks is_admin ever sees this link. */}
            {user?.is_admin && (
              <Link to="/admin" className="btn btn-ghost">
                Admin
              </Link>
            )}
            <ThemeToggle />
            {user ? (
              <>
                <span className="username" title={user.email}>
                  {user.username}
                </span>
                <button type="button" className="btn btn-ghost" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/" className="btn btn-primary">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}

// ---------- Admin area ----------

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function signOut() {
    logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="admin-area">
      <SkipLink />
      <header className="site-header admin-header">
        <div className="header-inner">
          <Link to="/admin" className="brand">
            <span className="brand-mark" aria-hidden="true">&gt;_</span>
            CodeArena
            <span className="admin-pill">Admin</span>
          </Link>
          <nav className="main-nav" aria-label="Admin">
            <NavLink to="/admin" end>
              Overview
            </NavLink>
            <NavLink to="/admin/problems" end>
              Problems
            </NavLink>
            <NavLink to="/admin/problems/new">New problem</NavLink>
            <Link to="/problems">View site</Link>
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            <span className="username" title={user?.email}>
              {user?.username}
            </span>
            <button type="button" className="btn btn-ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

// Keying by id gives each problem a fresh page (editor, draft, results) when navigating between them.
function ProblemRoute() {
  const { id } = useParams();
  return <ProblemPage key={id} problemId={Number(id)} />;
}

function AdminEditRoute() {
  const { id } = useParams();
  return <AdminProblemFormPage key={id} problemId={Number(id)} />;
}

function NotFound({ home = '/problems', label = 'Back to problems' }) {
  return (
    <div className="container page">
      <h1>Page not found</h1>
      <p>
        <Link to={home}>{label}</Link>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* The first page: choose to sign in as a user or as an admin. */}
      <Route path="/" element={<SignInPage />} />
      <Route path="/login" element={<SignInPage />} />
      <Route path="/admin/login" element={<SignInPage key="admin" initialRole="admin" />} />

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="problems" element={<AdminProblemsPage />} />
        <Route path="problems/new" element={<AdminProblemFormPage key="new" />} />
        <Route path="problems/:id/edit" element={<AdminEditRoute />} />
        <Route path="*" element={<NotFound home="/admin" label="Back to admin overview" />} />
      </Route>

      <Route
        element={
          <RequireAuth>
            <UserLayout />
          </RequireAuth>
        }
      >
        <Route path="/problems" element={<ProblemsPage />} />
        <Route path="/problems/:id" element={<ProblemRoute />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
