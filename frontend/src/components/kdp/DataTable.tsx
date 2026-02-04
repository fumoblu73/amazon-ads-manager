import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';

export interface Column<T> {
  key: string;
  header: string;
  accessor: (row: T) => any;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  searchPlaceholder?: string;
  showExport?: boolean;
  exportFilename?: string;
  itemsPerPageOptions?: number[];
  defaultItemsPerPage?: number;
  emptyMessage?: string;
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  searchPlaceholder = 'Search...',
  showExport = true,
  exportFilename = 'export',
  itemsPerPageOptions = [10, 25, 50, 100],
  defaultItemsPerPage = 25,
  emptyMessage = 'No data available'
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map(col => col.key))
  );

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;

    return data.filter(row =>
      columns.some(col => {
        const value = col.accessor(row);
        return String(value).toLowerCase().includes(searchQuery.toLowerCase());
      })
    );
  }, [data, searchQuery, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const column = columns.find(col => col.key === sortConfig.key);
      if (!column) return 0;

      const aValue = column.accessor(a);
      const bValue = column.accessor(b);

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredData, sortConfig, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handleSort = (columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    setSortConfig(current => {
      if (current?.key === columnKey) {
        return current.direction === 'asc'
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  };

  const handleExport = () => {
    const exportData = sortedData.map(row => {
      const exportRow: Record<string, any> = {};
      columns.forEach(col => {
        if (visibleColumns.has(col.key)) {
          exportRow[col.header] = col.accessor(row);
        }
      });
      return exportRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${exportFilename}.xlsx`);
  };

  const toggleColumnVisibility = (columnKey: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnKey)) {
        newSet.delete(columnKey);
      } else {
        newSet.add(columnKey);
      }
      return newSet;
    });
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header Controls */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}

          <div className="flex flex-wrap items-center gap-3">
            {/* Items Per Page */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
              >
                {itemsPerPageOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className="text-sm text-gray-400">entries</span>
            </div>

            {/* Column Visibility */}
            <div className="relative group">
              <button className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors">
                Column Visibility
              </button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 min-w-[200px]">
                {columns.map(col => (
                  <label key={col.key} className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumnVisibility(col.key)}
                      className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-white">{col.header}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Export Button */}
            {showExport && (
              <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors font-medium"
              >
                Export to Excel
              </button>
            )}

            {/* Search */}
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none min-w-[200px]"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              {columns.map(col => (
                visibleColumns.has(col.key) && (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider ${
                      col.sortable ? 'cursor-pointer hover:bg-gray-700 select-none' : ''
                    } ${col.className || ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {col.header}
                      {col.sortable && sortConfig?.key === col.key && (
                        <span className="text-orange-500">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                )
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <tr key={row.id || row.asin || rowIndex} className="hover:bg-gray-800 transition-colors">
                  {columns.map(col => (
                    visibleColumns.has(col.key) && (
                      <td key={col.key} className={`px-6 py-4 text-sm text-gray-300 ${col.className || ''}`}>
                        {col.render ? col.render(col.accessor(row), row) : col.accessor(row)}
                      </td>
                    )
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer - Pagination */}
      {paginatedData.length > 0 && (
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
