/**
 * Composants de widgets pour le dashboard
 */

import { TrainingMetrics } from '../../lib/metricsService';
import { DashboardWidget } from '../../lib/dashboardStore';

interface WidgetProps {
  widget: DashboardWidget;
  metrics: TrainingMetrics | null;
  onRemove?: () => void;
}

// Wrapper commun pour tous les widgets
function WidgetContainer({
  widget,
  children,
  onRemove,
}: {
  widget: DashboardWidget;
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  const sizeClasses = {
    small: 'col-span-1',
    medium: 'col-span-1 md:col-span-2',
    large: 'col-span-1 md:col-span-2 lg:col-span-4',
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 ${sizeClasses[widget.size]}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{widget.title}</h3>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Supprimer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// Widget: Résumé de la semaine
export function WeeklySummaryWidget({ widget, metrics, onRemove }: WidgetProps) {
  if (!metrics) {
    return (
      <WidgetContainer widget={widget} onRemove={onRemove}>
        <div className="text-gray-400 text-sm">Connecte Strava pour voir tes stats</div>
      </WidgetContainer>
    );
  }

  const { currentWeek, weeklyTrend } = metrics;

  return (
    <WidgetContainer widget={widget} onRemove={onRemove}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{currentWeek.totalDistance}</p>
          <p className="text-sm text-gray-500">km</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{currentWeek.activityCount}</p>
          <p className="text-sm text-gray-500">séances</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">
            {Math.round(currentWeek.totalDuration / 60 * 10) / 10}h
          </p>
          <p className="text-sm text-gray-500">durée</p>
        </div>
        <div className="text-center">
          <p className={`text-3xl font-bold ${weeklyTrend.trend === 'up' ? 'text-green-600' : weeklyTrend.trend === 'down' ? 'text-red-600' : 'text-gray-900'}`}>
            {weeklyTrend.distanceChange >= 0 ? '+' : ''}{weeklyTrend.distanceChange}%
          </p>
          <p className="text-sm text-gray-500">vs sem. dern.</p>
        </div>
      </div>
      {currentWeek.totalElevation > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-center">
          <span className="text-sm text-gray-600">🏔️ {currentWeek.totalElevation}m de dénivelé</span>
        </div>
      )}
    </WidgetContainer>
  );
}

// Widget: Graphique évolution volume (barres simples CSS)
export function VolumeChartWidget({ widget, metrics, onRemove }: WidgetProps) {
  if (!metrics) {
    return (
      <WidgetContainer widget={widget} onRemove={onRemove}>
        <div className="text-gray-400 text-sm">Connecte Strava pour voir tes stats</div>
      </WidgetContainer>
    );
  }

  const weeks = [...metrics.last4Weeks].reverse();
  const maxDistance = Math.max(...weeks.map(w => w.totalDistance), 1);

  const weekLabels = weeks.map((_, i) => {
    if (i === weeks.length - 1) return 'Cette sem.';
    if (i === weeks.length - 2) return 'Sem. dern.';
    return `S-${weeks.length - 1 - i}`;
  });

  return (
    <WidgetContainer widget={widget} onRemove={onRemove}>
      <div className="flex items-end justify-between gap-2 h-32">
        {weeks.map((week, index) => {
          const heightPercent = (week.totalDistance / maxDistance) * 100;
          const isCurrentWeek = index === weeks.length - 1;

          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <span className="text-xs text-gray-600 mb-1">{week.totalDistance}km</span>
              <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '80px' }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t transition-all ${isCurrentWeek ? 'bg-orange-500' : 'bg-orange-300'}`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 mt-1">{weekLabels[index]}</span>
            </div>
          );
        })}
      </div>
    </WidgetContainer>
  );
}

// Widget: Répartition par sport
export function SportBreakdownWidget({ widget, metrics, onRemove }: WidgetProps) {
  if (!metrics) {
    return (
      <WidgetContainer widget={widget} onRemove={onRemove}>
        <div className="text-gray-400 text-sm">Connecte Strava pour voir tes stats</div>
      </WidgetContainer>
    );
  }

  const sports = Object.entries(metrics.currentWeek.bySport);
  const sportIcons: Record<string, string> = {
    running: '🏃',
    cycling: '🚴',
    swimming: '🏊',
    walking: '🚶',
    hiking: '🥾',
    other: '🏋️',
  };
  const sportLabels: Record<string, string> = {
    running: 'Course',
    cycling: 'Vélo',
    swimming: 'Natation',
    walking: 'Marche',
    hiking: 'Rando',
    other: 'Autre',
  };

  if (sports.length === 0) {
    return (
      <WidgetContainer widget={widget} onRemove={onRemove}>
        <div className="text-gray-400 text-sm">Aucune activité cette semaine</div>
      </WidgetContainer>
    );
  }

  const totalDistance = sports.reduce((sum, [, data]) => sum + data.distance, 0);

  return (
    <WidgetContainer widget={widget} onRemove={onRemove}>
      <div className="space-y-3">
        {sports.map(([sport, data]) => {
          const percent = totalDistance > 0 ? Math.round((data.distance / totalDistance) * 100) : 0;

          return (
            <div key={sport}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {sportIcons[sport] || '🏋️'} {sportLabels[sport] || sport}
                </span>
                <span className="text-sm text-gray-600">{data.distance.toFixed(1)} km</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetContainer>
  );
}

// Widget: Dernières activités
export function RecentActivitiesWidget({ widget, metrics, onRemove }: WidgetProps) {
  if (!metrics || metrics.recentActivities.length === 0) {
    return (
      <WidgetContainer widget={widget} onRemove={onRemove}>
        <div className="text-gray-400 text-sm">Aucune activité récente</div>
      </WidgetContainer>
    );
  }

  const sportIcons: Record<string, string> = {
    Run: '🏃',
    Ride: '🚴',
    Swim: '🏊',
    Walk: '🚶',
    Hike: '🥾',
    VirtualRun: '🏃',
    VirtualRide: '🚴',
  };

  return (
    <WidgetContainer widget={widget} onRemove={onRemove}>
      <div className="space-y-2">
        {metrics.recentActivities.slice(0, 5).map((activity) => {
          const date = new Date(activity.start_date_local);
          const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
          const dist = (activity.distance / 1000).toFixed(1);
          const dur = Math.round(activity.moving_time / 60);

          return (
            <div key={activity.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
              <span className="text-xl">{sportIcons[activity.type] || '🏋️'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{activity.name}</p>
                <p className="text-xs text-gray-500">{dateStr}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium">{dist} km</p>
                <p className="text-xs text-gray-500">{dur} min</p>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetContainer>
  );
}

// Widget: Comparaison semaine
export function WeeklyComparisonWidget({ widget, metrics, onRemove }: WidgetProps) {
  if (!metrics) {
    return (
      <WidgetContainer widget={widget} onRemove={onRemove}>
        <div className="text-gray-400 text-sm">Connecte Strava pour voir tes stats</div>
      </WidgetContainer>
    );
  }

  const { currentWeek, previousWeek } = metrics;

  const comparisons = [
    { label: 'Distance', current: `${currentWeek.totalDistance} km`, previous: `${previousWeek.totalDistance} km`, diff: currentWeek.totalDistance - previousWeek.totalDistance },
    { label: 'Durée', current: `${Math.round(currentWeek.totalDuration)} min`, previous: `${Math.round(previousWeek.totalDuration)} min`, diff: currentWeek.totalDuration - previousWeek.totalDuration },
    { label: 'Séances', current: `${currentWeek.activityCount}`, previous: `${previousWeek.activityCount}`, diff: currentWeek.activityCount - previousWeek.activityCount },
    { label: 'Dénivelé', current: `${currentWeek.totalElevation} m`, previous: `${previousWeek.totalElevation} m`, diff: currentWeek.totalElevation - previousWeek.totalElevation },
  ];

  return (
    <WidgetContainer widget={widget} onRemove={onRemove}>
      <div className="space-y-2">
        {comparisons.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-600">{item.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{item.previous}</span>
              <span className="text-sm">→</span>
              <span className="text-sm font-medium">{item.current}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${item.diff > 0 ? 'bg-green-100 text-green-700' : item.diff < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                {item.diff > 0 ? '+' : ''}{typeof item.diff === 'number' ? item.diff.toFixed(1) : item.diff}
              </span>
            </div>
          </div>
        ))}
      </div>
    </WidgetContainer>
  );
}

// Composant pour rendre le bon widget selon le type
export function renderWidget(widget: DashboardWidget, metrics: TrainingMetrics | null, onRemove?: () => void) {
  const props = { widget, metrics, onRemove };

  switch (widget.type) {
    case 'weekly-summary':
      return <WeeklySummaryWidget key={widget.id} {...props} />;
    case 'volume-chart':
      return <VolumeChartWidget key={widget.id} {...props} />;
    case 'sport-breakdown':
      return <SportBreakdownWidget key={widget.id} {...props} />;
    case 'recent-activities':
      return <RecentActivitiesWidget key={widget.id} {...props} />;
    case 'weekly-comparison':
      return <WeeklyComparisonWidget key={widget.id} {...props} />;
    default:
      return (
        <WidgetContainer key={widget.id} widget={widget} onRemove={onRemove}>
          <div className="text-gray-400 text-sm">Widget en cours de développement</div>
        </WidgetContainer>
      );
  }
}
