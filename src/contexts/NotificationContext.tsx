import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  addNotification: (message: string, type: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function createNotificationId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutIds = useRef(new Set<number>());

  const addNotification = useCallback((message: string, type: NotificationType) => {
    const id = createNotificationId();
    setNotifications((prev) => [...prev, { id, message, type }]);
    const timeoutId = window.setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      timeoutIds.current.delete(timeoutId);
    }, 5000);
    timeoutIds.current.add(timeoutId);
  }, []);

  useEffect(
    () => () => {
      timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIds.current.clear();
    },
    [],
  );

  const value = useMemo(() => ({ addNotification }), [addNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-container" aria-live="polite" aria-label="Notificaciones">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`notification notification-${n.type}`}
            role={n.type === 'error' ? 'alert' : 'status'}
            aria-atomic="true"
          >
            {n.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
