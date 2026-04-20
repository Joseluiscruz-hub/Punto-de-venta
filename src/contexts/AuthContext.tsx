import React, { createContext, useContext, useState } from 'react';
import type { User, Role } from '../models/types';
import { BackendAPI } from '../api/BackendAPI';

interface AuthContextType {
  user: User | null;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => void;
  hasPermission: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (username: string, pin: string) => {
    const u = await BackendAPI.login(username, pin);
    setUser(u);
  };

  const logout = () => setUser(null);

  const hasPermission = (roles: Role[]) => {
    return user ? roles.includes(user.role) : false;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
