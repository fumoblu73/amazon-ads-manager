import { useState, useEffect } from 'react';
import { settingsApi } from '../services/api';

export default function Settings() {
  const [settings, setSettings] = useState({
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Carica settings all'avvio
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.get();
        if (response.success && response.data) {
          setSettings(response.data);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Salva settings
  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await settingsApi.update(settings);
      if (response.success) {
        setMessage('Impostazioni salvate con successo!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Errore nel salvataggio delle impostazioni');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (func: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [func]: {
        ...prev[func as keyof typeof prev],
        [key]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="h-full p-8 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white uppercase">Impostazioni</h1>
        <div className="flex items-center gap-4">
          {message && (
            <span className={`text-sm ${message.includes('successo') ? 'text-green-500' : 'text-red-500'}`}>
              {message}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvataggio...' : 'Salva Modifiche'}
          </button>
        </div>
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
              <input
                type="checkbox"
                checked={settings.func1.enabled}
                onChange={(e) => updateSetting('func1', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Increase</label>
              <input
                type="number"
                step="0.01"
                value={settings.func1.bidIncrease}
                onChange={(e) => updateSetting('func1', 'bidIncrease', parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq. (gg)</label>
              <input
                type="number"
                value={settings.func1.frequency}
                onChange={(e) => updateSetting('func1', 'frequency', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Max Impr.</label>
              <input
                type="number"
                value={settings.func1.impressions}
                onChange={(e) => updateSetting('func1', 'impressions', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Max Click</label>
              <input
                type="number"
                value={settings.func1.clicks}
                onChange={(e) => updateSetting('func1', 'clicks', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
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
              <input
                type="checkbox"
                checked={settings.func2.enabled}
                onChange={(e) => updateSetting('func2', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq. (gg)</label>
              <input
                type="number"
                value={settings.func2.frequency}
                onChange={(e) => updateSetting('func2', 'frequency', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Timeframe (sett.)</label>
              <input
                type="number"
                value={settings.func2.timeframeWeeks}
                onChange={(e) => updateSetting('func2', 'timeframeWeeks', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
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
              <input
                type="checkbox"
                checked={settings.func3.enabled}
                onChange={(e) => updateSetting('func3', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq.</label>
              <input
                type="number"
                value={settings.func3.frequency}
                onChange={(e) => updateSetting('func3', 'frequency', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF A</label>
              <input
                type="number"
                value={settings.func3.timeframeA}
                onChange={(e) => updateSetting('func3', 'timeframeA', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF B</label>
              <input
                type="number"
                value={settings.func3.timeframeB}
                onChange={(e) => updateSetting('func3', 'timeframeB', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF C</label>
              <input
                type="number"
                value={settings.func3.timeframeC}
                onChange={(e) => updateSetting('func3', 'timeframeC', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Click Pause</label>
              <input
                type="number"
                value={settings.func3.clicksPause}
                onChange={(e) => updateSetting('func3', 'clicksPause', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Click 65gg</label>
              <input
                type="number"
                value={settings.func3.clicks65days}
                onChange={(e) => updateSetting('func3', 'clicks65days', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
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
              <input
                type="checkbox"
                checked={settings.func4.enabled}
                onChange={(e) => updateSetting('func4', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq.</label>
              <input
                type="number"
                value={settings.func4.frequency}
                onChange={(e) => updateSetting('func4', 'frequency', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF A</label>
              <input
                type="number"
                value={settings.func4.timeframeA}
                onChange={(e) => updateSetting('func4', 'timeframeA', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF B</label>
              <input
                type="number"
                value={settings.func4.timeframeB}
                onChange={(e) => updateSetting('func4', 'timeframeB', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">TF C</label>
              <input
                type="number"
                value={settings.func4.timeframeC}
                onChange={(e) => updateSetting('func4', 'timeframeC', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Click Neg.</label>
              <input
                type="number"
                value={settings.func4.clicksNegative}
                onChange={(e) => updateSetting('func4', 'clicksNegative', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Spend Neg.</label>
              <input
                type="number"
                value={settings.func4.spendNegative}
                onChange={(e) => updateSetting('func4', 'spendNegative', parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
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
              <input
                type="checkbox"
                checked={settings.func5.enabled}
                onChange={(e) => updateSetting('func5', 'enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Freq. (gg)</label>
              <input
                type="number"
                value={settings.func5.frequency}
                onChange={(e) => updateSetting('func5', 'frequency', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Min Ordini</label>
              <input
                type="number"
                value={settings.func5.minOrders}
                onChange={(e) => updateSetting('func5', 'minOrders', parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Broad</label>
              <input
                type="number"
                step="0.01"
                value={settings.func5.bidBroad}
                onChange={(e) => updateSetting('func5', 'bidBroad', parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Exact</label>
              <input
                type="number"
                step="0.01"
                value={settings.func5.bidExact}
                onChange={(e) => updateSetting('func5', 'bidExact', parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Phrase</label>
              <input
                type="number"
                step="0.01"
                value={settings.func5.bidPhrase}
                onChange={(e) => updateSetting('func5', 'bidPhrase', parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-0.5">Bid Expand</label>
              <input
                type="number"
                step="0.01"
                value={settings.func5.bidExpanded}
                onChange={(e) => updateSetting('func5', 'bidExpanded', parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
