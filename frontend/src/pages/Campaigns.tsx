import { useEffect, useState } from 'react';
import { campaignsApi } from '../services/api';
import type { Campaign, Profile } from '../types';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await campaignsApi.getAll();
        if (response.success && response.data) {
          setCampaigns(response.data);
        }
      } catch (err) {
        console.error('Error fetching campaigns:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  const handleOpenProfileSelector = async () => {
    // Try to get token from localStorage first
    let token = localStorage.getItem('adminToken');

    if (!token) {
      token = prompt('Inserisci ADMIN_TOKEN (verrà salvato per le prossime volte):');
      if (!token) return;
      localStorage.setItem('adminToken', token);
    }

    // Load profiles
    setLoadingProfiles(true);
    try {
      const response = await campaignsApi.getProfiles(token);
      if (response.success && response.data) {
        setProfiles(response.data);
        setShowProfileSelector(true);
      }
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `❌ Errore caricamento profili: ${err.response?.data?.error || err.message}`
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
          text: `✅ Sincronizzazione completata: ${response.data.created} create, ${response.data.updated} aggiornate`
        });

        // Ricarica campagne
        const campaignsResponse = await campaignsApi.getAll();
        if (campaignsResponse.success && campaignsResponse.data) {
          setCampaigns(campaignsResponse.data);
        }
      }
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `❌ Errore sincronizzazione: ${err.response?.data?.error || err.message}`
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleSyncAll = async () => {
    // Get token from localStorage or prompt
    let token = localStorage.getItem('adminToken');

    if (!token) {
      token = prompt('Inserisci ADMIN_TOKEN (verrà salvato per le prossime volte):');
      if (!token) return;
      localStorage.setItem('adminToken', token);
    }

    // Load all profiles
    setLoadingProfiles(true);
    try {
      const response = await campaignsApi.getProfiles(token);
      if (!response.success || !response.data) {
        throw new Error('Impossibile caricare i profili');
      }

      const allProfiles = response.data;
      setLoadingProfiles(false);

      // Sync all profiles sequentially
      setSyncing(true);
      setSyncMessage(null);

      let totalCreated = 0;
      let totalUpdated = 0;
      let errors = 0;

      for (const profile of allProfiles) {
        try {
          const syncResponse = await campaignsApi.syncFromAmazon(token, profile.profileId);
          if (syncResponse.success && syncResponse.data) {
            totalCreated += syncResponse.data.created;
            totalUpdated += syncResponse.data.updated;
          }
        } catch (err: any) {
          console.error(`Errore sync marketplace ${profile.countryCode}:`, err);
          errors++;
        }
      }

      // Show summary message
      setSyncMessage({
        type: errors === allProfiles.length ? 'error' : 'success',
        text: `✅ Sync completato: ${totalCreated} create, ${totalUpdated} aggiornate${errors > 0 ? `, ${errors} errori` : ''}`
      });

      // Reload campaigns
      const campaignsResponse = await campaignsApi.getAll();
      if (campaignsResponse.success && campaignsResponse.data) {
        setCampaigns(campaignsResponse.data);
      }

    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: `❌ Errore: ${err.response?.data?.error || err.message}`
      });
      setLoadingProfiles(false);
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
        text: '✅ Token eliminato con successo'
      });
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    // Filter by state
    let matchesStateFilter = true;
    if (filter === 'enabled') matchesStateFilter = c.state === 'enabled';
    else if (filter === 'paused') matchesStateFilter = c.state === 'paused';

    // Filter by marketplace
    let matchesMarketplaceFilter = true;
    if (marketplaceFilter !== 'all') {
      matchesMarketplaceFilter = c.marketplace === marketplaceFilter;
    }

    return matchesStateFilter && matchesMarketplaceFilter;
  });

  // Get unique marketplaces from campaigns
  const uniqueMarketplaces = Array.from(new Set(campaigns.map(c => c.marketplace))).sort();

  const getCampaignTypeName = (type: string) => {
    const types: Record<string, string> = {
      '1': 'Keyword',
      '2': 'Product',
      '3': 'Key Super',
      '4': 'Prod Super',
      '5': 'Automatica',
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600">Caricamento campagne...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-8 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
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
            {syncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Sincronizzazione...
              </>
            ) : loadingProfiles ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Caricamento...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Singolo Marketplace
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
            {syncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Sincronizzazione...
              </>
            ) : loadingProfiles ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Caricamento...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Tutti i Marketplace
              </>
            )}
          </button>
          {syncMessage && (
            <div
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                syncMessage.type === 'success'
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
              }`}
            >
              {syncMessage.text}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Tutte ({campaigns.length})
          </button>
          <button
            onClick={() => setFilter('enabled')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              filter === 'enabled'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Attive ({campaigns.filter(c => c.state === 'enabled').length})
          </button>
          <button
            onClick={() => setFilter('paused')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              filter === 'paused'
                ? 'bg-yellow-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Pause ({campaigns.filter(c => c.state === 'paused').length})
          </button>

          {/* Marketplace Filters */}
          {uniqueMarketplaces.length > 0 && (
            <>
              <div className="w-px h-6 bg-gray-300 my-auto"></div>
              {uniqueMarketplaces.map((marketplace) => (
                <button
                  key={marketplace}
                  onClick={() => setMarketplaceFilter(marketplace === marketplaceFilter ? 'all' : marketplace)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                    marketplaceFilter === marketplace
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {marketplace} ({campaigns.filter(c => c.marketplace === marketplace).length})
                </button>
              ))}
            </>
          )}

          <button
            onClick={handleClearToken}
            className="px-3 py-1.5 text-xs rounded-lg font-medium transition-all bg-red-500 text-white hover:bg-red-600 shadow-md"
            title="Elimina token salvato"
          >
            Cancella Token
          </button>
        </div>
      </div>

      {/* Campaigns Table */}
      {filteredCampaigns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-300">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-lg font-medium text-white">Nessuna campagna trovata</p>
            <p className="text-sm text-gray-400 mt-2">Clicca "Sync Singolo Marketplace" o "Sync Tutti i Marketplace" per importare le tue campagne</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-xl shadow-md overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Campagna
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Budget/g
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Automazioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {campaign.marketplace === 'US' && '🇺🇸'}
                          {campaign.marketplace === 'CA' && '🇨🇦'}
                          {campaign.marketplace === 'MX' && '🇲🇽'}
                          {campaign.marketplace === 'BR' && '🇧🇷'}
                          {campaign.marketplace === 'GB' && '🇬🇧'}
                          {campaign.marketplace === 'DE' && '🇩🇪'}
                          {campaign.marketplace === 'FR' && '🇫🇷'}
                          {campaign.marketplace === 'IT' && '🇮🇹'}
                          {campaign.marketplace === 'ES' && '🇪🇸'}
                          {campaign.marketplace === 'NL' && '🇳🇱'}
                          {campaign.marketplace === 'SE' && '🇸🇪'}
                          {campaign.marketplace === 'PL' && '🇵🇱'}
                          {campaign.marketplace === 'TR' && '🇹🇷'}
                          {campaign.marketplace === 'AU' && '🇦🇺'}
                          {campaign.marketplace === 'SG' && '🇸🇬'}
                          {campaign.marketplace === 'AE' && '🇦🇪'}
                          {campaign.marketplace === 'SA' && '🇸🇦'}
                          {campaign.marketplace === 'IN' && '🇮🇳'}
                          {campaign.marketplace === 'JP' && '🇯🇵'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{campaign.name}</div>
                          <div className="text-xs text-gray-500 truncate">{campaign.amazonCampaignId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded">
                        {getCampaignTypeName(campaign.campaignType)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded ${
                          campaign.state === 'enabled'
                            ? 'bg-green-100 text-green-800'
                            : campaign.state === 'paused'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {campaign.state === 'enabled' ? 'Attiva' : 'Pausa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ${campaign.dailyBudget.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {campaign.campaignType !== '5' && (
                          <>
                            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                              F1
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800 rounded">
                              F3
                            </span>
                          </>
                        )}
                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded">
                          F2
                        </span>
                        {campaign.campaignType === '5' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-orange-100 text-orange-800 rounded">
                            F4
                          </span>
                        )}
                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-pink-100 text-pink-800 rounded">
                          F5
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profile Selector Modal */}
      {showProfileSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Seleziona Marketplace</h2>
            <p className="text-sm text-gray-600 mb-6">Scegli da quale marketplace sincronizzare le campagne</p>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {profiles.map((profile) => (
                <button
                  key={profile.profileId}
                  onClick={() => handleSync(profile.profileId)}
                  className="w-full px-4 py-3 text-left rounded-lg border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-orange-600">
                      {profile.countryCode === 'US' && '🇺🇸'}
                      {profile.countryCode === 'CA' && '🇨🇦'}
                      {profile.countryCode === 'MX' && '🇲🇽'}
                      {profile.countryCode === 'BR' && '🇧🇷'}
                      {profile.countryCode === 'GB' && '🇬🇧'}
                      {profile.countryCode === 'DE' && '🇩🇪'}
                      {profile.countryCode === 'FR' && '🇫🇷'}
                      {profile.countryCode === 'IT' && '🇮🇹'}
                      {profile.countryCode === 'ES' && '🇪🇸'}
                      {profile.countryCode === 'NL' && '🇳🇱'}
                      {profile.countryCode === 'SE' && '🇸🇪'}
                      {profile.countryCode === 'PL' && '🇵🇱'}
                      {profile.countryCode === 'TR' && '🇹🇷'}
                      {profile.countryCode === 'AU' && '🇦🇺'}
                      {profile.countryCode === 'SG' && '🇸🇬'}
                      {profile.countryCode === 'AE' && '🇦🇪'}
                      {profile.countryCode === 'SA' && '🇸🇦'}
                      {profile.countryCode === 'IN' && '🇮🇳'}
                      {profile.countryCode === 'JP' && '🇯🇵'}
                      {' '}{profile.countryCode}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {profile.accountName || profile.marketplaceId}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setShowProfileSelector(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
