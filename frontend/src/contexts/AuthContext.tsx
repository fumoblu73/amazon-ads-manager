import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
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
  type: 'campaigns' | 'kdp' | 'kdp_bsr';
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

const BSR_SYNC_TTL_MS = 6 * 60 * 60 * 1000; // 6 ore

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncNotifications, setSyncNotifications] = useState<SyncNotification[]>([]);
  const bsrSyncTriggeredRef = useRef(false);

  const addNotification = (n: SyncNotification) => {
    setSyncNotifications(prev => {
      // Sostituisci notifica dello stesso tipo se esiste
      const filtered = prev.filter(p => p.type !== n.type);
      return [...filtered, n];
    });
    // Auto-dismiss dopo 8 secondi per notifiche non in corso
    if (n.status !== 'syncing') {
      setTimeout(() => removeNotification(n.type), 8000);
    }
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
              message: `Campagne aggiornate (ultimo sync <6h)`
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
                message: `Bookshelf aggiornato`
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

  // Auto-trigger bookshelf sync via extension all'apertura dell'app (per BSR + pagine)
  useEffect(() => {
    if (!user || bsrSyncTriggeredRef.current) return;
    bsrSyncTriggeredRef.current = true;

    const lastSync = localStorage.getItem('lastBookshelfSyncTs');
    const isStale = !lastSync || (Date.now() - parseInt(lastSync)) > BSR_SYNC_TTL_MS;
    if (!isStale) return;

    let cancelled = false;
    let syncCompleteHandler: ((e: MessageEvent) => void) | null = null;

    const run = async () => {
      // Controlla se l'estensione è attiva (attendi max 2s)
      let extensionAvailable = false;
      await new Promise<void>(resolve => {
        const handler = (e: MessageEvent) => {
          // Accept either EXTENSION_INSTALLED (fires at extension load) or
          // KDP_EXTENSION_STATUS with installed:true (response to KDP_EXTENSION_CHECK)
          if (
            e.data?.type === 'EXTENSION_INSTALLED' ||
            (e.data?.type === 'KDP_EXTENSION_STATUS' && e.data.installed)
          ) {
            extensionAvailable = true;
            window.removeEventListener('message', handler);
            resolve();
          }
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'KDP_EXTENSION_CHECK' }, '*');
        setTimeout(() => { window.removeEventListener('message', handler); resolve(); }, 2000);
      });

      if (cancelled) return;
      if (!extensionAvailable) {
        addNotification({ type: 'kdp_bsr', status: 'error', message: 'Estensione Chrome non trovata: BSR libri non aggiornato' });
        return;
      }

      addNotification({ type: 'kdp_bsr', status: 'syncing', message: 'Aggiornamento BSR libri...' });

      syncCompleteHandler = (e: MessageEvent) => {
        if (e.data?.type !== 'KDP_BOOKSHELF_SYNC_COMPLETE' || cancelled) return;
        window.removeEventListener('message', syncCompleteHandler!);
        localStorage.setItem('lastBookshelfSyncTs', Date.now().toString());
        if (e.data.success) {
          addNotification({ type: 'kdp_bsr', status: 'success', message: `BSR aggiornato: ${e.data.booksCount} libri` });
        } else {
          removeNotification('kdp_bsr');
        }
      };
      window.addEventListener('message', syncCompleteHandler);

      window.postMessage({ type: 'KDP_BOOKSHELF_SYNC_REQUEST', marketplace: 'IT', forceRefresh: false }, '*');

      // Cleanup di sicurezza dopo 10 minuti
      setTimeout(() => {
        if (syncCompleteHandler) window.removeEventListener('message', syncCompleteHandler);
      }, 10 * 60 * 1000);
    };

    run();

    return () => {
      cancelled = true;
      if (syncCompleteHandler) window.removeEventListener('message', syncCompleteHandler);
    };
  }, [user]);

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
