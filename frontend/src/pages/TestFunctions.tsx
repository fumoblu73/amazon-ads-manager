import { useState, useEffect, useRef } from 'react';
import { automationApi, kdpBooksApi } from '../services/api';

interface BookOption {
  asin: string;
  title: string;
  marketplace: string;
}

interface SimLog {
  campaignName: string;
  ruleName: string;
  status: string;
  summary: string;
  bookTitle?: string;
}

interface ReadyNotification {
  functionNumber: number;
  asin: string;
  marketplace: string;
  reportIds: string[];
  readyAt: Date;
  isDryRun?: boolean;
  processing?: boolean;
  processed?: boolean;
  simLogs?: SimLog[];
}

const FUNCTION_NAMES: Record<number, { name: string; description: string }> = {
  1: { name: 'F1 Progressive Bidding', description: 'Incrementa bid per keyword/target senza click' },
  2: { name: 'F2 Placement', description: 'Ottimizza placement (top of search, product pages)' },
  3: { name: 'F3 Targeting', description: 'Ottimizza bid e pausa keyword/target per performance' },
  4: { name: 'F4 Auto Ad', description: 'Ottimizza targeting groups auto + negative targeting' },
  5: { name: 'F5 Feeding', description: 'Distribuisce search terms performanti tra campagne' },
};

export default function TestFunctions() {
  const [books, setBooks] = useState<BookOption[]>([]);
  const [selectedAsin, setSelectedAsin] = useState('');
  const [marketplace, setMarketplace] = useState('US');
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingFunc, setLoadingFunc] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Polling state
  const [pollingReportIds, setPollingReportIds] = useState<string[]>([]);
  const [pollingFunc, setPollingFunc] = useState<number | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persistent notifications (don't auto-dismiss)
  const [notifications, setNotifications] = useState<ReadyNotification[]>([]);

  useEffect(() => {
    loadBooks();
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // Timer during loading
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      setElapsed(0);
      interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Polling: check Amazon report status every 60s
  const startPolling = (reportIds: string[], mkt: string, funcNum: number, isDryRun?: boolean) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setPollingReportIds(reportIds);
    setPollingFunc(funcNum);

    const checkStatus = async () => {
      try {
        const data = await automationApi.getReportStatus(reportIds, mkt);
        console.log('[Polling] report-status:', data);
        if (data.allCompleted) {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          setPollingReportIds([]);
          setPollingFunc(null);
          setNotifications(prev => [...prev, {
            functionNumber: funcNum,
            asin: selectedAsin,
            marketplace: mkt,
            reportIds,
            readyAt: new Date(),
            isDryRun,
          }]);
        } else if (data.anyFailed) {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          setPollingReportIds([]);
          setPollingFunc(null);
          setError('Uno o più report Amazon sono falliti. Riprova.');
        }
      } catch (err) {
        console.error('[Polling] errore report-status:', err);
      }
    };

    // Prima poll immediata, poi ogni 60s
    checkStatus();
    pollingIntervalRef.current = setInterval(checkStatus, 60_000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = null;
    setPollingReportIds([]);
    setPollingFunc(null);
  };

  const loadBooks = async () => {
    try {
      const response = await kdpBooksApi.getAll();
      const bookList = (response.data || []).map((b: any) => ({
        asin: b.asin,
        title: b.title,
        marketplace: b.marketplace || 'US',
      }));
      setBooks(bookList);
      if (bookList.length > 0) {
        setSelectedAsin(bookList[0].asin);
        setMarketplace(bookList[0].marketplace);
      }
    } catch (err: any) {
      setError('Errore caricamento libri: ' + (err.message || 'Unknown'));
    }
  };

  const runTest = async (funcNumber: number) => {
    if (!selectedAsin) { setError('Seleziona un ASIN'); return; }
    stopPolling();
    setLoading(true);
    setLoadingFunc(funcNumber);
    setResult(null);
    setError(null);

    try {
      const data = await automationApi.testFunction(selectedAsin, funcNumber, marketplace, dryRun);
      setResult({ ...data, functionNumber: funcNumber });

      // Avvia polling se ci sono reportIds (sia dry run che real)
      if (data.reportIds?.length > 0) {
        startPolling(data.reportIds, marketplace, funcNumber, dryRun);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Errore sconosciuto');
    } finally {
      setLoading(false);
      setLoadingFunc(null);
    }
  };

  const dismissNotification = (idx: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== idx));
  };

  const runProcessReports = async (idx: number) => {
    const n = notifications[idx];
    setNotifications(prev => prev.map((item, i) => i === idx ? { ...item, processing: true } : item));
    try {
      if (n.isDryRun) {
        const data = await automationApi.runProcessReportsSync();
        setNotifications(prev => prev.map((item, i) => i === idx ? { ...item, processing: false, processed: true, simLogs: data.logs } : item));
      } else {
        await automationApi.runProcessReports();
        setNotifications(prev => prev.map((item, i) => i === idx ? { ...item, processing: false, processed: true } : item));
      }
    } catch (err: any) {
      setError('Errore process-reports: ' + (err.response?.data?.error || err.message));
      setNotifications(prev => prev.map((item, i) => i === idx ? { ...item, processing: false } : item));
    }
  };

  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<any>(null);

  const testEmail = async () => {
    setEmailLoading(true);
    setEmailResult(null);
    try {
      const data = await automationApi.testEmail();
      setEmailResult(data);
    } catch (err: any) {
      setEmailResult({ success: false, message: err.response?.data?.message || err.message });
    } finally {
      setEmailLoading(false);
    }
  };

  const copyJson = () => {
    if (result) navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Test Funzioni Automazione</h1>
      <p className="text-gray-400 text-sm mb-6">
        Sottomette i report ad Amazon e li salva in <code className="text-orange-400">pending_reports</code>.
        Riceverai una notifica quando i report sono pronti per il processing.
      </p>

      {/* Notifiche persistenti */}
      {notifications.map((n, idx) => (
        <div key={idx} className={`mb-4 border rounded-lg p-4 flex items-start justify-between gap-4 ${n.processed ? 'bg-blue-900/30 border-blue-600' : 'bg-green-900/40 border-green-500'}`}>
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-sm mb-1 ${n.processed ? 'text-blue-400' : 'text-green-400'}`}>
              {n.processed ? (n.isDryRun ? '🔬 Simulazione completata — ' : '✅ Automazioni eseguite — ') : '🟢 Report pronti — '}
              {FUNCTION_NAMES[n.functionNumber]?.name}
              {n.isDryRun && <span className="ml-2 text-xs text-yellow-400 font-normal">DRY RUN</span>}
            </div>
            {!n.processed && (
              <div className="text-green-300 text-sm mb-2">
                I report Amazon sono COMPLETED. Clicca per {n.isDryRun ? 'simulare le automazioni' : 'eseguire le automazioni'}.
              </div>
            )}
            {n.processed && !n.isDryRun && (
              <div className="text-blue-300 text-sm mb-2">Processing avviato in background. Controlla i log automazioni per i risultati.</div>
            )}
            {n.processed && n.isDryRun && n.simLogs && n.simLogs.length > 0 && (
              <div className="mt-2 space-y-1">
                {n.simLogs.map((log, li) => (
                  <div key={li} className={`text-xs rounded px-3 py-1.5 border ${log.status === 'success' ? 'bg-gray-800 border-gray-700' : 'bg-red-900/20 border-red-700'}`}>
                    <span className="text-white font-medium">{log.campaignName}</span>
                    <span className="text-gray-500 ml-2">{log.ruleName}</span>
                    <div className="text-yellow-300 mt-0.5">{log.summary}</div>
                  </div>
                ))}
              </div>
            )}
            {n.processed && n.isDryRun && (!n.simLogs || n.simLogs.length === 0) && (
              <div className="text-gray-400 text-sm mt-1">Nessuna campagna processata (forse i report non erano ancora in stato completed).</div>
            )}
            <div className="text-gray-400 text-xs mt-2">
              {n.asin} · {n.marketplace} · {n.reportIds.length} report · {n.readyAt.toLocaleTimeString()}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {!n.processed && (
              <button
                onClick={() => runProcessReports(idx)}
                disabled={n.processing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-semibold disabled:opacity-50 whitespace-nowrap"
              >
                {n.processing ? (n.isDryRun ? 'Simulazione...' : 'Avvio...') : (n.isDryRun ? 'Simula Automazioni' : 'Esegui Automazioni')}
              </button>
            )}
            <button
              onClick={() => dismissNotification(idx)}
              className="text-gray-400 hover:text-white text-sm"
              title="Chiudi"
            >
              ✕ Chiudi
            </button>
          </div>
        </div>
      ))}

      {/* Polling indicator */}
      {pollingReportIds.length > 0 && (
        <div className="mb-4 bg-blue-900/30 border border-blue-700 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-4 w-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-blue-300 text-sm">
              In attesa che Amazon generi i report ({pollingReportIds.length} report)… controllo ogni 60s
              {pollingFunc && ` — ${FUNCTION_NAMES[pollingFunc]?.name}`}
            </span>
          </div>
          <button onClick={stopPolling} className="text-gray-400 hover:text-white text-sm">Annulla</button>
        </div>
      )}

      {/* Configurazione */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Libro (ASIN)</label>
            <select
              value={selectedAsin}
              onChange={(e) => {
                setSelectedAsin(e.target.value);
                const book = books.find(b => b.asin === e.target.value);
                if (book) setMarketplace(book.marketplace);
              }}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm"
            >
              {books.length === 0 && <option value="">Nessun libro trovato</option>}
              {books.map(b => (
                <option key={b.asin} value={b.asin}>
                  {b.asin} - {b.title?.substring(0, 40)}{(b.title?.length || 0) > 40 ? '...' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Marketplace</label>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm"
            >
              {['US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'JP', 'AU'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-white">Dry Run</span>
            </label>
            {!dryRun && (
              <span className="text-xs text-red-400 font-semibold">MODIFICHE REALI</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottoni funzioni */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[1, 2, 3, 4, 5].map(num => (
          <button
            key={num}
            onClick={() => runTest(num)}
            disabled={loading}
            className={`p-3 rounded-lg border text-left transition-all ${
              loading
                ? 'opacity-50 cursor-not-allowed border-gray-700 bg-gray-900'
                : 'border-orange-600 bg-gray-900 hover:bg-orange-900/30 cursor-pointer'
            }`}
          >
            <div className="text-sm font-bold text-orange-400">
              {loadingFunc === num ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {elapsed}s
                </span>
              ) : (
                FUNCTION_NAMES[num].name
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">{FUNCTION_NAMES[num].description}</div>
          </button>
        ))}
      </div>

      {/* Test Email */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-800 flex items-center justify-between">
        <div>
          <span className="text-white font-semibold text-sm">Test Notifica Email</span>
          <span className="text-gray-500 text-xs ml-2">Invia un'email di prova per verificare la configurazione SMTP</span>
        </div>
        <div className="flex items-center gap-3">
          {emailResult && (
            <span className={`text-xs ${emailResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {emailResult.message}
            </span>
          )}
          <button
            onClick={testEmail}
            disabled={emailLoading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-semibold disabled:opacity-50"
          >
            {emailLoading ? 'Invio...' : 'Invia Email Test'}
          </button>
        </div>
      </div>

      {/* Errore */}
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Risultato */}
      {result && (
        <div className={`bg-gray-900 rounded-lg p-5 border space-y-4 ${result.dryRun ? 'border-yellow-700' : 'border-green-700'}`}>
          <div className="flex justify-between items-center">
            <h2 className={`text-lg font-bold ${result.dryRun ? 'text-yellow-400' : 'text-green-400'}`}>
              {result.dryRun ? 'DRY RUN — ' : ''}{FUNCTION_NAMES[result.functionNumber]?.name}
            </h2>
            <button
              onClick={copyJson}
              className="text-sm text-orange-400 hover:text-orange-300 border border-orange-600 rounded px-3 py-1"
            >
              Copia JSON
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-400 text-xs">ASIN</div>
              <div className="text-white font-semibold">{result.asin}</div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-400 text-xs">Marketplace</div>
              <div className="text-white font-semibold">{result.marketplace}</div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-400 text-xs">Campagne trovate</div>
              <div className="text-white font-semibold">{result.campaignsFound}</div>
            </div>
            <div className={`rounded p-3 border ${result.dryRun ? 'bg-yellow-900/30 border-yellow-700' : 'bg-gray-800 border-transparent'}`}>
              <div className="text-gray-400 text-xs">Report sottomessi</div>
              <div className={`font-bold text-lg ${result.dryRun ? 'text-yellow-400' : 'text-green-400'}`}>
                {result.reportsSubmitted ?? 0}
                {result.dryRun && <span className="text-xs font-normal ml-2">DRY RUN</span>}
              </div>
            </div>
          </div>

          {result.book && (
            <div className="text-sm text-gray-400">
              Libro: <span className="text-white">{result.book.title}</span>
              {result.book.fastAcos && (
                <span className="ml-3">FAST ACoS: <span className="text-orange-400">{result.book.fastAcos}%</span></span>
              )}
            </div>
          )}

          <div className={`rounded p-3 text-sm ${result.dryRun ? 'bg-yellow-900/20 border border-yellow-700 text-yellow-300' : 'bg-blue-900/30 border border-blue-700 text-blue-300'}`}>
            {result.message}
          </div>
        </div>
      )}
    </div>
  );
}
