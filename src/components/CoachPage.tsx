import { useState } from 'react';

const SUGGESTED_QUESTIONS = [
  "Suis-je prêt pour mon objectif ?",
  "Analyse ma semaine",
  "Comment progresser ?",
  "Est-ce que je récupère assez ?",
];

export function CoachPage() {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // TODO: setIsConnected sera utilisé après OAuth Strava
  void setIsConnected;

  const handleAskQuestion = async (q: string) => {
    const questionToAsk = q || question;
    if (!questionToAsk.trim()) return;

    setIsLoading(true);
    setResponse(null);

    // TODO: Implémenter l'appel API avec les données Strava
    // Pour l'instant, simulation
    await new Promise(resolve => setTimeout(resolve, 1500));

    setResponse(`C'est une simulation ! Pour répondre à "${questionToAsk}", je devrai d'abord être connecté à Strava pour analyser tes données d'entraînement.`);
    setIsLoading(false);
    setQuestion('');
  };

  const handleConnectStrava = () => {
    // TODO: Implémenter OAuth Strava
    alert('Connexion Strava à implémenter');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Titre */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Coach IA
        </h1>
        <p className="text-gray-600">
          Pose tes questions, analyse tes performances, progresse plus vite
        </p>
      </div>

      {/* Connexion Strava */}
      {!isConnected && (
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg mb-1">Connecte Strava</h2>
              <p className="text-orange-100 text-sm">
                Pour des analyses personnalisées basées sur tes entraînements
              </p>
            </div>
            <button
              onClick={handleConnectStrava}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg font-medium hover:bg-orange-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Connecter
            </button>
          </div>
        </div>
      )}

      {/* Zone de question */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pose ta question au coach
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion('')}
            placeholder="Ex: Est-ce que je suis prêt pour mon marathon ?"
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <button
            onClick={() => handleAskQuestion('')}
            disabled={!question.trim() || isLoading}
            className="bg-orange-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>
        </div>

        {/* Suggestions */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Suggestions :</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleAskQuestion(q)}
                disabled={isLoading}
                className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Réponse */}
      {(response || isLoading) && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-1">Coach IA</p>
              {isLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm">Analyse en cours...</span>
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">{response}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats placeholder */}
      {isConnected && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-sm text-gray-500">km cette semaine</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-sm text-gray-500">séances</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-sm text-gray-500">allure moy.</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-sm text-gray-500">dénivelé</p>
          </div>
        </div>
      )}
    </div>
  );
}
