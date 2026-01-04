/**
 * Service d'appel à l'IA (Groq)
 * Génère des réponses intelligentes basées sur les données d'entraînement
 */

import { TrainingMetrics } from './metricsService';
import { Workout } from './types';

// URL du proxy backend pour l'API Groq
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MODEL = 'llama-3.3-70b-versatile';

// Types
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  workout?: Workout;
}

// Créer le prompt système avec le contexte des métriques
function createSystemPrompt(metrics: TrainingMetrics | null): string {
  let prompt = `Tu es un coach sportif IA spécialisé dans les sports d'endurance : course à pied, trail, vélo, natation, triathlon et sports associés.

## TON RÔLE
Tu accompagnes les athlètes amateurs et confirmés dans leur entraînement en analysant leurs données et en donnant des conseils personnalisés, concrets et basés sur des principes d'entraînement reconnus.

## PRINCIPES D'ENTRAÎNEMENT QUE TU UTILISES
- Polarisation (80% facile / 20% intense)
- Progression graduelle (+10% volume max/semaine)
- Périodisation (base → spécifique → affûtage)
- Récupération comme partie intégrante de l'entraînement
- Spécificité (adapter l'entraînement à l'objectif)
- Individualisation (basée sur les données de l'athlète)

## RÈGLES DE COMMUNICATION
- Réponds TOUJOURS en français
- Sois concis et actionnable (2-4 paragraphes max, sauf analyse détaillée)
- Utilise les données réelles de l'utilisateur quand disponibles
- Cite des chiffres concrets (distances, allures, zones)
- Sois encourageant mais honnête - ne survends pas les performances
- Utilise des émojis avec parcimonie (1-2 max par réponse)

## CE QUE TU PEUX FAIRE
✅ Analyser les séances et données d'entraînement
✅ Créer des séances structurées (fractionné, seuil, endurance, etc.)
✅ Donner des conseils sur la technique (cadence, foulée, position)
✅ Expliquer les zones d'entraînement (FC, allure, puissance)
✅ Aider à la planification (objectifs, périodisation)
✅ Conseils généraux de récupération (sommeil, repos, étirements)
✅ Répondre aux questions sur l'équipement sportif

## CE QUE TU NE DOIS PAS FAIRE
❌ Donner des conseils médicaux → "Je te conseille de consulter un médecin du sport pour cette question."
❌ Diagnostiquer des blessures → "Une douleur persistante nécessite l'avis d'un professionnel de santé."
❌ Conseils nutritionnels détaillés → "Pour un plan nutritionnel personnalisé, consulte un diététicien du sport."
❌ Prescrire des compléments/médicaments
❌ Répondre à des sujets hors sport/entraînement → "Je suis spécialisé dans le coaching sportif, je ne peux pas t'aider sur ce sujet."

## QUAND TU N'ES PAS SÛR
- Dis-le clairement : "D'après tes données..." ou "Sans plus d'informations..."
- Propose des fourchettes plutôt que des valeurs exactes
- Suggère de consulter un professionnel si nécessaire

## FORMAT DES SÉANCES
Quand tu décris une séance, utilise ce format clair :
- Nom et objectif de la séance
- Échauffement (durée, intensité)
- Corps de séance (détail des intervalles/blocs)
- Retour au calme
- Conseils spécifiques si pertinent

## GÉNÉRATION DE SÉANCES STRUCTURÉES
Quand on te demande de CRÉER une séance (pas juste expliquer), tu DOIS inclure un bloc JSON à la fin de ta réponse.
Le JSON doit être entouré de balises \`\`\`workout-json et \`\`\`.

Format du JSON :
{
  "name": "Nom de la séance",
  "sport": "running" | "cycling" | "swimming",
  "description": "Description courte",
  "steps": [
    {
      "type": "warmup" | "active" | "recovery" | "cooldown" | "rest",
      "name": "Nom du step",
      "duration": { "type": "time" | "distance", "value": nombre },
      "notes": "Notes optionnelles"
    }
  ]
}

Règles pour les steps :
- duration.type "time" : value en SECONDES (ex: 600 = 10min)
- duration.type "distance" : value en MÈTRES (ex: 400 = 400m)
- Inclure TOUJOURS : échauffement, corps de séance, retour au calme
- Pour les fractionnés : alterner les steps "active" et "recovery"
- Adapter les allures au niveau de l'athlète basé sur ses données

Exemple de séance fractionné :
\`\`\`workout-json
{
  "name": "Fractionné 6x400m",
  "sport": "running",
  "description": "Travail VMA pour améliorer la vitesse",
  "steps": [
    { "type": "warmup", "name": "Échauffement", "duration": { "type": "time", "value": 900 } },
    { "type": "active", "name": "400m rapide", "duration": { "type": "distance", "value": 400 } },
    { "type": "recovery", "name": "Récupération trot", "duration": { "type": "time", "value": 90 } },
    { "type": "active", "name": "400m rapide", "duration": { "type": "distance", "value": 400 } },
    { "type": "recovery", "name": "Récupération trot", "duration": { "type": "time", "value": 90 } },
    { "type": "cooldown", "name": "Retour au calme", "duration": { "type": "time", "value": 600 } }
  ]
}
\`\`\`
`;

  if (metrics) {
    prompt += `
## DONNÉES D'ENTRAÎNEMENT DE L'UTILISATEUR

${metrics.summary}

Utilise ces données pour personnaliser TOUTES tes réponses. Réfère-toi aux chiffres concrets. Adapte tes conseils au niveau et volume actuel de l'athlète.
`;
  } else {
    prompt += `
## CONTEXTE
L'utilisateur n'a pas encore connecté Strava. Tu n'as pas accès à ses données d'entraînement.
- Pour les conseils généraux, tu peux répondre
- Pour les conseils personnalisés, encourage-le à connecter Strava
- Demande des informations (niveau, volume actuel, objectif) si nécessaire pour personnaliser
`;
  }

  return prompt;
}

// Détecter si c'est une demande de création de séance
function isWorkoutRequest(message: string): boolean {
  const patterns = [
    /cr[ée]+.*s[ée]ance/i,
    /faire.*s[ée]ance/i,
    /g[ée]n[èe]re.*workout/i,
    /propose.*entrainement/i,
    /entrainement.*fractionn[ée]/i,
    /s[ée]ance.*fractionn[ée]/i,
    /fais[- ]?moi.*s[ée]ance/i,
    /donne[- ]?moi.*s[ée]ance/i,
    /pr[ée]pare.*s[ée]ance/i,
  ];
  return patterns.some(p => p.test(message));
}

// Parser le JSON de workout depuis la réponse de l'IA
function parseWorkoutFromResponse(response: string): { content: string; workout?: Workout } {
  // Chercher le bloc workout-json dans la réponse
  const jsonMatch = response.match(/```workout-json\s*([\s\S]*?)```/);

  if (!jsonMatch) {
    return { content: response };
  }

  try {
    const jsonStr = jsonMatch[1].trim();
    const workoutData = JSON.parse(jsonStr);

    // Valider et créer le workout
    if (!workoutData.name || !workoutData.steps || !Array.isArray(workoutData.steps)) {
      console.warn('Workout JSON invalide:', workoutData);
      return { content: response };
    }

    // Générer des IDs pour chaque step
    const steps = workoutData.steps.map((step: { type: string; name: string; duration?: { type: string; value: number }; notes?: string }, index: number) => ({
      id: `${index + 1}`,
      type: step.type || 'active',
      name: step.name || `Step ${index + 1}`,
      duration: step.duration || { type: 'time', value: 300 },
      notes: step.notes,
    }));

    const workout: Workout = {
      id: Math.random().toString(36).substring(2, 9),
      name: workoutData.name,
      sport: workoutData.sport || 'running',
      date: new Date(),
      description: workoutData.description || '',
      steps,
    };

    // Retirer le bloc JSON du contenu affiché
    const content = response.replace(/```workout-json[\s\S]*?```/g, '').trim();

    return { content, workout };
  } catch (error) {
    console.error('Erreur parsing workout JSON:', error);
    return { content: response };
  }
}

// Générer une séance mockée (en attendant une vraie génération par l'IA)
function generateMockWorkout(userMessage: string): Workout {
  // Détecter le type de séance demandé
  const isInterval = /fractionn[ée]|interval|vma|vitesse/i.test(userMessage);
  const isLong = /long|endurance|fond/i.test(userMessage);
  const isTempo = /tempo|seuil|allure/i.test(userMessage);

  if (isInterval) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: 'Fractionné 8x400m',
      sport: 'running',
      date: new Date(),
      description: 'Séance de fractionné court pour travailler la VMA',
      steps: [
        { id: '1', type: 'warmup', name: 'Échauffement', duration: { type: 'time', value: 600 } },
        { id: '2', type: 'active', name: '400m rapide', duration: { type: 'distance', value: 400 }, details: { capPercent: { low: 95, high: 100 } } },
        { id: '3', type: 'recovery', name: 'Récupération', duration: { type: 'time', value: 90 } },
        { id: '4', type: 'active', name: '400m rapide', duration: { type: 'distance', value: 400 }, details: { capPercent: { low: 95, high: 100 } } },
        { id: '5', type: 'recovery', name: 'Récupération', duration: { type: 'time', value: 90 } },
        { id: '6', type: 'active', name: '400m rapide', duration: { type: 'distance', value: 400 }, details: { capPercent: { low: 95, high: 100 } } },
        { id: '7', type: 'recovery', name: 'Récupération', duration: { type: 'time', value: 90 } },
        { id: '8', type: 'active', name: '400m rapide', duration: { type: 'distance', value: 400 }, details: { capPercent: { low: 95, high: 100 } } },
        { id: '9', type: 'recovery', name: 'Récupération', duration: { type: 'time', value: 90 } },
        { id: '10', type: 'active', name: '400m rapide', duration: { type: 'distance', value: 400 }, details: { capPercent: { low: 95, high: 100 } } },
        { id: '11', type: 'recovery', name: 'Récupération', duration: { type: 'time', value: 90 } },
        { id: '12', type: 'active', name: '400m rapide', duration: { type: 'distance', value: 400 }, details: { capPercent: { low: 95, high: 100 } } },
        { id: '13', type: 'recovery', name: 'Récupération', duration: { type: 'time', value: 90 } },
        { id: '14', type: 'active', name: '400m rapide', duration: { type: 'distance', value: 400 }, details: { capPercent: { low: 95, high: 100 } } },
        { id: '15', type: 'recovery', name: 'Récupération', duration: { type: 'time', value: 90 } },
        { id: '16', type: 'active', name: '400m rapide', duration: { type: 'distance', value: 400 }, details: { capPercent: { low: 95, high: 100 } } },
        { id: '17', type: 'cooldown', name: 'Retour au calme', duration: { type: 'time', value: 600 } },
      ],
    };
  } else if (isLong) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: 'Sortie longue 1h30',
      sport: 'running',
      date: new Date(),
      description: 'Sortie longue en endurance fondamentale',
      steps: [
        { id: '1', type: 'warmup', name: 'Échauffement progressif', duration: { type: 'time', value: 600 } },
        { id: '2', type: 'active', name: 'Endurance fondamentale', duration: { type: 'time', value: 4800 }, details: { capPercent: { low: 65, high: 75 } } },
        { id: '3', type: 'cooldown', name: 'Retour au calme', duration: { type: 'time', value: 300 } },
      ],
    };
  } else if (isTempo) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      name: 'Tempo 3x10min',
      sport: 'running',
      date: new Date(),
      description: 'Travail au seuil pour améliorer l\'endurance',
      steps: [
        { id: '1', type: 'warmup', name: 'Échauffement', duration: { type: 'time', value: 900 } },
        { id: '2', type: 'active', name: 'Tempo', duration: { type: 'time', value: 600 }, details: { capPercent: { low: 85, high: 90 } } },
        { id: '3', type: 'recovery', name: 'Récupération', duration: { type: 'time', value: 180 } },
        { id: '4', type: 'active', name: 'Tempo', duration: { type: 'time', value: 600 }, details: { capPercent: { low: 85, high: 90 } } },
        { id: '5', type: 'recovery', name: 'Récupération', duration: { type: 'time', value: 180 } },
        { id: '6', type: 'active', name: 'Tempo', duration: { type: 'time', value: 600 }, details: { capPercent: { low: 85, high: 90 } } },
        { id: '7', type: 'cooldown', name: 'Retour au calme', duration: { type: 'time', value: 600 } },
      ],
    };
  }

  // Séance par défaut
  return {
    id: Math.random().toString(36).substring(2, 9),
    name: 'Footing 45min',
    sport: 'running',
    date: new Date(),
    description: 'Footing en endurance fondamentale',
    steps: [
      { id: '1', type: 'warmup', name: 'Début progressif', duration: { type: 'time', value: 300 } },
      { id: '2', type: 'active', name: 'Footing', duration: { type: 'time', value: 2400 }, details: { capPercent: { low: 65, high: 75 } } },
      { id: '3', type: 'cooldown', name: 'Retour au calme', duration: { type: 'time', value: 300 } },
    ],
  };
}

// Appeler l'API Groq via le proxy backend
async function callGroqAPI(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${API_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Erreur Groq API:', error);
    throw new Error(`Erreur API: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// Fonction principale : générer une réponse
export async function generateAIResponse(
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  metrics: TrainingMetrics | null
): Promise<AIResponse> {
  // Construire les messages pour l'API
  const messages: ChatMessage[] = [
    { role: 'system', content: createSystemPrompt(metrics) },
  ];

  // Ajouter l'historique de conversation (limité aux 10 derniers messages)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Ajouter le message actuel
  messages.push({ role: 'user', content: userMessage });

  try {
    const aiContent = await callGroqAPI(messages);

    // Parser la réponse pour extraire un éventuel workout JSON
    const { content, workout } = parseWorkoutFromResponse(aiContent);

    // Si c'est une demande de séance mais que l'IA n'a pas généré de JSON, utiliser le fallback
    let finalWorkout = workout;
    if (!workout && isWorkoutRequest(userMessage)) {
      console.log('Workout request détectée mais pas de JSON, utilisation du fallback');
      finalWorkout = generateMockWorkout(userMessage);
    }

    return {
      content,
      workout: finalWorkout,
    };
  } catch (error) {
    console.error('Erreur génération IA:', error);

    // Fallback en cas d'erreur
    if (isWorkoutRequest(userMessage)) {
      return {
        content: "Voici une séance adaptée à ta demande ! Tu peux la sauvegarder ou la synchroniser avec Garmin.",
        workout: generateMockWorkout(userMessage),
      };
    }

    return {
      content: "Désolé, j'ai rencontré une erreur. Réessaie dans quelques instants !",
    };
  }
}

// Export
export const aiService = {
  generateResponse: generateAIResponse,
};
