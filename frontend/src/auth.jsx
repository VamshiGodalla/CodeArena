import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, clearToken, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // api.js fires this when a request comes back 401 (expired or invalid token).
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('codearena:logout', onLogout);
    return () => window.removeEventListener('codearena:logout', onLogout);
  }, []);

  const login = useCallback(async (username, password) => {
    const { access_token } = await api.login(username, password);
    setToken(access_token);
    try {
      const me = await api.me();
      setUser(me);
      return me;
    } catch (err) {
      clearToken();
      throw err;
    }
  }, []);

  const register = useCallback(
    async (username, email, password) => {
      await api.register(username, email, password);
      return login(username, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted page-status">Loading…</p>;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  return children;
}

// The role comes only from is_admin on GET /users/me; the backend enforces it again on every call.
export function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted page-status">Loading…</p>;
  if (!user?.is_admin) return <Navigate to="/admin/login" replace state={{ from: location }} />;
  return children;
}
