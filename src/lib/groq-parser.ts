/**
 * Service de parsing de séances via Groq AI
 */

import { WorkoutStep, StepType, SwimStrokeType, SwimEquipmentType, SwimDrillType, SwimIntensityLevel, generateId } from './types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Modèles Groq par ordre de préférence (chacun a sa propre limite de 100k tokens/jour)
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',  // Principal : meilleure qualité
  'llama-3.1-8b-instant',      // Fallback 1 : rapide
  'gemma2-9b-it',              // Fallback 2 : Google
  'llama-3.2-3b-preview',      // Fallback 3 : très petit mais disponible
];

interface ParsedStep {
  duration_minutes?: number;
  duration_seconds?: number;
  distance_meters?: number;
  is_lap: boolean;
  type: 'warmup' | 'active' | 'recovery' | 'cooldown' | 'rest';
  name: string;
  cap_percent_low?: number;
  cap_percent_high?: number;
  repetitions?: number;
  // Champs natation
  swim_stroke?: SwimStrokeType;
  swim_equipment?: SwimEquipmentType[];
  swim_drill?: SwimDrillType;
  swim_intensity?: SwimIntensityLevel;
  swim_notes?: string;
  // Allure natation (en secondes par 100m)
  swim_pace_seconds_per_100m?: number;
  // Champs vélo
  cadence_rpm?: number;
  power_percent_low?: number;
  power_percent_high?: number;
}

interface AIResponse {
  steps: ParsedStep[];
}

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'analyse de descriptions d'entraînements sportifs (course à pied, vélo, natation).

Ton rôle est de convertir une description textuelle en une liste d'étapes structurées au format JSON.

Règles importantes :

DURÉES - TRÈS IMPORTANT :
- "2'" ou "2min" ou "2 min" = 2 MINUTES donc duration_minutes: 2
- "30''" ou "30s" ou "30 sec" = 30 SECONDES donc duration_seconds: 30
- "1'30" ou "1min30" = 1 minute 30 secondes donc duration_minutes: 1, duration_seconds: 30
- "R°" ou "récup" signifie récupération
- NE JAMAIS confondre minutes et secondes !

DISTANCES :
- "800m" = 800 mètres donc distance_meters: 800
- "1km" ou "1000m" = 1000 mètres donc distance_meters: 1000

TYPES D'ÉTAPES :
- warmup : échauffement
- active : effort principal, intervalle, corps de séance
- recovery : récupération ENTRE les efforts (courte, généralement < 5min)
- cooldown : retour au calme (fin de séance)
- rest : repos complet

POURCENTAGES (course à pied) :
- Extrais le pourcentage CAP/VMA UNIQUEMENT s'il est explicitement mentionné (ex: "76%-90%" ou "100%")
- Si aucun pourcentage n'est mentionné, NE PAS ajouter cap_percent_low ni cap_percent_high

VÉLO - SPÉCIFIQUE :
1. cadence_rpm (cadence en tours/minute) :
   - "90rpm" ou "90 rpm" = cadence_rpm: 90
   - "40 rpm" = cadence_rpm: 40
   - "110rpm" = cadence_rpm: 110

2. power_percent_low et power_percent_high (puissance en % FTP) :
   - "75% - 90%" = power_percent_low: 75, power_percent_high: 90
   - "100%" = power_percent_low: 100, power_percent_high: 100
   - Ces pourcentages sont pour la PUISSANCE vélo, pas la CAP course

Exemple vélo :
- "Échauffement 10' 90rpm" = duration_minutes: 10, type: warmup, cadence_rpm: 90
- "1' 40 rpm" = duration_minutes: 1, cadence_rpm: 40
- "15' 75% - 90% 90rpm" = duration_minutes: 15, power_percent_low: 75, power_percent_high: 90, cadence_rpm: 90
- "5' récupération 80 rpm" = duration_minutes: 5, type: cooldown, cadence_rpm: 80
- "Récupération lap" = is_lap: true, type: cooldown

RÉPÉTITIONS - TRÈS CRITIQUE - LIRE ATTENTIVEMENT :
Tu DOIS créer UN OBJET JSON SÉPARÉ pour CHAQUE répétition. Ne JAMAIS regrouper.

RÈGLE D'OR : Si tu vois "3x", tu DOIS avoir AU MOINS 6 objets dans steps (3 efforts + 3 récups).
            Si tu vois "5x", tu DOIS avoir AU MOINS 10 objets dans steps (5 efforts + 5 récups).
            Si tu vois "10x", tu DOIS avoir AU MOINS 20 objets dans steps.

EXEMPLE CONCRET - "3x 1' vite / 1' lent" (course) :
Tu DOIS générer EXACTEMENT 6 objets :
  {"duration_minutes": 1, "type": "active", "name": "Vite"},
  {"duration_minutes": 1, "type": "recovery", "name": "Récup"},
  {"duration_minutes": 1, "type": "active", "name": "Vite"},
  {"duration_minutes": 1, "type": "recovery", "name": "Récup"},
  {"duration_minutes": 1, "type": "active", "name": "Vite"},
  {"duration_minutes": 1, "type": "recovery", "name": "Récup"}

EXEMPLE CONCRET - "3x (1' 40rpm / 1' 80rpm)" (vélo) :
Tu DOIS générer EXACTEMENT 6 objets AVEC cadence_rpm :
  {"duration_minutes": 1, "type": "active", "name": "Force", "cadence_rpm": 40},
  {"duration_minutes": 1, "type": "recovery", "name": "Récup", "cadence_rpm": 80},
  {"duration_minutes": 1, "type": "active", "name": "Force", "cadence_rpm": 40},
  {"duration_minutes": 1, "type": "recovery", "name": "Récup", "cadence_rpm": 80},
  {"duration_minutes": 1, "type": "active", "name": "Force", "cadence_rpm": 40},
  {"duration_minutes": 1, "type": "recovery", "name": "Récup", "cadence_rpm": 80}

EXEMPLE CONCRET - "5x 800m avec 2' récup" :
Tu DOIS générer EXACTEMENT 10 objets :
  {"distance_meters": 800, "type": "active", "name": "800m"},
  {"duration_minutes": 2, "type": "recovery", "name": "Récup"},
  {"distance_meters": 800, "type": "active", "name": "800m"},
  {"duration_minutes": 2, "type": "recovery", "name": "Récup"},
  {"distance_meters": 800, "type": "active", "name": "800m"},
  {"duration_minutes": 2, "type": "recovery", "name": "Récup"},
  {"distance_meters": 800, "type": "active", "name": "800m"},
  {"duration_minutes": 2, "type": "recovery", "name": "Récup"},
  {"distance_meters": 800, "type": "active", "name": "800m"},
  {"duration_minutes": 2, "type": "recovery", "name": "Récup"}

CE QUI EST INTERDIT :
- NE JAMAIS utiliser un champ "repetitions"
- NE JAMAIS créer un seul objet pour représenter plusieurs répétitions
- NE JAMAIS numéroter (pas de "1/5", "2/5", etc.)
- NE JAMAIS mélanger des blocs de répétitions différents

EXEMPLE - "5x (1' à 40rpm / 1' à 80rpm) puis 5x (1' à 110rpm / 1' à 80rpm)" :
CORRECT - garder les blocs séparés :
  40rpm, 80rpm, 40rpm, 80rpm, 40rpm, 80rpm, 40rpm, 80rpm, 40rpm, 80rpm,  <- bloc 1 complet
  110rpm, 80rpm, 110rpm, 80rpm, 110rpm, 80rpm, 110rpm, 80rpm, 110rpm, 80rpm  <- bloc 2 complet

INCORRECT - mélanger les blocs :
  40rpm, 80rpm, 110rpm, 80rpm, 40rpm, 80rpm...  <- INTERDIT !

Chaque bloc "Nx" doit être COMPLÈTEMENT terminé avant de passer au suivant.

IMPORTANT : Dans chaque étape, TOUJOURS inclure les paramètres spécifiques :
- Vélo : cadence_rpm si mentionné, power_percent_low/high si mentionné
- Course : cap_percent_low/high si mentionné
- Natation : swim_stroke, swim_equipment, swim_intensity si mentionnés

TOUJOURS dérouler EXPLICITEMENT chaque étape en objets JSON séparés.

NATATION - SPÉCIFIQUE :
Chaque étape de natation DOIT avoir ces champs (si applicable) :

1. swim_stroke (type de nage) - OBLIGATOIRE si mentionné :
   - "free" : crawl, nage libre
   - "backstroke" : dos, dos crawlé
   - "breaststroke" : brasse
   - "fly" : papillon
   - "im" : 4 nages, épreuve individuelle
   - "rimo" : 4 nages inversé (dos, brasse, papillon, crawl)
   - "choice" : choix (la nage est au choix)
   - "mixed" : mixte (plusieurs nages)

2. swim_equipment (équipements) - tableau si mentionné :
   - "fins" : palmes
   - "kickboard" : planche
   - "paddles" : plaquettes
   - "pull_buoy" : pull-buoy, pullbuoy, pull buoy
   - "snorkel" : tuba

3. swim_drill (type d'exercice) - si applicable :
   - "kick" : battements de jambes, jambes, éducatif jambes
   - "pull" : bras seulement, tirage
   - "drill" : éducatif, exercice technique

4. swim_intensity (intensité) - si mentionné :
   - "recovery" : récupération, souple, tranquille
   - "easy" : facile
   - "moderate" : modéré
   - "hard" : difficile, soutenu
   - "very_hard" : très difficile
   - "maximum" : max, vitesse max, sprint, 100%
   - "ascending" : progressif, croissant
   - "descending" : décroissant, négatif split

5. swim_notes : notes pour tout ce qui ne rentre pas ailleurs (ex: "Hypoxie respiration 5tps/7tps", "technique rattrapé")

6. swim_pace_seconds_per_100m (allure en SECONDES par 100m) - TRÈS IMPORTANT :
   - "200m à 2'/100m" = 200m à allure de 2 minutes par 100m = swim_pace_seconds_per_100m: 120
   - "300m en 6'" = 300m en 6 minutes total = 6min pour 300m = 2min/100m = swim_pace_seconds_per_100m: 120
   - "100m à 1'45/100m" = swim_pace_seconds_per_100m: 105
   - "4x50m à 45''/50m" = swim_pace_seconds_per_100m: 90 (45s pour 50m = 90s pour 100m)
   - Calcul pour "Xm en Y'" : swim_pace_seconds_per_100m = (Y en secondes) * 100 / X

SEND-OFF TIME (départ tous les X') - TRÈS IMPORTANT :
   - "3x100m départ tous les 2'" = 3 répétitions de 100m avec départ toutes les 2 minutes
   - DOIT générer un pattern [distance + repos lap] pour chaque répétition :
     * 100m active avec swim_notes: "Départ tous les 2'"
     * rest avec is_lap: true (repos jusqu'au prochain départ, touche lap)
     * 100m active avec swim_notes: "Départ tous les 2'"
     * rest avec is_lap: true
     * 100m active avec swim_notes: "Départ tous les 2'"
     * rest avec is_lap: true
   - Le repos is_lap: true permet au nageur d'appuyer sur lap quand c'est l'heure de repartir

RÈGLE CRITIQUE NATATION - NE JAMAIS REGROUPER :
- Chaque ligne de la description utilisateur = UNE étape séparée dans le JSON
- INTERDIT de créer des répétitions si les lignes ont des nages ou équipements différents

EXEMPLE - CE QU'IL NE FAUT PAS FAIRE :
Input utilisateur:
  "100m dos avec pullbuoy
   100m brasse
   100m crawl avec pullbuoy"
MAUVAISE réponse (INTERDIT): répétitions: 3, name: "3x100m"
BONNE réponse: 3 objets séparés dans le tableau steps

- Seules les VRAIES répétitions EXPLICITES (ex: "4x 25m sprint" ou "6x 50m") doivent être déroulées
- La nage par défaut si non précisée est "free" (crawl)

Réponds UNIQUEMENT avec un JSON valide, sans commentaires ni explications.

Format de réponse course/vélo :
{
  "steps": [
    {
      "duration_minutes": 10,
      "is_lap": false,
      "type": "warmup",
      "name": "Échauffement",
      "cap_percent_low": 55,
      "cap_percent_high": 75
    }
  ]
}

Format de réponse NATATION :
{
  "steps": [
    {
      "distance_meters": 200,
      "is_lap": false,
      "type": "warmup",
      "name": "Crawl pull-buoy",
      "swim_stroke": "free",
      "swim_equipment": ["pull_buoy"]
    },
    {
      "distance_meters": 100,
      "is_lap": false,
      "type": "warmup",
      "name": "Dos pull-buoy",
      "swim_stroke": "backstroke",
      "swim_equipment": ["pull_buoy"]
    },
    {
      "distance_meters": 25,
      "is_lap": false,
      "type": "active",
      "name": "Sprint",
      "swim_stroke": "free",
      "swim_intensity": "maximum"
    },
    {
      "distance_meters": 75,
      "is_lap": false,
      "type": "recovery",
      "name": "Récupération",
      "swim_stroke": "free",
      "swim_intensity": "recovery"
    }
  ]
}`;

// Appeler l'API Groq avec un modèle spécifique
async function callGroqAPI(description: string, apiKey: string, model: string): Promise<{ content: string; model: string }> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyse cette description de séance et convertis-la en JSON :\n\n${description}` }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error('Clé API invalide');
    }
    // Vérifier si c'est une erreur de rate limit
    if (response.status === 429 || errorText.includes('rate_limit')) {
      const error = new Error(`Rate limit atteint pour ${model}`);
      (error as Error & { isRateLimit: boolean }).isRateLimit = true;
      throw error;
    }
    throw new Error(`Erreur Groq: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Réponse vide de Groq');
  }

  return { content, model };
}

export interface ParseResult {
  steps: WorkoutStep[];
  model: string;
  isFallback: boolean;
}

export async function parseWithGroq(description: string, apiKeys: string | string[]): Promise<ParseResult> {
  // Normaliser en tableau de clés
  const keys = Array.isArray(apiKeys) ? apiKeys.filter(k => k) : [apiKeys].filter(k => k);

  if (keys.length === 0) {
    throw new Error('Clé API Groq manquante');
  }

  // Essayer chaque clé API, puis chaque modèle
  let lastError: Error | null = null;
  let content: string | null = null;
  let usedModel: string | null = null;

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const apiKey = keys[keyIndex];
    console.log(`Essai avec la clé API ${keyIndex + 1}/${keys.length}`);

    for (const model of GROQ_MODELS) {
      try {
        console.log(`  Essai avec le modèle: ${model}`);
        const result = await callGroqAPI(description, apiKey, model);
        content = result.content;
        usedModel = result.model;
        console.log(`  Succès avec le modèle: ${model}`);
        break;
      } catch (error) {
        lastError = error as Error;
        const isRateLimit = (error as Error & { isRateLimit?: boolean }).isRateLimit;

        if (isRateLimit) {
          console.warn(`  Rate limit atteint pour ${model}, essai du modèle suivant...`);
          continue;
        }
        // Si ce n'est pas un rate limit, propager l'erreur
        throw error;
      }
    }

    // Si on a trouvé un contenu, on sort de la boucle des clés
    if (content) break;

    console.log(`Tous les modèles épuisés pour la clé ${keyIndex + 1}, essai de la clé suivante...`);
  }

  if (!content) {
    throw lastError || new Error('Toutes les clés API et tous les modèles ont échoué');
  }

  console.log(`Modèle utilisé: ${usedModel}`);

  // Parser le JSON de la réponse
  let parsed: AIResponse;
  try {
    // Nettoyer la réponse (parfois l'IA ajoute du texte autour du JSON)
    console.log('Réponse brute de Groq:', content);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Pas de JSON trouvé dans:', content);
      throw new Error('Pas de JSON trouvé dans la réponse');
    }
    console.log('JSON extrait:', jsonMatch[0]);
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Réponse brute:', content);
    throw new Error('Impossible de parser la réponse JSON');
  }

  // Convertir en WorkoutStep[]
  const steps = parsed.steps.map((step): WorkoutStep => {
    const workoutStep: WorkoutStep = {
      id: generateId(),
      type: step.type as StepType,
      name: step.name || 'Étape',
      duration: {
        type: step.is_lap ? 'open' : step.distance_meters ? 'distance' : 'time',
        value: step.distance_meters ||
               (step.duration_minutes ? step.duration_minutes * 60 : 0) +
               (step.duration_seconds || 0) || undefined,
      },
    };

    // Initialiser les détails
    workoutStep.details = {};

    // Ajouter l'intensité basée sur le % CAP
    if (step.cap_percent_low) {
      const avg = step.cap_percent_high
        ? (step.cap_percent_low + step.cap_percent_high) / 2
        : step.cap_percent_low;

      let zone: number;
      if (avg <= 60) zone = 1;
      else if (avg <= 75) zone = 2;
      else if (avg <= 90) zone = 3;
      else if (avg <= 105) zone = 4;
      else zone = 5;

      workoutStep.intensity = { type: 'heartRate', zone };
      workoutStep.details.capPercent = {
        low: step.cap_percent_low,
        high: step.cap_percent_high || step.cap_percent_low,
      };
    }

    // Ajouter les champs natation
    if (step.swim_stroke) {
      workoutStep.details.swimStroke = step.swim_stroke;
    }
    if (step.swim_equipment && step.swim_equipment.length > 0) {
      workoutStep.details.swimEquipment = step.swim_equipment;
    }
    if (step.swim_drill) {
      workoutStep.details.swimDrill = step.swim_drill;
    }
    if (step.swim_intensity) {
      workoutStep.details.swimIntensity = step.swim_intensity;
    }
    if (step.swim_notes) {
      workoutStep.details.swimNotes = step.swim_notes;
    }
    // Allure natation (convertir secondes -> minutes)
    if (step.swim_pace_seconds_per_100m) {
      const paceMinutes = step.swim_pace_seconds_per_100m / 60;
      workoutStep.details.swimPaceMin100m = {
        low: paceMinutes,
        high: paceMinutes,
      };
    }

    // Champs vélo
    if (step.cadence_rpm) {
      workoutStep.details.cadence = step.cadence_rpm;
    }
    if (step.power_percent_low) {
      workoutStep.details.powerPercent = {
        low: step.power_percent_low,
        high: step.power_percent_high || step.power_percent_low,
      };
    }

    // Nommage automatique pour le vélo si le nom est générique
    const stepName = step.name || '';
    const genericNames = [
      'intervalle', 'interval', 'effort', 'active', 'récup', 'recup', 'recovery',
      'force', 'vélocité', 'velocité', 'velocite', 'puissance', 'power', 'sprint'
    ];
    const isGenericName = !stepName ||
                          genericNames.some(g => stepName.toLowerCase().includes(g)) ||
                          stepName.length <= 3 ||
                          /^\d/.test(stepName); // commence par un chiffre

    if (isGenericName && (step.cadence_rpm || step.power_percent_low)) {
      // Logique de nommage basée sur la cadence et la puissance
      if (step.type === 'recovery' || step.type === 'cooldown' || step.type === 'rest') {
        workoutStep.name = 'Récupération';
      } else if (step.cadence_rpm) {
        if (step.cadence_rpm < 80) {
          workoutStep.name = 'Force';
        } else if (step.cadence_rpm > 90) {
          workoutStep.name = 'Vélocité';
        } else if (step.power_percent_low) {
          workoutStep.name = 'Puissance';
        } else {
          workoutStep.name = 'Récupération';
        }
      } else if (step.power_percent_low) {
        workoutStep.name = 'Puissance';
      }
    }

    // Nettoyer les détails vides
    if (Object.keys(workoutStep.details).length === 0) {
      delete workoutStep.details;
    }

    return workoutStep;
  });

  return {
    steps,
    model: usedModel!,
    isFallback: usedModel !== GROQ_MODELS[0],
  };
}

// Vérifier si une clé API est valide
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
