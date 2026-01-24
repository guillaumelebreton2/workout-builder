import { useState, useEffect } from 'react';
import { Workout } from '../lib/types';

interface GarminSyncModalProps {
  workout: Workout;
  onClose: () => void;
  onSuccess: () => void;
}

interface GarminStatus {
  connected: boolean;
  garminUserId?: string;
  needsRefresh?: boolean;
  reason?: string;
}

// En production (Vercel), utiliser /api, en dev utiliser localhost:3001
const API_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

async function checkGarminStatus(): Promise<GarminStatus> {
  try {
    const response = await fetch(`${API_URL}/api/garmin/status`, {
      credentials: 'include'
    });
    return await response.json();
  } catch {
    return { connected: false, reason: 'network_error' };
  }
}

async function syncWorkoutToGarmin(workout: Workout, scheduleDate?: string) {
  const response = await fetch(`${API_URL}/api/garmin/sync-workout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      workout: {
        name: workout.name,
        description: workout.description,
        sport: workout.sport,
        steps: workout.steps.map(step => ({
          type: step.type,
          name: step.name,
          notes: step.notes,
          duration: step.duration,
          details: step.details,
          repetitions: step.repetitions,
          steps: step.steps?.map(s => ({
            type: s.type,
            name: s.name,
            notes: s.notes,
            duration: s.duration,
            details: s.details,
          })),
        })),
      },
      scheduleDate: scheduleDate,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erreur lors de la synchronisation');
  }
  return data;
}

async function disconnectGarmin() {
  await fetch(`${API_URL}/api/garmin/disconnect`, {
    method: 'POST',
    credentials: 'include'
  });
}

type Step = 'loading' | 'not_connected' | 'connected' | 'syncing' | 'success' | 'error';

export function GarminSyncModal({ workout, onClose, onSuccess }: GarminSyncModalProps) {
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState<string | null>(null);
  const [scheduleForDate, setScheduleForDate] = useState(true);
  const [syncResult, setSyncResult] = useState<{ workoutId?: number; scheduled?: boolean } | null>(null);

  // Vérifier le statut de connexion au chargement
  useEffect(() => {
    checkGarminStatus().then(status => {
      setStep(status.connected ? 'connected' : 'not_connected');
    });
  }, []);

  // Gérer le retour après OAuth (paramètre URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const garminConnected = params.get('garmin_connected');
    const garminError = params.get('garmin_error');

    if (garminConnected === 'true') {
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
      setStep('connected');
    } else if (garminError) {
      window.history.replaceState({}, '', window.location.pathname);
      setError(decodeURIComponent(garminError));
      setStep('error');
    }
  }, []);

  const handleConnect = () => {
    // Rediriger vers l'endpoint OAuth
    window.location.href = `${API_URL}/api/garmin/auth`;
  };

  const handleSync = async () => {
    setError(null);
    setStep('syncing');

    try {
      const date = scheduleForDate
        ? workout.date.toISOString().split('T')[0]
        : undefined;

      const result = await syncWorkoutToGarmin(workout, date);
      setSyncResult(result);
      setStep('success');

      // Appeler onSuccess après un délai pour montrer le message de succès
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setStep('error');
    }
  };

  const handleDisconnect = async () => {
    await disconnectGarmin();
    setStep('not_connected');
  };

  const handleRetry = () => {
    setError(null);
    checkGarminStatus().then(status => {
      setStep(status.connected ? 'connected' : 'not_connected');
    });
  };

  // Loading
  if (step === 'loading') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 shadow-xl">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  // Syncing
  if (step === 'syncing') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 shadow-xl text-center">
          <div className="animate-spin h-12 w-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Synchronisation avec Garmin...</p>
          <p className="text-gray-500 text-sm mt-2">Création de la séance "{workout.name}"</p>
        </div>
      </div>
    );
  }

  // Success
  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 shadow-xl text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Synchronisé !</h3>
          <p className="text-gray-600 text-sm">
            "{workout.name}" a été ajouté à Garmin Connect
            {syncResult?.scheduled && " et planifié dans ton calendrier"}.
          </p>
        </div>
      </div>
    );
  }

  // Not connected - Show connect button
  if (step === 'not_connected') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Synchroniser avec Garmin</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
              &times;
            </button>
          </div>

          <div className="text-center py-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>

            <h3 className="text-lg font-medium text-gray-800 mb-2">
              Connecte ton compte Garmin
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              Pour synchroniser tes séances, autorise Enduzo à accéder à ton compte Garmin Connect.
            </p>

            <button
              onClick={handleConnect}
              className="w-full bg-[#007CC3] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#006AAD] transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              Connecter avec Garmin
            </button>

            <p className="text-xs text-gray-500 mt-4">
              Tu seras redirigé vers Garmin pour t'authentifier de manière sécurisée.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (step === 'error') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Erreur</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
              &times;
            </button>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <p className="text-red-700">{error}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handleRetry}
              className="flex-1 bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Connected - Ready to sync
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Synchroniser avec Garmin</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        {/* Workout info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-gray-800">{workout.name}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {workout.sport === 'running' ? 'Course' : workout.sport === 'cycling' ? 'Vélo' : 'Natation'}
            {' • '}
            {workout.steps.length} étape{workout.steps.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Schedule option */}
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={scheduleForDate}
            onChange={(e) => setScheduleForDate(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <div>
            <p className="font-medium text-gray-800">Planifier la séance</p>
            <p className="text-sm text-gray-600">
              Ajouter au calendrier pour le {workout.date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </p>
          </div>
        </label>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSync}
            className="flex-1 bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            Synchroniser
          </button>
        </div>

        {/* Disconnect link */}
        <div className="mt-4 text-center">
          <button
            onClick={handleDisconnect}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Déconnecter Garmin
          </button>
        </div>
      </div>
    </div>
  );
}
