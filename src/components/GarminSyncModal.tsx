import { useState, useEffect } from 'react';
import { Workout } from '../lib/types';
import {
  encryptCredentials,
  decryptCredentials,
  hasEncryptedCredentials,
  clearEncryptedCredentials,
} from '../lib/crypto';

interface GarminSyncModalProps {
  workout: Workout;
  onClose: () => void;
  onSuccess: () => void;
}

// En production (Vercel), utiliser /api, en dev utiliser localhost:3001
const BACKEND_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

async function syncWorkout(email: string, password: string, workout: Workout) {
  const response = await fetch(`${BACKEND_URL}/api/sync-garmin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
          notes: step.notes,
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

type Step = 'loading' | 'pin' | 'credentials' | 'syncing';

export function GarminSyncModal({ workout, onClose, onSuccess }: GarminSyncModalProps) {
  const [step, setStep] = useState<Step>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Vérifier si des credentials existent
  useEffect(() => {
    const exists = hasEncryptedCredentials();
    setStep(exists ? 'pin' : 'credentials');
  }, []);

  // Déchiffrer et synchroniser avec le PIN
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep('syncing');

    try {
      const creds = await decryptCredentials(pin);
      if (!creds) {
        setError('Code PIN incorrect');
        setStep('pin');
        setPin('');
        return;
      }

      await syncWorkout(creds.email, creds.password, workout);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStep('pin');
    }
  };

  // Sauvegarder les credentials et synchroniser
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pin.length < 4) {
      setError('Le code PIN doit contenir au moins 4 chiffres');
      return;
    }

    setStep('syncing');

    try {
      await syncWorkout(email, password, workout);
      await encryptCredentials(email, password, pin);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStep('credentials');
    }
  };

  // Réinitialiser les credentials
  const handleReset = () => {
    clearEncryptedCredentials();
    setStep('credentials');
    setEmail('');
    setPassword('');
    setPin('');
    setError(null);
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
        </div>
      </div>
    );
  }

  // Demande du PIN
  if (step === 'pin') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Code PIN</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
              &times;
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Entre ton code PIN pour synchroniser "{workout.name}".
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              maxLength={6}
              autoFocus
              className="w-full p-4 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pin.length < 4}
              className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Synchroniser
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Utiliser d'autres identifiants
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Formulaire credentials + PIN
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Connexion Garmin</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Entre tes identifiants Garmin et choisis un code PIN pour les protéger.
        </p>

        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Garmin
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="ton@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe Garmin
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code PIN (4-6 chiffres)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              required
              maxLength={6}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="••••"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ce PIN protège tes identifiants. Tu devras l'entrer à chaque synchro.
            </p>
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
              disabled={pin.length < 4}
              className="flex-1 bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Synchroniser
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
