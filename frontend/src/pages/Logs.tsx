import { useEffect, useState } from 'react';
import { logsApi } from '../services/api';
import type { AutomationLog } from '../types';

// ─── Tipi per la struttura raggruppata ───────────────────────────────────────

interface BookGroup {
  bookKey: string;        // bookAsin oppure targetName (fallback per log vecchi)
  bookLabel: string;      // bookTitle oppure targetName
  bookAsin: string | null;
  logs: AutomationLog[];
}

interface DateGroup {
  dateKey: string;        // YYYY-MM-DD
  dateLabel: string;      // "Lun 17 Feb 2026"
  books: BookGroup[];
  totalLogs: number;
  successCount: number;
  failedCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGroups(logs: AutomationLog[]): DateGroup[] {
  const byDate = new Map<string, AutomationLog[]>();

  for (const log of logs) {
    const dateKey = log.createdAt.slice(0, 10); // YYYY-MM-DD
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(log);
  }

  const dateGroups: DateGroup[] = [];

  for (const [dateKey, dateLogs] of byDate) {
    // Raggruppa per libro all'interno della data
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

    // Ordina libri: falliti in cima, poi per nome
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
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    dateGroups.push({
      dateKey,
      dateLabel,
      books,
      totalLogs: dateLogs.length,
      successCount,
      failedCount,
    });
  }

  // Ordina date decrescente (più recente prima)
  dateGroups.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return dateGroups;
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Componente riga singolo log ─────────────────────────────────────────────

function LogRow({ log }: { log: AutomationLog }) {
  const hasBidChange = log.oldValue != null && log.newValue != null;

  return (
    <div className={`flex flex-col gap-1 px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${log.status === 'failed' ? 'bg-red-50/50' : ''}`}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Orario */}
        <span className="text-xs text-gray-400 w-10 shrink-0">{formatTime(log.createdAt)}</span>

        {/* Funzioni */}
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded shrink-0">
          {log.ruleName}
        </span>

        {/* Target (campaign name) */}
        <span className="text-xs text-gray-600 truncate max-w-[280px]" title={log.targetName}>
          {log.targetName}
        </span>

        {/* Bid change */}
        {hasBidChange && (
          <span className="flex items-center gap-1 text-xs font-medium text-gray-700 shrink-0">
            <span className="text-gray-400">${Number(log.oldValue).toFixed(2)}</span>
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900">${Number(log.newValue).toFixed(2)}</span>
          </span>
        )}

        {/* Stato */}
        <span className={`ml-auto shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded ${
          log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {log.status === 'success' ? 'OK' : 'ERR'}
        </span>
      </div>

      {/* Reason */}
      {log.reason && (
        <div className="pl-[52px] text-xs text-gray-400">
          {log.reason}
        </div>
      )}

      {/* Error message */}
      {log.status === 'failed' && log.errorMessage && (
        <div className="pl-[52px] text-xs text-red-600 bg-red-50 rounded px-2 py-1 mt-0.5">
          {log.errorMessage}
        </div>
      )}
    </div>
  );
}

// ─── Componente gruppo libro ──────────────────────────────────────────────────

function BookGroupRow({ group }: { group: BookGroup }) {
  const [open, setOpen] = useState(true);
  const hasFailures = group.logs.some(l => l.status === 'failed');
  const successCount = group.logs.filter(l => l.status === 'success').length;
  const failedCount = group.logs.filter(l => l.status === 'failed').length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
      {/* Header libro */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          hasFailures ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        {/* Icona libro */}
        <svg className={`w-4 h-4 shrink-0 ${hasFailures ? 'text-red-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>

        {/* Titolo libro */}
        <span className="text-sm font-medium text-gray-800 flex-1 truncate">
          {group.bookLabel}
        </span>

        {/* ASIN badge */}
        {group.bookAsin && (
          <span className="text-xs text-gray-400 font-mono shrink-0">{group.bookAsin}</span>
        )}

        {/* Contatori */}
        <div className="flex items-center gap-1.5 shrink-0">
          {successCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
              {successCount} OK
            </span>
          )}
          {failedCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded">
              {failedCount} ERR
            </span>
          )}
        </div>

        {/* Chevron */}
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Log rows */}
      {open && (
        <div className="bg-white">
          {group.logs.map(log => <LogRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}

// ─── Componente gruppo data ───────────────────────────────────────────────────

function DateGroupRow({ group, defaultOpen }: { group: DateGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasFailures = group.failedCount > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
      {/* Header data */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors ${
          hasFailures ? 'bg-red-50 hover:bg-red-100' : 'bg-blue-50 hover:bg-blue-100'
        }`}
      >
        {/* Icona calendario */}
        <svg className={`w-5 h-5 shrink-0 ${hasFailures ? 'text-red-500' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>

        {/* Data */}
        <span className="text-sm font-bold text-gray-800 capitalize flex-1">
          {group.dateLabel}
        </span>

        {/* Sommario */}
        <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
          <span>{group.books.length} libr{group.books.length === 1 ? 'o' : 'i'}</span>
          <span>·</span>
          <span>{group.totalLogs} log</span>
        </div>

        {/* Badge stato */}
        <div className="flex items-center gap-1.5 shrink-0">
          {group.successCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
              {group.successCount} OK
            </span>
          )}
          {group.failedCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
              {group.failedCount} ERR
            </span>
          )}
        </div>

        {/* Chevron */}
        <svg className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Book groups */}
      {open && (
        <div className="p-4">
          {group.books.map(book => (
            <BookGroupRow key={book.bookKey} group={book} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function Logs() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await logsApi.getRecent(200);
        if (response.success && response.data) {
          setLogs(response.data);
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (statusFilter === 'all') return true;
    return log.status === statusFilter;
  });

  const groups = buildGroups(filteredLogs);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600">Caricamento log...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-8 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h1 className="text-2xl font-bold text-white uppercase">Log Attività</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Tutti ({logs.length})
          </button>
          <button
            onClick={() => setStatusFilter('success')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              statusFilter === 'success'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Successi ({logs.filter(l => l.status === 'success').length})
          </button>
          <button
            onClick={() => setStatusFilter('failed')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              statusFilter === 'failed'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Falliti ({logs.filter(l => l.status === 'failed').length})
          </button>
        </div>
      </div>

      {/* Content */}
      {groups.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">Nessun log trovato</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {groups.map((group, i) => (
            <DateGroupRow
              key={group.dateKey}
              group={group}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
