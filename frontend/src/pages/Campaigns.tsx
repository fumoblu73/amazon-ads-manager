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
      '1': 'Keyword Targeting',
      '2': 'Product Targeting',
      '3': 'Keyword Super',
      '4': 'Product Super',
      '5': 'AD Automatica',
    };
    return types[type] || type;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Campaigns Overview</h1>
        <p className="text-gray-600 mt-2">Monitor your campaigns and active automations</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          All Campaigns
        </button>
        <button
          onClick={() => setFilter('enabled')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'enabled'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Enabled
        </button>
        <button
          onClick={() => setFilter('paused')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'paused'
              ? 'bg-yellow-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Paused
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-600">Loading campaigns...</div>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-600">No campaigns found</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Daily Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active Automations
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCampaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                    <div className="text-xs text-gray-500">{campaign.amazonCampaignId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{getCampaignTypeName(campaign.campaignType)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        campaign.state === 'enabled'
                          ? 'bg-green-100 text-green-800'
                          : campaign.state === 'paused'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {campaign.state}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${campaign.dailyBudget.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-1">
                      {campaign.campaignType !== '5' && (
                        <>
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">F1</span>
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">F3</span>
                        </>
                      )}
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">F2</span>
                      {campaign.campaignType === '5' && (
                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">F4</span>
                      )}
                      <span className="px-2 py-1 text-xs bg-pink-100 text-pink-800 rounded">F5</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
