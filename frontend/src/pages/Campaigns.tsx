import { useEffect, useState } from 'react';
import { campaignsApi } from '../services/api';
import type { Campaign } from '../types';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

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

  const filteredCampaigns = campaigns.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'enabled') return c.state === 'enabled';
    if (filter === 'paused') return c.state === 'paused';
    return true;
  });

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
        <h1 className="text-2xl font-bold text-white uppercase">Campagne</h1>
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
        </div>
      </div>

      {/* Campaigns Table */}
      {filteredCampaigns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-lg font-medium">Nessuna campagna trovata</p>
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
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">{campaign.name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">{campaign.amazonCampaignId}</div>
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
    </div>
  );
}
