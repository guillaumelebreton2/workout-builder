/**
 * Service de stockage des séances
 * Pour l'instant : localStorage
 * Plus tard : remplacer par appels API Supabase
 */

import { Workout, SavedWorkout, WorkoutSource, generateId } from './types';

const STORAGE_KEY = 'workout-builder-saved-workouts';

// Récupérer toutes les séances sauvegardées
export function getAllWorkouts(): SavedWorkout[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    console.error('Erreur lors de la lecture des séances');
    return [];
  }
}

// Sauvegarder une nouvelle séance
export function saveWorkout(workout: Workout, source: WorkoutSource): SavedWorkout {
  const savedWorkout: SavedWorkout = {
    id: generateId(),
    workout,
    createdAt: new Date().toISOString(),
    source,
    syncedToGarmin: false,
  };

  const workouts = getAllWorkouts();
  workouts.unshift(savedWorkout); // Ajouter au début (plus récent en premier)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));

  return savedWorkout;
}

// Récupérer une séance par ID
export function getWorkoutById(id: string): SavedWorkout | undefined {
  const workouts = getAllWorkouts();
  return workouts.find(w => w.id === id);
}

// Supprimer une séance
export function deleteWorkout(id: string): boolean {
  const workouts = getAllWorkouts();
  const index = workouts.findIndex(w => w.id === id);

  if (index === -1) return false;

  workouts.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  return true;
}

// Marquer une séance comme synchronisée
export function markAsSynced(id: string): boolean {
  const workouts = getAllWorkouts();
  const workout = workouts.find(w => w.id === id);

  if (!workout) return false;

  workout.syncedToGarmin = true;
  workout.syncedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  return true;
}

// Mettre à jour une séance
export function updateWorkout(id: string, updates: Partial<SavedWorkout>): boolean {
  const workouts = getAllWorkouts();
  const index = workouts.findIndex(w => w.id === id);

  if (index === -1) return false;

  workouts[index] = { ...workouts[index], ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  return true;
}

// Obtenir le nombre de séances
export function getWorkoutCount(): number {
  return getAllWorkouts().length;
}

// Vider toutes les séances (utile pour les tests)
export function clearAllWorkouts(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Export pour faciliter le remplacement futur par Supabase
export const workoutStore = {
  getAll: getAllWorkouts,
  save: saveWorkout,
  getById: getWorkoutById,
  delete: deleteWorkout,
  markAsSynced,
  update: updateWorkout,
  count: getWorkoutCount,
  clear: clearAllWorkouts,
};
