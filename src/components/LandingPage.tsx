interface LandingPageProps {
  onNavigate: (page: 'home' | 'workouts' | 'coach' | 'stats' | 'profile') => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
          Crée tes séances d'entraînement avec l'IA
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
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
            className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors border border-gray-200"
          >
            Découvrir le Coach IA
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
            Décris en langage naturel
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Écris ta séance comme tu le ferais à un ami. L'IA comprend "10' échauffement + 8x400m R=1'30".
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
            Sync Garmin instantanée
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Un clic et ta séance est sur ta montre. Compatible avec toutes les montres Garmin.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
            Coach IA personnel
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Connecte Strava et pose tes questions. L'IA analyse tes données et te conseille.
          </p>
        </div>
      </div>

      {/* Sports */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Course, Vélo, Natation
        </h2>
        <div className="flex justify-center gap-8">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
              </svg>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Course</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-2.5l1.5-2.6c.3-.5.1-1.1-.4-1.4-.5-.3-1.1-.1-1.4.4L8.6 18c-.5.2-.8.8-.6 1.3.2.6.8.9 1.4.7h-.6zm9.2-6c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
              </svg>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Vélo</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-cyan-600 dark:text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 15c1.6-1 3.1-1.6 4.7-1.6 1.8 0 3.3.8 4.5 1.5 1.1.7 2.2 1.1 3.4 1.1 1.7 0 3.3-.8 4.6-1.5l.3-.2c.4-.3.8-.5 1.3-.6.5-.2 1-.2 1.5-.2 1 0 2 .3 2.7.8V12c-.9-.6-2-1-3.3-1-1.1 0-2.1.3-3.1.9l-.3.2c-1 .6-2.1 1.1-3.4 1.1-1.2 0-2.3-.4-3.4-1.1C10.6 11.4 9.1 10.6 7.3 10.6c-1.8 0-3.3.8-4.7 1.6v2.8zm0 4c1.6-1 3.1-1.6 4.7-1.6 1.8 0 3.3.8 4.5 1.5 1.1.7 2.2 1.1 3.4 1.1 1.7 0 3.3-.8 4.6-1.5l.3-.2c.4-.3.8-.5 1.3-.6.5-.2 1-.2 1.5-.2 1 0 2 .3 2.7.8V16c-.9-.6-2-1-3.3-1-1.1 0-2.1.3-3.1.9l-.3.2c-1 .6-2.1 1.1-3.4 1.1-1.2 0-2.3-.4-3.4-1.1-1.2-.7-2.7-1.5-4.5-1.5-1.8 0-3.3.8-4.7 1.6v2.8z"/>
              </svg>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Natation</span>
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
          className="bg-white dark:bg-gray-900 text-orange-600 px-8 py-3 rounded-xl font-semibold hover:bg-orange-50 transition-colors"
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
