import { useEffect, useState } from 'react';
import { kdpBooksApi } from '../../services/api';
import DataTable from '../../components/kdp/DataTable';
import type { Column } from '../../components/kdp/DataTable';
import type { KdpBook, BookshelfFilters } from '../../types';

interface CookieStatus {
  syncEnabled: boolean;
  cookieAge: number | null;
  cookiesExpired: boolean;
  needsRefresh: boolean;
  daysUntilExpiration: number;
}

export default function Bookshelf() {
  const [books, setBooks] = useState<KdpBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cookieStatus, setCookieStatus] = useState<CookieStatus | null>(null);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState<{ percent: number; text: string } | null>(null);
  const [filters, setFilters] = useState<BookshelfFilters>({
    status: 'all',
    page: 1,
    limit: 25
  });

  useEffect(() => {
    loadBooks();
    checkCookieStatus();
  }, [filters]);

  // Listen for extension messages (sync progress/completion)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const { type } = event.data || {};

      if (type === 'EXTENSION_INSTALLED') setExtensionInstalled(true);
      if (type === 'KDP_BOOKSHELF_SYNC_RESPONSE') {
        if (event.data.success) setSyncStatus('syncing');
        else { setSyncStatus('error'); setError(event.data.error || 'Sync failed'); }
      }
      if (type === 'KDP_SYNC_PROGRESS') {
        setSyncProgress({ percent: event.data.percent, text: event.data.text });
      }
      if (type === 'KDP_BOOKSHELF_SYNC_COMPLETE') {
        setSyncStatus(event.data.success ? 'done' : 'error');
        setSyncProgress(null);
        if (event.data.success) {
          setTimeout(() => { setSyncStatus('idle'); loadBooks(); }, 1500);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    // Check if extension is installed
    window.postMessage({ type: 'KDP_EXTENSION_CHECK' }, '*');
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const triggerBookshelfSync = () => {
    setSyncStatus('syncing');
    setSyncProgress({ percent: 0, text: 'Avvio sync...' });
    window.postMessage({ type: 'KDP_BOOKSHELF_SYNC_REQUEST', marketplace: 'IT', forceRefresh: true }, '*');
  };

  const loadBooks = async () => {
    try {
      setLoading(true);
      const response = await kdpBooksApi.getAll(filters);
      setBooks(response.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load books');
      console.error('Bookshelf error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkCookieStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await kdpBooksApi.getCookieStatus(token);
      setCookieStatus(response.data || null);
    } catch (err) {
      console.error('Failed to check cookie status:', err);
    }
  };

  const columns: Column<KdpBook>[] = [
    {
      key: 'cover',
      header: 'Cover',
      accessor: (book) => book.coverUrl || '',
      sortable: false,
      render: (_value, book) => {
        // Always generate cover URL from ASIN (more reliable than scraped URLs)
        const coverSrc = book.asin ? `https://m.media-amazon.com/images/P/${book.asin}.jpg` : '';
        return (
          <div className="w-12 h-16 flex items-center justify-center">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={book.title}
                className="w-full h-full object-cover rounded shadow-lg"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA0OCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNjQiIGZpbGw9IiMzNzQxNTEiLz48cGF0aCBkPSJNMjQgMjhDMjYuNzYxNCAyOCAyOSAyNS43NjE0IDI5IDIzQzI5IDIwLjIzODYgMjYuNzYxNCAxOCAyNCAxOEMyMS4yMzg2IDE4IDE5IDIwLjIzODYgMTkgMjNDMTkgMjUuNzYxNCAyMS4yMzg2IDI4IDI0IDI4WiIgZmlsbD0iIzlDQTNCRiIvPjxwYXRoIGQ9Ik0zNiA0MEwzMCAzNEwyNCA0MEwxOCAzNEwxMiA0NkgzNlY0MFoiIGZpbGw9IiM5Q0EzQkYiLz48L3N2Zz4=';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gray-800 rounded flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'asin',
      header: 'ASIN',
      accessor: (book) => book.asin,
      sortable: true,
      render: (value) => (
        <a
          href={`https://www.amazon.com/dp/${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-orange-500 hover:text-orange-400 hover:underline"
        >
          {value}
        </a>
      )
    },
    {
      key: 'format',
      header: 'Format',
      accessor: (book) => book.format || 'N/A',
      sortable: true,
      render: (value) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-500">
          {value}
        </span>
      )
    },
    {
      key: 'title',
      header: 'Title',
      accessor: (book) => book.title?.split(':')[0]?.trim() ?? book.title,
      sortable: true,
      render: (value) => (
        <span className="font-medium text-white">{value}</span>
      )
    },
    {
      key: 'author',
      header: 'Author',
      accessor: (book) => book.author || 'N/A',
      sortable: true
    },
    {
      key: 'publishDate',
      header: 'Publication Date',
      accessor: (book) => {
        if (!book.publishDate) return 'N/A';

        // Converti ISO (YYYY-MM-DD) in formato europeo (DD/MM/YYYY)
        const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
        const match = book.publishDate.match(isoPattern);

        if (match) {
          const [_, year, month, day] = match;
          return `${day}/${month}/${year}`;  // Formato europeo: 29/05/2025
        }

        return book.publishDate;  // Fallback per formati non ISO
      },
      sortable: true
    },
    {
      key: 'price',
      header: 'Price',
      accessor: (book) => book.price || 'N/A',
      sortable: true,
      render: (value) => (
        <span className="font-semibold text-orange-500">{value}</span>
      )
    },
    {
      key: 'pageCount',
      header: 'Pages',
      accessor: (book) => book.pageCount || null,
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-300">{value ?? '—'}</span>
      )
    },
    {
      key: 'bsr',
      header: 'BSR (Amazon.com)',
      accessor: (book) => book.bsrRank || null,
      sortable: true,
      render: (value, book) => (
        value ? (
          <div className="text-sm">
            <div className="font-semibold text-green-500">#{value.toLocaleString()}</div>
            {book.bsrCategory && (
              <div className="text-xs text-gray-400 truncate max-w-xs">{book.bsrCategory}</div>
            )}
          </div>
        ) : (
          <span className="text-gray-500 text-sm">N/A</span>
        )
      )
    }
  ];

  if (loading && books.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading books...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Bookshelf & BSRs</h1>
          <p className="text-gray-400">{books.length} books in library</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync KDP button — visible only if extension is installed */}
          {extensionInstalled && (
            <button
              onClick={triggerBookshelfSync}
              disabled={syncStatus === 'syncing'}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                syncStatus === 'syncing' ? 'bg-orange-600/30 text-orange-400 cursor-not-allowed' :
                syncStatus === 'done' ? 'bg-green-600/30 text-green-400' :
                syncStatus === 'error' ? 'bg-red-600/30 text-red-400' :
                'bg-orange-600 text-white hover:bg-orange-500'
              }`}
            >
              {syncStatus === 'syncing' ? (
                <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {syncStatus === 'syncing' ? 'Sync in corso...' : syncStatus === 'done' ? 'Sync completato' : 'Sync KDP'}
            </button>
          )}
          <button
            onClick={loadBooks}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Sync progress bar */}
      {syncStatus === 'syncing' && syncProgress && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">{syncProgress.text}</span>
            <span className="text-sm text-orange-400 font-mono">{syncProgress.percent}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${syncProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Cookie Status Banner */}
      {cookieStatus && cookieStatus.cookiesExpired && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-red-400 font-semibold mb-1">KDP Cookie scaduti</h3>
            <p className="text-red-300 text-sm mb-3">
              I cookie di autenticazione KDP sono scaduti. Il sync automatico non funzionerà fino a quando non li aggiorni.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-400">Come aggiornare:</span>
              <ol className="text-red-300 list-decimal list-inside">
                <li>Apri kdp.amazon.com nel browser</li>
                <li>Clicca sull'estensione Chrome</li>
                <li>Clicca "Sincronizza con KDP"</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {cookieStatus && !cookieStatus.cookiesExpired && cookieStatus.needsRefresh && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-yellow-400 font-semibold mb-1">Cookie KDP in scadenza</h3>
            <p className="text-yellow-300 text-sm">
              I cookie KDP scadranno tra <span className="font-bold">{cookieStatus.daysUntilExpiration} giorn{cookieStatus.daysUntilExpiration === 1 ? 'o' : 'i'}</span>.
              Ti consigliamo di aggiornarli usando l'estensione Chrome per evitare interruzioni nel sync automatico.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            >
              <option value="all">All Books</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search title or ASIN..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-500">✗ {error}</p>
        </div>
      )}

      {/* Books Table */}
      <DataTable
        data={books}
        columns={columns}
        title="KDP Books"
        searchPlaceholder="Search books..."
        exportFilename="kdp-books"
        emptyMessage="No books found. Use 'Sync KDP' in Overview to import books."
      />
    </div>
  );
}
