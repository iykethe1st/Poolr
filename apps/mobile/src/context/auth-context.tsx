import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authClient, clearToken, getToken, setToken } from '@/api/client';
import { clearPushToken, registerPushToken } from '@/lib/push-notifications';

interface LoginPayload { email: string; password: string }
interface RegisterPayload { fullName?: string; email: string; password: string; phone?: string }

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<{ message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getToken().then((t) => {
      setTokenState(t);
      setIsLoading(false);
      if (t) void registerPushToken();
    });
  }, []);

  const login = useCallback(async ({ email, password }: LoginPayload) => {
    const res = await authClient
      .post('auth/login', { json: { email, password } })
      .json<{ accessToken: string }>();
    await setToken(res.accessToken);
    setTokenState(res.accessToken);
    void registerPushToken();
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    return authClient
      .post('auth/register', { json: payload })
      .json<{ message: string }>();
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    await clearPushToken();
    setTokenState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, isLoading, isAuthenticated: !!token, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
