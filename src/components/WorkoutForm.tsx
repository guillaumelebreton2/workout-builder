import { useState, useEffect } from 'react';
import { Workout, WorkoutStep, Sport, SavedWorkout, generateId } from '../lib/types';
import { downloadFitFile } from '../lib/fit-encoder';
import { parseWithGroq } from '../lib/groq-parser';
import { workoutStore } from '../lib/workoutStore';
import { SportSelector } from './SportSelector';
import { WorkoutPreview } from './WorkoutPreview';
import { GarminWorkoutPreview } from './GarminWorkoutPreview';
import { GarminSyncModal } from './GarminSyncModal';
import { ShareWorkoutDialog } from './ShareWorkoutDialog';
import { convertToGarminFormat, GarminWorkout } from '../lib/garmin-format';

// Clés API depuis les variables d'environnement
const API_KEYS = [
  import.meta.env.VITE_GROQ_API_KEY,
  import.meta.env.VITE_GROQ_API_KEY_2,
].filter(key => key && key !== 'ta_cle_ici');

// Parse l'allure en format "4:30" vers un nombre décimal en min/km
function parsePaceInput(input: string): number | null {
  if (!input.trim()) return null;
  const match = input.match(/^(\d+)[:'′](\d+)$/);
  if (match) {
    return parseInt(match[1]) + parseInt(match[2]) / 60;
  }
  const decimal = parseFloat(input);
  if (!isNaN(decimal) && decimal > 0) return decimal;
  return null;
}

// Formater l'input allure (ex: "420" -> "4:20", "330" -> "3:30")
function formatPaceInput(value: string): string {
  // Si déjà formaté avec : ou ', ne rien faire
  if (value.includes(':') || value.includes("'") || value.includes('′')) {
    return value;
  }

  // Si c'est un nombre de 3-4 chiffres, formater
  const digits = value.replace(/\D/g, '');
  if (digits.length === 3) {
    // "420" -> "4:20"
    return `${digits[0]}:${digits.slice(1)}`;
  }
  if (digits.length === 4) {
    // "1030" -> "10:30"
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  return value;
}

// Allure par défaut si non renseignée (pour convertir les %)
const DEFAULT_PACE_MIN_KM = 5.0; // 5:00/km

// Enrichir les steps avec les allures calculées (course à pied)
// Le % correspond à la vitesse : 100% = vitesse de référence, 95% = plus lent (allure plus haute)
// Priorité : allure explicite > % avec référence > % avec défaut
function enrichStepsWithPace(steps: WorkoutStep[], referencePaceMinKm: number | null): WorkoutStep[] {
  const enrichSingleStep = (step: WorkoutStep): WorkoutStep => {
    // Si paceMinKm déjà présent (allure explicite), ne pas écraser
    if (step.details?.paceMinKm) {
      return step;
    }

    // Calculer depuis capPercent
    if (step.details?.capPercent) {
      // Utiliser la référence fournie ou le défaut
      const refPace = referencePaceMinKm ?? DEFAULT_PACE_MIN_KM;
      const referenceSpeedKmh = 60 / refPace;

      const { low, high } = step.details.capPercent;
      const speedAtLowPercent = referenceSpeedKmh * (low / 100);
      const speedAtHighPercent = referenceSpeedKmh * (high / 100);

      // low correspond au % bas (donc vitesse basse, allure haute/lente)
      // high correspond au % haut (donc vitesse haute, allure basse/rapide)
      return {
        ...step,
        details: {
          ...step.details,
          paceMinKm: {
            low: 60 / speedAtLowPercent,   // allure au % bas (lente)
            high: 60 / speedAtHighPercent  // allure au % haut (rapide)
          },
          speedKmh: {
            low: speedAtLowPercent,
            high: speedAtHighPercent
          },
        },
      };
    }
    return step;
  };

  return steps.map(step => {
    // Gérer les répétitions imbriquées
    if (step.repetitions && step.steps && step.steps.length > 0) {
      return {
        ...step,
        steps: step.steps.map(enrichSingleStep),
      };
    }
    return enrichSingleStep(step);
  });
}

// Puissance par défaut si non renseignée (pour convertir les %)
const DEFAULT_POWER_WATTS = 200;

// Enrichir les steps avec les watts calculés (vélo)
// Le % correspond à la puissance : 100% = puissance de référence, 95% = moins de watts
function enrichStepsWithWatts(steps: WorkoutStep[], referenceWatts: number): WorkoutStep[] {
  const enrichSingleStep = (step: WorkoutStep): WorkoutStep => {
    // Si watts déjà présents, ne pas écraser
    if (step.details?.watts) {
      return step;
    }

    // Calculer les watts depuis powerPercent
    if (step.details?.powerPercent) {
      const { low, high } = step.details.powerPercent;
      return {
        ...step,
        details: {
          ...step.details,
          watts: {
            low: Math.round(referenceWatts * (low / 100)),
            high: Math.round(referenceWatts * (high / 100))
          },
        },
      };
    }

    // Calculer les watts depuis capPercent (ancien format)
    if (step.details?.capPercent) {
      const { low, high } = step.details.capPercent;
      return {
        ...step,
        details: {
          ...step.details,
          watts: {
            low: Math.round(referenceWatts * (low / 100)),
            high: Math.round(referenceWatts * (high / 100))
          },
        },
      };
    }

    return step;
  };

  return steps.map(step => {
    // Gérer les répétitions imbriquées
    if (step.repetitions && step.steps && step.steps.length > 0) {
      return {
        ...step,
        steps: step.steps.map(enrichSingleStep),
      };
    }
    return enrichSingleStep(step);
  });
}

// Enrichir les steps avec les allures natation calculées (min/100m)
// Le % correspond à la vitesse : 100% = vitesse de référence, 95% = plus lent
function enrichStepsWithSwimPace(steps: WorkoutStep[], referencePaceMin100m: number): WorkoutStep[] {
  const referenceSpeed = 100 / referencePaceMin100m; // m/min

  const enrichSingleStep = (step: WorkoutStep): WorkoutStep => {
    if (step.details?.capPercent && !step.details?.swimPaceMin100m) {
      const { low, high } = step.details.capPercent;
      const speedAtLowPercent = referenceSpeed * (low / 100);
      const speedAtHighPercent = referenceSpeed * (high / 100);

      // low correspond au % bas (donc vitesse basse, allure haute/lente)
      // high correspond au % haut (donc vitesse haute, allure basse/rapide)
      return {
        ...step,
        details: {
          ...step.details,
          swimPaceMin100m: {
            low: 100 / speedAtLowPercent,   // allure au % bas (lente)
            high: 100 / speedAtHighPercent  // allure au % haut (rapide)
          },
        },
      };
    }
    return step;
  };

  return steps.map(step => {
    // Gérer les répétitions imbriquées
    if (step.repetitions && step.steps && step.steps.length > 0) {
      return {
        ...step,
        steps: step.steps.map(enrichSingleStep),
      };
    }
    return enrichSingleStep(step);
  });
}

// Clés localStorage pour chaque sport
const STORAGE_KEYS = {
  running: 'workout_ref_running_pace',
  cycling: 'workout_ref_cycling_watts',
  swimming: 'workout_ref_swimming_pace',
};

// Placeholders par sport
const DESCRIPTION_PLACEHOLDERS: Record<Sport, string> = {
  running: `Décris ta séance ici ou utilise un exemple ci-dessous...`,
  cycling: `Décris ta séance ici ou utilise un exemple ci-dessous...`,
  swimming: `Décris ta séance ici ou utilise un exemple ci-dessous...`,
};

// Aide et exemples par sport
const SPORT_HELP: Record<Sport, { features: string[]; examples: { label: string; value: string }[] }> = {
  running: {
    features: [
      'Pourcentages de VMA/CAP : "à 85%", "entre 70-80%"',
      'Durées : "15min", "1h30", "2\'"',
      'Distances : "800m", "1km", "5000m"',
      'Répétitions : "10x400m", "5x (1000m + 500m)"',
      'Récupération : "avec 2min récup", "récup trot"',
      'Types : échauffement, actif, récupération, retour au calme',
    ],
    examples: [
      {
        label: 'Fractionné 10x400m',
        value: `Échauffement 15min 65%
10x 400m à 100% avec 1min30 récup trot
Retour au calme 10min`,
      },
      {
        label: 'Seuil 3x2000m',
        value: `Échauffement 20min progressif 60-70%
3x 2000m à 88-92% avec 3min récup
Retour au calme 15min 60%`,
      },
      {
        label: 'Sortie longue',
        value: `Sortie longue 1h30 à 70-75%`,
      },
    ],
  },
  cycling: {
    features: [
      'Cadence : "90rpm", "40 rpm", "110rpm"',
      'Puissance : "à 75-85%", "95% FTP"',
      'Force (cadence < 80rpm) et Vélocité (> 90rpm) détectées auto',
      'Répétitions : "5x (1min force / 1min vélocité)"',
      'Durées : "10min", "1h", "2\'"',
    ],
    examples: [
      {
        label: 'Force/Vélocité',
        value: `Échauffement 10min 90rpm
5x (1' 40 rpm / 1' 80rpm)
5x (1' 110 rpm / 1' 80rpm)
15' 75% - 90% 90rpm
Récupération 5' 80 rpm
Récupération lap`,
      },
      {
        label: 'Sweetspot',
        value: `Échauffement 15min 85-90rpm
3x 10min à 88-93% avec 5min récup
Retour au calme 10min`,
      },
      {
        label: 'Endurance',
        value: `Sortie endurance 2h à 60-70% cadence libre`,
      },
    ],
  },
  swimming: {
    features: [
      'Nages : crawl, dos, brasse, papillon, 4 nages',
      'Équipements : pull-buoy, plaquettes, palmes, planche, tuba',
      'Éducatifs : battements, bras, technique',
      'Intensités : souple, modéré, rapide, sprint, progressif',
      'Départ chronométré : "départ tous les 2min"',
      'Distances : "100m", "50m", "25m"',
      'Allure au 100m : "300m à 2\'/100m"',
      'Temps sur distance : "300m en 6\'" (calcule auto 2\'/100m)',
    ],
    examples: [
      {
        label: 'Technique',
        value: `200m crawl souple échauffement
4x 50m battements planche
4x 50m bras pull-buoy
4x 25m sprint crawl avec 30s récup
200m 4 nages retour au calme`,
      },
      {
        label: 'Intervalles',
        value: `300m échauffement varié
8x 100m crawl départ tous les 2min
4x 50m sprint départ tous les 1min30
200m souple retour au calme`,
      },
      {
        label: 'Endurance',
        value: `400m crawl échauffement
800m pull-buoy allure modérée
400m plaquettes crawl
200m souple`,
      },
    ],
  },
};

// Noms par défaut par sport
const SPORT_DEFAULT_NAMES: Record<Sport, string> = {
  running: 'Course',
  cycling: 'Vélo',
  swimming: 'Natation',
};

// Générer un nom par défaut basé sur le sport et la date
function getDefaultName(sport: Sport, dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${SPORT_DEFAULT_NAMES[sport]} ${day}/${month}`;
}

export function WorkoutForm() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sport, setSport] = useState<Sport>('running');
  const [name, setName] = useState(() => getDefaultName('running', new Date().toISOString().split('T')[0]));
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  // Mettre à jour le nom par défaut quand le sport ou la date change
  useEffect(() => {
    setName(getDefaultName(sport, date));
  }, [sport, date]);

  // Références par sport (chargées depuis localStorage)
  const [runningPace, setRunningPace] = useState(() => localStorage.getItem(STORAGE_KEYS.running) || '');
  const [cyclingWatts, setCyclingWatts] = useState(() => localStorage.getItem(STORAGE_KEYS.cycling) || '');
  const [swimmingPace, setSwimmingPace] = useState(() => localStorage.getItem(STORAGE_KEYS.swimming) || '');

  const [steps, setSteps] = useState<WorkoutStep[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [shareSavedWorkout, setShareSavedWorkout] = useState<SavedWorkout | null>(null);
  const [useGarminPreview, setUseGarminPreview] = useState(true);
  const [garminWorkout, setGarminWorkout] = useState<GarminWorkout | null>(null);

  // Sauvegarder les références dans localStorage avec formatage automatique
  const handleRunningPaceChange = (value: string) => {
    const formatted = formatPaceInput(value);
    setRunningPace(formatted);
    localStorage.setItem(STORAGE_KEYS.running, formatted);
  };

  const handleCyclingWattsChange = (value: string) => {
    setCyclingWatts(value);
    localStorage.setItem(STORAGE_KEYS.cycling, value);
  };

  const handleSwimmingPaceChange = (value: string) => {
    const formatted = formatPaceInput(value);
    setSwimmingPace(formatted);
    localStorage.setItem(STORAGE_KEYS.swimming, formatted);
  };


  const handlePreview = async () => {
    setError(null);
    setFallbackWarning(null);

    if (!description.trim()) {
      setError('Veuillez entrer une description de séance');
      return;
    }

    if (API_KEYS.length === 0) {
      setError('Clé API manquante. Configure VITE_GROQ_API_KEY dans le fichier .env');
      return;
    }

    setIsParsing(true);

    try {
      const result = await parseWithGroq(description, API_KEYS);
      let parsedSteps = result.steps;

      // Afficher un avertissement si un modèle de fallback a été utilisé
      if (result.isFallback) {
        setFallbackWarning(`Modèle de secours utilisé (${result.model}). La qualité du parsing peut être réduite, notamment pour les répétitions.`);
      }

      // Enrichir avec les allures/watts selon le sport
      if (sport === 'running') {
        const paceMinKm = parsePaceInput(runningPace);
        // Toujours appeler pour gérer les allures explicites et les % (avec ou sans référence)
        parsedSteps = enrichStepsWithPace(parsedSteps, paceMinKm);
      } else if (sport === 'cycling') {
        const watts = parseFloat(cyclingWatts);
        if (!isNaN(watts) && watts > 0) {
          // Utiliser la puissance de référence renseignée
          parsedSteps = enrichStepsWithWatts(parsedSteps, watts);
        } else {
          // Utiliser la puissance par défaut si des % sont présents
          const hasPercent = parsedSteps.some(s => s.details?.powerPercent);
          if (hasPercent) {
            parsedSteps = enrichStepsWithWatts(parsedSteps, DEFAULT_POWER_WATTS);
          }
        }
      } else if (sport === 'swimming') {
        const paceMin100m = parsePaceInput(swimmingPace);
        if (paceMin100m) {
          parsedSteps = enrichStepsWithSwimPace(parsedSteps, paceMin100m);
        }
      }

      if (parsedSteps.length === 0) {
        setError('Aucune étape détectée. Essayez de reformuler.');
        return;
      }

      setSteps(parsedSteps);
      setGarminWorkout(convertToGarminFormat({
        id: generateId(),
        name: name.trim(),
        sport,
        date: new Date(date),
        description: description.trim(),
        steps: parsedSteps,
      }, getGarminFormatParams()));
      setShowPreview(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Veuillez entrer un nom pour la séance');
      return;
    }

    if (steps.length === 0) {
      setError('Veuillez d\'abord prévisualiser la séance');
      return;
    }

    setIsGenerating(true);

    try {
      const workout: Workout = {
        id: generateId(),
        name: name.trim(),
        sport,
        date: new Date(date),
        description: description.trim(),
        steps,
      };

      downloadFitFile(workout);
    } catch (err) {
      setError('Erreur lors de la génération du fichier FIT');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (showPreview) {
      setShowPreview(false);
      setSteps([]);
      setGarminWorkout(null);
    }
    setSyncSuccess(false);
    setFallbackWarning(null);
  };

  const parseTags = (input: string): string[] => {
    return input
      .split(/[,;]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
  };

  const getCurrentWorkout = (): Workout => ({
    id: generateId(),
    name: name.trim(),
    sport,
    date: new Date(date),
    description: description.trim(),
    steps,
    tags: parseTags(tags),
  });

  const getGarminFormatParams = () => {
    if (sport === 'running') {
      const pace = parsePaceInput(runningPace);
      return pace ? { referencePaceMinKm: pace } : undefined;
    }
    if (sport === 'cycling') {
      const watts = parseFloat(cyclingWatts);
      return !isNaN(watts) && watts > 0 ? { referenceWatts: watts } : undefined;
    }
    if (sport === 'swimming') {
      const pace = parsePaceInput(swimmingPace);
      return pace ? { referenceSwimPaceMin100m: pace } : undefined;
    }
    return undefined;
  };

  // Sauvegarder la séance
  const handleSave = () => {
    const workout = getCurrentWorkout();
    const saved = workoutStore.save(workout, 'manual', garminWorkout || undefined);
    setIsSaved(true);
    setSavedWorkoutId(saved.id);
    return saved.id;
  };

  // Ouvrir le modal de sync (sauvegarde auto si pas encore fait)
  const handleSyncClick = () => {
    // Sauvegarder automatiquement avant de sync
    if (!isSaved) {
      handleSave();
    }
    setShowSyncModal(true);
  };

  // Ouvrir le modal de partage (sauvegarde auto si pas encore fait)
  const handleShareClick = () => {
    const workout = getCurrentWorkout();
    const saved = workoutStore.save(workout, 'manual', garminWorkout || undefined);
    setIsSaved(true);
    setSavedWorkoutId(saved.id);
    setShareSavedWorkout(saved);
  };

  const handleSyncSuccess = () => {
    // Marquer comme synchronisé
    if (savedWorkoutId) {
      workoutStore.markAsSynced(savedWorkoutId);
    }
    setShowSyncModal(false);
    setSyncSuccess(true);
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sport selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200 mb-2">
          Type de sport
        </label>
        <SportSelector value={sport} onChange={setSport} />
      </div>

      {/* Workout name + Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200 mb-2">
            Nom de la séance
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Test VMA 20min"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200 mb-2">
            Date
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Référence selon le sport */}
      <div>
        {sport === 'running' && (
          <>
            <label htmlFor="runningPace" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200 mb-2">
              Allure de référence (VMA, seuil, marathon...)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="runningPace"
                value={runningPace}
                onChange={(e) => handleRunningPaceChange(e.target.value)}
                placeholder="4:00"
                className="w-32 p-3 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
              />
              <span className="text-gray-500">/km</span>
              <span className="text-xs text-gray-400 ml-2">
                (pour calculer les allures à partir des %)
              </span>
            </div>
          </>
        )}

        {sport === 'cycling' && (
          <>
            <label htmlFor="cyclingWatts" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200 mb-2">
              Puissance de référence (FTP, PMA...)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="cyclingWatts"
                value={cyclingWatts}
                onChange={(e) => handleCyclingWattsChange(e.target.value)}
                placeholder="200"
                className="w-32 p-3 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
              />
              <span className="text-gray-500">watts</span>
              <span className="text-xs text-gray-400 ml-2">
                (pour calculer les watts à partir des %)
              </span>
            </div>
          </>
        )}

        {sport === 'swimming' && (
          <>
            <label htmlFor="swimmingPace" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200 mb-2">
              Allure de référence (CSS, allure critique...)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="swimmingPace"
                value={swimmingPace}
                onChange={(e) => handleSwimmingPaceChange(e.target.value)}
                placeholder="1:45"
                className="w-32 p-3 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
              />
              <span className="text-gray-500">/100m</span>
              <span className="text-xs text-gray-400 ml-2">
                (pour calculer les allures à partir des %)
              </span>
            </div>
          </>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200 mb-2">
          Description de la séance
        </label>

        <textarea
          id="description"
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder={DESCRIPTION_PLACEHOLDERS[sport]}
          rows={6}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />

        {/* Tags */}
        <div className="mt-4">
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Étiquettes
          </label>
          <input
            type="text"
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="prépa marathon, seuil, vma..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Sépare les étiquettes par des virgules.
          </p>
        </div>

        {/* Section Aide */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showHelp ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Aide et exemples
          </button>

          {showHelp && (
            <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 text-sm">
              {/* Fonctionnalités */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 dark:text-white dark:text-white mb-2">Ce que l'IA comprend :</h4>
                <ul className="space-y-1 text-gray-600">
                  {SPORT_HELP[sport].features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Exemples cliquables */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white dark:text-white mb-2">Exemples à essayer :</h4>
                <div className="flex flex-wrap gap-2">
                  {SPORT_HELP[sport].examples.map((example, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDescription(example.value);
                        setShowHelp(false);
                        setShowPreview(false);
                        setSteps([]);
                      }}
                      className="px-3 py-1.5 bg-white dark:bg-gray-900 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-full text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bouton Prévisualiser */}
        <button
          type="button"
          onClick={handlePreview}
          disabled={isParsing}
          className="mt-3 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 text-white py-3 px-4 rounded-xl font-semibold hover:from-violet-400 hover:via-purple-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2"
        >
          {isParsing ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyse en cours...
            </>
          ) : (
            <>
              <span>✨</span>
              Analyser avec l'IA
            </>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Fallback warning */}
      {fallbackWarning && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <span>{fallbackWarning}</span>
        </div>
      )}

      {/* Prévisualisation */}
      {showPreview && steps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Prévisualisation</h3>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setUseGarminPreview(false)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  !useGarminPreview
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                Ancienne
              </button>
              <button
                type="button"
                onClick={() => setUseGarminPreview(true)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  useGarminPreview
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                Nouvelle
              </button>
            </div>
          </div>

          {useGarminPreview && garminWorkout ? (
            <>
              <GarminWorkoutPreview garminWorkout={garminWorkout} />
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Données envoyées à Garmin (temporaire)
                </h4>
                <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(garminWorkout, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <WorkoutPreview steps={steps} />
          )}
        </div>
      )}

      {/* Action buttons - affichés uniquement après analyse */}
      {showPreview && steps.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Télécharger FIT */}
          <button
            type="submit"
            disabled={isGenerating}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gray-800 text-gray-100 border border-gray-700 hover:bg-gray-700 hover:border-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V3m0 12-4-4m4 4 4-4" />
              <path d="M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" />
            </svg>
            <span className="text-xs">FIT</span>
          </button>

          {/* Partager */}
          <button
            type="button"
            onClick={handleShareClick}
            disabled={!name.trim()}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-xs">Partager</span>
          </button>

          {/* Sauvegarder */}
          {!isSaved ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gray-800 text-gray-100 border border-gray-700 hover:bg-gray-700 hover:border-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span className="text-xs">Sauvegarder</span>
            </button>
          ) : (
            <span className="flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl font-semibold bg-green-600/20 text-green-400 border border-green-600/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-xs">Sauvegardé</span>
            </span>
          )}

          {/* Synchroniser sur Garmin */}
          <button
            type="button"
            onClick={handleSyncClick}
            disabled={!name.trim()}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-900/30 hover:from-orange-400 hover:to-orange-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="12" height="16" rx="4" />
              <path d="M9 4V2h6v2" />
              <path d="M9 20v2h6v-2" />
              <path d="M12 9v6" />
            </svg>
            <span className="text-xs">Garmin</span>
          </button>
        </div>
      )}

      {syncSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Séance synchronisée avec Garmin Connect !
        </div>
      )}

      {showPreview && !syncSuccess && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Télécharge le fichier FIT, partage la séance, sauvegarde-la ou synchronise-la directement avec Garmin Connect.
        </p>
      )}
    </form>

    {/* Modal de synchronisation Garmin - EN DEHORS du form */}
    {showSyncModal && (
      <GarminSyncModal
        workout={getCurrentWorkout()}
        garminWorkout={garminWorkout || undefined}
        onClose={() => setShowSyncModal(false)}
        onSuccess={handleSyncSuccess}
      />
    )}

    {/* Modal de partage - EN DEHORS du form */}
    {shareSavedWorkout && (
      <ShareWorkoutDialog
        savedWorkout={shareSavedWorkout}
        onClose={() => setShareSavedWorkout(null)}
      />
    )}
  </>
  );
}
