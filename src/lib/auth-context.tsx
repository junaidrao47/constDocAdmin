"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { configureApiTokens, loginRequest, refreshRequest } from "./api";
import type { Session } from "./types";

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

  const refresh = async () => {
    if (!session?.refreshToken) return null;
    try {
      const tokens = await refreshRequest(session.refreshToken);
      const nextSession = { ...session, ...tokens };
      setSession(nextSession);
      return nextSession.accessToken;
    } catch {
      setSession(null);
      return null;
    }
  };

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    configureApiTokens({
      getAccessToken: () => session?.accessToken ?? null,
      refresh,
    });
    return () => configureApiTokens(null);
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isLoading,
    refresh,
    login: async (email, password) => {
      const result = await loginRequest(email, password);
      const nextSession = result;
      setSession(nextSession);
      return nextSession;
    },
    logout: () => setSession(null),
  }), [isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}