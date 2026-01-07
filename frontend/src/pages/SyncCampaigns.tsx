import { useState, useEffect } from 'react';

interface Profile {
  profileId: number;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  accountName: string;
  marketplaceId: string;
  type: string;
}

export default function SyncCampaigns() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoadingProfiles(true);
      setError(null);

      const response = await fetch('/api/campaigns/profiles', {
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        setProfiles(data.data);
        // Auto-select if only one profile
        if (data.data.length === 1) {
          await selectProfile(data.data[0]);
        }
      } else {
        setError(data.error || 'Failed to load profiles');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profiles');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const selectProfile = async (profile: Profile) => {
    try {
      const response = await fetch('/api/campaigns/select-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          profileId: profile.profileId,
          countryCode: profile.countryCode,
          currencyCode: profile.currencyCode
        })
      });

      const data = await response.json();

      if (data.success) {
        setSelectedProfile(profile);
        setError(null);
      } else {
        setError(data.error || 'Failed to select profile');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to select profile');
    }
  };

  const handleSync = async () => {
    if (!selectedProfile) {
      setError('Please select a profile first');
      return;
    }

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

        {/* Profile Selection */}
        {loadingProfiles ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading profiles...</p>
          </div>
        ) : profiles.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-white mb-2">No Profiles Found</h2>
              <p className="text-gray-400">Please connect your Amazon Advertising account first</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">Select Amazon Advertising Profile</h2>
              <div className="space-y-3">
                {profiles.map((profile) => (
                  <button
                    key={profile.profileId}
                    onClick={() => selectProfile(profile)}
                    className={`w-full p-4 rounded-lg text-left transition-all ${
                      selectedProfile?.profileId === profile.profileId
                        ? 'bg-orange-500/20 border-2 border-orange-500'
                        : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-white font-medium">{profile.accountName || 'Amazon Account'}</div>
                        <div className="text-gray-400 text-sm mt-1">
                          Profile ID: {profile.profileId}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {profile.countryCode} • {profile.currencyCode} • {profile.marketplaceId}
                        </div>
                      </div>
                      {selectedProfile?.profileId === profile.profileId && (
                        <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sync Section */}
            {selectedProfile && (
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
                    Import Campaigns
                  </h2>
                  <p className="text-gray-400">
                    From: {selectedProfile.accountName || 'Amazon Account'} ({selectedProfile.countryCode})
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
                        <h3 className="text-red-500 font-semibold mb-1">Error</h3>
                        <p className="text-white text-sm">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <h3 className="text-blue-400 font-medium mb-2">ℹ️ Note:</h3>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Imports campaigns from your selected Amazon Advertising profile</li>
                    <li>• Uses official Amazon Advertising API</li>
                    <li>• Only active and paused campaigns are imported</li>
                    <li>• Run this sync whenever you create new campaigns on Amazon</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
