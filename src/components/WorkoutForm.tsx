import { useState } from 'react';
import { Workout, WorkoutStep, Sport, generateId } from '../lib/types';
import { downloadFitFile } from '../lib/fit-encoder';
import { parseWithGroq } from '../lib/groq-parser';
import { SportSelector } from './SportSelector';
import { WorkoutPreview } from './WorkoutPreview';
import { GarminSyncModal } from './GarminSyncModal';

// Clé API depuis les variables d'environnement
const API_KEY = import.meta.env.VITE_GROQ_API_KEY;

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

// Enrichir les steps avec les allures calculées (course à pied)
// Le % correspond à la vitesse : 100% = vitesse de référence, 95% = plus lent (allure plus haute)
function enrichStepsWithPace(steps: WorkoutStep[], referencePaceMinKm: number): WorkoutStep[] {
  const referenceSpeedKmh = 60 / referencePaceMinKm;

  return steps.map(step => {
    if (step.details?.capPercent && !step.details?.paceMinKm) {
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
  });
}

// Enrichir les steps avec les watts calculés (vélo)
// Le % correspond à la puissance : 100% = puissance de référence, 95% = moins de watts
function enrichStepsWithWatts(steps: WorkoutStep[], referenceWatts: number): WorkoutStep[] {
  return steps.map(step => {
    if (step.details?.capPercent && !step.details?.watts) {
      const { low, high } = step.details.capPercent;
      // low correspond au % bas (moins de watts)
      // high correspond au % haut (plus de watts)
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
  });
}

// Enrichir les steps avec les allures natation calculées (min/100m)
// Le % correspond à la vitesse : 100% = vitesse de référence, 95% = plus lent
function enrichStepsWithSwimPace(steps: WorkoutStep[], referencePaceMin100m: number): WorkoutStep[] {
  const referenceSpeed = 100 / referencePaceMin100m; // m/min

  return steps.map(step => {
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
  running: `Décris ta séance comme tu veux, l'IA comprendra :

• "15min échauffement, puis 5x1000m à 90% avec 2min récup, et 10min retour au calme"

• "Sortie longue 1h30 en endurance fondamentale à 70-75%"

• "Pyramide : 200-400-600-800-600-400-200m avec récup égale à l'effort"

• Ou colle directement depuis Nolio/TrainingPeaks/etc.`,

  cycling: `Décris ta séance comme tu veux, l'IA comprendra :

• "10min échauffement 90rpm, puis 5x (1min force 40rpm / 1min vélocité 110rpm), 10min récup"

• "20min à 75-85% FTP, puis 2x10min à 95% avec 5min récup"

• "Sortie endurance 2h à 60-70% avec cadence libre"

• Ou colle directement depuis Nolio/TrainingPeaks/etc.`,

  swimming: `Décris ta séance comme tu veux, l'IA comprendra :

• "200m échauffement crawl, 4x50m sprints avec 30s récup, 200m retour au calme"

• "400m pull-buoy, 4x100m battements planche, 4x25m sprints"

• "10x100m crawl départ tous les 2min"

• Ou colle directement depuis Nolio/TrainingPeaks/etc.`,
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

export function WorkoutForm() {
  const [name, setName] = useState('');
  const [sport, setSport] = useState<Sport>('running');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

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

    if (!API_KEY || API_KEY === 'ta_cle_ici') {
      setError('Clé API manquante. Configure VITE_GROQ_API_KEY dans le fichier .env');
      return;
    }

    setIsParsing(true);

    try {
      const result = await parseWithGroq(description, API_KEY);
      let parsedSteps = result.steps;

      // Afficher un avertissement si un modèle de fallback a été utilisé
      if (result.isFallback) {
        setFallbackWarning(`Modèle de secours utilisé (${result.model}). La qualité du parsing peut être réduite, notamment pour les répétitions.`);
      }

      // Enrichir avec les allures/watts selon le sport
      if (sport === 'running') {
        const paceMinKm = parsePaceInput(runningPace);
        if (paceMinKm) {
          parsedSteps = enrichStepsWithPace(parsedSteps, paceMinKm);
        }
      } else if (sport === 'cycling') {
        const watts = parseFloat(cyclingWatts);
        if (!isNaN(watts) && watts > 0) {
          parsedSteps = enrichStepsWithWatts(parsedSteps, watts);
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
    }
    setSyncSuccess(false);
    setFallbackWarning(null);
  };

  const getCurrentWorkout = (): Workout => ({
    id: generateId(),
    name: name.trim(),
    sport,
    date: new Date(date),
    description: description.trim(),
    steps,
  });

  const handleSyncSuccess = () => {
    setShowSyncModal(false);
    setSyncSuccess(true);
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sport selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type de sport
        </label>
        <SportSelector value={sport} onChange={setSport} />
      </div>

      {/* Workout name + Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Nom de la séance
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Test VMA 20min"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
            Date
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Référence selon le sport */}
      <div>
        {sport === 'running' && (
          <>
            <label htmlFor="runningPace" className="block text-sm font-medium text-gray-700 mb-2">
              Allure de référence (VMA, seuil, marathon...)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="runningPace"
                value={runningPace}
                onChange={(e) => handleRunningPaceChange(e.target.value)}
                placeholder="4:00"
                className="w-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
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
            <label htmlFor="cyclingWatts" className="block text-sm font-medium text-gray-700 mb-2">
              Puissance de référence (FTP, PMA...)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="cyclingWatts"
                value={cyclingWatts}
                onChange={(e) => handleCyclingWattsChange(e.target.value)}
                placeholder="200"
                className="w-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
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
            <label htmlFor="swimmingPace" className="block text-sm font-medium text-gray-700 mb-2">
              Allure de référence (CSS, allure critique...)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="swimmingPace"
                value={swimmingPace}
                onChange={(e) => handleSwimmingPaceChange(e.target.value)}
                placeholder="1:45"
                className="w-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
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
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description de la séance
        </label>

        <textarea
          id="description"
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder={DESCRIPTION_PLACEHOLDERS[sport]}
          rows={6}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />

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
            <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm">
              {/* Fonctionnalités */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Ce que l'IA comprend :</h4>
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
                <h4 className="font-medium text-gray-900 mb-2">Exemples à essayer :</h4>
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
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-full text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
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
          className="mt-3 w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
              ✨ Analyser avec l'IA
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
          <WorkoutPreview steps={steps} />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isGenerating || !showPreview || steps.length === 0}
          className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? 'Génération...' : 'Télécharger FIT'}
        </button>

        <button
          type="button"
          onClick={() => setShowSyncModal(true)}
          disabled={!showPreview || steps.length === 0 || !name.trim()}
          className="flex-1 bg-orange-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          Sync Garmin
        </button>
      </div>

      {syncSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Séance synchronisée avec Garmin Connect !
        </div>
      )}

      {showPreview && !syncSuccess && (
        <p className="text-sm text-gray-500 text-center">
          Télécharge le fichier FIT pour l'importer manuellement, ou synchronise directement avec Garmin Connect.
        </p>
      )}
    </form>

    {/* Modal de synchronisation Garmin - EN DEHORS du form */}
    {showSyncModal && (
      <GarminSyncModal
        workout={getCurrentWorkout()}
        onClose={() => setShowSyncModal(false)}
        onSuccess={handleSyncSuccess}
      />
    )}
  </>
  );
}
