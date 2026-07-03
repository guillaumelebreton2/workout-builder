import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/authContext';
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
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showAddWidget, setShowAddWidget] = useState(false);

  const stravaConnected = user?.stravaConnected || !!stravaApi.getStoredTokens();
  const garminConnected = user?.garminConnected || false;
  const hasActivitySource = stravaConnected || garminConnected;

  const loadMetrics = useCallback(async (forceSync = false) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const data = await metricsService.calculateTrainingMetrics(forceSync);
      setMetrics(data);
    } catch (err) {
      console.error('Erreur chargement métriques:', err);
      setMetricsError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Charger la config
  useEffect(() => {
    const config = dashboardStore.getConfig();
    setWidgets(config.widgets.sort((a, b) => a.order - b.order));
  }, []);

  // Charger les métriques
  useEffect(() => {
    if (hasActivitySource && !metrics && !metricsLoading) {
      loadMetrics();
    }
  }, [hasActivitySource, metrics, metricsLoading, loadMetrics]);

  const handleConnectStrava = () => {
    stravaApi.startOAuthFlow();
  };

  const handleConnectGarmin = () => {
    window.location.href = `${import.meta.env.PROD ? '' : 'http://localhost:3001'}/api/garmin/auth`;
  };

  const handleRefresh = () => {
    loadMetrics(true);
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
            {hasActivitySource ? (
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
                  onClick={handleRefresh}
                  disabled={metricsLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Synchroniser les activités"
                >
                  <svg className={`w-5 h-5 ${metricsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync
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
                onClick={() => window.location.href = '/account'}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Connecter un compte
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
        {!hasActivitySource && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connecte un compte</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Pour voir tes statistiques d'entraînement, connecte Strava et/ou Garmin
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleConnectStrava}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#FC4C02] text-white rounded-lg font-medium hover:bg-[#e34402] transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Connecter Strava
              </button>
              <button
                onClick={handleConnectGarmin}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#007CC3] text-white rounded-lg font-medium hover:bg-[#006AAD] transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                Connecter Garmin
              </button>
            </div>
          </div>
        )}

        {/* Sources connectées */}
        {hasActivitySource && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Sources :</span>
            {stravaConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#FC4C02]/10 text-[#FC4C02] text-xs font-medium rounded">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Strava
              </span>
            )}
            {garminConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#007CC3]/10 text-[#007CC3] text-xs font-medium rounded">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                Garmin
              </span>
            )}
          </div>
        )}

        {/* Erreur */}
        {metricsError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {metricsError}
          </div>
        )}

        {/* Messages du backend (erreurs de sync, info) */}
        {metrics?.meta && (metrics.meta.errors?.length || metrics.meta.message) && (
          <div className={`mb-6 p-4 rounded-xl text-sm ${metrics.meta.errors?.length ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
            {metrics.meta.message && <p className="mb-1">{metrics.meta.message}</p>}
            {metrics.meta.errors?.map((err, i) => (
              <p key={i} className="font-medium">{err}</p>
            ))}
          </div>
        )}

        {/* Chargement */}
        {hasActivitySource && metricsLoading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Chargement de tes stats...</p>
          </div>
        )}

        {/* Widgets */}
        {hasActivitySource && !metricsLoading && (
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
        {hasActivitySource && !metricsLoading && widgets.length === 0 && (
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
