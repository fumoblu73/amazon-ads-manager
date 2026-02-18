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
  dismissNotification: (type: string) => void;
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

      // Auto-sync campagne (tutti i marketplace)
      if (response.data.user?.profileId) {
        addNotification({ type: 'campaigns', status: 'syncing', message: 'Sincronizzazione campagne (tutti i marketplace)...' });

        try {
          const syncRes = await fetch(`${API_BASE_URL}/api/campaigns/auto-sync`, {
            method: 'POST',
            credentials: 'include'
          });
          const syncData = await syncRes.json();

          if (syncData.skipped) {
            addNotification({
              type: 'campaigns',
              status: 'success',
              message: `Campagne aggiornate (ultimo sync ${Math.round(syncData.hoursSinceSync || 0)}h fa)`
            });
          } else if (syncData.success) {
            const mktDetails = syncData.marketplaces?.map((m: any) =>
              `${m.marketplace} +${m.created}/${m.totalCampaigns || (m.created + m.updated)}`
            ).join(' | ') || '';
            addNotification({
              type: 'campaigns',
              status: 'success',
              message: `Sync completato: ${mktDetails}`
            });
          }
        } catch {
          addNotification({ type: 'campaigns', status: 'error', message: 'Errore sync campagne' });
        }
      }

      // Auto-sync KDP (server-side con cookie salvati)
      if (response.data.user) {
        addNotification({ type: 'kdp', status: 'syncing', message: 'Sincronizzazione KDP...' });

        try {
          const kdpRes = await fetch(`${API_BASE_URL}/api/kdp-sync/auto-sync`, {
            method: 'POST',
            credentials: 'include'
          });
          const kdpData = await kdpRes.json();

          if (kdpData.skipped) {
            if (kdpData.reason === 'no_cookies') {
              // Nessun cookie KDP → rimuovi notifica silenziosamente
              removeNotification('kdp');
            } else if (kdpData.reason === 'cookies_expired') {
              addNotification({ type: 'kdp', status: 'error', message: 'Cookie KDP scaduti (rinnova con estensione)' });
            } else {
              addNotification({
                type: 'kdp',
                status: 'success',
                message: `KDP aggiornato (ultimo sync ${kdpData.hoursSinceSync || 0}h fa)`
              });
            }
          } else if (kdpData.success) {
            addNotification({
              type: 'kdp',
              status: 'success',
              message: `KDP sync: ${kdpData.books} libri, ${kdpData.stats} record`
            });
          }
        } catch {
          addNotification({ type: 'kdp', status: 'error', message: 'Errore sync KDP' });
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
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, syncNotifications, dismissNotification: removeNotification }}>
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
