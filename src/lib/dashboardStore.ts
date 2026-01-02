/**
 * Store pour le dashboard personnalisable
 * Gère les widgets épinglés par l'utilisateur
 */

import { generateId } from './types';

// Types de widgets disponibles
export type WidgetType =
  | 'weekly-summary'      // Résumé de la semaine
  | 'volume-chart'        // Graphique évolution volume
  | 'sport-breakdown'     // Répartition par sport
  | 'recent-activities'   // Dernières activités
  | 'weekly-comparison'   // Comparaison semaine
  | 'pace-evolution'      // Évolution allure (running)
  | 'heart-rate'          // Stats FC
  | 'elevation'           // Stats dénivelé
  | 'streak';             // Série d'entraînements

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  size: 'small' | 'medium' | 'large'; // 1, 2 ou 4 colonnes
  order: number;
  config?: Record<string, unknown>; // Config spécifique au widget
  addedAt: string; // ISO date
}

export interface DashboardConfig {
  widgets: DashboardWidget[];
  lastUpdated: string;
}

const STORAGE_KEY = 'workout-builder-dashboard';

// Widgets par défaut
const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: 'default-1',
    type: 'weekly-summary',
    title: 'Cette semaine',
    size: 'large',
    order: 1,
    addedAt: new Date().toISOString(),
  },
  {
    id: 'default-2',
    type: 'volume-chart',
    title: 'Évolution du volume',
    size: 'large',
    order: 2,
    addedAt: new Date().toISOString(),
  },
  {
    id: 'default-3',
    type: 'sport-breakdown',
    title: 'Par sport',
    size: 'medium',
    order: 3,
    addedAt: new Date().toISOString(),
  },
  {
    id: 'default-4',
    type: 'recent-activities',
    title: 'Dernières activités',
    size: 'medium',
    order: 4,
    addedAt: new Date().toISOString(),
  },
];

// Récupérer la config du dashboard
export function getDashboardConfig(): DashboardConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return {
        widgets: DEFAULT_WIDGETS,
        lastUpdated: new Date().toISOString(),
      };
    }
    return JSON.parse(data);
  } catch {
    return {
      widgets: DEFAULT_WIDGETS,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Sauvegarder la config
function saveConfig(config: DashboardConfig): void {
  config.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// Ajouter un widget
export function addWidget(type: WidgetType, title: string, size: 'small' | 'medium' | 'large' = 'medium'): DashboardWidget {
  const config = getDashboardConfig();
  const maxOrder = Math.max(0, ...config.widgets.map(w => w.order));

  const widget: DashboardWidget = {
    id: generateId(),
    type,
    title,
    size,
    order: maxOrder + 1,
    addedAt: new Date().toISOString(),
  };

  config.widgets.push(widget);
  saveConfig(config);

  return widget;
}

// Supprimer un widget
export function removeWidget(widgetId: string): boolean {
  const config = getDashboardConfig();
  const index = config.widgets.findIndex(w => w.id === widgetId);

  if (index === -1) return false;

  config.widgets.splice(index, 1);
  saveConfig(config);

  return true;
}

// Réorganiser les widgets
export function reorderWidgets(widgetIds: string[]): void {
  const config = getDashboardConfig();

  widgetIds.forEach((id, index) => {
    const widget = config.widgets.find(w => w.id === id);
    if (widget) {
      widget.order = index + 1;
    }
  });

  config.widgets.sort((a, b) => a.order - b.order);
  saveConfig(config);
}

// Mettre à jour un widget
export function updateWidget(widgetId: string, updates: Partial<DashboardWidget>): boolean {
  const config = getDashboardConfig();
  const widget = config.widgets.find(w => w.id === widgetId);

  if (!widget) return false;

  Object.assign(widget, updates);
  saveConfig(config);

  return true;
}

// Réinitialiser aux widgets par défaut
export function resetToDefault(): void {
  saveConfig({
    widgets: DEFAULT_WIDGETS,
    lastUpdated: new Date().toISOString(),
  });
}

// Labels des widgets
export const WIDGET_LABELS: Record<WidgetType, { name: string; description: string }> = {
  'weekly-summary': { name: 'Résumé semaine', description: 'Vue d\'ensemble de ta semaine' },
  'volume-chart': { name: 'Évolution volume', description: 'Graphique sur 4 semaines' },
  'sport-breakdown': { name: 'Par sport', description: 'Répartition de tes activités' },
  'recent-activities': { name: 'Activités récentes', description: 'Tes dernières séances' },
  'weekly-comparison': { name: 'Comparaison', description: 'Cette semaine vs précédente' },
  'pace-evolution': { name: 'Allure', description: 'Évolution de ton allure course' },
  'heart-rate': { name: 'Fréquence cardiaque', description: 'Stats de FC' },
  'elevation': { name: 'Dénivelé', description: 'Cumul et évolution' },
  'streak': { name: 'Série', description: 'Jours consécutifs d\'entraînement' },
};

// Export groupé
export const dashboardStore = {
  getConfig: getDashboardConfig,
  addWidget,
  removeWidget,
  reorderWidgets,
  updateWidget,
  resetToDefault,
};
