import { useState, useEffect, useRef } from 'react';
import { Conversation } from '../lib/types';
import { conversationStore } from '../lib/conversationStore';
import { stravaApi } from '../lib/stravaApi';
import { metricsService, TrainingMetrics } from '../lib/metricsService';
import { aiService } from '../lib/aiService';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessageBubble, ChatLoadingIndicator } from './ChatMessageBubble';

const SUGGESTED_QUESTIONS = [
  "Suis-je prêt pour mon objectif ?",
  "Analyse ma semaine",
  "Crée-moi une séance de fractionné",
  "Comment progresser ?",
];

export function CoachPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // État Strava
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaAthlete, setStravaAthlete] = useState<string | null>(null);

  // Métriques
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Charger les métriques Strava
  const loadMetrics = async () => {
    if (!stravaConnected) return;
    setMetricsLoading(true);
    try {
      const data = await metricsService.calculateTrainingMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Erreur chargement métriques:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  // Charger les conversations et vérifier la connexion Strava au démarrage
  useEffect(() => {
    const loaded = conversationStore.getAll();
    setConversations(loaded);
    if (loaded.length > 0) {
      setCurrentConversationId(loaded[0].id);
    }

    // Gérer le callback OAuth si présent dans l'URL
    const tokens = stravaApi.handleOAuthCallback();
    if (tokens) {
      setStravaConnected(true);
      setStravaAthlete(tokens.athlete_name || null);
    } else {
      // Vérifier si déjà connecté
      const storedTokens = stravaApi.getStoredTokens();
      if (storedTokens) {
        setStravaConnected(true);
        setStravaAthlete(storedTokens.athlete_name || null);
      }
    }
  }, []);

  // Charger les métriques quand on se connecte à Strava
  useEffect(() => {
    if (stravaConnected && !metrics && !metricsLoading) {
      loadMetrics();
    }
  }, [stravaConnected]);

  // Scroll vers le bas quand les messages changent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, currentConversationId, isLoading]);

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const handleConnectStrava = () => {
    stravaApi.startOAuthFlow();
  };

  const handleDisconnectStrava = () => {
    stravaApi.clearTokens();
    setStravaConnected(false);
    setStravaAthlete(null);
  };

  const handleNewConversation = () => {
    const newConv = conversationStore.create();
    setConversations(conversationStore.getAll());
    setCurrentConversationId(newConv.id);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
  };

  const handleDeleteConversation = (id: string) => {
    conversationStore.delete(id);
    const updated = conversationStore.getAll();
    setConversations(updated);
    if (currentConversationId === id) {
      setCurrentConversationId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleRenameConversation = (id: string, title: string) => {
    conversationStore.updateTitle(id, title);
    setConversations(conversationStore.getAll());
  };

  const handleAskQuestion = async (q: string) => {
    const questionToAsk = q || question;
    if (!questionToAsk.trim()) return;

    // Créer une conversation si aucune n'est sélectionnée
    let convId = currentConversationId;
    if (!convId) {
      const newConv = conversationStore.create(questionToAsk);
      convId = newConv.id;
      setCurrentConversationId(convId);
    }

    // Ajouter le message utilisateur
    conversationStore.addMessage(convId, {
      role: 'user',
      content: questionToAsk,
    });
    setConversations(conversationStore.getAll());
    setQuestion('');
    setIsLoading(true);

    // Préparer l'historique de conversation pour l'IA
    const conversationHistory = currentConversation?.messages.map(m => ({
      role: m.role,
      content: m.content,
    })) || [];

    // Appeler l'API Groq
    try {
      const aiResponse = await aiService.generateResponse(
        questionToAsk,
        conversationHistory,
        metrics
      );

      // Ajouter la réponse de l'assistant
      conversationStore.addMessage(convId, {
        role: 'assistant',
        content: aiResponse.content,
        workout: aiResponse.workout,
      });
      setConversations(conversationStore.getAll());
    } catch (error) {
      console.error('Erreur IA:', error);
      conversationStore.addMessage(convId, {
        role: 'assistant',
        content: "Désolé, j'ai rencontré une erreur. Réessaie dans quelques instants !",
      });
      setConversations(conversationStore.getAll());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <ChatSidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Zone principale */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-semibold text-gray-900">Coach IA</h1>
          </div>

          {/* Bouton connexion Strava */}
          {stravaConnected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                <span className="hidden sm:inline">{stravaAthlete || 'Connecté'}</span>
              </div>
              <button
                onClick={handleDisconnectStrava}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Déconnecter Strava"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectStrava}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#FC4C02] text-white rounded-lg text-sm font-medium hover:bg-[#e34402] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              <span className="hidden sm:inline">Connecter Strava</span>
            </button>
          )}
        </div>

        {/* Zone de messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {!currentConversation || currentConversation.messages.length === 0 ? (
            // État vide - nouvelle conversation
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Coach IA</h2>
              <p className="text-gray-600 mb-4 max-w-md">
                Pose tes questions, analyse tes performances, crée des séances personnalisées
              </p>

              {/* Bandeau connexion Strava */}
              {!stravaConnected && (
                <div className="mb-8 p-4 bg-gradient-to-r from-[#FC4C02] to-[#e34402] rounded-xl text-white max-w-md">
                  <div className="flex items-center gap-3">
                    <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                    </svg>
                    <div className="flex-1 text-left">
                      <p className="font-medium">Connecte Strava</p>
                      <p className="text-sm text-orange-100">Pour des analyses personnalisées</p>
                    </div>
                    <button
                      onClick={handleConnectStrava}
                      className="px-4 py-2 bg-white text-[#FC4C02] rounded-lg font-medium hover:bg-orange-50 transition-colors"
                    >
                      Connecter
                    </button>
                  </div>
                </div>
              )}

              {/* Stats rapides si connecté */}
              {stravaConnected && metrics && (
                <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg">
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{metrics.currentWeek.totalDistance}</p>
                    <p className="text-xs text-gray-500">km cette semaine</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{metrics.currentWeek.activityCount}</p>
                    <p className="text-xs text-gray-500">séances</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.round(metrics.currentWeek.totalDuration / 60 * 10) / 10}h
                    </p>
                    <p className="text-xs text-gray-500">durée totale</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className={`text-2xl font-bold ${metrics.weeklyTrend.trend === 'up' ? 'text-green-600' : metrics.weeklyTrend.trend === 'down' ? 'text-red-600' : 'text-gray-900'}`}>
                      {metrics.weeklyTrend.distanceChange >= 0 ? '+' : ''}{metrics.weeklyTrend.distanceChange}%
                    </p>
                    <p className="text-xs text-gray-500">vs sem. dernière</p>
                  </div>
                </div>
              )}

              {/* Chargement des métriques */}
              {stravaConnected && metricsLoading && (
                <div className="mb-8 flex items-center gap-2 text-gray-500">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Chargement de tes stats...</span>
                </div>
              )}

              {/* Suggestions */}
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleAskQuestion(q)}
                    disabled={isLoading}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Fil de messages
            <div className="max-w-3xl mx-auto space-y-4">
              {currentConversation.messages.map((message) => (
                <ChatMessageBubble
                  key={message.id}
                  message={message}
                  onWorkoutSaved={() => console.log('Séance sauvegardée')}
                  onWorkoutSynced={() => console.log('Séance synchronisée')}
                />
              ))}
              {isLoading && <ChatLoadingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Zone de saisie */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAskQuestion('')}
                placeholder="Pose ta question au coach..."
                className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                disabled={isLoading}
              />
              <button
                onClick={() => handleAskQuestion('')}
                disabled={!question.trim() || isLoading}
                className="bg-orange-500 text-white px-5 py-3 rounded-xl font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>

            {/* Suggestions rapides (si conversation en cours) */}
            {currentConversation && currentConversation.messages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.slice(0, 2).map((q) => (
                  <button
                    key={q}
                    onClick={() => handleAskQuestion(q)}
                    disabled={isLoading}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
