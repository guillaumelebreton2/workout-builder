import { useState, useEffect } from 'react';
import { SavedWorkout } from '../lib/types';
import { workoutStore } from '../lib/workoutStore';
import { WorkoutPreview } from './WorkoutPreview';
import { GarminSyncModal } from './GarminSyncModal';

interface SavedWorkoutsPageProps {
  onNavigate: (page: 'home' | 'workouts' | 'coach' | 'stats' | 'profile' | 'account' | 'saved-workouts') => void;
}

export function SavedWorkoutsPage({ onNavigate }: SavedWorkoutsPageProps) {
  const [workouts, setWorkouts] = useState<SavedWorkout[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncWorkout, setSyncWorkout] = useState<SavedWorkout | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Charger les séances au montage
  useEffect(() => {
    setWorkouts(workoutStore.getAll());
  }, []);

  const handleDelete = (id: string) => {
    workoutStore.delete(id);
    setWorkouts(workoutStore.getAll());
    setDeleteConfirmId(null);
  };

  const handleSyncSuccess = (id: string) => {
    workoutStore.markAsSynced(id);
    setWorkouts(workoutStore.getAll());
    setSyncWorkout(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSportLabel = (sport: string) => {
    switch (sport) {
      case 'running': return 'Course';
      case 'cycling': return 'Vélo';
      case 'swimming': return 'Natation';
      default: return sport;
    }
  };

  const getSportColor = (sport: string) => {
    switch (sport) {
      case 'running': return 'bg-green-100 text-green-700';
      case 'cycling': return 'bg-blue-100 text-blue-700';
      case 'swimming': return 'bg-cyan-100 text-cyan-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Mes séances
        </h1>
        <p className="text-gray-600">
          {workouts.length} séance{workouts.length > 1 ? 's' : ''} sauvegardée{workouts.length > 1 ? 's' : ''}
        </p>
      </header>

      {workouts.length === 0 ? (
        <div className="max-w-md mx-auto text-center py-12">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune séance sauvegardée</h3>
          <p className="text-gray-600 mb-6">
            Crée ta première séance pour la retrouver ici.
          </p>
          <button
            onClick={() => onNavigate('workouts')}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            Créer une séance
          </button>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-4">
          {workouts.map((saved) => (
            <div
              key={saved.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Header de la carte */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(expandedId === saved.id ? null : saved.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {saved.workout.name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSportColor(saved.workout.sport)}`}>
                        {getSportLabel(saved.workout.sport)}
                      </span>
                      {saved.syncedToGarmin && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          Synced
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatDate(saved.createdAt)} • {saved.workout.steps.length} étape{saved.workout.steps.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedId === saved.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Contenu expandé */}
              {expandedId === saved.id && (
                <div className="border-t border-gray-100">
                  {/* Preview */}
                  <div className="p-4 bg-gray-50">
                    <WorkoutPreview steps={saved.workout.steps} />
                  </div>

                  {/* Actions */}
                  <div className="p-4 flex gap-3 flex-wrap">
                    {!saved.syncedToGarmin && (
                      <button
                        onClick={() => setSyncWorkout(saved)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                        </svg>
                        Sync Garmin
                      </button>
                    )}

                    {deleteConfirmId === saved.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Supprimer ?</span>
                        <button
                          onClick={() => handleDelete(saved.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600"
                        >
                          Oui
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300"
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(saved.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Sync Garmin */}
      {syncWorkout && (
        <GarminSyncModal
          workout={syncWorkout.workout}
          onClose={() => setSyncWorkout(null)}
          onSuccess={() => handleSyncSuccess(syncWorkout.id)}
        />
      )}
    </div>
  );
}
