/**
 * Service de stockage des séances
 * localStorage (sync) + Vercel KV (async)
 */

import { Workout, SavedWorkout, WorkoutSource, generateId } from './types';

const STORAGE_KEY = 'workout-builder-saved-workouts';
const API_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

// ============== LOCAL STORAGE (sync) ==============

// Récupérer toutes les séances depuis localStorage
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

// Sauvegarder dans localStorage
function saveToLocal(workouts: SavedWorkout[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
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
  workouts.unshift(savedWorkout);
  saveToLocal(workouts);

  // Sync to server in background
  createWorkoutOnServer(savedWorkout).catch(err => {
    console.warn('Failed to sync workout to server:', err);
  });

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
  saveToLocal(workouts);

  // Sync to server in background
  deleteWorkoutOnServer(id).catch(err => {
    console.warn('Failed to delete workout on server:', err);
  });

  return true;
}

// Marquer une séance comme synchronisée
export function markAsSynced(id: string): boolean {
  const workouts = getAllWorkouts();
  const workout = workouts.find(w => w.id === id);

  if (!workout) return false;

  workout.syncedToGarmin = true;
  workout.syncedAt = new Date().toISOString();
  saveToLocal(workouts);

  // Sync to server in background
  updateWorkoutOnServer(id, { syncedToGarmin: true, syncedAt: workout.syncedAt }).catch(err => {
    console.warn('Failed to sync workout status to server:', err);
  });

  return true;
}

// Mettre à jour une séance
export function updateWorkout(id: string, updates: Partial<SavedWorkout>): boolean {
  const workouts = getAllWorkouts();
  const index = workouts.findIndex(w => w.id === id);

  if (index === -1) return false;

  workouts[index] = { ...workouts[index], ...updates };
  saveToLocal(workouts);

  // Sync to server in background
  updateWorkoutOnServer(id, updates).catch(err => {
    console.warn('Failed to update workout on server:', err);
  });

  return true;
}

// Obtenir le nombre de séances
export function getWorkoutCount(): number {
  return getAllWorkouts().length;
}

// Vider toutes les séances
export function clearAllWorkouts(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ============== SERVER SYNC (async) ==============

// Fetch workouts from server
export async function fetchWorkoutsFromServer(): Promise<SavedWorkout[] | null> {
  try {
    const response = await fetch(`${API_URL}/api/workouts/list`, {
      credentials: 'include'
    });
    if (!response.ok) {
      if (response.status === 401) return null;
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.workouts || [];
  } catch (error) {
    console.error('Failed to fetch workouts from server:', error);
    return null;
  }
}

// Create workout on server
async function createWorkoutOnServer(workout: SavedWorkout): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/workouts/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ workout })
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to create workout on server:', error);
    return false;
  }
}

// Update workout on server
async function updateWorkoutOnServer(id: string, updates: Partial<SavedWorkout>): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/workouts/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, updates })
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to update workout on server:', error);
    return false;
  }
}

// Delete workout on server
async function deleteWorkoutOnServer(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/workouts/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id })
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to delete workout on server:', error);
    return false;
  }
}

// Bulk sync to server
async function syncWorkoutsToServer(workouts: SavedWorkout[]): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/workouts/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ workouts })
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to sync workouts to server:', error);
    return false;
  }
}

// Sync: merge local and server workouts
export async function syncWorkoutsFromServer(): Promise<SavedWorkout[]> {
  const serverWorkouts = await fetchWorkoutsFromServer();
  const localWorkouts = getAllWorkouts();

  if (serverWorkouts === null) {
    // Not authenticated or error - upload local if any
    if (localWorkouts.length > 0) {
      await syncWorkoutsToServer(localWorkouts);
    }
    return localWorkouts;
  }

  if (serverWorkouts.length === 0 && localWorkouts.length > 0) {
    // Server empty, upload local
    await syncWorkoutsToServer(localWorkouts);
    return localWorkouts;
  }

  if (serverWorkouts.length > 0 && localWorkouts.length === 0) {
    // Local empty, download server
    saveToLocal(serverWorkouts);
    return serverWorkouts;
  }

  // Both have data - merge by ID, keep all unique
  const merged = new Map<string, SavedWorkout>();

  // Add server workouts first
  for (const w of serverWorkouts) {
    merged.set(w.id, w);
  }

  // Add/update with local workouts (local wins for same ID)
  for (const w of localWorkouts) {
    const existing = merged.get(w.id);
    if (!existing) {
      merged.set(w.id, w);
    } else {
      // Keep the one with more recent createdAt or syncedAt
      const localTime = new Date(w.syncedAt || w.createdAt).getTime();
      const serverTime = new Date(existing.syncedAt || existing.createdAt).getTime();
      if (localTime >= serverTime) {
        merged.set(w.id, w);
      }
    }
  }

  // Sort by createdAt descending
  const result = Array.from(merged.values()).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Save merged result
  saveToLocal(result);
  await syncWorkoutsToServer(result);

  return result;
}

// ============== EXPORT ==============

export const workoutStore = {
  getAll: getAllWorkouts,
  save: saveWorkout,
  getById: getWorkoutById,
  delete: deleteWorkout,
  markAsSynced,
  update: updateWorkout,
  count: getWorkoutCount,
  clear: clearAllWorkouts,
  // Server sync
  fetchFromServer: fetchWorkoutsFromServer,
  syncFromServer: syncWorkoutsFromServer,
};
