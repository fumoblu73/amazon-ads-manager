import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, type SyncNotification } from '../contexts/AuthContext';

export default function Layout() {
  const { user, logout, syncNotifications, dismissNotification } = useAuth();
  const navItems = [
    { path: '/kdp/dashboard', icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ) },
    { path: '/dashboard', icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ) },
    // Sync campaigns removed from sidebar - button now in Dashboard campaigns section
    { path: '/logs', icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ) },
    { path: '/settings', icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ) },
    { path: '/test-functions', icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ) },
    { path: '/help', icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ) },
  ];

  return (
    <div className="flex h-screen bg-black">
      {/* Left Sidebar - Vertical Navigation */}
      <aside className="w-32 bg-black flex flex-col items-center py-4">
        {/* Logo */}
        <div className="mb-4 w-full">
          <img
            src="/logoADS.png"
            alt="Amazon Ads Manager"
            className="object-contain mx-auto"
            style={{ width: '75%' }}
          />
        </div>

        {/* Navigation Icons */}
        <nav className="flex flex-col items-center gap-3 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `p-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-orange-500'
                    : 'hover:bg-gray-800'
                }`
              }
            >
              {({ isActive }) => (
                <div className={`transition-colors ${isActive ? 'text-white' : 'text-orange-500 hover:text-white'}`}>
                  {item.icon}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Menu */}
        <div className="mt-auto">
          <div className="text-center mb-4">
            <p className="text-xs text-gray-400">{user?.email}</p>
            <p className="text-xs text-gray-500">{user?.countryCode}</p>
          </div>
          <button
            onClick={logout}
            className="p-3 rounded-lg hover:bg-red-900/20 transition-all"
            title="Logout"
          >
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-black relative">
        <Outlet />

        {/* Sync Notifications Toast */}
        {syncNotifications.length > 0 && (
          <div className="absolute top-4 right-4 z-50 space-y-2">
            {syncNotifications.map((n: SyncNotification) => (
              <div
                key={n.type}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm shadow-lg transition-all max-w-sm ${
                  n.status === 'syncing' ? 'bg-gray-800 border border-gray-600 text-gray-300' :
                  n.status === 'success' ? 'bg-green-900/80 border border-green-600 text-green-300' :
                  n.status === 'error' ? 'bg-red-900/80 border border-red-600 text-red-300' :
                  'bg-gray-800 border border-gray-600 text-gray-400'
                }`}
              >
                {n.status === 'syncing' && (
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                {n.status === 'success' && (
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {n.status === 'error' && (
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className="flex-1">{n.message}</span>
                {n.status !== 'syncing' && (
                  <button
                    onClick={() => dismissNotification(n.type)}
                    className="flex-shrink-0 ml-1 hover:opacity-70 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
