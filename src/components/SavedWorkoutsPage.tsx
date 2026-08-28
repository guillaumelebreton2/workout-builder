import { useState } from 'react';
import { SavedWorkout } from '../lib/types';
import { workoutStore } from '../lib/workoutStore';
import { convertToGarminFormat } from '../lib/garmin-format';
import { GarminWorkoutPreview } from './GarminWorkoutPreview';
import { GarminSyncModal } from './GarminSyncModal';
import { ShareWorkoutDialog } from './ShareWorkoutDialog';

interface SavedWorkoutsPageProps {
  onNavigate: (page: 'home' | 'workouts' | 'coach' | 'stats' | 'profile' | 'account' | 'saved-workouts') => void;
}

export function SavedWorkoutsPage({ onNavigate }: SavedWorkoutsPageProps) {
  const [workouts, setWorkouts] = useState<SavedWorkout[]>(() => workoutStore.getAll());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncWorkout, setSyncWorkout] = useState<SavedWorkout | null>(null);
  const [shareWorkout, setShareWorkout] = useState<SavedWorkout | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = Array.from(new Set(workouts.flatMap(w => w.workout.tags || []))).sort();
  const filteredWorkouts = selectedTag
    ? workouts.filter(w => w.workout.tags?.includes(selectedTag))
    : workouts;

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

  const getSportBadge = (sport: string) => {
    switch (sport) {
      case 'running': return 'bg-orange-500/15 text-orange-300 border border-orange-500/30';
      case 'cycling': return 'bg-blue-500/15 text-blue-300 border border-blue-500/30';
      case 'swimming': return 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30';
      default: return 'bg-gray-500/15 text-gray-300 border border-gray-500/30';
    }
  };

  const SPORT_ICONS: Record<string, React.ReactNode> = {
    running: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 -960 960 960">
        <path d="M520-40v-240l-84-80-40 176-276-56 16-80 192 40 64-324-72 28v136h-80v-188l158-68q35-15 51.5-19.5T480-720q21 0 39 11t29 29l40 64q26 42 70.5 69T760-520v80q-66 0-123.5-27.5T540-540l-24 120 84 80v300h-80Zm-36.5-723.5Q460-787 460-820t23.5-56.5Q507-900 540-900t56.5 23.5Q620-853 620-820t-23.5 56.5Q573-740 540-740t-56.5-23.5Z"/>
      </svg>
    ),
    cycling: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 -960 960 960">
        <path d="M200-80q-83 0-141.5-58.5T0-280q0-83 58.5-141.5T200-480q83 0 141.5 58.5T400-280q0 83-58.5 141.5T200-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Zm155-5v-200L312-512q-12-11-18-25.5t-6-30.5q0-16 6.5-30.5T312-624l112-112q12-12 27.5-18t32.5-6q17 0 32.5 6t27.5 18l76 76q28 28 64 44t76 16v80q-57 0-108.5-22T560-604l-32-32-96 96 88 92v248h-80Zm123.5-563.5Q540-787 540-820t23.5-56.5Q587-900 620-900t56.5 23.5Q700-853 700-820t-23.5 56.5Q653-740 620-740t-56.5-23.5ZM760-80q-83 0-141.5-58.5T560-280q0-83 58.5-141.5T760-480q83 0 141.5 58.5T960-280q0 83-58.5 141.5T760-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Z"/>
      </svg>
    ),
    swimming: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 -960 960 960">
        <path d="M80-120v-80q38 0 57-20t75-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-160q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-54.5 20T80-120Zm0-180v-80q38 0 57-20t75-20q56 0 77.5 20t56.5 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-340q-36 0-55.5 20T614-300q-57 0-77.5-20T480-340q-38 0-56.5 20T346-300q-59 0-78.5-20T212-340q-36 0-54.5 20T80-300Zm196-204 133-133-40-40q-33-33-70-48t-91-15v-100q75 0 124 16.5t96 63.5l256 256q-17 11-33 17.5t-37 6.5q-36 0-57-20t-77-20q-56 0-77 20t-57 20q-21 0-37-6.5T276-504Zm463-306.5q29 29.5 29 70.5 0 42-29 71t-71 29q-42 0-71-29t-29-71q0-41 29-70.5t71-29.5q42 0 71 29.5Z"/>
      </svg>
    ),
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Aucune séance sauvegardée</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
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
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedTag === null
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                }`}
              >
                Toutes
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedTag === tag
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {filteredWorkouts.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              Aucune séance ne correspond à ce filtre.
            </p>
          )}

          {filteredWorkouts.map((saved) => (
            <div
              key={saved.id}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Header de la carte */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
                onClick={() => setExpandedId(expandedId === saved.id ? null : saved.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {saved.workout.name}
                      </h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getSportBadge(saved.workout.sport)}`}>
                        {SPORT_ICONS[saved.workout.sport]}
                        {getSportLabel(saved.workout.sport)}
                      </span>
                      {saved.syncedToGarmin && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-300 border border-green-500/30 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                          </svg>
                          Synchronisé
                        </span>
                      )}
                    </div>
                    {saved.workout.tags && saved.workout.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {saved.workout.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
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
                  <div className="p-4 bg-gray-950">
                    <GarminWorkoutPreview garminWorkout={saved.garminWorkout || convertToGarminFormat(saved.workout)} />
                  </div>

                  {/* Actions */}
                  <div className="p-4 flex gap-3 flex-wrap">
                    <button
                      onClick={() => setSyncWorkout(saved)}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                      </svg>
                      Sync Garmin
                    </button>

                    <button
                      onClick={() => setShareWorkout(saved)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Partager
                    </button>

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
                          className="px-3 py-1 bg-gray-200 text-gray-700 dark:text-gray-200 rounded text-sm font-medium hover:bg-gray-300"
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(saved.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-200 transition-colors"
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
          garminWorkout={syncWorkout.garminWorkout}
          onClose={() => setSyncWorkout(null)}
          onSuccess={() => handleSyncSuccess(syncWorkout.id)}
        />
      )}

      {/* Modal Partager */}
      {shareWorkout && (
        <ShareWorkoutDialog
          savedWorkout={shareWorkout}
          onClose={() => setShareWorkout(null)}
        />
      )}
    </div>
  );
}
