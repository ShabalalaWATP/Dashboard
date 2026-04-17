import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api";
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
