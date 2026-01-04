import { useState, useEffect } from 'react';
import { StravaActivity, stravaApi } from '../lib/stravaApi';
import { getSportConfig } from '../lib/metricsService';

interface AllActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (activityId: number, activityName: string) => void;
}

export function AllActivitiesModal({ isOpen, onClose, onAnalyze }: AllActivitiesModalProps) {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Types d'activités analysables
  const analyzableTypes = [
    // Running
    'Run', 'TrailRun', 'VirtualRun', 'Treadmill',
    // Cycling
    'Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide',
    // Swimming
    'Swim',
  ];

  // Charger les activités
  const loadActivities = async (pageNum: number, reset: boolean = false) => {
    setLoading(true);
    try {
      const newActivities = await stravaApi.getActivities({
        page: pageNum,
        perPage: 20,
      });

      if (reset) {
        setActivities(newActivities);
      } else {
        setActivities(prev => [...prev, ...newActivities]);
      }

      setHasMore(newActivities.length === 20);
    } catch (err) {
      console.error('Erreur chargement activités:', err);
    } finally {
      setLoading(false);
    }
  };

  // Charger la première page à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setPage(1);
      loadActivities(1, true);
    }
  }, [isOpen]);

  // Charger plus d'activités
  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadActivities(nextPage);
  };

  // Gérer l'analyse
  const handleAnalyze = (activity: StravaActivity) => {
    onAnalyze(activity.id, activity.name);
    onClose();
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
                const sportConfig = getSportConfig(activity.type);
                const date = new Date(activity.start_date_local);
                const dateStr = date.toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                });
                const dist = (activity.distance / 1000).toFixed(1);
                const dur = Math.round(activity.moving_time / 60);
                const canAnalyze = analyzableTypes.includes(activity.type);

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

          {/* Bouton charger plus */}
          {hasMore && activities.length > 0 && (
            <div className="mt-4 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-4 py-2 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    Chargement...
                  </span>
                ) : (
                  'Charger plus d\'activités'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer avec info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-500 text-center">
            {activities.length} activité{activities.length > 1 ? 's' : ''} affichée{activities.length > 1 ? 's' : ''}
            {' • '}
            Seules les activités de course à pied sont analysables pour l'instant
          </p>
        </div>
      </div>
    </div>
  );
}
