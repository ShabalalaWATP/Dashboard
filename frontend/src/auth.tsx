import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken, AUTH_EXPIRED_EVENT } from "./api";
import type { User } from "./types";

type Ctx = {
  user: User | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
};

const AuthCtx = createContext<Ctx>({
  user: null, login: async () => {}, logout: () => {}, loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const me = await api.get<User>("/api/auth/me");
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // When api.ts detects a 401/403 on an authenticated request, it clears the
  // token and fires AUTH_EXPIRED_EVENT. React to that by clearing user state
  // so the app re-renders with the login modal. We don't reload the page —
  // in-flight form state (e.g. a half-written new project) stays put and
  // the user can resubmit after re-authenticating.
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, []);

  const login = async (username: string, password: string) => {
    const { access_token } = await api.login(username, password);
    setToken(access_token);
    await refresh();
  };

  const logout = () => { setToken(null); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
