const TOKEN_KEY = "crp_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Fired whenever the backend rejects a request with 401/403 while we were
 *  holding a token — i.e. the token was valid at some point but is no longer
 *  accepted (12 h JWT expiry, admin revoked the user, JWT secret rotated,
 *  etc). AuthProvider listens for this, clears its user state, and pops the
 *  login modal. We dispatch on `window` because the listener lives in a
 *  React provider that isn't aware of `api.ts` module identity. */
export const AUTH_EXPIRED_EVENT = "crp:auth-expired";


async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as any),
  };
  const tok = getToken();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    // Session expiry: if we sent a token and got 401/403 back, wipe the
    // token and let the AuthProvider know. We do NOT fire this when there
    // was no token — a 401 on an unauthenticated request is just "please
    // log in", not "your session died", and the login modal is already the
    // natural next UI state.
    if ((res.status === 401 || res.status === 403) && tok) {
      setToken(null);
      try {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      } catch { /* SSR / jsdom — ignore */ }
      throw new Error("Your session has expired. Please log in again.");
    }
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: any) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: any) =>
    request<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => request<T>(p, { method: "DELETE" }),
  upload: async <T>(p: string, file: File): Promise<T> => {
    const fd = new FormData();
    fd.append("file", file);
    const headers: Record<string, string> = {};
    const tok = getToken();
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
    const res = await fetch(p, { method: "POST", body: fd, headers });
    if (!res.ok) {
      if ((res.status === 401 || res.status === 403) && tok) {
        setToken(null);
        try { window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT)); } catch { /* ignore */ }
        throw new Error("Your session has expired. Please log in again.");
      }
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return res.json();
  },
  login: async (username: string, password: string) => {
    const fd = new URLSearchParams();
    fd.append("username", username);
    fd.append("password", password);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: fd.toString(),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || "Invalid credentials");
    }
    return res.json() as Promise<{ access_token: string; username: string; role: string }>;
  },
};
