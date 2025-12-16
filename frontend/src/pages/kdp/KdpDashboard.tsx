import { useEffect, useState } from 'react';
import { kdpAnalyticsApi } from '../../services/api';
import StatsCard from '../../components/kdp/StatsCard';
import type { KdpDashboardSummary } from '../../types';

export default function KdpDashboard() {
  const [summary, setSummary] = useState<KdpDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await kdpAnalyticsApi.getDashboardSummary();
      setSummary(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-500 font-medium">{error}</p>
          <button
            onClick={loadDashboardData}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatPercentage = (value: number | null) => value !== null ? `${value.toFixed(2)}%` : 'N/A';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">KDP Analytics Dashboard</h1>
        <p className="text-gray-400">
          Period: {new Date(summary.period.startDate).toLocaleDateString()} - {new Date(summary.period.endDate).toLocaleDateString()}
        </p>
      </div>

      {/* Overall Stats Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Stats */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">OVERALL MONTHLY STATS</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-normal pb-2"></th>
                  <th className="text-center text-gray-400 font-normal pb-2">Nov.</th>
                  <th className="text-center text-gray-400 font-normal pb-2">Dec.</th>
                  <th className="text-center text-gray-400 font-normal pb-2">Change</th>
                </tr>
              </thead>
              <tbody className="text-white">
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">AD Orders</td>
                  <td className="py-2 text-center">0</td>
                  <td className="py-2 text-center font-medium">{summary.overall.monthlyStats.adOrders}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Royalties (Gross)</td>
                  <td className="py-2 text-center">$0.00</td>
                  <td className="py-2 text-center font-medium">{formatCurrency(summary.overall.monthlyStats.grossRoyalties)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Spending</td>
                  <td className="py-2 text-center">$0.00</td>
                  <td className="py-2 text-center font-medium">{formatCurrency(summary.overall.monthlyStats.spending)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Royalties (Net)</td>
                  <td className="py-2 text-center">$0.00</td>
                  <td className="py-2 text-center font-medium text-green-500">{formatCurrency(summary.overall.monthlyStats.netRoyalties)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Overall ROI</td>
                  <td className="py-2 text-center">0%</td>
                  <td className="py-2 text-center font-medium">{formatPercentage(summary.overall.monthlyStats.overallROI)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">AMS ROI</td>
                  <td className="py-2 text-center">0%</td>
                  <td className="py-2 text-center font-medium">{formatPercentage(summary.overall.monthlyStats.amsROI)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-400">AMS ACoS</td>
                  <td className="py-2 text-center">-</td>
                  <td className="py-2 text-center font-medium">{formatPercentage(summary.overall.monthlyStats.amsACoS)}</td>
                  <td className="py-2 text-center">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Stats */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">OVERALL DAILY STATS</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-normal pb-2"></th>
                  <th className="text-center text-gray-400 font-normal pb-2">10/12</th>
                  <th className="text-center text-gray-400 font-normal pb-2">11/12</th>
                  <th className="text-center text-gray-400 font-normal pb-2">Change</th>
                </tr>
              </thead>
              <tbody className="text-white">
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">AD Orders</td>
                  <td className="py-2 text-center">0</td>
                  <td className="py-2 text-center font-medium">{summary.overall.dailyStats.adOrders}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Royalties (Gross)</td>
                  <td className="py-2 text-center">$0.00</td>
                  <td className="py-2 text-center font-medium">{formatCurrency(summary.overall.dailyStats.grossRoyalties)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Spending</td>
                  <td className="py-2 text-center">$0.00</td>
                  <td className="py-2 text-center font-medium">{formatCurrency(summary.overall.dailyStats.spending)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Royalties (Net)</td>
                  <td className="py-2 text-center">$0.00</td>
                  <td className="py-2 text-center font-medium text-green-500">{formatCurrency(summary.overall.dailyStats.netRoyalties)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Overall ROI</td>
                  <td className="py-2 text-center">0%</td>
                  <td className="py-2 text-center font-medium">{formatPercentage(summary.overall.dailyStats.overallROI)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">AMS ROI</td>
                  <td className="py-2 text-center">0%</td>
                  <td className="py-2 text-center font-medium">{formatPercentage(summary.overall.dailyStats.amsROI)}</td>
                  <td className="py-2 text-center text-green-500">0%</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-400">AMS ACoS</td>
                  <td className="py-2 text-center">-</td>
                  <td className="py-2 text-center font-medium">{formatPercentage(summary.overall.dailyStats.amsACoS)}</td>
                  <td className="py-2 text-center">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Gross Royalties Estimator"
          value={formatCurrency(summary.widgets.grossRoyaltiesEstimator)}
          variant="primary"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Today's Net Royalties"
          value={formatCurrency(summary.widgets.todayNetRoyalties)}
          subtitle={`Yesterday: ${formatCurrency(summary.widgets.yesterdayNetRoyalties)}`}
          variant="success"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />

        <StatsCard
          title="KENP Reads This Month"
          value={summary.widgets.kenpReadsThisMonth.toLocaleString()}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />

        <StatsCard
          title="Total Live Books"
          value={summary.widgets.totalLiveBooks}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />

        <StatsCard
          title="Daily Avg. Gross Royalties"
          value={formatCurrency(summary.widgets.dailyAvgGrossRoyalties)}
        />

        <StatsCard
          title="Daily Avg. Net Royalties"
          value={formatCurrency(summary.widgets.dailyAvgNetRoyalties)}
        />

        <StatsCard
          title="Estimated Projection"
          value={formatCurrency(summary.widgets.estimatedProjection)}
          variant="primary"
        />

        <StatsCard
          title="Book Sales This Month"
          value={summary.widgets.bookSalesThisMonth}
        />
      </div>

      {/* Top Earners */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Yesterday's Top Earners */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Yesterday's Top Earners</h2>
          {summary.topEarners.yesterday.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No top earners yesterday</p>
          ) : (
            <div className="space-y-3">
              {summary.topEarners.yesterday.map((book, index) => (
                <div key={book.bookId} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-orange-500 font-bold text-lg">#{index + 1}</span>
                    <div>
                      <p className="text-white font-medium">{book.title}</p>
                      <p className="text-xs text-gray-400">{book.asin}</p>
                    </div>
                  </div>
                  <span className="text-green-500 font-semibold">{formatCurrency(book.royalties)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Top Earners */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Today's Top Earners</h2>
          {summary.topEarners.today.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No top earners today</p>
          ) : (
            <div className="space-y-3">
              {summary.topEarners.today.map((book, index) => (
                <div key={book.bookId} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-orange-500 font-bold text-lg">#{index + 1}</span>
                    <div>
                      <p className="text-white font-medium">{book.title}</p>
                      <p className="text-xs text-gray-400">{book.asin}</p>
                    </div>
                  </div>
                  <span className="text-green-500 font-semibold">{formatCurrency(book.royalties)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
