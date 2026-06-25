import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, setAccessToken, setOnAuthFailure } from "@/lib/api";
import type { User } from "@/types";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Bootstrap: try a silent refresh (uses the httpOnly cookie). If it works,
  // we have a fresh access token + can load the current user. This is what
  // keeps the session alive across page reloads without localStorage.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.post("/auth/refresh");
        setAccessToken(res.data.accessToken);
        const me = await api.get("/auth/me");
        if (active) setUser(me.data.user);
      } catch {
        if (active) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // If a refresh fails mid-session, the api layer calls this to force logout.
  useEffect(() => {
    setOnAuthFailure(() => {
      setAccessToken(null);
      setUser(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await api.post("/auth/register", { name, email, password });
      // Auto-login so the user isn't bounced back to the login screen.
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore — clear local state regardless
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
