import { useAuth, AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AccessGate } from './components/AccessGate';
import { LoginScreen } from './pages/Login';
import { MainLayout } from './components/MainLayout';

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return <LoginScreen />;
  }

  return <MainLayout />;
}

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AccessGate>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </AccessGate>
      </NotificationProvider>
    </ThemeProvider>
  );
}
