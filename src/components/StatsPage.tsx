import { useState, useEffect } from 'react';
import { stravaApi } from '../lib/stravaApi';
import { metricsService, TrainingMetrics } from '../lib/metricsService';
import { dashboardStore, DashboardWidget, WIDGET_LABELS, WidgetType } from '../lib/dashboardStore';
import { renderWidget } from './widgets';

interface StatsPageProps {
  onNavigate?: (page: 'home' | 'workouts' | 'coach' | 'stats' | 'profile') => void;
}

// Stockage de l'analyse en attente
const PENDING_ANALYSIS_KEY = 'workout-builder-pending-analysis';

export interface PendingAnalysis {
  activityId: number;
  activityName: string;
  timestamp: number;
}

export function setPendingAnalysis(analysis: PendingAnalysis): void {
  localStorage.setItem(PENDING_ANALYSIS_KEY, JSON.stringify(analysis));
}

export function getPendingAnalysis(): PendingAnalysis | null {
  try {
    const data = localStorage.getItem(PENDING_ANALYSIS_KEY);
    if (!data) return null;
    const analysis = JSON.parse(data) as PendingAnalysis;
    // Expire après 5 minutes
    if (Date.now() - analysis.timestamp > 5 * 60 * 1000) {
      clearPendingAnalysis();
      return null;
    }
    return analysis;
  } catch {
    return null;
  }
}

export function clearPendingAnalysis(): void {
  localStorage.removeItem(PENDING_ANALYSIS_KEY);
}

export function StatsPage({ onNavigate }: StatsPageProps) {
  const [stravaConnected, setStravaConnected] = useState(false);
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showAddWidget, setShowAddWidget] = useState(false);

  // Charger la config et vérifier Strava
  useEffect(() => {
    const storedTokens = stravaApi.getStoredTokens();
    if (storedTokens) {
      setStravaConnected(true);
    }

    const config = dashboardStore.getConfig();
    setWidgets(config.widgets.sort((a, b) => a.order - b.order));
  }, []);

  // Charger les métriques
  useEffect(() => {
    if (stravaConnected && !metrics && !metricsLoading) {
      loadMetrics();
    }
  }, [stravaConnected]);

  const loadMetrics = async () => {
    setMetricsLoading(true);
    try {
      const data = await metricsService.calculateTrainingMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Erreur chargement métriques:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleConnectStrava = () => {
    stravaApi.startOAuthFlow();
  };

  const handleRemoveWidget = (widgetId: string) => {
    dashboardStore.removeWidget(widgetId);
    setWidgets(dashboardStore.getConfig().widgets);
  };

  const handleAddWidget = (type: WidgetType) => {
    const info = WIDGET_LABELS[type];
    dashboardStore.addWidget(type, info.name, 'medium');
    setWidgets(dashboardStore.getConfig().widgets);
    setShowAddWidget(false);
  };

  const handleResetDashboard = () => {
    if (confirm('Réinitialiser le dashboard aux widgets par défaut ?')) {
      dashboardStore.resetToDefault();
      setWidgets(dashboardStore.getConfig().widgets);
    }
  };

  const handleAnalyzeActivity = (activityId: number, activityName: string) => {
    // Stocker l'analyse en attente
    setPendingAnalysis({
      activityId,
      activityName,
      timestamp: Date.now(),
    });
    // Naviguer vers le coach
    if (onNavigate) {
      onNavigate('coach');
    }
  };

  // Widgets disponibles (non encore ajoutés)
  const existingTypes = new Set(widgets.map(w => w.type));
  const availableWidgets = (Object.keys(WIDGET_LABELS) as WidgetType[]).filter(
    type => !existingTypes.has(type)
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Tes statistiques d'entraînement</p>
          </div>

          <div className="flex items-center gap-2">
            {stravaConnected ? (
              <>
                <button
                  onClick={() => onNavigate?.('profile')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  title="Profil Athlète"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profil
                </button>
                <button
                  onClick={() => setShowAddWidget(!showAddWidget)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter
                </button>
                <button
                  onClick={handleResetDashboard}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Réinitialiser"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectStrava}
                className="flex items-center gap-2 px-4 py-2 bg-[#FC4C02] text-white rounded-lg font-medium hover:bg-[#e34402] transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Connecter Strava
              </button>
            )}
          </div>
        </div>

        {/* Modal ajout widget */}
        {showAddWidget && (
          <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Ajouter un widget</h3>
              <button
                onClick={() => setShowAddWidget(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {availableWidgets.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {availableWidgets.map(type => (
                  <button
                    key={type}
                    onClick={() => handleAddWidget(type)}
                    className="p-3 text-left bg-gray-50 hover:bg-orange-50 hover:border-orange-300 border border-gray-200 rounded-lg transition-colors"
                  >
                    <p className="font-medium text-sm">{WIDGET_LABELS[type].name}</p>
                    <p className="text-xs text-gray-500">{WIDGET_LABELS[type].description}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Tous les widgets sont déjà ajoutés</p>
            )}
          </div>
        )}

        {/* État non connecté */}
        {!stravaConnected && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connecte Strava</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Pour voir tes statistiques d'entraînement, connecte ton compte Strava
            </p>
            <button
              onClick={handleConnectStrava}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FC4C02] text-white rounded-lg font-medium hover:bg-[#e34402] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Connecter Strava
            </button>
          </div>
        )}

        {/* Chargement */}
        {stravaConnected && metricsLoading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Chargement de tes stats...</p>
          </div>
        )}

        {/* Widgets */}
        {stravaConnected && !metricsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {widgets.map(widget => renderWidget(
              widget,
              metrics,
              () => handleRemoveWidget(widget.id),
              handleAnalyzeActivity
            ))}
          </div>
        )}

        {/* Widgets vides */}
        {stravaConnected && !metricsLoading && widgets.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <p className="text-gray-600 mb-4">Aucun widget sur ton dashboard</p>
            <button
              onClick={() => setShowAddWidget(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ajouter un widget
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
