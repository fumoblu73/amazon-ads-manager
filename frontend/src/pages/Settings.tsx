import { useState } from 'react';

export default function Settings() {
  const [settings] = useState({
    func1: {
      enabled: true,
      bidIncrease: 0.02,
      frequency: 3,
      impressions: 20,
      clicks: 0,
    },
    func2: {
      enabled: true,
      frequency: 7,
      timeframeWeeks: 4,
    },
    func3: {
      enabled: true,
      frequency: 3,
      timeframeA: 2000,
      timeframeB: 3000,
      timeframeC: 5000,
      clicksPause: 10,
      clicks65days: 30,
    },
    func4: {
      enabled: true,
      frequency: 7,
      timeframeA: 1000,
      timeframeB: 3000,
      timeframeC: 5000,
      clicksNegative: 10,
      spendNegative: 10,
    },
    func5: {
      enabled: true,
      frequency: 7,
      minOrders: 1,
      bidBroad: 0.30,
      bidExact: 0.50,
      bidPhrase: 0.40,
      bidExpanded: 0.30,
    },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Automation Settings</h1>
        <p className="text-gray-600 mt-2">Configure automation functions parameters</p>
      </div>

      <div className="space-y-6">
        {/* Function 1 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Function 1: Progressive Bidding Increase</h2>
              <p className="text-sm text-gray-600">Campaigns 1-4 | Increases bid for low-impression keywords</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func1.enabled} className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bid Increase</label>
              <input type="number" value={settings.func1.bidIncrease} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency (days)</label>
              <input type="number" value={settings.func1.frequency} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Impressions</label>
              <input type="number" value={settings.func1.impressions} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Clicks</label>
              <input type="number" value={settings.func1.clicks} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
          </div>
        </div>

        {/* Function 2 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Function 2: Placement Optimization</h2>
              <p className="text-sm text-gray-600">All campaigns | Adjusts placement bids based on FAST ACoS</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func2.enabled} className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency (days)</label>
              <input type="number" value={settings.func2.frequency} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe (weeks)</label>
              <input type="number" value={settings.func2.timeframeWeeks} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
          </div>
        </div>

        {/* Function 3 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Function 3: Targeting Optimization</h2>
              <p className="text-sm text-gray-600">Campaigns 1-4 | Optimizes and pauses keywords/products</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func3.enabled} className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency (days)</label>
              <input type="number" value={settings.func3.frequency} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe A (low)</label>
              <input type="number" value={settings.func3.timeframeA} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe B (med)</label>
              <input type="number" value={settings.func3.timeframeB} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe C (high)</label>
              <input type="number" value={settings.func3.timeframeC} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clicks Pause</label>
              <input type="number" value={settings.func3.clicksPause} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clicks 65 days</label>
              <input type="number" value={settings.func3.clicks65days} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
          </div>
        </div>

        {/* Function 4 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Function 4: Auto Ad Optimization</h2>
              <p className="text-sm text-gray-600">Campaign 5 only | Optimizes auto targeting groups</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func4.enabled} className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency (days)</label>
              <input type="number" value={settings.func4.frequency} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe A</label>
              <input type="number" value={settings.func4.timeframeA} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe B</label>
              <input type="number" value={settings.func4.timeframeB} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe C</label>
              <input type="number" value={settings.func4.timeframeC} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clicks for Negative</label>
              <input type="number" value={settings.func4.clicksNegative} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Spend for Negative</label>
              <input type="number" value={settings.func4.spendNegative} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
          </div>
        </div>

        {/* Function 5 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Function 5: Campaign Feeding</h2>
              <p className="text-sm text-gray-600">All campaigns | Feeds performing keywords across campaigns</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func5.enabled} className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency (days)</label>
              <input type="number" value={settings.func5.frequency} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Orders</label>
              <input type="number" value={settings.func5.minOrders} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bid Broad</label>
              <input type="number" step="0.01" value={settings.func5.bidBroad} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bid Exact</label>
              <input type="number" step="0.01" value={settings.func5.bidExact} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bid Phrase</label>
              <input type="number" step="0.01" value={settings.func5.bidPhrase} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bid Expanded</label>
              <input type="number" step="0.01" value={settings.func5.bidExpanded} className="w-full px-3 py-2 border border-gray-300 rounded-md" readOnly />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Save Settings
        </button>
      </div>
    </div>
  );
}
