import { useState, useEffect } from 'react';
import { UnifiedActivity } from '../types/activity';
import { unifiedActivityApi } from '../lib/unifiedActivityApi';
import { getSportConfig } from '../lib/metricsService';

interface AllActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (activityId: number, activityName: string) => void;
}

export function AllActivitiesModal({ isOpen, onClose, onAnalyze }: AllActivitiesModalProps) {
  const [activities, setActivities] = useState<UnifiedActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Types d'activités analysables (uniquement Strava pour l'instant)
  const analyzableTypes = [
    // Running
    'Run', 'TrailRun', 'VirtualRun', 'Treadmill',
    // Cycling
    'Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide',
    // Swimming
    'Swim',
  ];

  // Charger les activités unifiées
  const loadActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await unifiedActivityApi.getUnifiedActivities();
      setActivities(response.activities);
    } catch (err) {
      console.error('Erreur chargement activités:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Charger à l'ouverture
  useEffect(() => {
    if (isOpen) {
      loadActivities();
    }
  }, [isOpen]);

  // Gérer l'analyse (uniquement Strava)
  const handleAnalyze = (activity: UnifiedActivity) => {
    if (typeof activity.providerActivityId === 'number') {
      onAnalyze(activity.providerActivityId, activity.name);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Toutes mes activités</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Liste des activités */}
        <div className="flex-1 overflow-y-auto p-4">
          {activities.length === 0 && loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune activité trouvée
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => {
                const sportConfig = getSportConfig(activity.source === 'strava' ? activity.rawType : activity.type);
                const date = new Date(activity.startDateLocal);
                const dateStr = date.toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                });
                const dist = (activity.distance / 1000).toFixed(1);
                const dur = Math.round(activity.movingTime / 60);
                const canAnalyze = activity.source === 'strava' && analyzableTypes.includes(activity.rawType);

                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span className="text-2xl">{sportConfig.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{activity.name}</p>
                      <p className="text-xs text-gray-500">{dateStr}</p>
                    </div>
                    <div className="text-right text-sm">
                      {sportConfig.hasDistance ? (
                        <>
                          <p className="font-medium">{dist} km</p>
                          <p className="text-xs text-gray-500">{dur} min</p>
                        </>
                      ) : (
                        <p className="font-medium">{dur} min</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${activity.source === 'strava' ? 'bg-[#FC4C02]/10 text-[#FC4C02]' : 'bg-[#007CC3]/10 text-[#007CC3]'}`}>
                      {activity.source === 'strava' ? 'Strava' : 'Garmin'}
                    </span>
                    {canAnalyze ? (
                      <button
                        onClick={() => handleAnalyze(activity)}
                        className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        Analyser
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 text-xs text-gray-400 rounded-lg">
                        Non analysable
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer avec info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-500 text-center">
            {activities.length} activité{activities.length > 1 ? 's' : ''} affichée{activities.length > 1 ? 's' : ''}
            {' • '}
            L'analyse détaillée n'est disponible que pour les activités Strava
          </p>
        </div>
      </div>
    </div>
  );
}
