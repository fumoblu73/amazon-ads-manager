import { useState, useEffect } from 'react';
import { automationConfigApi, type AutomationConfig } from '../services/api';

interface CampaignSettingsModalProps {
  campaignId: string;
  campaignName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

const ADMIN_TOKEN = localStorage.getItem('adminToken') || '';

export const CampaignSettingsModal: React.FC<CampaignSettingsModalProps> = ({
  campaignId,
  campaignName,
  isOpen,
  onClose,
  onSave,
}) => {
  const [config, setConfig] = useState<Partial<AutomationConfig> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(1);

  useEffect(() => {
    if (isOpen && campaignId) {
      loadConfig();
    }
  }, [isOpen, campaignId]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await automationConfigApi.getByCampaignId(campaignId);
      setConfig(response.data || null);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Config non esiste, usa defaults
        setConfig({
          campaignId,
          func1Enabled: true,
          func1BidIncrease: 0.02,
          func1Frequency: 3,
          func1Impressions: 20,
          func1Clicks: 0,
          func2Enabled: true,
          func2Frequency: 7,
          func2TimeframeWeeks: 4,
          func3Enabled: true,
          func3Frequency: 3,
          func3TimeframeA: 2000,
          func3TimeframeB: 3000,
          func3TimeframeC: 5000,
          func3ClicksPause: 10,
          func3Clicks65days: 30,
          func4Enabled: true,
          func4Frequency: 7,
          func4TimeframeA: 1000,
          func4TimeframeB: 3000,
          func4TimeframeC: 5000,
          func4ClicksNegative: 10,
          func4SpendNegative: 10,
          func5Enabled: true,
          func5Frequency: 7,
          func5MinOrders: 1,
          func5BidBroad: 0.30,
          func5BidExact: 0.50,
          func5BidPhrase: 0.40,
          func5BidExpanded: 0.30,
        });
      } else {
        setError('Errore nel caricamento della configurazione');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError(null);
    try {
      await automationConfigApi.update(campaignId, config, ADMIN_TOKEN);
      onSave?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (field: keyof AutomationConfig, value: any) => {
    setConfig(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Impostazioni Ottimizzazioni</h2>
              <p className="text-gray-400 mt-1">{campaignName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {[1, 2, 3, 4, 5].map(num => (
              <button
                key={num}
                onClick={() => setActiveTab(num)}
                className={`px-4 py-2 rounded whitespace-nowrap transition-colors ${
                  activeTab === num
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Funzione {num}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-8 text-gray-400">Caricamento...</div>
          )}

          {error && (
            <div className="bg-red-900 text-white p-4 rounded mb-4">
              {error}
            </div>
          )}

          {!loading && config && (
            <>
              {/* Function 1: Progressive Bidding Increase */}
              {activeTab === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded">
                    <div>
                      <h3 className="text-lg font-bold text-white">Funzione 1: Progressive Bidding Increase</h3>
                      <p className="text-sm text-gray-400">Incrementa progressivamente le offerte per parole chiave/prodotti con poche impressioni</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.func1Enabled ?? true}
                        onChange={e => updateConfig('func1Enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Incremento Offerta (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.func1BidIncrease ?? 0.02}
                        onChange={e => updateConfig('func1BidIncrease', parseFloat(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func1Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Frequenza (giorni)
                      </label>
                      <input
                        type="number"
                        value={config.func1Frequency ?? 3}
                        onChange={e => updateConfig('func1Frequency', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func1Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Max Impressioni
                      </label>
                      <input
                        type="number"
                        value={config.func1Impressions ?? 20}
                        onChange={e => updateConfig('func1Impressions', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func1Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Max Click
                      </label>
                      <input
                        type="number"
                        value={config.func1Clicks ?? 0}
                        onChange={e => updateConfig('func1Clicks', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func1Enabled}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Function 2: Placement Optimization */}
              {activeTab === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded">
                    <div>
                      <h3 className="text-lg font-bold text-white">Funzione 2: Placement Optimization</h3>
                      <p className="text-sm text-gray-400">Ottimizza gli aggiustamenti di offerta per i 3 placement basandosi sul FAST ACoS</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.func2Enabled ?? true}
                        onChange={e => updateConfig('func2Enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Frequenza (giorni)
                      </label>
                      <input
                        type="number"
                        value={config.func2Frequency ?? 7}
                        onChange={e => updateConfig('func2Frequency', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func2Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Timeframe (settimane)
                      </label>
                      <input
                        type="number"
                        value={config.func2TimeframeWeeks ?? 4}
                        onChange={e => updateConfig('func2TimeframeWeeks', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func2Enabled}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Function 3: Targeting Optimization */}
              {activeTab === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded">
                    <div>
                      <h3 className="text-lg font-bold text-white">Funzione 3: Targeting Optimization</h3>
                      <p className="text-sm text-gray-400">Ottimizza le offerte e mette in pausa parole chiave/prodotti non performanti</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.func3Enabled ?? true}
                        onChange={e => updateConfig('func3Enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Frequenza (giorni)
                      </label>
                      <input
                        type="number"
                        value={config.func3Frequency ?? 3}
                        onChange={e => updateConfig('func3Frequency', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func3Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Timeframe A (impressioni)
                      </label>
                      <input
                        type="number"
                        value={config.func3TimeframeA ?? 2000}
                        onChange={e => updateConfig('func3TimeframeA', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func3Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Timeframe B (impressioni)
                      </label>
                      <input
                        type="number"
                        value={config.func3TimeframeB ?? 3000}
                        onChange={e => updateConfig('func3TimeframeB', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func3Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Timeframe C (impressioni)
                      </label>
                      <input
                        type="number"
                        value={config.func3TimeframeC ?? 5000}
                        onChange={e => updateConfig('func3TimeframeC', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func3Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Click per Pausa
                      </label>
                      <input
                        type="number"
                        value={config.func3ClicksPause ?? 10}
                        onChange={e => updateConfig('func3ClicksPause', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func3Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Click in 65 giorni
                      </label>
                      <input
                        type="number"
                        value={config.func3Clicks65days ?? 30}
                        onChange={e => updateConfig('func3Clicks65days', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func3Enabled}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Function 4: Auto Ad Optimization */}
              {activeTab === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded">
                    <div>
                      <h3 className="text-lg font-bold text-white">Funzione 4: Auto Ad Optimization</h3>
                      <p className="text-sm text-gray-400">Ottimizza campagne automatiche e aggiunge targeting negativo</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.func4Enabled ?? true}
                        onChange={e => updateConfig('func4Enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Frequenza (giorni)
                      </label>
                      <input
                        type="number"
                        value={config.func4Frequency ?? 7}
                        onChange={e => updateConfig('func4Frequency', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func4Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Timeframe A (impressioni)
                      </label>
                      <input
                        type="number"
                        value={config.func4TimeframeA ?? 1000}
                        onChange={e => updateConfig('func4TimeframeA', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func4Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Timeframe B (impressioni)
                      </label>
                      <input
                        type="number"
                        value={config.func4TimeframeB ?? 3000}
                        onChange={e => updateConfig('func4TimeframeB', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func4Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Timeframe C (impressioni)
                      </label>
                      <input
                        type="number"
                        value={config.func4TimeframeC ?? 5000}
                        onChange={e => updateConfig('func4TimeframeC', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func4Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Click per Negativo
                      </label>
                      <input
                        type="number"
                        value={config.func4ClicksNegative ?? 10}
                        onChange={e => updateConfig('func4ClicksNegative', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func4Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Spesa per Negativo (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.func4SpendNegative ?? 10}
                        onChange={e => updateConfig('func4SpendNegative', parseFloat(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func4Enabled}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Function 5: Campaign Feeding */}
              {activeTab === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-800 rounded">
                    <div>
                      <h3 className="text-lg font-bold text-white">Funzione 5: Campaign Feeding</h3>
                      <p className="text-sm text-gray-400">Alimenta le campagne con search terms performanti</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.func5Enabled ?? true}
                        onChange={e => updateConfig('func5Enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Frequenza (giorni)
                      </label>
                      <input
                        type="number"
                        value={config.func5Frequency ?? 7}
                        onChange={e => updateConfig('func5Frequency', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func5Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Ordini Minimi
                      </label>
                      <input
                        type="number"
                        value={config.func5MinOrders ?? 1}
                        onChange={e => updateConfig('func5MinOrders', parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func5Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Offerta Broad (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.func5BidBroad ?? 0.30}
                        onChange={e => updateConfig('func5BidBroad', parseFloat(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func5Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Offerta Exact (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.func5BidExact ?? 0.50}
                        onChange={e => updateConfig('func5BidExact', parseFloat(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func5Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Offerta Phrase (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.func5BidPhrase ?? 0.40}
                        onChange={e => updateConfig('func5BidPhrase', parseFloat(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func5Enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Offerta Expanded (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.func5BidExpanded ?? 0.30}
                        onChange={e => updateConfig('func5BidExpanded', parseFloat(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
                        disabled={!config.func5Enabled}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-6 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvataggio...' : 'Salva Configurazione'}
          </button>
        </div>
      </div>
    </div>
  );
};
