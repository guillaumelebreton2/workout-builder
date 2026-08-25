import { useState, useEffect } from 'react';
import { Workout, SPORT_LABELS } from '../lib/types';
import { workoutStore } from '../lib/workoutStore';
import { useAuth } from '../lib/authContext';
import { WorkoutPreview } from './WorkoutPreview';

export function SharePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSharedWorkout = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        if (!cancelled) {
          setError('Lien de partage invalide.');
          setLoading(false);
        }
        return;
      }

      try {
        const data = await workoutStore.fetchSharedWorkout(token);
        if (cancelled) return;
        if (data) {
          setWorkout(data);
        } else {
          setError('Ce lien de partage est invalide ou a expiré.');
        }
      } catch {
        if (!cancelled) {
          setError('Impossible de charger la séance partagée.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSharedWorkout();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleImport = () => {
    if (!workout) return;
    workoutStore.save(workout, 'manual');
    setImported(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <svg className="w-16 h-16 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!workout) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-gray-900">Enduzo</a>
          <a
            href="/saved-workouts"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            Mes séances
          </a>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{workout.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-700">
                  {SPORT_LABELS[workout.sport]}
                </span>
              </div>
              {workout.description && (
                <p className="text-gray-600">{workout.description}</p>
              )}
            </div>

            <WorkoutPreview steps={workout.steps} />

            <div className="mt-6 flex flex-wrap gap-3">
              {isAuthenticated ? (
                imported ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Séance importée
                  </div>
                ) : (
                  <button
                    onClick={handleImport}
                    className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Importer dans mes séances
                  </button>
                )
              ) : (
                <a
                  href="/login"
                  className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Se connecter pour importer
                </a>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
