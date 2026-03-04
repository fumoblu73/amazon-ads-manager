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

function getLast14Days(): string[] {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
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
      const bookLabel = log.bookTitle || log.targetName || log.targetId;
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

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// ─── Componente riga singolo log ──────────────────────────────────────────────

function LogRow({ log }: { log: AutomationLog }) {
  const hasBidChange = log.oldValue != null && log.newValue != null;
  return (
    <div className={`flex flex-col gap-1 px-4 py-2.5 border-b border-gray-700/50 last:border-0 hover:bg-gray-800/50 transition-colors ${log.status === 'failed' ? 'bg-red-900/20' : ''}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-400 w-10 shrink-0">{formatTime(log.createdAt)}</span>
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-indigo-900/50 text-indigo-300 rounded shrink-0">
          {log.ruleName}
        </span>
        <span className="text-xs text-gray-400 truncate max-w-[280px]" title={log.targetName}>
          {log.targetName}
        </span>
        {hasBidChange && (
          <span className="flex items-center gap-1 text-xs font-medium text-gray-300 shrink-0">
            <span className="text-gray-400">${Number(log.oldValue).toFixed(2)}</span>
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white">${Number(log.newValue).toFixed(2)}</span>
          </span>
        )}
        <span className={`ml-auto shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded ${
          log.status === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
        }`}>
          {log.status === 'success' ? 'OK' : 'ERR'}
        </span>
      </div>
      {log.reason && (
        <div className="pl-[52px] text-xs text-gray-400">{log.reason}</div>
      )}
      {log.status === 'failed' && log.errorMessage && (
        <div className="pl-[52px] text-xs text-red-400 bg-red-900/30 rounded px-2 py-1 mt-0.5">
          {log.errorMessage}
        </div>
      )}
    </div>
  );
}

// ─── Componente gruppo libro (collassabile) ───────────────────────────────────

function BookGroupRow({ group }: { group: BookGroup }) {
  const [open, setOpen] = useState(true);
  const hasFailures = group.logs.some(l => l.status === 'failed');
  const successCount = group.logs.filter(l => l.status === 'success').length;
  const failedCount = group.logs.filter(l => l.status === 'failed').length;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          hasFailures ? 'bg-red-900/20 hover:bg-red-900/30' : 'bg-gray-800 hover:bg-gray-700'
        }`}
      >
        <svg className={`w-4 h-4 shrink-0 ${hasFailures ? 'text-red-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="text-sm font-medium text-gray-100 flex-1 truncate">{group.bookLabel}</span>
        {group.bookAsin && (
          <span className="text-xs text-gray-400 font-mono shrink-0">{group.bookAsin}</span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          {successCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-green-900/50 text-green-300 rounded">
              {successCount} OK
            </span>
          )}
          {failedCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-red-900/50 text-red-300 rounded">
              {failedCount} ERR
            </span>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="bg-gray-900">
          {group.logs.map(log => <LogRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}

// ─── Componente gruppo data (sempre espanso) ──────────────────────────────────

function DateGroupRow({ group }: { group: DateGroup }) {
  const hasFailures = group.failedCount > 0;
  return (
    <div className="rounded-xl border border-gray-700 overflow-hidden mb-4">
      <div className={`flex items-center gap-4 px-5 py-3.5 ${hasFailures ? 'bg-red-900/20' : 'bg-gray-800'}`}>
        <svg className={`w-5 h-5 shrink-0 ${hasFailures ? 'text-red-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-bold text-white capitalize flex-1">{group.dateLabel}</span>
        <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
          <span>{group.books.length} libr{group.books.length === 1 ? 'o' : 'i'}</span>
          <span>·</span>
          <span>{group.totalLogs} log</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {group.successCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-green-900/50 text-green-300 rounded-full">
              {group.successCount} OK
            </span>
          )}
          {group.failedCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-red-900/50 text-red-300 rounded-full">
              {group.failedCount} ERR
            </span>
          )}
        </div>
      </div>
      <div className="px-4 pb-4 pt-3 bg-gray-900/30">
        {group.books.map(book => (
          <BookGroupRow key={book.bookKey} group={book} />
        ))}
      </div>
    </div>
  );
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
  const [logFilter, setLogFilter] = useState<string>('all');

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
        const { startDate, endDate } = getDateRange(14);

        const [campaignsRes, automationRes, weeklyLogsRes, adsRes] = await Promise.allSettled([
          campaignsApi.getStats(),
          automationApi.getStatus(),
          logsApi.getAll({ dateFrom: startDate, dateTo: endDate, limit: 1000, sortBy: 'createdAt', sortOrder: 'DESC' }),
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

  // Calendario 14 giorni
  const last14Days = getLast14Days();
  const dayMap: Record<string, { success: number; failed: number }> = {};
  last14Days.forEach(d => { dayMap[d] = { success: 0, failed: 0 }; });
  weeklyLogs.forEach(log => {
    const day = log.createdAt.split('T')[0];
    if (dayMap[day]) {
      if (log.status === 'success') dayMap[day].success++;
      else dayMap[day].failed++;
    }
  });

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

  // Log filtrati e raggruppati
  const filteredLogs = logFilter === 'all' ? weeklyLogs : weeklyLogs.filter(l => l.status === logFilter);
  const logGroups = buildGroups(filteredLogs);

  return (
    <div className="h-full p-8 overflow-auto">
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

            {/* Calendario 14 giorni */}
            <div>
              <div className="mb-2">
                <span className="text-xs text-gray-400">Ultimi 14 giorni</span>
              </div>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(14, 1fr)' }}>
                {last14Days.map(day => {
                  const { success, failed } = dayMap[day];
                  const total = success + failed;
                  const isToday = day === last14Days[13];
                  const { weekday, ddmm } = getDayLabel(day);
                  return (
                    <div key={day} className="flex flex-col items-center gap-0.5">
                      <div className={`w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center
                        ${total === 0 ? 'opacity-40' : ''}
                        ${isToday ? 'ring-2 ring-orange-400' : ''}
                      `}>
                        {total > 0 && (
                          <div className="flex flex-col items-center leading-none gap-px">
                            {success > 0 && <span className="text-[7px] text-green-400 font-bold">{success}</span>}
                            <span className="text-[7px] text-red-400 font-bold">{failed}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] text-gray-400 capitalize">{weekday}</span>
                      <span className="text-[8px] text-gray-500">{ddmm}</span>
                    </div>
                  );
                })}
              </div>
            </div>
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

        {/* ── Sezione Log Attività ── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-sm font-semibold text-white">Log Attività — Ultimi 14 giorni</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLogFilter('all')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  logFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Tutti ({weeklyLogs.length})
              </button>
              <button
                onClick={() => setLogFilter('success')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  logFilter === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Successi ({weeklyLogs.filter(l => l.status === 'success').length})
              </button>
              <button
                onClick={() => setLogFilter('failed')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  logFilter === 'failed' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Falliti ({weeklyLogs.filter(l => l.status === 'failed').length})
              </button>
            </div>
          </div>

          {logGroups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Nessuna esecuzione negli ultimi 14 giorni</p>
            </div>
          ) : (
            <div>
              {logGroups.map(group => (
                <DateGroupRow key={group.dateKey} group={group} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
