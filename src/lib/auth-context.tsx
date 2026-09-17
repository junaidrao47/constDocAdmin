"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { configureApiTokens, loginRequest, logoutRequest, refreshRequest } from "./api";
import type { Session } from "./types";

const SESSION_STORAGE_KEY = "constdoc.session";

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<Session>;
  logout: () => void;
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session?.refreshToken) return null;
    try {
      const tokens = await refreshRequest(session.refreshToken);
      const nextSession = { ...session, ...tokens };
      setSession(nextSession);
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      return nextSession.accessToken;
    } catch {
      setSession(null);
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }, [session]);

  useEffect(() => {
    const storedSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSession) {
      try {
        setSession(JSON.parse(storedSession) as Session);
      } catch {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    configureApiTokens({
      getAccessToken: () => session?.accessToken ?? null,
      refresh,
    });
    return () => configureApiTokens(null);
  }, [refresh, session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isLoading,
    refresh,
    login: async (email, password) => {
      const result = await loginRequest(email, password);
      const nextSession = result;
      setSession(nextSession);
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      return nextSession;
    },
    logout: () => {
      const refreshToken = session?.refreshToken;
      setSession(null);
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      if (refreshToken) void logoutRequest(refreshToken).catch(() => undefined);
    },
  }), [isLoading, refresh, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}