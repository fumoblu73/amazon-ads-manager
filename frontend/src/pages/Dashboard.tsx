import { useEffect, useState } from 'react';
import { campaignsApi, logsApi, automationApi, amazonAdsApi } from '../services/api';
import type { CampaignStats, AutomationStatus, AutomationLog } from '../types';

interface AdTypeSpend {
  spend7d: number;
  sales7d: number;
  avgDailySpend: number;
}

interface SpendCache {
  totalSpend7d: number | null;
  totalSales7d: number | null;
  avgDailySpend: number | null;
  acos: number | null;
  byAdType?: {
    SP: AdTypeSpend;
    SD: AdTypeSpend;
    SB: AdTypeSpend;
  };
  updatedAt: string | null;
}

// Helper: last N days date strings
// endDate uses tomorrow to include all logs created today (avoids midnight UTC cutoff)
function getDateRange(daysBack: number): { startDate: string; endDate: string } {
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: tomorrow.toISOString().split('T')[0],
  };
}

// Helper: format date as "Lun 17"
function formatDayLabel(dateStr: string): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const d = new Date(dateStr + 'T12:00:00');
  return `${days[d.getDay()]} ${d.getDate()}`;
}

// Helper: format date as "Lun 17 Feb"
function formatDayFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
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

// Helper: extract marketplace from reason field ("Phase 2 — US" → "US")
function extractMarketplace(reason: string | undefined): string {
  if (!reason) return 'N/A';
  const match = reason.match(/[—\-]\s*([A-Z]{2,3})$/);
  return match ? match[1] : 'N/A';
}

// Helper: group logs for a day by marketplace → book
function groupDayLogs(logs: AutomationLog[]) {
  const byMp: Record<string, Record<string, { label: string; asin: string | null; success: number; failed: number }>> = {};
  for (const log of logs) {
    const mp = extractMarketplace(log.reason);
    const bookKey = log.bookAsin || log.targetName || log.targetId;
    const bookLabel = log.bookTitle || log.targetName || log.targetId;
    if (!byMp[mp]) byMp[mp] = {};
    if (!byMp[mp][bookKey]) byMp[mp][bookKey] = { label: bookLabel, asin: log.bookAsin || null, success: 0, failed: 0 };
    if (log.status === 'success') byMp[mp][bookKey].success++;
    else byMp[mp][bookKey].failed++;
  }
  return byMp;
}

export default function Dashboard() {
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
  const [, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [weeklyLogs, setWeeklyLogs] = useState<AutomationLog[]>([]);
  const [spendCache, setSpendCache] = useState<SpendCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringAutomation, setTriggeringAutomation] = useState(false);
  const [automationMessage, setAutomationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncingCampaigns, setSyncingCampaigns] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

        const [campaignsRes, automationRes, weeklyLogsRes, adsRes] = await Promise.allSettled([
          campaignsApi.getStats(),
          automationApi.getStatus(),
          logsApi.getAll({ dateFrom: startDate, dateTo: endDate, limit: 500, sortBy: 'createdAt', sortOrder: 'DESC' }),
          amazonAdsApi.getSpendCache(),
        ]);

        if (campaignsRes.status === 'fulfilled' && campaignsRes.value.success) setCampaignStats(campaignsRes.value.data!);
        if (automationRes.status === 'fulfilled') setAutomationStatus(automationRes.value);
        if (adsRes.status === 'fulfilled') setSpendCache(adsRes.value);

        if (weeklyLogsRes.status === 'fulfilled' && weeklyLogsRes.value.success) {
          const logs = weeklyLogsRes.value.data || [];
          setWeeklyLogs(logs);
          // Auto-select most recent day with logs
          if (logs.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const daysWithLogs = [...new Set(logs.map(l => l.createdAt.split('T')[0]))].sort().reverse();
            setSelectedDay(daysWithLogs[0] === today ? today : daysWithLogs[0]);
          }
        }
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

  // Spesa da cache DB
  const avgDailySpend = spendCache?.avgDailySpend ?? null;
  const acos = spendCache?.acos ?? null;
  const spendUpdatedAt = spendCache?.updatedAt ?? null;

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
  const archivedCount = campaignStats?.byState?.archived || 0;

  // Dati del giorno selezionato
  const dayLogs = selectedDay ? weeklyLogs.filter(l => l.createdAt.split('T')[0] === selectedDay) : [];
  const dayGrouped = selectedDay ? groupDayLogs(dayLogs) : {};

  return (
    <div className="h-full p-8 overflow-auto">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <h1 className="text-2xl font-bold text-white uppercase">Dashboard</h1>

        {/* 2 colonne */}
        <div className="grid grid-cols-2 gap-6">

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

            {/* Calendario 7 giorni — cliccabile */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Ultimi 7 giorni</span>
                <span className={`text-xs font-semibold ${weekErrors > 0 ? 'text-red-400' : weekTotal > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {weekTotal > 0 ? `${weekTotal} log · ${weekErrors > 0 ? `${weekErrors} err` : 'ok'}` : 'nessuna esecuzione'}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {last7Days.map(day => {
                  const { success, failed } = dayMap[day];
                  const total = success + failed;
                  const isToday = day === last7Days[6];
                  const isSelected = day === selectedDay;
                  const hasLogs = total > 0;
                  let dotColor = 'bg-gray-700 cursor-default';
                  if (hasLogs) dotColor = failed > 0 ? 'bg-red-500 cursor-pointer hover:ring-2 hover:ring-red-300' : 'bg-green-500 cursor-pointer hover:ring-2 hover:ring-green-300';
                  return (
                    <div
                      key={day}
                      className="flex flex-col items-center gap-1"
                      onClick={() => hasLogs && setSelectedDay(isSelected ? null : day)}
                    >
                      <div className={`w-7 h-7 rounded-full ${dotColor} flex items-center justify-center transition-all
                        ${isToday && !isSelected ? 'ring-2 ring-orange-400' : ''}
                        ${isSelected ? 'ring-3 ring-white scale-110' : ''}
                      `}>
                        {total > 0 && <span className="text-[9px] text-white font-bold">{total}</span>}
                      </div>
                      <span className={`text-[9px] ${isSelected ? 'text-white font-semibold' : 'text-gray-500'}`}>
                        {formatDayLabel(day)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-600 mt-1">Clicca un giorno per vedere i dettagli</p>
            </div>

            {/* Dettaglio giorno selezionato o messaggio vuoto */}
            <div className="bg-gray-800 rounded-lg p-3 flex-1">
              {selectedDay && dayLogs.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white capitalize">{formatDayFull(selectedDay)}</span>
                    <span className="text-xs text-gray-400">{dayLogs.length} log</span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(dayGrouped).map(([mp, books]) => (
                      <div key={mp}>
                        {/* Marketplace header */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">{mp}</span>
                          <span className="text-[10px] text-gray-500">{Object.keys(books).length} libr{Object.keys(books).length === 1 ? 'o' : 'i'}</span>
                        </div>
                        {/* Libri */}
                        <div className="space-y-1 pl-2">
                          {Object.entries(books).map(([bookKey, { label, asin, success, failed }]) => (
                            <div key={bookKey} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-gray-200 truncate block">{label}</span>
                                {asin && <span className="text-[10px] text-gray-500 font-mono">{asin}</span>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {success > 0 && (
                                  <span className="text-[10px] font-semibold text-green-400">✓ {success}</span>
                                )}
                                {failed > 0 && (
                                  <span className="text-[10px] font-semibold text-red-400">✗ {failed}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500">
                  {selectedDay ? 'Nessun log per questo giorno' : 'Nessuna esecuzione negli ultimi 7 giorni'}
                </p>
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
                {/* Totale + stati: 4 card */}
                <div className="grid grid-cols-4 gap-2">
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
                  <div className="bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Archiviate</div>
                    <div className="text-2xl font-bold text-gray-500">{archivedCount}</div>
                  </div>
                </div>

                {/* Spesa 7gg breakdown per tipo */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-2">Spesa 7 giorni</div>
                  {avgDailySpend !== null ? (
                    <div className="space-y-1.5">
                      {(['SP', 'SD', 'SB'] as const).map(type => {
                        const typeLabels = { SP: 'Sponsored Products', SD: 'Sponsored Display', SB: 'Sponsored Brands' };
                        const typeData = spendCache?.byAdType?.[type];
                        const spend = typeData?.spend7d ?? 0;
                        const daily = typeData?.avgDailySpend ?? 0;
                        const hasData = spend > 0;
                        return (
                          <div key={type} className="flex items-center justify-between">
                            <span className={`text-xs font-medium w-40 ${hasData ? 'text-indigo-300' : 'text-gray-600'}`}>{typeLabels[type]}</span>
                            <span className={`text-xs flex-1 text-right mr-3 ${hasData ? 'text-white' : 'text-gray-600'}`}>
                              {hasData ? `$${spend.toFixed(2)}` : '—'}
                            </span>
                            <span className={`text-xs w-14 text-right ${hasData ? 'text-gray-400' : 'text-gray-700'}`}>
                              {hasData ? `$${daily.toFixed(2)}/g` : ''}
                            </span>
                          </div>
                        );
                      })}
                      <div className="border-t border-gray-700 pt-1.5 flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-semibold w-6">Tot</span>
                        <span className="text-sm font-bold text-indigo-300 flex-1 text-right mr-3">
                          ${spendCache!.totalSpend7d!.toFixed(2)}
                        </span>
                        <span className="text-xs text-indigo-300 w-14 text-right">
                          ${avgDailySpend.toFixed(2)}/g
                        </span>
                      </div>
                      {acos !== null && (
                        <div className="flex justify-between items-center pt-0.5">
                          <span className="text-xs text-gray-400">ACOS</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${acos > 50 ? 'text-red-400' : acos > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                              {acos.toFixed(1)}%
                            </span>
                            {spendUpdatedAt && <span className="text-xs text-gray-600">{formatTimeAgo(spendUpdatedAt)}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Cache spesa non ancora disponibile</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Dati campagne non disponibili
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
