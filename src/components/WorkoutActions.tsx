import { useState } from 'react';
import { Workout, WorkoutSource } from '../lib/types';
import { workoutStore } from '../lib/workoutStore';
import { GarminSyncModal } from './GarminSyncModal';

interface WorkoutActionsProps {
  workout: Workout;
  source: WorkoutSource;
  onSaved?: () => void;
  onSynced?: () => void;
  showSaveButton?: boolean;
  savedWorkoutId?: string; // Si déjà sauvegardé
}

export function WorkoutActions({
  workout,
  source,
  onSaved,
  onSynced,
  showSaveButton = true,
  savedWorkoutId,
}: WorkoutActionsProps) {
  const [isSaved, setIsSaved] = useState(!!savedWorkoutId);
  const [currentSavedId, setCurrentSavedId] = useState(savedWorkoutId);
  const [showGarminModal, setShowGarminModal] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSave = () => {
    const saved = workoutStore.save(workout, source);
    setIsSaved(true);
    setCurrentSavedId(saved.id);
    setSaveMessage('Séance sauvegardée !');
    setTimeout(() => setSaveMessage(null), 2000);
    onSaved?.();
  };

  const handleSyncSuccess = () => {
    if (currentSavedId) {
      workoutStore.markAsSynced(currentSavedId);
    }
    setShowGarminModal(false);
    onSynced?.();
  };

  return (
    <>
      <div className="flex gap-3 flex-wrap">
        {showSaveButton && !isSaved && (
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Sauvegarder
          </button>
        )}

        {showSaveButton && isSaved && (
          <span className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Sauvegardé
          </span>
        )}

        <button
          onClick={() => setShowGarminModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Garmin
        </button>
      </div>

      {saveMessage && (
        <p className="mt-2 text-sm text-green-600">{saveMessage}</p>
      )}

      {showGarminModal && (
        <GarminSyncModal
          workout={workout}
          onClose={() => setShowGarminModal(false)}
          onSuccess={handleSyncSuccess}
        />
      )}
    </>
  );
}
