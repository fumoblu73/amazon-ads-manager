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
  const [loading, setLoading] = useState(false);
  const [loadingFunc, setLoadingFunc] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    loadBooks();
  }, []);

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

    try {
      const data = await automationApi.testFunction(selectedAsin, funcNumber, marketplace);
      setResult({ ...data, functionNumber: funcNumber });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Errore sconosciuto');
    } finally {
      setLoading(false);
      setLoadingFunc(null);
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
        Dopo 15-30 min chiama <strong className="text-white">POST /process-reports</strong> per eseguire le automazioni.
      </p>

      {/* Configurazione */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
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
        <div className="bg-gray-900 rounded-lg p-5 border border-green-700 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-green-400">
              Report sottomessi — {FUNCTION_NAMES[result.functionNumber]?.name}
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
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-400 text-xs">Report sottomessi</div>
              <div className="text-green-400 font-bold text-lg">{result.reportsSubmitted}</div>
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

          <div className="bg-blue-900/30 border border-blue-700 rounded p-3 text-sm text-blue-300">
            {result.message}
          </div>
        </div>
      )}
    </div>
  );
}
