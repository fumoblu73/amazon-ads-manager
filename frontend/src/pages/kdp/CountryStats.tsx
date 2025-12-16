import { useEffect, useState } from 'react';
import { kdpAnalyticsApi } from '../../services/api';
import FilterBar from '../../components/kdp/FilterBar';
import type { FilterValues } from '../../components/kdp/FilterBar';
import ChartContainer from '../../components/kdp/ChartContainer';
import DataTable from '../../components/kdp/DataTable';
import type { Column } from '../../components/kdp/DataTable';
import type { CountryStatsData } from '../../types';

export default function CountryStats() {
  const [data, setData] = useState<CountryStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (customFilters?: FilterValues) => {
    try {
      setLoading(true);
      const response = await kdpAnalyticsApi.getCountryStats(
        customFilters?.startDate,
        customFilters?.endDate
      );
      setData(response);
    } catch (err: any) {
      console.error('Country stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatPercentage = (value: number | null) => value !== null ? `${value.toFixed(2)}%` : 'N/A';

  const countryColumns: Column<any>[] = [
    {
      key: 'marketplace',
      header: 'Marketplace',
      accessor: (country) => country.marketplace,
      sortable: true,
      render: (value, row) => (
        <div>
          <span className="font-medium text-white">{row.countryName}</span>
          <span className="ml-2 text-xs text-gray-400">({value})</span>
        </div>
      )
    },
    {
      key: 'royalties',
      header: 'Royalties',
      accessor: (country) => country.royalties,
      sortable: true,
      render: (value) => <span className="text-green-500 font-medium">{formatCurrency(value)}</span>
    },
    {
      key: 'spending',
      header: 'Spending',
      accessor: (country) => country.spending,
      sortable: true,
      render: (value) => <span className="text-red-500 font-medium">{formatCurrency(value)}</span>
    },
    {
      key: 'sales',
      header: 'Sales',
      accessor: (country) => country.sales,
      sortable: true,
      render: (value) => value.toLocaleString()
    }
  ];

  if (loading && !data) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white">No data available</h1>
        <p className="text-gray-400 mt-2">Failed to load country stats</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Country Stats</h1>
        <p className="text-gray-400">
          Period: {new Date(data.period.startDate).toLocaleDateString()} - {new Date(data.period.endDate).toLocaleDateString()}
        </p>
      </div>

      <FilterBar onFilterChange={loadData} />

      {/* Total Global Card */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-white">Total Global</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase mb-1">Gross</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(data.totalGlobal.gross)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase mb-1">Overall ROI</p>
            <p className="text-2xl font-bold text-orange-500">{formatPercentage(data.totalGlobal.overallROI)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase mb-1">AMS ROI</p>
            <p className="text-2xl font-bold text-purple-500">{formatPercentage(data.totalGlobal.amsROI)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase mb-1">AMS ROAS</p>
            <p className="text-2xl font-bold text-green-500">{formatPercentage(data.totalGlobal.amsROAS)}</p>
          </div>
        </div>
      </div>

      <ChartContainer
        data={data.chartData}
        series={[
          { dataKey: 'US', name: 'United States', color: '#3B82F6' },
          { dataKey: 'UK', name: 'United Kingdom', color: '#8B5CF6' },
          { dataKey: 'DE', name: 'Germany', color: '#10B981' },
          { dataKey: 'FR', name: 'France', color: '#F59E0B' },
          { dataKey: 'IT', name: 'Italy', color: '#EF4444' },
          { dataKey: 'ES', name: 'Spain', color: '#EC4899' }
        ]}
        xAxisKey="date"
        type="line"
        title="Country vs Gross Royalties"
        height={400}
      />

      <DataTable
        data={data.countriesData}
        columns={countryColumns}
        title="Performance by Country"
        exportFilename="country-stats"
      />
    </div>
  );
}
