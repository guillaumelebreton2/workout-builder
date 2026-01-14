/**
 * Service pour l'API Strava
 * Gère l'authentification et les appels API
 */

// En production, l'API est sur le même domaine (URL relative)
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';
const STORAGE_KEY = 'workout-builder-strava';

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // timestamp en secondes
  athlete_id?: string;
  athlete_name?: string;
}

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
  city?: string;
  country?: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string; // 'Run', 'Ride', 'Swim', etc.
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  average_speed: number; // m/s
  max_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  average_cadence?: number;
  average_watts?: number;
  kilojoules?: number;
}

// Récupérer les tokens stockés
export function getStoredTokens(): StravaTokens | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Sauvegarder les tokens
export function storeTokens(tokens: StravaTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

// Supprimer les tokens (déconnexion)
export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Vérifier si le token est expiré
export function isTokenExpired(tokens: StravaTokens): boolean {
  // Ajouter une marge de 5 minutes
  return Date.now() / 1000 > tokens.expires_at - 300;
}

// Rafraîchir le token
export async function refreshToken(refreshToken: string): Promise<StravaTokens | null> {
  try {
    const response = await fetch(`${API_BASE}/api/strava/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      console.error('Erreur refresh token:', response.status);
      return null;
    }

    const data = await response.json();
    const tokens: StravaTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };

    storeTokens(tokens);
    return tokens;
  } catch (err) {
    console.error('Erreur refresh token:', err);
    return null;
  }
}

// Obtenir un token valide (refresh si nécessaire)
export async function getValidToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;

  if (isTokenExpired(tokens)) {
    const newTokens = await refreshToken(tokens.refresh_token);
    if (!newTokens) {
      clearTokens();
      return null;
    }
    return newTokens.access_token;
  }

  return tokens.access_token;
}

// Démarrer le flux OAuth
export function startOAuthFlow(): void {
  window.location.href = `${API_BASE}/api/strava/auth`;
}

// Gérer le callback OAuth (appelé depuis le CoachPage)
export function handleOAuthCallback(): StravaTokens | null {
  const params = new URLSearchParams(window.location.search);

  if (params.get('strava_error')) {
    console.error('Erreur OAuth Strava:', params.get('strava_error'));
    // Nettoyer l'URL
    window.history.replaceState({}, '', window.location.pathname);
    return null;
  }

  if (params.get('strava_connected') === 'true') {
    const tokens: StravaTokens = {
      access_token: params.get('access_token') || '',
      refresh_token: params.get('refresh_token') || '',
      expires_at: parseInt(params.get('expires_at') || '0', 10),
      athlete_id: params.get('athlete_id') || undefined,
      athlete_name: params.get('athlete_name') || undefined,
    };

    if (tokens.access_token && tokens.refresh_token) {
      storeTokens(tokens);
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
      return tokens;
    }
  }

  return null;
}

// Récupérer les activités
export async function getActivities(options: {
  page?: number;
  perPage?: number;
  after?: Date;
  before?: Date;
} = {}): Promise<StravaActivity[]> {
  const token = await getValidToken();
  if (!token) throw new Error('Non connecté à Strava');

  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page.toString());
  if (options.perPage) params.append('per_page', options.perPage.toString());
  if (options.after) params.append('after', Math.floor(options.after.getTime() / 1000).toString());
  if (options.before) params.append('before', Math.floor(options.before.getTime() / 1000).toString());

  const response = await fetch(`${API_BASE}/api/strava/activities?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearTokens();
      throw new Error('Session expirée');
    }
    throw new Error('Erreur lors de la récupération des activités');
  }

  return response.json();
}

// Récupérer le profil de l'athlète
export async function getAthlete(): Promise<StravaAthlete> {
  const token = await getValidToken();
  if (!token) throw new Error('Non connecté à Strava');

  const response = await fetch(`${API_BASE}/api/strava/athlete`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearTokens();
      throw new Error('Session expirée');
    }
    throw new Error('Erreur lors de la récupération du profil');
  }

  return response.json();
}

// Vérifier si connecté
export function isConnected(): boolean {
  const tokens = getStoredTokens();
  return tokens !== null && tokens.access_token !== '';
}

// Types pour les données détaillées
export interface StravaActivityDetails extends StravaActivity {
  description?: string;
  calories?: number;
  splits_metric?: StravaSplit[];
  splits_standard?: StravaSplit[];
  laps?: StravaLap[];
  segment_efforts?: unknown[];
  best_efforts?: StravaBestEffort[];
  device_name?: string;
  embed_token?: string;
  photos?: unknown;
}

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  moving_time: number;
  average_speed: number;
  average_heartrate?: number;
  pace_zone?: number;
  split: number;
}

export interface StravaLap {
  id: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  lap_index: number;
  split: number;
  pace_zone?: number;
}

export interface StravaBestEffort {
  id: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  pr_rank?: number;
}

export interface StravaStream {
  type: string;
  data: number[];
  series_type: string;
  original_size: number;
  resolution: string;
}

export interface StravaStreams {
  time?: StravaStream;
  distance?: StravaStream;
  altitude?: StravaStream;
  velocity_smooth?: StravaStream;
  heartrate?: StravaStream;
  cadence?: StravaStream;
  watts?: StravaStream;
  temp?: StravaStream;
  moving?: StravaStream;
  grade_smooth?: StravaStream;
}

// Récupérer les détails d'une activité
export async function getActivityDetails(activityId: number): Promise<StravaActivityDetails> {
  const token = await getValidToken();
  if (!token) throw new Error('Non connecté à Strava');

  const response = await fetch(`${API_BASE}/api/strava/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearTokens();
      throw new Error('Session expirée');
    }
    throw new Error('Erreur lors de la récupération des détails');
  }

  return response.json();
}

// Récupérer les streams d'une activité (données seconde par seconde)
export async function getActivityStreams(activityId: number): Promise<StravaStreams> {
  const token = await getValidToken();
  if (!token) throw new Error('Non connecté à Strava');

  const response = await fetch(`${API_BASE}/api/strava/activities/${activityId}/streams`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearTokens();
      throw new Error('Session expirée');
    }
    throw new Error('Erreur lors de la récupération des streams');
  }

  return response.json();
}

// Récupérer les laps d'une activité
export async function getActivityLaps(activityId: number): Promise<StravaLap[]> {
  const token = await getValidToken();
  if (!token) throw new Error('Non connecté à Strava');

  const response = await fetch(`${API_BASE}/api/strava/activities/${activityId}/laps`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearTokens();
      throw new Error('Session expirée');
    }
    throw new Error('Erreur lors de la récupération des laps');
  }

  return response.json();
}

// Types pour les zones de l'athlète
export interface StravaZoneRange {
  min: number;
  max: number;
}

export interface StravaHeartRateZones {
  custom_zones: boolean;
  zones: StravaZoneRange[];
}

export interface StravaPowerZones {
  zones: StravaZoneRange[];
}

export interface StravaAthleteZones {
  heart_rate?: StravaHeartRateZones;
  power?: StravaPowerZones;
}

// Erreur spécifique pour les problèmes de scope
export class StravaScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StravaScopeError';
  }
}

// Récupérer les zones de l'athlète (FC et puissance)
export async function getAthleteZones(): Promise<StravaAthleteZones> {
  const token = await getValidToken();
  if (!token) throw new Error('Non connecté à Strava');

  const response = await fetch(`${API_BASE}/api/strava/athlete/zones`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearTokens();
      throw new Error('Session expirée');
    }
    if (response.status === 403) {
      throw new StravaScopeError('Accès refusé. Reconnecte-toi à Strava pour autoriser l\'accès aux zones.');
    }
    throw new Error('Erreur lors de la récupération des zones');
  }

  return response.json();
}

// Forcer une nouvelle authentification Strava (pour mettre à jour les scopes)
export function forceReauthentication(): void {
  clearTokens();
  startOAuthFlow();
}

// Export groupé
export const stravaApi = {
  getStoredTokens,
  storeTokens,
  clearTokens,
  isTokenExpired,
  refreshToken,
  getValidToken,
  startOAuthFlow,
  handleOAuthCallback,
  getActivities,
  getActivityDetails,
  getActivityStreams,
  getActivityLaps,
  getAthlete,
  getAthleteZones,
  forceReauthentication,
  isConnected,
};
