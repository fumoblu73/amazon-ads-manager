import { useState, useEffect } from 'react';
import { automationApi, kdpBooksApi } from '../services/api';

interface BookOption {
  asin: string;
  title: string;
  marketplace: string;
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
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState(0);

  // Carica libri all'avvio
  useEffect(() => {
    loadBooks();
  }, []);

  // Timer durante il loading
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      setElapsed(0);
      interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [loading]);

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
    if (!selectedAsin) {
      setError('Seleziona un ASIN');
      return;
    }

    setLoading(true);
    setLoadingFunc(funcNumber);
    setResult(null);
    setError(null);
    setExpandedResults(new Set());

    try {
      // Costruisci configOverrides solo se ci sono valori
      let configOverrides: any = undefined;
      if (showOverrides) {
        const parsed: any = {};
        for (const [key, value] of Object.entries(overrides)) {
          if (value !== '') {
            if (key === 'skipPart1') {
              parsed[key] = value === 'true';
            } else {
              parsed[key] = parseFloat(value);
            }
          }
        }
        if (Object.keys(parsed).length > 0) {
          configOverrides = parsed;
        }
      }

      const data = await automationApi.testFunction(selectedAsin, funcNumber, marketplace, dryRun, configOverrides);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Errore sconosciuto');
    } finally {
      setLoading(false);
      setLoadingFunc(null);
    }
  };

  const copyJson = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    if (status === 'executed') return 'border-green-600 bg-green-900/20';
    if (status === 'skipped') return 'border-gray-600 bg-gray-900/20';
    return 'border-red-600 bg-red-900/20';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'executed') return 'bg-green-600 text-white';
    if (status === 'skipped') return 'bg-gray-600 text-white';
    return 'bg-red-600 text-white';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Test Funzioni Automazione</h1>

      {/* Configurazione */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* ASIN */}
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
                  {b.asin} - {b.title?.substring(0, 50)}{(b.title?.length || 0) > 50 ? '...' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Marketplace */}
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

          {/* Dry Run */}
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

        {/* Config Overrides */}
        <div className="mt-4">
          <button
            onClick={() => setShowOverrides(!showOverrides)}
            className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
          >
            <span>{showOverrides ? '\u25BC' : '\u25B6'}</span>
            Config Overrides (opzionale)
          </button>

          {showOverrides && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'clicksNegative', label: 'clicksNegative', placeholder: '10' },
                { key: 'spendNegative', label: 'spendNegative', placeholder: '10' },
                { key: 'minOrders', label: 'minOrders (F5)', placeholder: '1' },
                { key: 'skipPart1', label: 'skipPart1 (F4)', placeholder: 'true/false' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={overrides[key] || ''}
                    onChange={(e) => setOverrides(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          )}
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

      {/* Errore */}
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Risultati */}
      {result && (
        <div className="space-y-4">
          {/* Header risultato */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-white">
                Risultato {FUNCTION_NAMES[result.functionNumber]?.name}
                {result.dryRun && <span className="ml-2 text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">DRY RUN</span>}
              </h2>
              <button
                onClick={copyJson}
                className="text-sm text-orange-400 hover:text-orange-300 border border-orange-600 rounded px-3 py-1"
              >
                Copia JSON
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="text-gray-400">ASIN: <span className="text-white">{result.asin}</span></div>
              <div className="text-gray-400">Marketplace: <span className="text-white">{result.marketplace}</span></div>
              <div className="text-gray-400">Campagne: <span className="text-white">{result.campaignsFound}</span></div>
              <div className="text-gray-400">FAST ACoS: <span className="text-white">{result.book?.fastAcos}%</span></div>
            </div>
          </div>

          {/* Card per ogni campagna */}
          {result.results?.map((r: any, idx: number) => (
            <div
              key={idx}
              className={`rounded-lg p-4 border ${getStatusColor(r.status)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-white font-semibold">{r.campaignName}</span>
                  <span className="text-gray-500 text-sm ml-2">({r.campaignId})</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(r.status)}`}>
                  {r.status}
                </span>
              </div>

              {r.status === 'skipped' && (
                <p className="text-gray-400 text-sm mt-2">{r.reason}</p>
              )}

              {r.status === 'executed' && r.result && (
                <div className="mt-3">
                  {/* Statistiche principali */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {renderResultStats(r.result)}
                  </div>

                  {/* Errori */}
                  {r.result.errors?.length > 0 && (
                    <div className="mt-2 p-2 bg-red-900/30 rounded text-sm text-red-400">
                      {r.result.errors.map((e: string, i: number) => (
                        <div key={i}>{e}</div>
                      ))}
                    </div>
                  )}

                  {/* Toggle dettagli */}
                  {r.result.details && (
                    <button
                      onClick={() => toggleExpand(idx)}
                      className="mt-2 text-sm text-orange-400 hover:text-orange-300"
                    >
                      {expandedResults.has(idx) ? '\u25BC Nascondi dettagli' : '\u25B6 Mostra dettagli'}
                    </button>
                  )}

                  {expandedResults.has(idx) && r.result.details && (
                    <div className="mt-2 bg-gray-800/50 rounded p-3 text-xs overflow-x-auto">
                      <pre className="text-gray-300 whitespace-pre-wrap">
                        {JSON.stringify(r.result.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderResultStats(result: any): React.ReactNode[] {
  const stats: React.ReactNode[] = [];

  // Func3-style
  if (result.keywordsProcessed !== undefined) {
    stats.push(<Stat key="kp" label="Keywords/Targets" value={result.keywordsProcessed} />);
    stats.push(<Stat key="bp" label="Bid aggiornati" value={result.keywordsBidUpdated} />);
    stats.push(<Stat key="pa" label="Pausati" value={result.keywordsPaused} />);
    stats.push(<Stat key="tf" label="Timeframe" value={`${result.timeframeDays}gg`} />);
  }

  // Func4-style
  if (result.targetingGroupsProcessed !== undefined) {
    stats.push(<Stat key="tg" label="Targeting groups" value={result.targetingGroupsProcessed} />);
    stats.push(<Stat key="bu" label="Bid aggiornati" value={result.targetingGroupsBidUpdated} />);
    stats.push(<Stat key="tp" label="Pausati" value={result.targetingGroupsPaused} />);
    stats.push(<Stat key="nk" label="Neg. keywords" value={result.negativeKeywordsAdded} />);
    stats.push(<Stat key="nt" label="Neg. targets" value={result.negativeTargetsAdded} />);
    stats.push(<Stat key="tf4" label="Timeframe" value={`${result.timeframeDays}gg`} />);
  }

  // Func5-style
  if (result.searchTermsProcessed !== undefined && result.keywordsAdded !== undefined) {
    stats.push(<Stat key="st" label="Search terms" value={result.searchTermsProcessed} />);
    stats.push(<Stat key="ka" label="Keywords aggiunte" value={result.keywordsAdded} />);
    stats.push(<Stat key="ta" label="Targets aggiunti" value={result.targetsAdded} />);
  }

  // Func1-style
  if (result.keywordsIncreased !== undefined) {
    stats.push(<Stat key="ki" label="Bid incrementati" value={result.keywordsIncreased} />);
    stats.push(<Stat key="ks" label="Skippati" value={result.keywordsSkipped} />);
  }

  // Func2-style
  if (result.placementAdjustments !== undefined) {
    stats.push(<Stat key="pl" label="Placement adj." value={JSON.stringify(result.placementAdjustments)} />);
  }

  if (stats.length === 0) {
    stats.push(<Stat key="raw" label="Risultato" value="Vedi dettagli" />);
  }

  return stats;
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-gray-800/50 rounded p-2">
      <div className="text-gray-500 text-xs">{label}</div>
      <div className="text-white font-semibold">{String(value)}</div>
    </div>
  );
}
