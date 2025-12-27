/**
 * Service de parsing de séances via Groq AI
 */

import { WorkoutStep, StepType, generateId } from './types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

POURCENTAGES :
- Extrais le pourcentage CAP/VMA UNIQUEMENT s'il est explicitement mentionné (ex: "76%-90%" ou "100%")
- Si aucun pourcentage n'est mentionné, NE PAS ajouter cap_percent_low ni cap_percent_high

RÉPÉTITIONS - CRITIQUE :
- "10x 800m avec 2' récup" = déroule les 10 répétitions complètes : 800m, récup 2min, 800m, récup 2min, ... , 800m, récup 2min (10 x 800m ET 10 x récup)
- "4x (1500m - 500m) avec 2' récup" = 1500m, récup, 500m, récup, 1500m, récup, 500m, récup... (4 fois le bloc complet avec récup)
- TOUJOURS dérouler explicitement chaque étape
- TOUJOURS inclure la récup après chaque intervalle, y compris le dernier
- NE PAS numéroter les étapes (pas de "1/10", "2/10", etc.) - utiliser des noms simples comme "Intervalle", "Récup", "800m"

Réponds UNIQUEMENT avec un JSON valide, sans commentaires ni explications.

Format de réponse :
{
  "steps": [
    {
      "duration_minutes": 10,
      "is_lap": false,
      "type": "warmup",
      "name": "Échauffement",
      "cap_percent_low": 55,
      "cap_percent_high": 75
    },
    {
      "distance_meters": 400,
      "is_lap": false,
      "type": "active",
      "name": "Intervalle 1/5",
      "cap_percent_low": 100,
      "cap_percent_high": 100
    }
  ]
}`;

export async function parseWithGroq(description: string, apiKey: string): Promise<WorkoutStep[]> {
  if (!apiKey) {
    throw new Error('Clé API Groq manquante');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyse cette description de séance et convertis-la en JSON :\n\n${description}` }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 401) {
      throw new Error('Clé API invalide');
    }
    throw new Error(`Erreur Groq: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Réponse vide de Groq');
  }

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
  return parsed.steps.map((step): WorkoutStep => {
    const workoutStep: WorkoutStep = {
      id: generateId(),
      type: step.type as StepType,
      name: step.name,
      duration: {
        type: step.is_lap ? 'open' : step.distance_meters ? 'distance' : 'time',
        value: step.distance_meters ||
               (step.duration_minutes ? step.duration_minutes * 60 : 0) +
               (step.duration_seconds || 0) || undefined,
      },
    };

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
      workoutStep.details = {
        capPercent: {
          low: step.cap_percent_low,
          high: step.cap_percent_high || step.cap_percent_low,
        },
      };
    }

    return workoutStep;
  });
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
