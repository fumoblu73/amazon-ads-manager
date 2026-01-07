import { useState } from 'react';

export default function SyncCampaigns() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/campaigns/sync-from-amazon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Sync Amazon Ads Campaigns</h1>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8">
          <div className="text-center mb-6">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-orange-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <h2 className="text-xl font-semibold text-white mb-2">
              Import Amazon Advertising Campaigns
            </h2>
            <p className="text-gray-400">
              Import your active Amazon Ads campaigns using the official Amazon Advertising API
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full px-6 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-medium"
          >
            {syncing ? (
              <>
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                Syncing Campaigns...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Sync Now
              </>
            )}
          </button>

          {result && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-green-500 font-semibold mb-2">Sync Completed Successfully!</h3>
                  <p className="text-white">
                    <span className="font-medium">{result.created || 0}</span> new campaigns imported
                  </p>
                  <p className="text-white">
                    <span className="font-medium">{result.updated || 0}</span> campaigns updated
                  </p>
                  <p className="text-white">
                    <span className="font-medium">{result.total || 0}</span> total campaigns found
                  </p>
                  {result.marketplace && (
                    <p className="text-gray-400 text-sm mt-2">Marketplace: {result.marketplace}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-red-500 font-semibold mb-1">Sync Failed</h3>
                  <p className="text-white text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h3 className="text-blue-400 font-medium mb-2">ℹ️ Note:</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Imports campaigns from your linked Amazon Advertising account</li>
              <li>• Uses official Amazon Advertising API</li>
              <li>• Only active and paused campaigns are imported</li>
              <li>• Run this sync whenever you create new campaigns on Amazon</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
