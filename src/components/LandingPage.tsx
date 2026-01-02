interface LandingPageProps {
  onNavigate: (page: 'home' | 'workouts' | 'coach') => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          Crée tes séances d'entraînement avec l'IA
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Décris ta séance en français, l'IA la structure pour toi.
          Synchronise directement avec ta montre Garmin.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => onNavigate('workouts')}
            className="bg-orange-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-orange-600 transition-colors shadow-lg hover:shadow-xl"
          >
            Créer une séance
          </button>
          <button
            onClick={() => onNavigate('coach')}
            className="bg-white text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-colors border border-gray-200"
          >
            Découvrir le Coach IA
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg text-gray-900 mb-2">
            Décris en langage naturel
          </h3>
          <p className="text-gray-600">
            Écris ta séance comme tu le ferais à un ami. L'IA comprend "10' échauffement + 8x400m R=1'30".
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg text-gray-900 mb-2">
            Sync Garmin instantanée
          </h3>
          <p className="text-gray-600">
            Un clic et ta séance est sur ta montre. Compatible avec toutes les montres Garmin.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg text-gray-900 mb-2">
            Coach IA personnel
          </h3>
          <p className="text-gray-600">
            Connecte Strava et pose tes questions. L'IA analyse tes données et te conseille.
          </p>
        </div>
      </div>

      {/* Sports */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Course, Vélo, Natation
        </h2>
        <div className="flex justify-center gap-8">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-2xl">🏃</span>
            </div>
            <span className="text-sm text-gray-600">Course</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-2xl">🚴</span>
            </div>
            <span className="text-sm text-gray-600">Vélo</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-2xl">🏊</span>
            </div>
            <span className="text-sm text-gray-600">Natation</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-center text-white max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">
          Prêt à créer ta première séance ?
        </h2>
        <p className="text-orange-100 mb-6">
          Gratuit pour commencer. Pas de carte bancaire requise.
        </p>
        <button
          onClick={() => onNavigate('workouts')}
          className="bg-white text-orange-600 px-8 py-3 rounded-xl font-semibold hover:bg-orange-50 transition-colors"
        >
          Commencer maintenant
        </button>
      </div>

      {/* Footer */}
      <footer className="text-center mt-16 text-sm text-gray-500">
        <p>Compatible avec Garmin Connect et les montres Garmin</p>
        <a href="/privacy" className="text-blue-600 hover:underline mt-1 inline-block">
          Privacy Policy
        </a>
      </footer>
    </div>
  );
}
