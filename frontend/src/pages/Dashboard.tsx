import { useEffect, useState } from 'react';
import { campaignsApi, logsApi, automationApi, amazonAdsApi } from '../services/api';
import type { CampaignStats, AutomationStatus, AutomationLog } from '../types';

// ─── Interfacce ──────────────────────────────────────────────────────────────

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

interface BookGroup {
  bookKey: string;
  bookLabel: string;
  bookAsin: string | null;
  logs: AutomationLog[];
}

interface DateGroup {
  dateKey: string;
  dateLabel: string;
  books: BookGroup[];
  totalLogs: number;
  successCount: number;
  failedCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function getDayLabel(dateStr: string): { weekday: string; ddmm: string } {
  const d = new Date(dateStr + 'T12:00:00');
  const weekday = d.toLocaleDateString('it-IT', { weekday: 'short' });
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return { weekday, ddmm: `${dd}/${mm}` };
}

// Returns 7 day strings for the given week offset (0 = current, 1 = last week, 2 = two weeks ago)
function getWeekDays(weekOffset: number): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i) - weekOffset * 7);
    return d.toISOString().split('T')[0];
  });
}

function buildGroups(logs: AutomationLog[]): DateGroup[] {
  const byDate = new Map<string, AutomationLog[]>();
  for (const log of logs) {
    const dateKey = log.createdAt.slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(log);
  }

  const dateGroups: DateGroup[] = [];

  for (const [dateKey, dateLogs] of byDate) {
    const byBook = new Map<string, { label: string; asin: string | null; logs: AutomationLog[] }>();
    for (const log of dateLogs) {
      const bookKey = log.bookAsin || log.targetName || log.targetId;
      const rawLabel = log.bookTitle || log.targetName || log.targetId;
      const bookLabel = rawLabel?.includes(':') ? rawLabel.split(':')[0].trim() : rawLabel;
      if (!byBook.has(bookKey)) {
        byBook.set(bookKey, { label: bookLabel, asin: log.bookAsin ?? null, logs: [] });
      }
      byBook.get(bookKey)!.logs.push(log);
    }

    const books: BookGroup[] = Array.from(byBook.entries()).map(([bookKey, v]) => ({
      bookKey,
      bookLabel: v.label,
      bookAsin: v.asin,
      logs: v.logs,
    }));

    books.sort((a, b) => {
      const aFailed = a.logs.some(l => l.status === 'failed') ? 0 : 1;
      const bFailed = b.logs.some(l => l.status === 'failed') ? 0 : 1;
      if (aFailed !== bFailed) return aFailed - bFailed;
      return a.bookLabel.localeCompare(b.bookLabel);
    });

    const successCount = dateLogs.filter(l => l.status === 'success').length;
    const failedCount = dateLogs.filter(l => l.status === 'failed').length;

    const date = new Date(dateKey + 'T12:00:00');
    const dateLabel = date.toLocaleDateString('it-IT', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });

    dateGroups.push({ dateKey, dateLabel, books, totalLogs: dateLogs.length, successCount, failedCount });
  }

  dateGroups.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return dateGroups;
}

// ─── Pagina Dashboard ─────────────────────────────────────────────────────────

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
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());

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
        const { startDate, endDate } = getDateRange(21);

        const [campaignsRes, automationRes, weeklyLogsRes, adsRes] = await Promise.allSettled([
          campaignsApi.getStats(),
          automationApi.getStatus(),
          logsApi.getAll({ dateFrom: startDate, dateTo: endDate, limit: 2000, sortBy: 'createdAt', sortOrder: 'DESC' }),
          amazonAdsApi.getSpendCache(),
        ]);

        if (campaignsRes.status === 'fulfilled' && campaignsRes.value.success) setCampaignStats(campaignsRes.value.data!);
        if (automationRes.status === 'fulfilled') setAutomationStatus(automationRes.value);
        if (adsRes.status === 'fulfilled') setSpendCache(adsRes.value);
        if (weeklyLogsRes.status === 'fulfilled' && weeklyLogsRes.value.success) {
          setWeeklyLogs(weeklyLogsRes.value.data || []);
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

  // Calendario — dayMap su 21 giorni
  const todayStr = new Date().toISOString().split('T')[0];
  const allDays = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (20 - i));
    return d.toISOString().split('T')[0];
  });
  const dayMap: Record<string, { success: number; failed: number }> = {};
  allDays.forEach(d => { dayMap[d] = { success: 0, failed: 0 }; });
  weeklyLogs.forEach(log => {
    const day = log.createdAt.split('T')[0];
    if (dayMap[day]) {
      if (log.status === 'success') dayMap[day].success++;
      else dayMap[day].failed++;
    }
  });

  const currentWeekDays = getWeekDays(weekOffset);

  // Libri del giorno selezionato
  const selectedDayBooks: BookGroup[] = (() => {
    if (!selectedDay) return [];
    const groups = buildGroups(weeklyLogs.filter(l => l.createdAt.slice(0, 10) === selectedDay));
    return groups[0]?.books ?? [];
  })();

  // Spesa
  const avgDailySpend = spendCache?.avgDailySpend ?? null;
  const acos = spendCache?.acos ?? null;
  const spendUpdatedAt = spendCache?.updatedAt ?? null;
  const archivedCount = campaignStats?.byState?.archived || 0;

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor(diff / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}g fa`;
    if (h >= 1) return `${h}h fa`;
    return `${m}m fa`;
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Contenuto principale ── */}
      <div className="flex-1 overflow-auto p-8">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-white uppercase">Dashboard</h1>

        {/* ── Griglia 2 colonne: Automazioni | Campagne ── */}
        <div className="grid grid-cols-2 gap-6 items-start">

          {/* COLONNA 1: AUTOMAZIONI */}
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

            {/* Calendario 7 giorni con navigazione */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => { setWeekOffset(o => Math.min(o + 1, 2)); setSelectedDay(null); }}
                  disabled={weekOffset >= 2}
                  className="p-1 rounded hover:bg-gray-700 transition-colors disabled:opacity-30 text-gray-400"
                  title="Settimana precedente"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-gray-400">
                  {getDayLabel(currentWeekDays[0]).ddmm} — {getDayLabel(currentWeekDays[6]).ddmm}
                </span>
                <button
                  onClick={() => { setWeekOffset(o => Math.max(o - 1, 0)); setSelectedDay(null); }}
                  disabled={weekOffset === 0}
                  className="p-1 rounded hover:bg-gray-700 transition-colors disabled:opacity-30 text-gray-400"
                  title="Settimana successiva"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {currentWeekDays.map(day => {
                  const { success, failed } = dayMap[day] || { success: 0, failed: 0 };
                  const total = success + failed;
                  const isToday = day === todayStr;
                  const isSelected = day === selectedDay;
                  const hasLogs = total > 0;
                  const { weekday, ddmm } = getDayLabel(day);
                  return (
                    <button
                      key={day}
                      onClick={() => { setSelectedDay(d => d === day ? null : day); setExpandedBooks(new Set()); }}
                      className="flex flex-col items-center gap-1"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all
                        ${isSelected
                          ? 'bg-blue-600 ring-2 ring-blue-400'
                          : hasLogs
                            ? 'bg-gray-700 hover:bg-gray-600'
                            : 'bg-gray-800'}
                        ${isToday && !isSelected ? 'ring-2 ring-orange-400' : ''}
                      `}>
                        {total > 0 && (
                          <div className="flex flex-col items-center leading-none gap-px">
                            {success > 0 && <span className="text-[9px] text-green-400 font-bold">{success}</span>}
                            <span className="text-[9px] text-red-400 font-bold">{failed}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-400 capitalize">{weekday}</span>
                      <span className="text-[9px] text-gray-500">{ddmm}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dettaglio giorno selezionato — sotto il calendario */}
            {selectedDay && (
              <div className="border-t border-gray-700 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-orange-400">
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </span>
                  {selectedDayBooks.length > 0 && (
                    <span className="text-xs text-gray-500">{selectedDayBooks.length} libr{selectedDayBooks.length === 1 ? 'o' : 'i'}</span>
                  )}
                </div>
                {selectedDayBooks.length === 0 ? (
                  <p className="text-xs text-gray-500">Nessuna attività</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selectedDayBooks.map(book => {
                      const hasFail = book.logs.some(l => l.status === 'failed');
                      const ok = book.logs.filter(l => l.status === 'success').length;
                      const err = book.logs.filter(l => l.status === 'failed').length;
                      const isExpanded = expandedBooks.has(book.bookKey);
                      return (
                        <div key={book.bookKey}>
                          <button
                            onClick={() => setExpandedBooks(prev => {
                              const next = new Set(prev);
                              if (next.has(book.bookKey)) next.delete(book.bookKey);
                              else next.add(book.bookKey);
                              return next;
                            })}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left ${hasFail ? 'bg-red-900/20 hover:bg-red-900/30' : 'bg-gray-800/50 hover:bg-gray-700/50'} transition-colors`}
                          >
                            <svg className={`w-3 h-3 text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasFail ? 'bg-red-400' : 'bg-green-400'}`} />
                            <span className="text-xs text-gray-200 truncate flex-1">{book.bookLabel}</span>
                            <div className="flex gap-1.5 shrink-0">
                              {ok > 0 && <span className="text-xs text-green-400">{ok}✓</span>}
                              {err > 0 && <span className="text-xs text-red-400">{err}✗</span>}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="ml-6 mt-0.5 space-y-px">
                              {book.logs.map(log => (
                                <div key={log.id} className={`flex flex-col gap-0.5 px-2 py-1.5 rounded ${log.status === 'failed' ? 'bg-red-950/40' : 'bg-gray-900/60'}`}>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs shrink-0 ${log.status === 'failed' ? 'text-red-400' : 'text-green-400'}`}>
                                      {log.status === 'failed' ? '✗' : '✓'}
                                    </span>
                                    <span className="text-xs text-gray-300 font-medium truncate">{log.targetName || log.targetId}</span>
                                    <span className="text-[10px] text-gray-600 shrink-0">{log.ruleName}</span>
                                  </div>
                                  {(log.oldValue != null || log.newValue != null) && (
                                    <div className="text-[10px] text-gray-500 pl-4">
                                      {log.action && <span className="text-gray-600 mr-1">{log.action}:</span>}
                                      {log.oldValue != null && <span className="text-gray-400">${log.oldValue.toFixed(2)}</span>}
                                      {log.oldValue != null && log.newValue != null && <span className="text-gray-600 mx-1">→</span>}
                                      {log.newValue != null && <span className="text-blue-400 font-medium">${log.newValue.toFixed(2)}</span>}
                                    </div>
                                  )}
                                  {log.reason && (
                                    <div className="text-[10px] text-gray-600 pl-4 truncate" title={log.reason}>{log.reason}</div>
                                  )}
                                  {log.status === 'failed' && log.errorMessage && (
                                    <div className="text-[10px] text-red-500 pl-4 truncate" title={log.errorMessage}>{log.errorMessage}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* COLONNA 2: CAMPAGNE */}
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
      </div>{/* fine contenuto principale */}
    </div>
  );
}
