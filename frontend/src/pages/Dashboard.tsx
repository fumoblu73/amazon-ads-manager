import { useEffect, useState } from 'react';
import { campaignsApi, logsApi, automationApi } from '../services/api';
import type { CampaignStats, LogStats, AutomationStatus, AutomationLog } from '../types';

export default function Dashboard() {
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [recentErrors, setRecentErrors] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [campaignsRes, logsRes, automationRes, errorsRes] = await Promise.all([
          campaignsApi.getStats(),
          logsApi.getStats(),
          automationApi.getStatus(),
          logsApi.getErrors(10),
        ]);

        if (campaignsRes.success && campaignsRes.data) {
          setCampaignStats(campaignsRes.data);
        }

        if (logsRes.success && logsRes.data) {
          setLogStats(logsRes.data);
        }

        setAutomationStatus(automationRes);

        if (errorsRes.success && errorsRes.data) {
          setRecentErrors(errorsRes.data);
        }
      } catch (err: any) {
        setError(err.message || 'Errore nel caricamento dati');
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh ogni 30 secondi
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600">Caricamento...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-white">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-lg font-semibold text-red-900">Errore</div>
          </div>
          <div className="text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  const hasErrors = recentErrors.length > 0;
  const isSchedulerRunning = automationStatus?.scheduler.isRunning;

  return (
    <div className="h-full p-8 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            <div className={`w-2 h-2 rounded-full ${isSchedulerRunning && !hasErrors ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
            <span className="text-sm font-medium text-gray-700">
              {isSchedulerRunning && !hasErrors ? 'Sistema Operativo' : 'Attenzione Richiesta'}
            </span>
          </div>
        </div>

        {/* Alert Box - Only if errors */}
        {hasErrors && (
          <div className="bg-red-50 rounded-lg p-3 mb-6 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-red-900 font-medium text-sm">Errori Rilevati ({recentErrors.length})</h3>
              <p className="text-red-700 text-xs">Sono stati rilevati errori nelle ultime esecuzioni</p>
            </div>
          </div>
        )}

        {/* Compact Stats Grid */}
        <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
          {/* Automation Status */}
          <div className="bg-white rounded-xl shadow-md p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-900">Automazioni</h2>
            </div>
            {automationStatus && (
              <div className="space-y-3 flex-1">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Scheduler</div>
                  <div className="text-xl font-bold text-blue-700">
                    {automationStatus.scheduler.isRunning ? 'Attivo' : 'Inattivo'}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Tasks Attivi</div>
                  <div className="text-xl font-bold text-green-700">
                    {automationStatus.scheduler.activeTasks}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Ultima Esecuzione</div>
                  <div className="text-lg font-bold text-purple-700">
                    {automationStatus.lastExecution.status}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Campaign Stats */}
          <div className="bg-white rounded-xl shadow-md p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-900">Campagne</h2>
            </div>
            {campaignStats && (
              <div className="space-y-3 flex-1">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Totale</div>
                  <div className="text-xl font-bold text-indigo-700">{campaignStats.total}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Attive</div>
                    <div className="text-xl font-bold text-green-700">{campaignStats.byState.enabled}</div>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-3 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Pause</div>
                    <div className="text-xl font-bold text-yellow-700">{campaignStats.byState.paused}</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Budget Giornaliero</div>
                  <div className="text-lg font-bold text-gray-700">${campaignStats.totalDailyBudget.toFixed(2)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Log Stats */}
          <div className="bg-white rounded-xl shadow-md p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-900">Log Attività</h2>
            </div>
            {logStats && (
              <div className="space-y-3 flex-1">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Totale Log</div>
                  <div className="text-xl font-bold text-blue-700">{logStats.total}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Successi</div>
                  <div className="text-xl font-bold text-green-700">{logStats.byStatus.success}</div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Falliti</div>
                  <div className="text-xl font-bold text-red-700">{logStats.byStatus.failed}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
