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
    <div className="h-full p-8 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white uppercase">Impostazioni</h1>
        <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-md">
          Salva Modifiche
        </button>
      </div>

      {/* Functions Grid - 2x3 layout */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Function 1 */}
        <div className="bg-black border-2 border-orange-500 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-white">F1: Progressive Bidding</h2>
              <p className="text-sm text-gray-300">Camp. 1-4 | Bid increase</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func1.enabled} className="sr-only peer" readOnly />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Increase</label>
              <input type="number" value={settings.func1.bidIncrease} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq. (gg)</label>
              <input type="number" value={settings.func1.frequency} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Max Impr.</label>
              <input type="number" value={settings.func1.impressions} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Max Click</label>
              <input type="number" value={settings.func1.clicks} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
          </div>
        </div>

        {/* Function 2 */}
        <div className="bg-black border-2 border-orange-500 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-white">F2: Placement Optimization</h2>
              <p className="text-sm text-gray-300">Tutte | Ottimizza placement</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func2.enabled} className="sr-only peer" readOnly />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq. (gg)</label>
              <input type="number" value={settings.func2.frequency} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Timeframe (sett.)</label>
              <input type="number" value={settings.func2.timeframeWeeks} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
          </div>
        </div>

        {/* Function 3 */}
        <div className="bg-black border-2 border-orange-500 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-white">F3: Targeting Optimization</h2>
              <p className="text-sm text-gray-300">Camp. 1-4 | Keywords/prodotti</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func3.enabled} className="sr-only peer" readOnly />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq.</label>
              <input type="number" value={settings.func3.frequency} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF A</label>
              <input type="number" value={settings.func3.timeframeA} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF B</label>
              <input type="number" value={settings.func3.timeframeB} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF C</label>
              <input type="number" value={settings.func3.timeframeC} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Click Pause</label>
              <input type="number" value={settings.func3.clicksPause} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Click 65gg</label>
              <input type="number" value={settings.func3.clicks65days} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
          </div>
        </div>

        {/* Function 4 */}
        <div className="bg-black border-2 border-orange-500 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-white">F4: Auto Ad Optimization</h2>
              <p className="text-sm text-gray-300">Camp. 5 | Auto targeting</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func4.enabled} className="sr-only peer" readOnly />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq.</label>
              <input type="number" value={settings.func4.frequency} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF A</label>
              <input type="number" value={settings.func4.timeframeA} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF B</label>
              <input type="number" value={settings.func4.timeframeB} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF C</label>
              <input type="number" value={settings.func4.timeframeC} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Click Neg.</label>
              <input type="number" value={settings.func4.clicksNegative} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Spend Neg.</label>
              <input type="number" value={settings.func4.spendNegative} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
          </div>
        </div>

        {/* Function 5 */}
        <div className="bg-black border-2 border-orange-500 rounded-xl p-4 flex flex-col col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-white">F5: Campaign Feeding</h2>
              <p className="text-sm text-gray-300">Tutte | Feeding keywords tra campagne</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.func5.enabled} className="sr-only peer" readOnly />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq. (gg)</label>
              <input type="number" value={settings.func5.frequency} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Min Ordini</label>
              <input type="number" value={settings.func5.minOrders} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Broad</label>
              <input type="number" step="0.01" value={settings.func5.bidBroad} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Exact</label>
              <input type="number" step="0.01" value={settings.func5.bidExact} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Phrase</label>
              <input type="number" step="0.01" value={settings.func5.bidPhrase} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Expand</label>
              <input type="number" step="0.01" value={settings.func5.bidExpanded} className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded" readOnly />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
