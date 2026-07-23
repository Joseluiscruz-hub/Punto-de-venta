/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useState, useEffect, useMemo } from 'react';
import { User, Tenant, Store, RequestContext, Role, Session } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useNotification } from './NotificationContext';

const SESSION_KEY = 'el-triunfo.enterprise-session.v2';
type StoredSession = Omit<Session, 'token'>;

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

function sessionWithoutToken(session: Session): StoredSession {
  const { user, tenant, store, register } = session;
  return { user, tenant, store, ...(register ? { register } : {}) };
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.user || !parsed.tenant || !parsed.store) throw new Error('Invalid session');
    const storedSession = sessionWithoutToken(parsed as Session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));
    return storedSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(loadSession);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addNotification } = useNotification();

  const login = useCallback(
    async (username: string, pin: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await BackendAPI.login(username, pin);
        const storedSession = sessionWithoutToken(data);
        localStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));
        setSession(storedSession);
        addNotification('Sesion iniciada correctamente.', 'success');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Ocurrio un error inesperado';
        setError(errorMessage);
        addNotification(errorMessage, 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [addNotification],
  );

  const logout = useCallback(() => {
    void BackendAPI.logout().catch(() => undefined);
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setError(null);
    addNotification('Sesion cerrada.', 'info');
  }, [addNotification]);

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

  const hasPermission = useCallback(
    (roles: Role[]) => {
      return session ? roles.includes(session.user.role) : false;
    },
    [session],
  );

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

  const value = useMemo(
    () => ({
      user: session?.user || null,
      tenant: session?.tenant || null,
      store: session?.store || null,
      isLoading,
      error,
      login,
      logout,
      hasPermission,
      reqContext,
    }),
    [error, hasPermission, isLoading, login, logout, reqContext, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
