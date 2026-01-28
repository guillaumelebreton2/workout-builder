const API_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

export function LoginPage() {
  const handleGarminLogin = () => {
    window.location.href = `${API_URL}/api/garmin/auth`;
  };

  const handleStravaLogin = () => {
    window.location.href = `${API_URL}/api/strava/auth`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Bienvenue sur Enduzo</h1>
          <p className="text-gray-600 mt-2">
            Connecte-toi pour creer tes seances d'entrainement
          </p>
        </div>

        {/* Login buttons */}
        <div className="space-y-4">
          {/* Garmin button */}
          <button
            onClick={handleGarminLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#007CC3] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#006AAD] transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            Continuer avec Garmin
          </button>

          {/* Strava button */}
          <button
            onClick={handleStravaLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#FC4C02] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#e34402] transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Continuer avec Strava
          </button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-4 text-sm text-gray-500">info</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        {/* Info text */}
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>
            Enduzo utilise Garmin ou Strava pour t'identifier.
          </p>
          <p>
            <a href="/privacy" className="text-blue-600 hover:underline">
              Politique de confidentialite
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
