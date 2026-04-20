import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './components/Layout/MainLayout';
import LoginScreen from './components/Login/LoginScreen';
import { useAuth } from './contexts/AuthContext';

function AppContent() {
  const { user } = useAuth();
  return user ? <MainLayout /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
