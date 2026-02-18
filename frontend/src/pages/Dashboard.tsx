import { useEffect, useState } from 'react';
import { campaignsApi, logsApi, automationApi, amazonAdsApi } from '../services/api';
import type { CampaignStats, LogStats, AutomationStatus, AutomationLog, AmazonAdsSummary } from '../types';

// Helper: last N days date strings
function getDateRange(daysBack: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

// Helper: format date as "Lun 17"
function formatDayLabel(dateStr: string): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const d = new Date(dateStr + 'T12:00:00');
  return `${days[d.getDay()]} ${d.getDate()}`;
}

// Helper: get last 7 days as YYYY-MM-DD strings
function getLast7Days(): string[] {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

// Map ruleName → function label
const RULE_LABELS: Record<string, string> = {
  'func1': 'F1 Bidding',
  'func2': 'F2 Placement',
  'func3': 'F3 Targeting',
  'func4': 'F4 AutoAd',
  'func5': 'F5 Feed',
  'progressive_bidding': 'F1 Bidding',
  'placement_optimization': 'F2 Placement',
  'targeting_optimization': 'F3 Targeting',
  'auto_ad': 'F4 AutoAd',
  'campaign_feeding': 'F5 Feed',
};

function getFuncLabel(ruleName: string): string {
  if (!ruleName) return 'Altro';
  const lower = ruleName.toLowerCase();
  for (const [key, label] of Object.entries(RULE_LABELS)) {
    if (lower.includes(key)) return label;
  }
  return ruleName;
}

export default function Dashboard() {
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [weeklyLogs, setWeeklyLogs] = useState<AutomationLog[]>([]);
  const [recentLogs, setRecentLogs] = useState<AutomationLog[]>([]);
  const [adsSummary, setAdsSummary] = useState<AmazonAdsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringAutomation, setTriggeringAutomation] = useState(false);
  const [automationMessage, setAutomationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncingCampaigns, setSyncingCampaigns] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTriggerAutomation = async () => {
    setTriggeringAutomation(true);
    setAutomationMessage(null);
    try {
      const response = await automationApi.triggerUser();
      setAutomationMessage({ type: 'success', text: response.data?.message || 'Automazioni avviate!' });
      setTimeout(() => setAutomationMessage(null), 5000);
    } catch (err: any) {
      setAutomationMessage({ type: 'error', text: err.response?.data?.error || 'Errore avvio automazioni' });
      setTimeout(() => setAutomationMessage(null), 5000);
    } finally {
      setTriggeringAutomation(false);
    }
  };

  const handleSyncCampaigns = async () => {
    setSyncingCampaigns(true);
    setSyncMessage(null);
    try {
      const response = await campaignsApi.syncFromAmazon();
      if (response.success) {
        const mkts = response.data?.marketplaces?.map((m: any) => `${m.marketplace}: +${m.created}/${m.updated}`).join(', ') || '';
        setSyncMessage({ type: 'success', text: `Sync completato! ${mkts}` });
        const campaignsRes = await campaignsApi.getStats();
        if (campaignsRes.success && campaignsRes.data) setCampaignStats(campaignsRes.data);
      } else {
        setSyncMessage({ type: 'error', text: response.error || 'Errore sync' });
      }
      setTimeout(() => setSyncMessage(null), 8000);
    } catch (err: any) {
      setSyncMessage({ type: 'error', text: err.response?.data?.error || 'Errore sync campagne' });
      setTimeout(() => setSyncMessage(null), 8000);
    } finally {
      setSyncingCampaigns(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const { startDate, endDate } = getDateRange(7);

        const [campaignsRes, logsRes, automationRes, weeklyLogsRes, recentLogsRes, adsRes] = await Promise.allSettled([
          campaignsApi.getStats(),
          logsApi.getStats({ dateFrom: startDate, dateTo: endDate }),
          automationApi.getStatus(),
          logsApi.getAll({ dateFrom: startDate, dateTo: endDate, limit: 500, sortBy: 'createdAt', sortOrder: 'DESC' }),
          logsApi.getRecent(5),
          amazonAdsApi.getSummary(startDate, endDate),
        ]);

        if (campaignsRes.status === 'fulfilled' && campaignsRes.value.success) setCampaignStats(campaignsRes.value.data!);
        if (logsRes.status === 'fulfilled' && logsRes.value.success) setLogStats(logsRes.value.data!);
        if (automationRes.status === 'fulfilled') setAutomationStatus(automationRes.value);
        if (weeklyLogsRes.status === 'fulfilled' && weeklyLogsRes.value.success) setWeeklyLogs(weeklyLogsRes.value.data || []);
        if (recentLogsRes.status === 'fulfilled' && recentLogsRes.value.success) setRecentLogs(recentLogsRes.value.data || []);
        if (adsRes.status === 'fulfilled') setAdsSummary(adsRes.value);
      } catch (err: any) {
        setError(err.message || 'Errore nel caricamento dati');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-300">Caricamento...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="bg-gray-900 border-2 border-red-500 rounded-xl p-6 max-w-md">
          <div className="text-lg font-semibold text-white mb-2">Errore</div>
          <div className="text-gray-300">{error}</div>
          <div className="mt-4 text-sm text-gray-400">Il backend potrebbe essere in sleep mode. Riprova tra qualche minuto.</div>
        </div>
      </div>
    );
  }

  // Calcola mini calendario 7 giorni
  const last7Days = getLast7Days();
  const dayMap: Record<string, { success: number; failed: number }> = {};
  last7Days.forEach(d => { dayMap[d] = { success: 0, failed: 0 }; });
  weeklyLogs.forEach(log => {
    const day = log.createdAt.split('T')[0];
    if (dayMap[day]) {
      if (log.status === 'success') dayMap[day].success++;
      else dayMap[day].failed++;
    }
  });

  // Breakdown per funzione (ultimi 7 giorni)
  const funcBreakdown: Record<string, { success: number; failed: number }> = {};
  weeklyLogs.forEach(log => {
    const label = getFuncLabel(log.ruleName);
    if (!funcBreakdown[label]) funcBreakdown[label] = { success: 0, failed: 0 };
    if (log.status === 'success') funcBreakdown[label].success++;
    else funcBreakdown[label].failed++;
  });

  // Spesa media giornaliera (7gg)
  const avgDailySpend = adsSummary ? adsSummary.totalSpendUSD / 7 : null;
  const acos = adsSummary?.overallAcos;

  // Format azione log per mini-feed
  const formatLogAction = (log: AutomationLog) => {
    const arrow = log.newValue && log.oldValue
      ? log.newValue > log.oldValue ? '↑' : '↓'
      : '→';
    const values = log.oldValue != null && log.newValue != null
      ? ` $${log.oldValue}→$${log.newValue}`
      : '';
    return `${arrow} ${log.action}${values}`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor(diff / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}g fa`;
    if (h >= 1) return `${h}h fa`;
    return `${m}m fa`;
  };

  const weekTotal = weeklyLogs.length;
  const weekErrors = weeklyLogs.filter(l => l.status === 'failed').length;

  return (
    <div className="h-full p-8 overflow-auto">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <h1 className="text-2xl font-bold text-white uppercase">Dashboard</h1>

        {/* 3 colonne */}
        <div className="grid grid-cols-3 gap-6">

          {/* ============ COLONNA 1: AUTOMAZIONI ============ */}
          <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="text-sm font-semibold text-white">Automazioni</h2>
              </div>
              <button
                onClick={handleTriggerAutomation}
                disabled={triggeringAutomation}
                className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {triggeringAutomation ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {triggeringAutomation ? 'Avvio...' : 'Esegui Ora'}
              </button>
            </div>

            {automationMessage && (
              <div className={`p-2 rounded-lg text-xs ${automationMessage.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                {automationMessage.text}
              </div>
            )}

            {/* Mini calendario 7 giorni */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Ultimi 7 giorni</div>
              <div className="grid grid-cols-7 gap-1">
                {last7Days.map(day => {
                  const { success, failed } = dayMap[day];
                  const total = success + failed;
                  const isToday = day === last7Days[6];
                  let dotColor = 'bg-gray-700';
                  if (total > 0) dotColor = failed > 0 ? 'bg-red-500' : 'bg-green-500';
                  return (
                    <div key={day} className="flex flex-col items-center gap-1">
                      <div className={`w-6 h-6 rounded-full ${dotColor} flex items-center justify-center ${isToday ? 'ring-2 ring-orange-400' : ''}`}>
                        {total > 0 && <span className="text-[9px] text-white font-bold">{total}</span>}
                      </div>
                      <span className="text-[9px] text-gray-500">{formatDayLabel(day)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Riepilogo settimana */}
            <div className="bg-gray-800 rounded-lg p-3 text-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-xs">Questa settimana</span>
                <span className={`text-xs font-semibold ${weekErrors > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {weekTotal} azioni {weekErrors > 0 ? `· ${weekErrors} errori` : '· ok'}
                </span>
              </div>
              {Object.keys(funcBreakdown).length > 0 ? (
                <div className="space-y-1">
                  {Object.entries(funcBreakdown).map(([label, { success, failed }]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs text-gray-300">{label}</span>
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-green-400">{success}</span>
                        {failed > 0 && <span className="text-xs text-red-400">/ {failed} err</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Nessuna esecuzione negli ultimi 7 giorni</p>
              )}
            </div>
          </div>

          {/* ============ COLONNA 2: CAMPAGNE ============ */}
          <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <h2 className="text-sm font-semibold text-white">Campagne</h2>
              </div>
              <button
                onClick={handleSyncCampaigns}
                disabled={syncingCampaigns}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {syncingCampaigns ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {syncingCampaigns ? 'Sync...' : 'Sync'}
              </button>
            </div>

            {syncMessage && (
              <div className={`p-2 rounded-lg text-xs ${syncMessage.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                {syncMessage.text}
              </div>
            )}

            {campaignStats ? (
              <div className="space-y-3">
                {/* Totale + stati */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Totale</div>
                    <div className="text-2xl font-bold text-white">{campaignStats.total || 0}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Attive</div>
                    <div className="text-2xl font-bold text-green-400">{campaignStats.byState?.enabled || 0}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Pause</div>
                    <div className="text-2xl font-bold text-yellow-400">{campaignStats.byState?.paused || 0}</div>
                  </div>
                </div>

                {/* Spesa media 7gg + ACOS */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-2">Spesa media/giorno (7gg)</div>
                  {avgDailySpend !== null ? (
                    <div className="flex items-end justify-between">
                      <div className="text-2xl font-bold text-indigo-300">
                        ${avgDailySpend.toFixed(2)}
                      </div>
                      {acos !== null && acos !== undefined && (
                        <div className="text-right">
                          <div className="text-xs text-gray-400">ACOS</div>
                          <div className={`text-lg font-bold ${acos > 50 ? 'text-red-400' : acos > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {acos.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Dati spesa non disponibili</div>
                  )}
                  {adsSummary && (
                    <div className="mt-2 text-xs text-gray-500">
                      Tot 7gg: ${adsSummary.totalSpendUSD.toFixed(2)} · Vendite: ${adsSummary.totalSalesUSD.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Dati campagne non disponibili
              </div>
            )}
          </div>

          {/* ============ COLONNA 3: LOG ============ */}
          <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-sm font-semibold text-white">Log Attività</h2>
            </div>

            {logStats ? (
              <div className="space-y-3">
                {/* Contatori */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Totale</div>
                    <div className="text-2xl font-bold text-white">{logStats.total || 0}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">OK</div>
                    <div className="text-2xl font-bold text-green-400">{logStats.byStatus?.success || 0}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Errori</div>
                    <div className="text-2xl font-bold text-red-400">{logStats.byStatus?.failed || 0}</div>
                  </div>
                </div>

                {/* Mini-feed ultime 5 azioni */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-2">Ultime attività</div>
                  {recentLogs.length > 0 ? (
                    <div className="space-y-2">
                      {recentLogs.map(log => (
                        <div key={log.id} className="flex items-start justify-between gap-2 text-xs">
                          <div className="flex items-start gap-1.5 min-w-0">
                            <span className={`mt-0.5 flex-shrink-0 ${log.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                              {log.status === 'success' ? '✓' : '✗'}
                            </span>
                            <div className="min-w-0">
                              <div className="text-gray-200 truncate font-mono">{formatLogAction(log)}</div>
                              <div className="text-gray-500 truncate">{log.targetName || log.targetId}</div>
                            </div>
                          </div>
                          <span className="text-gray-600 flex-shrink-0">{formatTimeAgo(log.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Nessuna attività recente</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Dati log non disponibili
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
