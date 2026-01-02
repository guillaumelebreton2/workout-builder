/**
 * Service de stockage des conversations du Coach IA
 * Pour l'instant : localStorage
 * Plus tard : remplacer par appels API Supabase
 */

import { Conversation, ChatMessage, generateId, generateConversationTitle } from './types';

const STORAGE_KEY = 'workout-builder-conversations';

// Récupérer toutes les conversations
export function getAllConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    console.error('Erreur lors de la lecture des conversations');
    return [];
  }
}

// Créer une nouvelle conversation
export function createConversation(firstMessage?: string): Conversation {
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: generateId(),
    title: firstMessage ? generateConversationTitle(firstMessage) : 'Nouvelle conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  const conversations = getAllConversations();
  conversations.unshift(conversation); // Plus récent en premier
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));

  return conversation;
}

// Récupérer une conversation par ID
export function getConversationById(id: string): Conversation | undefined {
  const conversations = getAllConversations();
  return conversations.find(c => c.id === id);
}

// Ajouter un message à une conversation
export function addMessage(conversationId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
  const conversations = getAllConversations();
  const conversation = conversations.find(c => c.id === conversationId);

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} non trouvée`);
  }

  const fullMessage: ChatMessage = {
    ...message,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };

  conversation.messages.push(fullMessage);
  conversation.updatedAt = new Date().toISOString();

  // Mettre à jour le titre si c'est le premier message utilisateur
  if (conversation.messages.length === 1 && message.role === 'user') {
    conversation.title = generateConversationTitle(message.content);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));

  return fullMessage;
}

// Mettre à jour le titre d'une conversation
export function updateConversationTitle(id: string, title: string): boolean {
  const conversations = getAllConversations();
  const conversation = conversations.find(c => c.id === id);

  if (!conversation) return false;

  conversation.title = title;
  conversation.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));

  return true;
}

// Supprimer une conversation
export function deleteConversation(id: string): boolean {
  const conversations = getAllConversations();
  const index = conversations.findIndex(c => c.id === id);

  if (index === -1) return false;

  conversations.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  return true;
}

// Supprimer toutes les conversations
export function clearAllConversations(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Export pour faciliter le remplacement futur par Supabase
export const conversationStore = {
  getAll: getAllConversations,
  create: createConversation,
  getById: getConversationById,
  addMessage,
  updateTitle: updateConversationTitle,
  delete: deleteConversation,
  clear: clearAllConversations,
};
