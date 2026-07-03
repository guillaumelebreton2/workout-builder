/**
 * Client API pour les activités unifiées (Strava + Garmin)
 *
 * En production : appelle le backend unifié /api/activities.
 * En dev local (si le backend unifié n'est pas servi par le serveur express) :
 * fallback sur l'API Strava directe.
 */
import { UnifiedActivitiesResponse, SyncActivitiesResponse, UnifiedActivity } from '../types/activity';
import { stravaApi } from './stravaApi';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

function normalizeStravaActivitiesForFallback(stravaActivities: unknown[]): UnifiedActivity[] {
  return stravaActivities.map((raw) => {
    const activity = raw as Record<string, unknown>;
    const id = activity.id as number;
    const type = (activity.type as string) || 'other';

    return {
      id: `strava:${id}`,
      source: 'strava' as const,
      externalId: String(id),
      name: (activity.name as string) || 'Activité Strava',
      type,
      rawType: (activity.sport_type as string) || type,
      startDate: activity.start_date as string,
      startDateLocal: (activity.start_date_local as string) || (activity.start_date as string),
      distance: Number(activity.distance) || 0,
      movingTime: Number(activity.moving_time) || 0,
      elapsedTime: Number(activity.elapsed_time) || 0,
      totalElevationGain: Number(activity.total_elevation_gain) || 0,
      averageSpeed: Number(activity.average_speed) || 0,
      maxSpeed: activity.max_speed ? Number(activity.max_speed) : undefined,
      averageHeartrate: activity.average_heartrate ? Number(activity.average_heartrate) : undefined,
      maxHeartrate: activity.max_heartrate ? Number(activity.max_heartrate) : undefined,
      averageCadence: activity.average_cadence ? Number(activity.average_cadence) : undefined,
      averageWatts: activity.average_watts ? Number(activity.average_watts) : undefined,
      kilojoules: activity.kilojoules ? Number(activity.kilojoules) : undefined,
      sufferScore: activity.suffer_score ? Number(activity.suffer_score) : undefined,
      providerActivityId: id,
      url: id ? `https://www.strava.com/activities/${id}` : undefined,
      location: (activity.location_city as string) || (activity.location_state as string) || undefined,
      description: activity.description as string | undefined,
      deviceName: activity.device_name as string | undefined,
      private: activity.private === true || activity.visibility === 'only_me',
      raw: activity,
    };
  });
}

export async function getUnifiedActivities(options: {
  forceSync?: boolean;
} = {}): Promise<UnifiedActivitiesResponse> {
  try {
    const params = new URLSearchParams();
    if (options.forceSync) params.append('sync', 'true');

    const response = await fetch(`${API_BASE}/api/activities?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      // En dev local, le backend unifié peut ne pas être disponible (serveur express legacy)
      if (!import.meta.env.PROD && response.status === 404) {
        throw new Error('unified_backend_not_available');
      }

      if (response.status === 401) {
        throw new Error('Non authentifié');
      }
      const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
      throw new Error(error.error || error.message || 'Erreur lors de la récupération des activités');
    }

    return response.json();
  } catch (err) {
    if (err instanceof Error && err.message === 'unified_backend_not_available') {
      // Fallback Strava en dev local
      const stravaActivities = await stravaApi.getActivities({ perPage: 100 });
      const normalized = normalizeStravaActivitiesForFallback(stravaActivities);
      return {
        activities: normalized,
        meta: {
          total: normalized.length,
          sources: ['strava' as const],
          message: 'Mode dev local : uniquement Strava',
        },
      };
    }
    throw err;
  }
}

export async function syncUnifiedActivities(): Promise<SyncActivitiesResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/activities`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      if (!import.meta.env.PROD && response.status === 404) {
        throw new Error('unified_backend_not_available');
      }

      if (response.status === 401) {
        throw new Error('Non authentifié');
      }
      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Synchronisation trop fréquente');
      }
      const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
      throw new Error(error.error || error.message || 'Erreur lors de la synchronisation');
    }

    return response.json();
  } catch (err) {
    if (err instanceof Error && err.message === 'unified_backend_not_available') {
      // En dev local, sync = re-fetch Strava
      const stravaActivities = await stravaApi.getActivities({ perPage: 100 });
      const normalized = normalizeStravaActivitiesForFallback(stravaActivities);
      return {
        success: true,
        activities: normalized,
        message: 'Mode dev local : synchronisé via Strava',
      };
    }
    throw err;
  }
}

export const unifiedActivityApi = {
  getUnifiedActivities,
  syncUnifiedActivities,
};
