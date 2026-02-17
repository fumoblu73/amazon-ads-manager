import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

// In production, use relative paths (same domain). In development, use localhost backend
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

interface User {
  id: string;
  email: string;
  name: string;
  profileId: number;
  countryCode: string;
  currencyCode: string;
  lastLoginAt: string;
}

export interface SyncNotification {
  type: 'campaigns' | 'kdp';
  status: 'syncing' | 'success' | 'skipped' | 'error';
  message: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  syncNotifications: SyncNotification[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncNotifications, setSyncNotifications] = useState<SyncNotification[]>([]);

  const addNotification = (n: SyncNotification) => {
    setSyncNotifications(prev => {
      // Sostituisci notifica dello stesso tipo se esiste
      const filtered = prev.filter(p => p.type !== n.type);
      return [...filtered, n];
    });
  };

  const removeNotification = (type: string) => {
    setSyncNotifications(prev => prev.filter(p => p.type !== type));
  };

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        withCredentials: true
      });
      setUser(response.data.user);

      // Auto-sync campagne
      if (response.data.user?.profileId) {
        addNotification({ type: 'campaigns', status: 'syncing', message: 'Sincronizzazione campagne...' });

        try {
          const syncRes = await fetch(`${API_BASE_URL}/api/campaigns/auto-sync`, {
            method: 'POST',
            credentials: 'include'
          });
          const syncData = await syncRes.json();

          if (syncData.skipped) {
            removeNotification('campaigns');
          } else if (syncData.success) {
            addNotification({
              type: 'campaigns',
              status: 'success',
              message: `Campagne sync: ${syncData.created} nuove, ${syncData.updated} aggiornate`
            });
            setTimeout(() => removeNotification('campaigns'), 5000);
          }
        } catch {
          addNotification({ type: 'campaigns', status: 'error', message: 'Errore sync campagne' });
          setTimeout(() => removeNotification('campaigns'), 5000);
        }
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = `${API_BASE_URL}/api/auth/login`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
        withCredentials: true
      });
      setUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, syncNotifications }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
