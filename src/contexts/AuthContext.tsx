/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, Tenant, Store, RequestContext, Role, Session } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useNotification } from './NotificationContext';

const SESSION_KEY = 'el-triunfo.enterprise-session.v2';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  store: Store | null;
  isLoading: boolean;
  error: string | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  hasPermission: (roles: Role[]) => boolean;
  reqContext: RequestContext;
}

export const AuthContext = createContext<AuthContextType | null>(null);

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addNotification } = useNotification();

  const login = async (username: string, pin: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await BackendAPI.login(username, pin);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, token: '' }));
      setSession(data);
      addNotification('Sesion iniciada correctamente.', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrio un error inesperado';
      setError(errorMessage);
      addNotification(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    void BackendAPI.logout();
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setError(null);
    addNotification('Sesion cerrada.', 'info');
  };

  useEffect(() => {
    const expireSession = () => {
      setSession(null);
      const message = 'Tu sesion expiro. Inicia sesion nuevamente.';
      setError(message);
      addNotification(message, 'error');
    };
    window.addEventListener('el-triunfo:session-expired', expireSession);
    return () => window.removeEventListener('el-triunfo:session-expired', expireSession);
  }, [addNotification]);

  const hasPermission = (roles: Role[]) => {
    return session ? roles.includes(session.user.role) : false;
  };

  const reqContext = useMemo(
    () =>
      session
        ? {
            tenantId: session.tenant.id,
            storeId: session.store.id,
            userId: session.user.id,
          }
        : { tenantId: '', storeId: '', userId: '' },
    [session],
  );

  const value = {
    user: session?.user || null,
    tenant: session?.tenant || null,
    store: session?.store || null,
    isLoading,
    error,
    login,
    logout,
    hasPermission,
    reqContext,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
