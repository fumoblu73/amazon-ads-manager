import { useEffect, useState } from 'react';
import { campaignsApi, logsApi, automationApi } from '../services/api';
import type { CampaignStats, LogStats, AutomationStatus } from '../types';

export default function Dashboard() {
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [campaignsRes, logsRes, automationRes] = await Promise.all([
          campaignsApi.getStats(),
          logsApi.getStats(),
          automationApi.getStatus(),
        ]);

        if (campaignsRes.success && campaignsRes.data) {
          setCampaignStats(campaignsRes.data);
        }

        if (logsRes.success && logsRes.data) {
          setLogStats(logsRes.data);
        }

        setAutomationStatus(automationRes);
      } catch (err: any) {
        setError(err.message || 'Errore nel caricamento dati');
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">Errore: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Amazon Ads Manager - Dashboard</h1>

        {/* Automation Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Stato Automazioni</h2>
          {automationStatus && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-sm text-gray-600">Scheduler</div>
                <div className="text-2xl font-bold text-blue-600">
                  {automationStatus.scheduler.isRunning ? 'Attivo' : 'Inattivo'}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-sm text-gray-600">Tasks Attivi</div>
                <div className="text-2xl font-bold text-green-600">
                  {automationStatus.scheduler.activeTasks}
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-sm text-gray-600">Stato Ultima Esecuzione</div>
                <div className="text-2xl font-bold text-purple-600">
                  {automationStatus.lastExecution.status}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Campaign Stats */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Statistiche Campagne</h2>
          {campaignStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-indigo-50 p-4 rounded">
                <div className="text-sm text-gray-600">Totale Campagne</div>
                <div className="text-2xl font-bold text-indigo-600">{campaignStats.total}</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-sm text-gray-600">Attive</div>
                <div className="text-2xl font-bold text-green-600">{campaignStats.byState.enabled}</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded">
                <div className="text-sm text-gray-600">In Pausa</div>
                <div className="text-2xl font-bold text-yellow-600">{campaignStats.byState.paused}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-sm text-gray-600">Budget Giornaliero Totale</div>
                <div className="text-2xl font-bold text-gray-600">${campaignStats.totalDailyBudget.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Log Stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Statistiche Log Automazioni</h2>
          {logStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-sm text-gray-600">Totale Log</div>
                <div className="text-2xl font-bold text-blue-600">{logStats.total}</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-sm text-gray-600">Successi</div>
                <div className="text-2xl font-bold text-green-600">{logStats.byStatus.success}</div>
              </div>
              <div className="bg-red-50 p-4 rounded">
                <div className="text-sm text-gray-600">Falliti</div>
                <div className="text-2xl font-bold text-red-600">{logStats.byStatus.failed}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
