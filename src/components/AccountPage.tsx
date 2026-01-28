import { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';

const API_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

interface GarminStatus {
  connected: boolean;
  garminUserId?: string;
}

interface StravaStatus {
  connected: boolean;
  athleteName?: string;
}

export function AccountPage() {
  const { user, logout } = useAuth();
  const [garminStatus, setGarminStatus] = useState<GarminStatus>({ connected: false });
  const [stravaStatus, setStravaStatus] = useState<StravaStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    setLoading(true);
    try {
      // Check Garmin status
      const garminRes = await fetch(`${API_URL}/api/garmin/status`, {
        credentials: 'include'
      });
      if (garminRes.ok) {
        const data = await garminRes.json();
        setGarminStatus({ connected: data.connected, garminUserId: data.garminUserId });
      }
    } catch (e) {
      console.warn('Failed to check Garmin status:', e);
    }

    // Check Strava status from user data
    if (user?.stravaConnected) {
      setStravaStatus({ connected: true });
    }

    setLoading(false);
  };

  const handleGarminConnect = () => {
    window.location.href = `${API_URL}/api/garmin/auth`;
  };

  const handleGarminDisconnect = async () => {
    try {
      await fetch(`${API_URL}/api/garmin/disconnect`, {
        method: 'POST',
        credentials: 'include'
      });
      setGarminStatus({ connected: false });
    } catch (e) {
      console.error('Failed to disconnect Garmin:', e);
    }
  };

  const handleStravaConnect = () => {
    window.location.href = `${API_URL}/api/strava/auth`;
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Compte & Connectivite</h1>

      {/* Account Info */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Informations du compte
        </h2>

        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Nom</span>
            <span className="font-medium text-gray-900">{user.name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Compte cree via</span>
            <span className="font-medium text-gray-900">
              {user.authProvider === 'garmin' ? 'Garmin Connect' : 'Strava'}
            </span>
          </div>
          {user.createdAt && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Membre depuis</span>
              <span className="font-medium text-gray-900">
                {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Connectivity */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Connectivite
        </h2>

        <p className="text-sm text-gray-500 mb-4">
          Connecte tes comptes pour synchroniser tes seances et importer tes activites.
        </p>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-orange-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Garmin */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#007CC3] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Garmin Connect</p>
                  <p className="text-sm text-gray-500">
                    {garminStatus.connected ? 'Connecte - Sync workouts' : 'Non connecte'}
                  </p>
                </div>
              </div>
              {garminStatus.connected ? (
                <button
                  onClick={handleGarminDisconnect}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Deconnecter
                </button>
              ) : (
                <button
                  onClick={handleGarminConnect}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#007CC3] hover:bg-[#006AAD] rounded-lg transition-colors"
                >
                  Connecter
                </button>
              )}
            </div>

            {/* Strava */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FC4C02] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Strava</p>
                  <p className="text-sm text-gray-500">
                    {stravaStatus.connected || user.stravaConnected
                      ? 'Connecte - Import activites'
                      : 'Non connecte'}
                  </p>
                </div>
              </div>
              {stravaStatus.connected || user.stravaConnected ? (
                <span className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg">
                  Actif
                </span>
              ) : (
                <button
                  onClick={handleStravaConnect}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#FC4C02] hover:bg-[#e34402] rounded-lg transition-colors"
                >
                  Connecter
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Danger Zone */}
      <section className="bg-white rounded-xl shadow-sm p-6 border border-red-100">
        <h2 className="text-lg font-semibold text-red-600 mb-4">Zone de danger</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Deconnexion du compte</p>
            <p className="text-sm text-gray-500">
              Tu seras deconnecte de ton compte Enduzo sur cet appareil.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Se deconnecter
          </button>
        </div>
      </section>
    </div>
  );
}
