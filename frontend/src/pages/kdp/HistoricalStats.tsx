import { useEffect, useState } from 'react';
import { kdpAnalyticsApi } from '../../services/api';
import FilterBar from '../../components/kdp/FilterBar';
import type { FilterValues } from '../../components/kdp/FilterBar';
import StatsCard from '../../components/kdp/StatsCard';
import ChartContainer from '../../components/kdp/ChartContainer';
import DataTable from '../../components/kdp/DataTable';
import type { Column } from '../../components/kdp/DataTable';
import type { HistoricalStatsData } from '../../types';

export default function HistoricalStats() {
  const [data, setData] = useState<HistoricalStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>({
    timePeriod: 'last30days'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (customFilters?: FilterValues) => {
    try {
      setLoading(true);
      const activeFilters = customFilters || filters;
      const response = await kdpAnalyticsApi.getHistoricalStats({
        startDate: activeFilters.startDate,
        endDate: activeFilters.endDate
      });
      setData(response);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load historical stats');
      console.error('Historical stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    loadData(newFilters);
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  const bookColumns: Column<typeof data.books[0]>[] = [
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
      sortable: true,
      render: (value) => <span className="font-mono text-orange-500">{value}</span>
    },
    {
      key: 'grossRoyalties',
      header: 'Gross Royalties',
      accessor: (book) => book.grossRoyalties,
      sortable: true,
      render: (value) => <span className="text-green-500 font-medium">{formatCurrency(value)}</span>
    },
    {
      key: 'spending',
      header: 'Spending',
      accessor: (book) => book.spending,
      sortable: true,
      render: (value) => <span className="text-red-500 font-medium">{formatCurrency(value)}</span>
    },
    {
      key: 'netRoyalties',
      header: 'Net Royalties',
      accessor: (book) => book.netRoyalties,
      sortable: true,
      render: (value) => (
        <span className={`font-medium ${value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {formatCurrency(value)}
        </span>
      )
    }
  ];

  if (loading && !data) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading historical stats...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-500 font-medium">{error}</p>
          <button
            onClick={() => loadData()}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Historical Stats</h1>
        <p className="text-gray-400">
          Period: {new Date(data.period.startDate).toLocaleDateString()} - {new Date(data.period.endDate).toLocaleDateString()}
        </p>
      </div>

      {/* Filters */}
      <FilterBar onFilterChange={handleFilterChange} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total Gross Royalties"
          value={formatCurrency(data.summary.totalGrossRoyalties)}
          variant="success"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Total Spending"
          value={formatCurrency(data.summary.totalSpending)}
          variant="danger"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Total Net Royalties"
          value={formatCurrency(data.summary.totalNetRoyalties)}
          variant="primary"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />

        <StatsCard
          title="Total Units Sold"
          value={(data.summary.totalPaidUnits + data.summary.totalFreeUnits).toLocaleString()}
          subtitle={`Paid: ${data.summary.totalPaidUnits} | Free: ${data.summary.totalFreeUnits}`}
        />
      </div>

      {/* Best Month Badge */}
      {data.bestMonth && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <p className="text-orange-500 font-medium">
            Best Month: {data.bestMonth}
          </p>
        </div>
      )}

      {/* Timeline Chart */}
      <ChartContainer
        data={data.chartData}
        series={[
          { dataKey: 'spending', name: 'Spending', color: '#EC4899', type: 'line' },
          { dataKey: 'royalties', name: 'Total Royalties', color: '#A855F7', type: 'line' }
        ]}
        xAxisKey="date"
        type="line"
        title="Spending vs Total Royalties"
        height={400}
      />

      {/* Books Table */}
      <DataTable
        data={data.books}
        columns={bookColumns}
        title="Book Performance"
        exportFilename="historical-stats"
        emptyMessage="No book data available for this period"
      />
    </div>
  );
}
