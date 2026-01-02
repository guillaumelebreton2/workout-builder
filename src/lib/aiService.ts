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
  let prompt = `Tu es un coach sportif IA expert en course à pied, vélo et natation. Tu es amical, motivant et tu donnes des conseils personnalisés basés sur les données d'entraînement de l'utilisateur.

Règles importantes:
- Réponds toujours en français
- Sois concis mais utile (2-4 paragraphes max)
- Utilise des émojis avec modération pour rendre les réponses engageantes
- Base tes conseils sur les données réelles de l'utilisateur
- Si on te demande de créer une séance, décris-la en détail mais ne génère pas de JSON
- Encourage l'utilisateur tout en étant réaliste
`;

  if (metrics) {
    prompt += `
DONNÉES D'ENTRAÎNEMENT DE L'UTILISATEUR:

${metrics.summary}

Utilise ces données pour personnaliser tes réponses. Réfère-toi aux chiffres concrets quand c'est pertinent.
`;
  } else {
    prompt += `
L'utilisateur n'a pas encore connecté Strava, donc tu n'as pas accès à ses données d'entraînement. Encourage-le à se connecter pour des conseils personnalisés.
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
    /plan.*entrainement/i,
    /programme.*semaine/i,
  ];
  return patterns.some(p => p.test(message));
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

    // Si c'est une demande de séance, générer aussi le workout
    let workout: Workout | undefined;
    if (isWorkoutRequest(userMessage)) {
      workout = generateMockWorkout(userMessage);
    }

    return {
      content: aiContent,
      workout,
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
