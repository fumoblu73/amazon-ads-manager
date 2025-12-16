import { useEffect, useState } from 'react';
import { kdpAnalyticsApi } from '../../services/api';
import FilterBar from '../../components/kdp/FilterBar';
import type { FilterValues } from '../../components/kdp/FilterBar';
import ChartContainer from '../../components/kdp/ChartContainer';
import DataTable from '../../components/kdp/DataTable';
import type { Column } from '../../components/kdp/DataTable';
import type { BookStatsData } from '../../types';

export default function BookStats() {
  const [data, setData] = useState<BookStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('spending_vs_royalties');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (customFilters?: FilterValues) => {
    try {
      setLoading(true);
      const response = await kdpAnalyticsApi.getBookStats({
        startDate: customFilters?.startDate,
        endDate: customFilters?.endDate,
        metric: selectedMetric
      });
      setData(response);
    } catch (err: any) {
      console.error('Book stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  const columns: Column<typeof data.books[0]>[] = [
    {
      key: 'title',
      header: 'Title',
      accessor: (book) => book.title,
      sortable: true,
      render: (value) => <span className="font-medium text-white">{value}</span>
    },
    {
      key: 'asin',
      header: 'ASIN',
      accessor: (book) => book.asin,
      sortable: true
    },
    {
      key: 'grossRoyalties',
      header: 'Gross Royalties',
      accessor: (book) => book.grossRoyalties,
      sortable: true,
      render: (value) => <span className="text-green-500">{formatCurrency(value)}</span>
    },
    {
      key: 'spending',
      header: 'Spending',
      accessor: (book) => book.spending,
      sortable: true,
      render: (value) => <span className="text-red-500">{formatCurrency(value)}</span>
    }
  ];

  if (loading && !data) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Book Stats</h1>
        <p className="text-gray-400">Total Net Royalties: {formatCurrency(data.totalNetRoyalties)}</p>
        {data.bestDate && <p className="text-sm text-orange-500">Best Date: {data.bestDate}</p>}
      </div>

      <FilterBar onFilterChange={loadData} />

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Graph Selection
        </label>
        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          className="w-full max-w-md px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 outline-none"
        >
          <option value="spending_vs_royalties">Spending vs Total Royalties</option>
          <option value="books_sold">Books Sold</option>
          <option value="kenp_reads">KENP Reads</option>
          <option value="net_royalties">Net Royalties & Trend</option>
        </select>
      </div>

      <ChartContainer
        data={data.chartData}
        series={[{ dataKey: 'value', name: 'Value', color: '#F97316' }]}
        xAxisKey="date"
        type="line"
        title={selectedMetric.replace(/_/g, ' ').toUpperCase()}
        height={400}
      />

      <DataTable
        data={data.books}
        columns={columns}
        title="Book Performance Details"
        exportFilename="book-stats"
      />
    </div>
  );
}
