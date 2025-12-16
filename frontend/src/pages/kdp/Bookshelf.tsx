import { useEffect, useState } from 'react';
import { kdpBooksApi } from '../../services/api';
import DataTable from '../../components/kdp/DataTable';
import type { Column } from '../../components/kdp/DataTable';
import type { KdpBook, BookshelfFilters } from '../../types';

export default function Bookshelf() {
  const [books, setBooks] = useState<KdpBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState<BookshelfFilters>({
    status: 'all',
    page: 1,
    limit: 25
  });

  useEffect(() => {
    loadBooks();
  }, [filters]);

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

  const handleSync = async () => {
    try {
      setSyncing(true);
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to sync books');
        return;
      }
      await kdpBooksApi.sync(token);
      alert('Books synced successfully!');
      loadBooks();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const columns: Column<KdpBook>[] = [
    {
      key: 'asin',
      header: 'ASIN',
      accessor: (book) => book.asin,
      sortable: true,
      render: (value) => (
        <span className="font-mono text-orange-500">{value}</span>
      )
    },
    {
      key: 'title',
      header: 'Title',
      accessor: (book) => book.title,
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
      key: 'marketplace',
      header: 'Marketplace',
      accessor: (book) => book.marketplace,
      sortable: true,
      render: (value) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-500">
          {value}
        </span>
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
      key: 'publicationDate',
      header: 'Publication Date',
      accessor: (book) => book.publicationDate ? new Date(book.publicationDate).toLocaleDateString() : 'N/A',
      sortable: true
    },
    {
      key: 'kenpc',
      header: 'KENPC',
      accessor: (book) => book.kenpc || 0,
      sortable: true,
      render: (value) => value.toLocaleString()
    },
    {
      key: 'lastSyncDate',
      header: 'Last Sync',
      accessor: (book) => book.lastSyncDate ? new Date(book.lastSyncDate).toLocaleDateString() : 'Never',
      sortable: true
    },
    {
      key: 'createdAt',
      header: 'Added',
      accessor: (book) => new Date(book.createdAt).toLocaleDateString(),
      sortable: true
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
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {syncing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Syncing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Books
            </>
          )}
        </button>
      </div>

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
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {/* Books Table */}
      <DataTable
        data={books}
        columns={columns}
        title="KDP Books"
        searchPlaceholder="Search books..."
        exportFilename="kdp-books"
        emptyMessage="No books found. Click 'Sync Books' to import from KDP."
      />
    </div>
  );
}
