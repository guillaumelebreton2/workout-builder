import { useState, useEffect } from 'react';
import { Workout } from '../lib/types';

interface GarminSyncModalProps {
  workout: Workout;
  onClose: () => void;
  onSuccess: () => void;
}

// En production (Vercel), utiliser /api, en dev utiliser localhost:3001
const BACKEND_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

// Sauvegarder les identifiants via Credential Management API (sécurisé)
async function saveCredentials(email: string, password: string) {
  if (!navigator.credentials || !window.PasswordCredential) {
    // Fallback: ne stocker que l'email en localStorage (pas le mot de passe)
    localStorage.setItem('garmin_email', email);
    return;
  }

  try {
    const credential = new PasswordCredential({
      id: email,
      password: password,
      name: 'Garmin Connect',
    });
    await navigator.credentials.store(credential);
  } catch (e) {
    console.warn('Impossible de sauvegarder les credentials:', e);
    // Fallback: stocker juste l'email
    localStorage.setItem('garmin_email', email);
  }
}

// Récupérer les identifiants via Credential Management API
async function getCredentials(): Promise<{ email: string; password: string } | null> {
  if (!navigator.credentials || !window.PasswordCredential) {
    // Fallback: récupérer l'email depuis localStorage
    const email = localStorage.getItem('garmin_email');
    return email ? { email, password: '' } : null;
  }

  try {
    const credential = await navigator.credentials.get({
      password: true,
      mediation: 'silent', // Ne pas afficher de popup
    }) as PasswordCredential | null;

    if (credential && credential.password) {
      return { email: credential.id, password: credential.password };
    }
  } catch (e) {
    console.warn('Impossible de récupérer les credentials:', e);
  }

  // Fallback: récupérer l'email depuis localStorage
  const email = localStorage.getItem('garmin_email');
  return email ? { email, password: '' } : null;
}

async function syncWorkout(email: string, password: string, workout: Workout) {
  const response = await fetch(`${BACKEND_URL}/api/sync-garmin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      workout: {
        name: workout.name,
        description: workout.description,
        sport: workout.sport,
        date: workout.date.toISOString(),
        steps: workout.steps.map(step => ({
          type: step.type,
          name: step.name,
          duration: step.duration,
          details: step.details,
        })),
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erreur lors de la synchronisation');
  }

  return data;
}

export function GarminSyncModal({ workout, onClose, onSuccess }: GarminSyncModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [autoSyncTried, setAutoSyncTried] = useState(false);

  // Au montage, essayer de sync automatiquement si on a des identifiants
  useEffect(() => {
    if (autoSyncTried) return;

    setAutoSyncTried(true);
    setIsLoading(true);

    getCredentials()
      .then((creds) => {
        if (creds?.email) setEmail(creds.email);
        if (creds?.password) setPassword(creds.password);

        // Si on a les deux, tenter une sync automatique
        if (creds?.email && creds?.password) {
          return syncWorkout(creds.email, creds.password, workout)
            .then(() => {
              onSuccess();
            })
            .catch((err) => {
              console.log('Auto-sync échoué:', err.message);
              setShowForm(true);
              setIsLoading(false);
            });
        } else {
          // Pas d'identifiants complets, afficher le formulaire
          setShowForm(true);
          setIsLoading(false);
        }
      })
      .catch(() => {
        setShowForm(true);
        setIsLoading(false);
      });
  }, [workout, onSuccess, autoSyncTried]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await syncWorkout(email, password, workout);

      // Sauvegarder les identifiants de manière sécurisée
      await saveCredentials(email, password);

      onSuccess();
    } catch (err) {
      console.error('Erreur sync Garmin:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Impossible de contacter le serveur.');
      } else {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Affichage loading pendant l'auto-sync
  if (isLoading && !showForm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 shadow-xl text-center">
          <svg className="animate-spin h-12 w-12 mx-auto mb-4 text-orange-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-700 font-medium">Synchronisation avec Garmin...</p>
        </div>
      </div>
    );
  }

  // Formulaire de connexion
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Connexion Garmin Connect
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Entre tes identifiants pour synchroniser "{workout.name}".
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="garmin-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Garmin
            </label>
            <input
              type="email"
              id="garmin-email"
              name="username"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ton@email.com"
            />
          </div>

          <div>
            <label htmlFor="garmin-password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe Garmin
            </label>
            <input
              type="password"
              id="garmin-password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Synchronisation...
                </>
              ) : (
                'Synchroniser'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
