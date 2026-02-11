import { useEffect, useState, useCallback } from 'react';
import { kdpAnalyticsApi } from '../../services/api';
import StatsCard from '../../components/kdp/StatsCard';
import type { KdpDashboardSummary } from '../../types';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

// Tipo per lo stato dell'estensione
interface ExtensionStatus {
  installed: boolean;
  authenticated: boolean;
  lastSync: string | null;
  lastSyncSuccess: boolean;
}

// Tipo per il progresso sync
interface SyncProgress {
  active: boolean;
  percent: number;
  text: string;
}

export default function KdpDashboard() {
  const [summary, setSummary] = useState<KdpDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stato estensione e sync
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>({
    installed: false,
    authenticated: false,
    lastSync: null,
    lastSyncSuccess: false
  });
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    active: false,
    percent: 0,
    text: ''
  });
  const [showSyncAlert, setShowSyncAlert] = useState(false);

  // Verifica se serve sync (ultimo sync > 24 ore fa o mai fatto)
  const needsSync = useCallback(() => {
    if (!extensionStatus.lastSync) return true;
    const lastSyncDate = new Date(extensionStatus.lastSync);
    const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);
    return hoursSinceSync > 24;
  }, [extensionStatus.lastSync]);

  // Controlla stato estensione
  const checkExtensionStatus = useCallback(() => {
    window.postMessage({ type: 'KDP_EXTENSION_CHECK' }, '*');
  }, []);

  // Avvia sync automatico
  const startAutoSync = useCallback(() => {
    if (!extensionStatus.installed) {
      alert('Estensione non installata. Installa l\'estensione Amazon Ads Manager - KDP Sync per sincronizzare i dati.');
      return;
    }
    if (!extensionStatus.authenticated) {
      alert('Estensione non autenticata. Ricarica la pagina per autenticare l\'estensione.');
      return;
    }

    setSyncProgress({ active: true, percent: 5, text: 'Avvio sincronizzazione...' });
    window.postMessage({ type: 'KDP_SYNC_REQUEST', action: 'startSync' }, '*');
  }, [extensionStatus]);

  // Listener per messaggi dall'estensione
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type } = event.data || {};
      console.log('[Dashboard] Received message:', type, event.data);

      // Estensione installata
      if (type === 'EXTENSION_INSTALLED') {
        console.log('[Dashboard] Extension detected, version:', event.data.version);
        setExtensionStatus(prev => ({ ...prev, installed: true }));
        checkExtensionStatus();
      }

      // Stato estensione
      if (type === 'KDP_EXTENSION_STATUS') {
        console.log('[Dashboard] Extension status:', event.data);
        setExtensionStatus(prev => {
          // Se abbiamo già un lastSync più recente (es. appena sincronizzato), mantienilo
          let lastSync = event.data.lastSync;
          let lastSyncSuccess = event.data.lastSyncSuccess;

          if (prev.lastSync && event.data.lastSync) {
            const prevDate = new Date(prev.lastSync).getTime();
            const newDate = new Date(event.data.lastSync).getTime();
            if (prevDate > newDate) {
              console.log('[Dashboard] Keeping more recent lastSync from state');
              lastSync = prev.lastSync;
              lastSyncSuccess = prev.lastSyncSuccess;
            }
          } else if (prev.lastSync && !event.data.lastSync) {
            // Se l'estensione non ha lastSync ma noi sì, mantieni il nostro
            lastSync = prev.lastSync;
            lastSyncSuccess = prev.lastSyncSuccess;
          }

          return {
            installed: event.data.installed,
            authenticated: event.data.authenticated,
            lastSync,
            lastSyncSuccess
          };
        });
      }

      // Progresso sync
      if (type === 'KDP_SYNC_PROGRESS') {
        setSyncProgress({
          active: true,
          percent: event.data.percent,
          text: event.data.text
        });
      }

      // Sync completato
      if (type === 'KDP_SYNC_COMPLETE') {
        setSyncProgress({ active: false, percent: 100, text: 'Completato!' });
        if (event.data.success) {
          setShowSyncAlert(false);
          // Aggiorna lastSync per evitare che l'alert ricompaia
          setExtensionStatus(prev => ({
            ...prev,
            lastSync: new Date().toISOString(),
            lastSyncSuccess: true
          }));
          // Ricarica i dati della dashboard
          setTimeout(() => loadDashboardData(), 2000);
        }
      }

      // Errore sync
      if (type === 'KDP_SYNC_ERROR') {
        setSyncProgress({ active: false, percent: 0, text: '' });
      }
    };

    window.addEventListener('message', handleMessage);

    // Controlla estensione all'avvio
    console.log('[Dashboard] Checking extension status...');
    checkExtensionStatus();

    // Ricontrolla dopo 1 secondo (l'estensione potrebbe non essere ancora caricata)
    const timeout1 = setTimeout(() => {
      console.log('[Dashboard] Re-checking extension status (1s)...');
      checkExtensionStatus();
    }, 1000);

    // Se dopo 3 secondi l'estensione non risponde, mostra alert solo per "estensione non installata"
    const timeout2 = setTimeout(() => {
      // Solo se l'estensione non è stata rilevata, mostra l'alert
      setExtensionStatus(prev => {
        if (!prev.installed) {
          console.log('[Dashboard] Extension not detected after 3s, showing install alert');
          setShowSyncAlert(true);
        }
        return prev;
      });
    }, 3000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [checkExtensionStatus]);

  // Mostra/nascondi alert in base a se serve sync (quando estensione è rilevata)
  useEffect(() => {
    if (extensionStatus.installed) {
      const syncNeeded = needsSync();
      console.log('[Dashboard] Extension installed, needsSync:', syncNeeded);
      // Mostra alert solo se serve sync, altrimenti nascondilo
      setShowSyncAlert(syncNeeded);
    }
  }, [extensionStatus.installed, extensionStatus.lastSync, needsSync]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await kdpAnalyticsApi.getDashboardSummary();
      setSummary(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-500 font-medium">{error}</p>
          <button
            onClick={loadDashboardData}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const formatCurrency = (value: number | undefined | null) => value != null ? `$${value.toFixed(2)}` : '$0.00';
  const formatPercentage = (value: number | null | undefined) => value != null ? `${value.toFixed(1)}%` : '-';

  const formatChange = (value: number | null | undefined) => {
    if (value == null) return { text: '-', color: 'text-gray-400' };
    const isPositive = value >= 0;
    return {
      text: `${isPositive ? '+' : ''}${value.toFixed(1)}%`,
      color: isPositive ? 'text-green-500' : 'text-red-500'
    };
  };

  const { monthlyStats, dailyStats } = summary.overall;

  // Formatta ultima sync
  const formatLastSync = () => {
    if (!extensionStatus.lastSync) return 'Mai';
    const date = new Date(extensionStatus.lastSync);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Sync Alert Banner */}
      {(showSyncAlert || syncProgress.active) && (
        <div className={`rounded-xl p-4 border ${
          syncProgress.active
            ? 'bg-blue-500/10 border-blue-500/30'
            : !extensionStatus.installed
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-orange-500/10 border-orange-500/30'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {syncProgress.active ? (
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : !extensionStatus.installed ? (
                <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              <div>
                {syncProgress.active ? (
                  <>
                    <p className="text-white font-medium">Sincronizzazione in corso...</p>
                    <p className="text-blue-400 text-sm">{syncProgress.text}</p>
                  </>
                ) : !extensionStatus.installed ? (
                  <>
                    <p className="text-white font-medium">Estensione Chrome non rilevata</p>
                    <p className="text-gray-400 text-sm">
                      Installa o ricarica l'estensione "Amazon Ads Manager - KDP Sync" per sincronizzare i dati
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-white font-medium">Sincronizzazione dati KDP necessaria</p>
                    <p className="text-gray-400 text-sm">
                      Ultimo sync: {formatLastSync()}
                      {!extensionStatus.authenticated && ' • Estensione non autenticata'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {syncProgress.active ? (
              <div className="flex-1 min-w-[200px] max-w-md">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${syncProgress.percent}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">{syncProgress.percent}%</p>
              </div>
            ) : !extensionStatus.installed ? (
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Ricarica Pagina
                </button>
                <button
                  onClick={() => setShowSyncAlert(false)}
                  className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={startAutoSync}
                  disabled={!extensionStatus.installed || !extensionStatus.authenticated || syncProgress.active}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sincronizza Ora
                </button>
                <button
                  onClick={() => setShowSyncAlert(false)}
                  className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header with dynamic period */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">KDP Overview</h1>
          <p className="text-gray-400 text-sm">
            {summary.period.label || `${summary.period.startDate} - ${summary.period.endDate}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startAutoSync}
            disabled={!extensionStatus.installed || syncProgress.active}
            title={extensionStatus.installed ? 'Sincronizza libri e vendite KDP' : 'Estensione non installata'}
            className="px-4 py-2 bg-orange-500/20 text-orange-500 rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${syncProgress.active ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncProgress.active ? 'Sync...' : 'Sync KDP'}
          </button>
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Stats Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* OVERALL MONTHLY STATS */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            OVERALL MONTHLY STATS
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-normal pb-3"></th>
                  <th className="text-center text-gray-400 font-normal pb-3 min-w-[80px]">
                    {monthlyStats.previousMonth.label}
                  </th>
                  <th className="text-center text-gray-400 font-normal pb-3 min-w-[80px]">
                    {monthlyStats.currentMonth.label}
                  </th>
                  <th className="text-center text-gray-400 font-normal pb-3 min-w-[70px]">Change</th>
                </tr>
              </thead>
              <tbody className="text-white">
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">AD Orders</td>
                  <td className="py-3 text-center">{monthlyStats.previousMonth.adOrders}</td>
                  <td className="py-3 text-center font-medium">{monthlyStats.currentMonth.adOrders}</td>
                  <td className={`py-3 text-center ${formatChange(monthlyStats.change.adOrders).color}`}>
                    {formatChange(monthlyStats.change.adOrders).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Paperbacks</td>
                  <td className="py-3 text-center">{monthlyStats.previousMonth.paperbacks || 0}</td>
                  <td className="py-3 text-center font-medium">{monthlyStats.currentMonth.paperbacks || 0}</td>
                  <td className={`py-3 text-center ${formatChange(monthlyStats.change.paperbacks).color}`}>
                    {formatChange(monthlyStats.change.paperbacks).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Reads</td>
                  <td className="py-3 text-center">{(monthlyStats.previousMonth.reads || 0).toLocaleString()}</td>
                  <td className="py-3 text-center font-medium">{(monthlyStats.currentMonth.reads || 0).toLocaleString()}</td>
                  <td className={`py-3 text-center ${formatChange(monthlyStats.change.reads).color}`}>
                    {formatChange(monthlyStats.change.reads).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Royalties (Gross)</td>
                  <td className="py-3 text-center">{formatCurrency(monthlyStats.previousMonth.grossRoyalties)}</td>
                  <td className="py-3 text-center font-medium">{formatCurrency(monthlyStats.currentMonth.grossRoyalties)}</td>
                  <td className={`py-3 text-center ${formatChange(monthlyStats.change.grossRoyalties).color}`}>
                    {formatChange(monthlyStats.change.grossRoyalties).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Spending</td>
                  <td className="py-3 text-center">{formatCurrency(monthlyStats.previousMonth.spending)}</td>
                  <td className="py-3 text-center font-medium">{formatCurrency(monthlyStats.currentMonth.spending)}</td>
                  <td className={`py-3 text-center ${formatChange(monthlyStats.change.spending).color}`}>
                    {formatChange(monthlyStats.change.spending).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Royalties (Net)</td>
                  <td className="py-3 text-center">{formatCurrency(monthlyStats.previousMonth.netRoyalties)}</td>
                  <td className="py-3 text-center font-medium text-green-500">{formatCurrency(monthlyStats.currentMonth.netRoyalties)}</td>
                  <td className={`py-3 text-center ${formatChange(monthlyStats.change.netRoyalties).color}`}>
                    {formatChange(monthlyStats.change.netRoyalties).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Overall ROI</td>
                  <td className="py-3 text-center">{formatPercentage(monthlyStats.previousMonth.overallROI)}</td>
                  <td className="py-3 text-center font-medium">{formatPercentage(monthlyStats.currentMonth.overallROI)}</td>
                  <td className="py-3 text-center text-gray-400">-</td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">AMS ROI</td>
                  <td className="py-3 text-center">{formatPercentage(monthlyStats.previousMonth.amsROI)}</td>
                  <td className="py-3 text-center font-medium">{formatPercentage(monthlyStats.currentMonth.amsROI)}</td>
                  <td className="py-3 text-center text-gray-400">-</td>
                </tr>
                <tr>
                  <td className="py-3 text-gray-400">AMS ACoS</td>
                  <td className="py-3 text-center">{formatPercentage(monthlyStats.previousMonth.amsACoS)}</td>
                  <td className="py-3 text-center font-medium">{formatPercentage(monthlyStats.currentMonth.amsACoS)}</td>
                  <td className="py-3 text-center text-gray-400">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* OVERALL DAILY STATS */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            OVERALL DAILY STATS
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-normal pb-3"></th>
                  <th className="text-center text-gray-400 font-normal pb-3 min-w-[80px]">
                    {dailyStats.yesterday.label}
                  </th>
                  <th className="text-center text-gray-400 font-normal pb-3 min-w-[80px]">
                    {dailyStats.today.label}
                  </th>
                  <th className="text-center text-gray-400 font-normal pb-3 min-w-[70px]">Change</th>
                </tr>
              </thead>
              <tbody className="text-white">
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">AD Orders</td>
                  <td className="py-3 text-center">{dailyStats.yesterday.adOrders}</td>
                  <td className="py-3 text-center font-medium">{dailyStats.today.adOrders}</td>
                  <td className={`py-3 text-center ${formatChange(dailyStats.change.adOrders).color}`}>
                    {formatChange(dailyStats.change.adOrders).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Paperbacks</td>
                  <td className="py-3 text-center">{dailyStats.yesterday.paperbacks || 0}</td>
                  <td className="py-3 text-center font-medium">{dailyStats.today.paperbacks || 0}</td>
                  <td className={`py-3 text-center ${formatChange(dailyStats.change.paperbacks).color}`}>
                    {formatChange(dailyStats.change.paperbacks).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Reads</td>
                  <td className="py-3 text-center">{(dailyStats.yesterday.reads || 0).toLocaleString()}</td>
                  <td className="py-3 text-center font-medium">{(dailyStats.today.reads || 0).toLocaleString()}</td>
                  <td className={`py-3 text-center ${formatChange(dailyStats.change.reads).color}`}>
                    {formatChange(dailyStats.change.reads).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Royalties (Gross)</td>
                  <td className="py-3 text-center">{formatCurrency(dailyStats.yesterday.grossRoyalties)}</td>
                  <td className="py-3 text-center font-medium">{formatCurrency(dailyStats.today.grossRoyalties)}</td>
                  <td className={`py-3 text-center ${formatChange(dailyStats.change.grossRoyalties).color}`}>
                    {formatChange(dailyStats.change.grossRoyalties).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Spending</td>
                  <td className="py-3 text-center">{formatCurrency(dailyStats.yesterday.spending)}</td>
                  <td className="py-3 text-center font-medium">{formatCurrency(dailyStats.today.spending)}</td>
                  <td className={`py-3 text-center ${formatChange(dailyStats.change.spending).color}`}>
                    {formatChange(dailyStats.change.spending).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Royalties (Net)</td>
                  <td className="py-3 text-center">{formatCurrency(dailyStats.yesterday.netRoyalties)}</td>
                  <td className="py-3 text-center font-medium text-green-500">{formatCurrency(dailyStats.today.netRoyalties)}</td>
                  <td className={`py-3 text-center ${formatChange(dailyStats.change.netRoyalties).color}`}>
                    {formatChange(dailyStats.change.netRoyalties).text}
                  </td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">Overall ROI</td>
                  <td className="py-3 text-center">{formatPercentage(dailyStats.yesterday.overallROI)}</td>
                  <td className="py-3 text-center font-medium">{formatPercentage(dailyStats.today.overallROI)}</td>
                  <td className="py-3 text-center text-gray-400">-</td>
                </tr>
                <tr className="border-b border-gray-700/50">
                  <td className="py-3 text-gray-400">AMS ROI</td>
                  <td className="py-3 text-center">{formatPercentage(dailyStats.yesterday.amsROI)}</td>
                  <td className="py-3 text-center font-medium">{formatPercentage(dailyStats.today.amsROI)}</td>
                  <td className="py-3 text-center text-gray-400">-</td>
                </tr>
                <tr>
                  <td className="py-3 text-gray-400">AMS ACoS</td>
                  <td className="py-3 text-center">{formatPercentage(dailyStats.yesterday.amsACoS)}</td>
                  <td className="py-3 text-center font-medium">{formatPercentage(dailyStats.today.amsACoS)}</td>
                  <td className="py-3 text-center text-gray-400">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Widgets Grid - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          title="Gross Royalties"
          value={formatCurrency(summary.widgets.grossRoyaltiesEstimator)}
          subtitle={summary.widgets.royaltiesChange != null ? `${summary.widgets.royaltiesChange >= 0 ? '+' : ''}${summary.widgets.royaltiesChange.toFixed(1)}% vs last month` : undefined}
          variant="primary"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Net Royalties"
          value={formatCurrency(summary.widgets.netRoyaltiesThisMonth || summary.widgets.grossRoyaltiesEstimator)}
          subtitle="This month"
          variant="success"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Today's Net"
          value={formatCurrency(summary.widgets.todayNetRoyalties)}
          subtitle="Today"
          variant="success"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />

        <StatsCard
          title="Yesterday's Net"
          value={formatCurrency(summary.widgets.yesterdayNetRoyalties)}
          subtitle="Yesterday"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Daily Avg Gross"
          value={formatCurrency(summary.widgets.dailyAvgGrossRoyalties)}
          subtitle="This month avg"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />

        <StatsCard
          title="Projection"
          value={formatCurrency(summary.widgets.estimatedProjection)}
          subtitle="Full month est."
          variant="primary"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
      </div>

      {/* Widgets Grid - Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          title="KENP Reads"
          value={(summary.widgets?.kenpReadsThisMonth || 0).toLocaleString()}
          subtitle="This month"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />

        <StatsCard
          title="Book Sales"
          value={summary.widgets.bookSalesThisMonth}
          subtitle={summary.widgets.ordersChange != null ? `${summary.widgets.ordersChange >= 0 ? '+' : ''}${summary.widgets.ordersChange.toFixed(1)}%` : undefined}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          }
        />

        <StatsCard
          title="Organic Orders"
          value={summary.widgets.organicOrders || 0}
          subtitle="Digital sales"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />

        <StatsCard
          title="Print Orders"
          value={summary.widgets.inorganicOrders || 0}
          subtitle="Paperbacks"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />

        <StatsCard
          title="Pre-orders"
          value={summary.widgets.preOrders || 0}
          subtitle="Pending"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />

        <StatsCard
          title="Live Books"
          value={summary.widgets.totalLiveBooks}
          subtitle="In catalog"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      </div>

      {/* Monthly Performance Chart */}
      {summary.charts?.monthly && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Monthly Performance (Last 12 Months)
          </h2>
          {summary.charts.monthly.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary.charts.monthly.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="label"
                  stroke="#9CA3AF"
                  fontSize={11}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#F59E0B"
                  fontSize={10}
                  tickFormatter={(value) => `$${value}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#3B82F6"
                  fontSize={10}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                  formatter={(value, name) => {
                    if (name === 'royalties') return [`$${Number(value).toFixed(2)}`, 'Royalties'];
                    return [value, 'Orders'];
                  }}
                />
                <Bar yAxisId="left" dataKey="royalties" fill="#F59E0B" name="royalties" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="orders" fill="#3B82F6" name="orders" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No monthly data available
            </div>
          )}
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-gray-400">Royalties ($)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-400">Orders</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Earners */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Previous Month Top Earners */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {monthlyStats.previousMonth.label} Top Earners
          </h2>
          {summary.topEarners.previousMonth.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No data for {monthlyStats.previousMonth.label}</p>
          ) : (
            <div className="space-y-3">
              {summary.topEarners.previousMonth.slice(0, 5).map((book, index) => (
                <div key={book.bookId} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
                  <span className={`text-lg font-bold w-6 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                    #{index + 1}
                  </span>
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="w-10 h-14 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{book.title}</p>
                    <p className="text-xs text-gray-400">{book.asin}</p>
                  </div>
                  <span className="text-green-500 font-semibold">{formatCurrency(book.royalties)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current Month Top Earners */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {monthlyStats.currentMonth.label} Top Earners
          </h2>
          {summary.topEarners.currentMonth.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No data for {monthlyStats.currentMonth.label}</p>
          ) : (
            <div className="space-y-3">
              {summary.topEarners.currentMonth.slice(0, 5).map((book, index) => (
                <div key={book.bookId} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
                  <span className={`text-lg font-bold w-6 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                    #{index + 1}
                  </span>
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="w-10 h-14 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{book.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{book.asin}</span>
                      {book.bsrRank && (
                        <span className="text-orange-500">BSR #{book.bsrRank.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-green-500 font-semibold">{formatCurrency(book.royalties)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Snapshot Info (Debug) */}
      {summary.snapshotInfo && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-xs text-gray-500">
          <p>Data source: {summary.snapshotInfo.source} | Last sync: {new Date(summary.snapshotInfo.createdAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
