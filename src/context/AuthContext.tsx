import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CurrentUser } from '../types';
import { api, hasStoredSession, LoginResponse, onSessionChange, refreshSession, storeSession } from '../api/client';

interface AuthContextType {
  user: CurrentUser | null;
  /** 'loading' only while a stored session is being restored on page load. */
  status: 'loading' | 'anonymous' | 'authenticated';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [restoring, setRestoring] = useState(hasStoredSession());

  useEffect(() => {
    onSessionChange(setUser);
    if (hasStoredSession()) {
      refreshSession().finally(() => setRestoring(false));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    storeSession(await api.post<LoginResponse>('/auth/login', { email, password }));
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('workflow_refresh_token');
    // Best effort: even if the call fails the local session is cleared.
    if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {});
    storeSession(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    storeSession(await api.post<LoginResponse>('/auth/change-password', { currentPassword, newPassword }));
  }, []);

  const forgotPassword = useCallback((email: string) => api.post<void>('/auth/forgot-password', { email }), []);
  const resetPassword = useCallback(
    (email: string, token: string, newPassword: string) => api.post<void>('/auth/reset-password', { email, token, newPassword }),
    []
  );

  const status = restoring ? 'loading' : user ? 'authenticated' : 'anonymous';

  return (
    <AuthContext.Provider value={{ user, status, login, logout, changePassword, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
