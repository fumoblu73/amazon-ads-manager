import { useState } from 'react';
import { kdpAnalyticsApi } from '../../services/api';
import ChartContainer from '../../components/kdp/ChartContainer';
import type { MonthComparisonData } from '../../types';

export default function MonthComparison() {
  const [data, setData] = useState<MonthComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [month1, setMonth1] = useState('2024-11');
  const [month2, setMonth2] = useState('2024-12');

  const loadComparison = async () => {
    try {
      setLoading(true);
      const response = await kdpAnalyticsApi.getMonthComparison(month1, month2);
      setData(response);
    } catch (err: any) {
      console.error('Month comparison error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | undefined | null) => value != null ? `$${value.toFixed(2)}` : '$0.00';
  const formatPercentage = (value: number | null | undefined) => value != null ? `${value.toFixed(2)}%` : 'N/A';
  const formatChange = (change: number | null | undefined) => {
    if (change == null) return 'N/A';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white mb-6">Month vs. Month Stats</h1>

      {/* Month Selectors */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              First Month to Compare
            </label>
            <input
              type="month"
              value={month1}
              onChange={(e) => setMonth1(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Second Month to Compare
            </label>
            <input
              type="month"
              value={month2}
              onChange={(e) => setMonth2(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            />
          </div>

          <button
            onClick={loadComparison}
            disabled={loading}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Apply Filters'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Comparison Bar Chart */}
          <ChartContainer
            data={data.chartData}
            series={[
              { dataKey: 'month1Value', name: data.month1, color: '#F97316', type: 'bar' },
              { dataKey: 'month2Value', name: data.month2, color: '#A855F7', type: 'bar' }
            ]}
            xAxisKey="day"
            type="mixed"
            title="Monthly Comparison"
            height={400}
          />

          {/* Comparison Table */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Comparison Table</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Metric
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {data.month1}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {data.month2}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    <tr className="hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">Royalty (Gross)</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatCurrency(data.comparisonTable.royaltyGross.month1)}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatCurrency(data.comparisonTable.royaltyGross.month2)}</td>
                      <td className={`px-6 py-4 text-sm font-medium ${data.comparisonTable.royaltyGross.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatChange(data.comparisonTable.royaltyGross.change)}
                      </td>
                    </tr>

                    <tr className="hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">Spending</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatCurrency(data.comparisonTable.spending.month1)}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatCurrency(data.comparisonTable.spending.month2)}</td>
                      <td className={`px-6 py-4 text-sm font-medium ${data.comparisonTable.spending.change <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatChange(data.comparisonTable.spending.change)}
                      </td>
                    </tr>

                    <tr className="hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">Royalty (Net)</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatCurrency(data.comparisonTable.royaltyNet.month1)}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatCurrency(data.comparisonTable.royaltyNet.month2)}</td>
                      <td className={`px-6 py-4 text-sm font-medium ${data.comparisonTable.royaltyNet.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatChange(data.comparisonTable.royaltyNet.change)}
                      </td>
                    </tr>

                    <tr className="hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">Overall ROI</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatPercentage(data.comparisonTable.overallROI.month1)}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatPercentage(data.comparisonTable.overallROI.month2)}</td>
                      <td className={`px-6 py-4 text-sm font-medium ${(data.comparisonTable.overallROI.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatChange(data.comparisonTable.overallROI.change)}
                      </td>
                    </tr>

                    <tr className="hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">AMS ROI</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatPercentage(data.comparisonTable.amsROI.month1)}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatPercentage(data.comparisonTable.amsROI.month2)}</td>
                      <td className={`px-6 py-4 text-sm font-medium ${(data.comparisonTable.amsROI.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatChange(data.comparisonTable.amsROI.change)}
                      </td>
                    </tr>

                    <tr className="hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">AMS ACoS</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatPercentage(data.comparisonTable.amsACoS.month1)}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{formatPercentage(data.comparisonTable.amsACoS.month2)}</td>
                      <td className={`px-6 py-4 text-sm font-medium ${(data.comparisonTable.amsACoS.change || 0) <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatChange(data.comparisonTable.amsACoS.change)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-12 text-center">
          <p className="text-gray-400">Select two months and click "Apply Filters" to compare</p>
        </div>
      )}
    </div>
  );
}
