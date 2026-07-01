"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser, Role } from "@baridi-ma/shared-types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    role: Exclude<Role, "admin">;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (res.ok) {
        const { accessToken: token } = await res.json();
        setAccessToken(token);
        const meRes = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        if (meRes.ok) setUser(await meRes.json());
      }
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Login failed" };
    }
    setAccessToken(data.accessToken);
    setUser(data.user);
    return { ok: true };
  }

  async function register(input: { email: string; password: string; name: string; role: Exclude<Role, "admin"> }) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error?.formErrors?.join(", ") ?? data.error ?? "Registration failed" };
    }
    return { ok: true };
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
  }

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      return fetch(url, { ...options, headers });
    },
    [accessToken],
  );

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
