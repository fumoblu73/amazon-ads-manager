import { useEffect, useState } from 'react';
import { campaignsApi } from '../services/api';
import type { Campaign, Profile } from '../types';
import { CampaignSettingsModal } from '../components/CampaignSettingsModal';

interface CampaignWithConfig extends Campaign {
  automationConfig?: {
    func1Enabled: boolean;
    func2Enabled: boolean;
    func3Enabled: boolean;
    func4Enabled: boolean;
    func5Enabled: boolean;
  };
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<CampaignWithConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await campaignsApi.getAll({ includeConfig: true });
      if (response.success && response.data) {
        setCampaigns(response.data as CampaignWithConfig[]);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = (campaign: Campaign) => {
    setSelectedCampaign({ id: campaign.id, name: campaign.name });
  };

  const handleCloseSettings = () => {
    setSelectedCampaign(null);
  };

  const handleSaveSettings = () => {
    fetchCampaigns();
  };

  const handleOpenProfileSelector = async () => {
    let token = localStorage.getItem('adminToken');

    if (!token) {
      token = prompt('Inserisci ADMIN_TOKEN (verrà salvato per le prossime volte):');
      if (!token) return;
      localStorage.setItem('adminToken', token);
    }

    setLoadingProfiles(true);
    try {
      const response = await campaignsApi.getProfiles(token);
      if (response.success && response.data) {
        const profilesByCountry = new Map(response.data.map(p => [p.countryCode, p]));

        const supportedMarketplaces = ['AU', 'CA', 'DE', 'ES', 'FR', 'IT', 'UK', 'US'];
        const allProfiles = supportedMarketplaces.map(code => {
          const existingProfile = profilesByCountry.get(code);
          return existingProfile || {
            profileId: '',
            countryCode: code,
            currencyCode: '',
            timezone: '',
            accountName: 'Non configurato',
            marketplaceId: '',
            type: ''
          };
        });

        setProfiles(allProfiles);
        setShowProfileSelector(true);
      }
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `Errore caricamento profili: ${err.response?.data?.error || err.message}`
      });
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleSync = async (profileId?: string) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    setSyncing(true);
    setSyncMessage(null);
    setShowProfileSelector(false);

    try {
      const response = await campaignsApi.syncFromAmazon(token, profileId);
      if (response.success && response.data) {
        setSyncMessage({
          type: 'success',
          text: `Sincronizzazione completata: ${response.data.created} create, ${response.data.updated} aggiornate`
        });

        fetchCampaigns();
      }
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `Errore sincronizzazione: ${err.response?.data?.error || err.message}`
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleSyncAll = async () => {
    let token = localStorage.getItem('adminToken');

    if (!token) {
      token = prompt('Inserisci ADMIN_TOKEN (verrà salvato per le prossime volte):');
      if (!token) return;
      localStorage.setItem('adminToken', token);
    }

    setSyncing(true);
    setSyncMessage(null);

    try {
      // Chiama l'endpoint SENZA profileId per sincronizzare tutti i marketplace
      const response = await campaignsApi.syncFromAmazon(token);

      if (response.success && response.data) {
        setSyncMessage({
          type: 'success',
          text: `Sync completato: ${response.data.created} create, ${response.data.updated} aggiornate`
        });

        fetchCampaigns();
      }
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `Errore: ${err.response?.data?.error || err.message}`
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleClearToken = () => {
    if (confirm('Vuoi eliminare il token salvato? Dovrai inserirlo di nuovo alla prossima sincronizzazione.')) {
      localStorage.removeItem('adminToken');
      setSyncMessage({
        type: 'success',
        text: 'Token eliminato con successo'
      });
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    let matchesStateFilter = true;
    if (filter === 'enabled') matchesStateFilter = c.state === 'enabled';
    else if (filter === 'paused') matchesStateFilter = c.state === 'paused';

    let matchesMarketplaceFilter = true;
    if (marketplaceFilter !== 'all') {
      matchesMarketplaceFilter = c.marketplace === marketplaceFilter;
    }

    return matchesStateFilter && matchesMarketplaceFilter;
  });

  const uniqueMarketplaces = Array.from(new Set(campaigns.map(c => c.marketplace))).sort();

  const getEnabledFunctions = (campaign: CampaignWithConfig): number[] => {
    const enabled: number[] = [];
    if (!campaign.automationConfig) {
      if (campaign.campaignType !== '5') {
        enabled.push(1, 3);
      }
      enabled.push(2);
      if (campaign.campaignType === '5') {
        enabled.push(4);
      }
      enabled.push(5);
    } else {
      if (campaign.automationConfig.func1Enabled) enabled.push(1);
      if (campaign.automationConfig.func2Enabled) enabled.push(2);
      if (campaign.automationConfig.func3Enabled) enabled.push(3);
      if (campaign.automationConfig.func4Enabled) enabled.push(4);
      if (campaign.automationConfig.func5Enabled) enabled.push(5);
    }
    return enabled;
  };

  const getFunctionBadgeColor = (funcNum: number): string => {
    const colors: Record<number, string> = {
      1: 'bg-blue-100 text-blue-800',
      2: 'bg-green-100 text-green-800',
      3: 'bg-purple-100 text-purple-800',
      4: 'bg-orange-100 text-orange-800',
      5: 'bg-pink-100 text-pink-800',
    };
    return colors[funcNum] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-300">Caricamento campagne...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-8 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-white uppercase">Campagne</h1>
          <button
            onClick={handleOpenProfileSelector}
            disabled={syncing || loadingProfiles}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              syncing || loadingProfiles
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md'
            }`}
          >
            {syncing || loadingProfiles ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {syncing ? 'Sincronizzazione...' : 'Caricamento...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Singolo
              </>
            )}
          </button>
          <button
            onClick={handleSyncAll}
            disabled={syncing || loadingProfiles}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              syncing || loadingProfiles
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-purple-500 text-white hover:bg-purple-600 shadow-md'
            }`}
          >
            {syncing || loadingProfiles ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {syncing ? 'Sincronizzazione...' : 'Caricamento...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Tutti
              </>
            )}
          </button>
          {syncMessage && (
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${syncMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {syncMessage.text}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            Tutte ({campaigns.length})
          </button>
          <button onClick={() => setFilter('enabled')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${filter === 'enabled' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            Attive ({campaigns.filter(c => c.state === 'enabled').length})
          </button>
          <button onClick={() => setFilter('paused')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${filter === 'paused' ? 'bg-yellow-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            Pause ({campaigns.filter(c => c.state === 'paused').length})
          </button>

          {uniqueMarketplaces.length > 0 && (
            <>
              <div className="w-px h-6 bg-gray-600 my-auto"></div>
              <button onClick={() => setMarketplaceFilter('all')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${marketplaceFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                Tutti i Market
              </button>
              {uniqueMarketplaces.map((marketplace) => (
                <button key={marketplace} onClick={() => setMarketplaceFilter(marketplace)} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${marketplaceFilter === marketplace ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                  {marketplace} ({campaigns.filter(c => c.marketplace === marketplace).length})
                </button>
              ))}
            </>
          )}

          <button onClick={handleClearToken} className="px-3 py-1.5 text-xs rounded-lg font-medium transition-all bg-red-500 text-white hover:bg-red-600 shadow-md" title="Elimina token salvato">
            Cancella Token
          </button>
        </div>
      </div>

      {filteredCampaigns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-300">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-lg font-medium text-white">Nessuna campagna trovata</p>
            <p className="text-sm text-gray-400 mt-2">Clicca "Sync Singolo" o "Sync Tutti" per importare le tue campagne</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-gray-800 rounded-xl shadow-md overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-900 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Campagna</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Stato</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Budget/g</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Funzioni Attive</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredCampaigns.map((campaign) => {
                  const enabledFunctions = getEnabledFunctions(campaign);
                  return (
                    <tr key={campaign.id} className="hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {campaign.marketplace === 'US' && '🇺🇸'}
                            {campaign.marketplace === 'CA' && '🇨🇦'}
                            {(campaign.marketplace === 'GB' || campaign.marketplace === 'UK') && '🇬🇧'}
                            {campaign.marketplace === 'IT' && '🇮🇹'}
                            {campaign.marketplace === 'DE' && '🇩🇪'}
                            {campaign.marketplace === 'FR' && '🇫🇷'}
                            {campaign.marketplace === 'ES' && '🇪🇸'}
                            {campaign.marketplace === 'AU' && '🇦🇺'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{campaign.name}</div>
                            <div className="text-xs text-gray-400 truncate">{campaign.amazonCampaignId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-indigo-900 text-indigo-200 rounded">{campaign.campaignType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded ${campaign.state === 'enabled' ? 'bg-green-900 text-green-200' : campaign.state === 'paused' ? 'bg-yellow-900 text-yellow-200' : 'bg-gray-900 text-gray-200'}`}>
                          {campaign.state === 'enabled' ? 'Attiva' : 'Pausa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        ${campaign.dailyBudget ? campaign.dailyBudget.toFixed(2) : '0.00'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {enabledFunctions.map(funcNum => (
                            <span key={funcNum} className={`inline-flex items-center px-1.5 py-0.5 text-xs font-semibold rounded ${getFunctionBadgeColor(funcNum)}`}>F{funcNum}</span>
                          ))}
                          {enabledFunctions.length === 0 && <span className="text-xs text-gray-500">Nessuna</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleOpenSettings(campaign)} className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors font-medium">
                          Impostazioni
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showProfileSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Seleziona Marketplace</h2>
            <p className="text-sm text-gray-400 mb-6">Scegli da quale marketplace sincronizzare le campagne</p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {profiles.map((profile) => {
                const isConfigured = profile.profileId !== '';
                const getFlag = (code: string) => ({ 'US': '🇺🇸', 'CA': '🇨🇦', 'UK': '🇬🇧', 'IT': '🇮🇹', 'DE': '🇩🇪', 'FR': '🇫🇷', 'ES': '🇪🇸', 'AU': '🇦🇺' }[code] || '');
                return (
                  <button key={profile.countryCode} onClick={() => isConfigured && handleSync(profile.profileId)} disabled={!isConfigured} className={`w-full px-4 py-3 text-left rounded-lg border-2 transition-all flex items-center justify-between group ${isConfigured ? 'border-gray-700 hover:border-orange-500 hover:bg-gray-800 cursor-pointer' : 'border-gray-800 bg-gray-900 cursor-not-allowed opacity-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getFlag(profile.countryCode)}</span>
                      <div>
                        <div className={`font-semibold ${isConfigured ? 'text-white group-hover:text-orange-500' : 'text-gray-600'}`}>{profile.countryCode}</div>
                        <div className="text-xs text-gray-500 mt-1">{profile.accountName || profile.marketplaceId}</div>
                      </div>
                    </div>
                    {isConfigured && (
                      <svg className="w-5 h-5 text-gray-600 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-6">
              <button onClick={() => setShowProfileSelector(false)} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all font-medium">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {selectedCampaign && (
        <CampaignSettingsModal campaignId={selectedCampaign.id} campaignName={selectedCampaign.name} isOpen={true} onClose={handleCloseSettings} onSave={handleSaveSettings} />
      )}
    </div>
  );
}
