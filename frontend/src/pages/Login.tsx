export default function Login() {
  const handleLogin = () => {
    // Reindirizza al backend che gestirà l'OAuth flow
    // In produzione usa percorsi relativi (stesso dominio)
    const apiUrl = import.meta.env.PROD ? '' : 'http://localhost:3000';
    window.location.href = `${apiUrl}/api/auth/login`;
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img
            src="/logoADS.png"
            alt="Amazon Ads Manager"
            className="w-48 mx-auto mb-6"
          />
          <h1 className="text-3xl font-bold text-white mb-2">
            Amazon Ads Manager
          </h1>
          <p className="text-gray-400">
            Automated campaign management and KDP analytics
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            Sign in to continue
          </h2>

          <button
            onClick={handleLogin}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-3 mb-4"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.09 10.693c0-.36-.03-.63-.09-.84-.06-.18-.15-.33-.27-.48-.12-.12-.27-.21-.45-.27-.18-.06-.39-.09-.63-.09-.63 0-1.08.21-1.38.63-.27.42-.42.99-.42 1.71 0 .33.03.63.09.87.06.24.15.45.27.6.12.18.27.3.48.39.18.09.42.12.69.12.24 0 .45-.03.63-.12.18-.06.33-.18.45-.33.12-.15.21-.33.27-.54.06-.24.09-.51.09-.84v-.27zm8.28 7.38c-.42.33-.96.63-1.59.87-.63.24-1.32.36-2.07.36-1.26 0-2.34-.3-3.21-.93-.87-.6-1.5-1.44-1.89-2.49h-.06c-.09.72-.27 1.35-.54 1.86-.27.51-.6.93-1.02 1.26-.39.33-.87.57-1.41.72-.54.15-1.11.24-1.74.24-.66 0-1.26-.09-1.77-.27-.51-.18-.96-.45-1.32-.78-.36-.33-.63-.72-.84-1.2-.18-.45-.27-.96-.27-1.53 0-.96.27-1.74.78-2.37.51-.63 1.23-1.14 2.13-1.5.9-.36 1.95-.63 3.12-.78 1.17-.15 2.4-.24 3.63-.24v-.36c0-.48-.06-.9-.18-1.26-.12-.36-.3-.66-.54-.9-.24-.24-.54-.42-.9-.54-.36-.12-.78-.18-1.26-.18-.54 0-1.08.09-1.59.27-.51.18-1.02.39-1.5.66l-.69-1.71c.54-.33 1.17-.6 1.86-.81.69-.21 1.44-.33 2.22-.33.96 0 1.77.15 2.4.42.63.27 1.14.66 1.53 1.14.39.48.66 1.05.84 1.68.15.63.24 1.32.24 2.04v4.41c0 .36.03.66.12.87.06.21.21.3.42.3.15 0 .33-.03.51-.12.18-.06.33-.15.45-.24l.42 1.59zm-8.55-3.33c-.78 0-1.5.06-2.13.15-.63.09-1.17.24-1.62.45-.45.21-.78.48-1.02.84-.24.33-.36.75-.36 1.23 0 .39.06.72.18 1.02.12.27.27.51.48.69.21.18.45.3.72.39.27.09.57.12.87.12.63 0 1.14-.15 1.56-.45.39-.3.69-.66.87-1.08.18-.42.3-.87.36-1.35.06-.48.09-.93.09-1.35v-.66z"/>
            </svg>
            Login with Amazon
          </button>

          <div className="text-center text-sm text-gray-400">
            <p className="mb-2">You'll be redirected to Amazon to authorize this app.</p>
            <p>We'll access your Amazon Ads campaigns and performance data.</p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-center">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="text-orange-500 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">Automated</p>
            <p className="text-xs text-gray-400">Campaign optimization</p>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="text-orange-500 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">Analytics</p>
            <p className="text-xs text-gray-400">KDP insights</p>
          </div>
        </div>
      </div>
    </div>
  );
}
