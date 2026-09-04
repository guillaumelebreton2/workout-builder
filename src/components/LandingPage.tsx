interface LandingPageProps {
  onNavigate: (page: 'home' | 'workouts' | 'coach' | 'stats' | 'profile') => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const isProd = import.meta.env.PROD;
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
          {!isProd && (
            <button
              onClick={() => onNavigate('coach')}
              className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors border border-gray-200"
            >
              Découvrir le Coach IA
            </button>
          )}
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
            <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 -960 960 960">
                <path d="M520-40v-240l-84-80-40 176-276-56 16-80 192 40 64-324-72 28v136h-80v-188l158-68q35-15 51.5-19.5T480-720q21 0 39 11t29 29l40 64q26 42 70.5 69T760-520v80q-66 0-123.5-27.5T540-540l-24 120 84 80v300h-80Zm-36.5-723.5Q460-787 460-820t23.5-56.5Q507-900 540-900t56.5 23.5Q620-853 620-820t-23.5 56.5Q573-740 540-740t-56.5-23.5Z"/>
              </svg>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Course</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 -960 960 960">
                <path d="M200-80q-83 0-141.5-58.5T0-280q0-83 58.5-141.5T200-480q83 0 141.5 58.5T400-280q0 83-58.5 141.5T200-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Zm155-5v-200L312-512q-12-11-18-25.5t-6-30.5q0-16 6.5-30.5T312-624l112-112q12-12 27.5-18t32.5-6q17 0 32.5 6t27.5 18l76 76q28 28 64 44t76 16v80q-57 0-108.5-22T560-604l-32-32-96 96 88 92v248h-80Zm123.5-563.5Q540-787 540-820t23.5-56.5Q587-900 620-900t56.5 23.5Q700-853 700-820t-23.5 56.5Q653-740 620-740t-56.5-23.5ZM760-80q-83 0-141.5-58.5T560-280q0-83 58.5-141.5T760-480q83 0 141.5 58.5T960-280q0 83-58.5 141.5T760-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Z"/>
              </svg>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Vélo</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 -960 960 960">
                <path d="M80-120v-80q38 0 57-20t75-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-160q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-54.5 20T80-120Zm0-180v-80q38 0 57-20t75-20q56 0 77.5 20t56.5 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-340q-36 0-55.5 20T614-300q-57 0-77.5-20T480-340q-38 0-56.5 20T346-300q-59 0-78.5-20T212-340q-36 0-54.5 20T80-300Zm196-204 133-133-40-40q-33-33-70-48t-91-15v-100q75 0 124 16.5t96 63.5l256 256q-17 11-33 17.5t-37 6.5q-36 0-57-20t-77-20q-56 0-77 20t-57 20q-21 0-37-6.5T276-504Zm463-306.5q29 29.5 29 70.5 0 42-29 71t-71 29q-42 0-71-29t-29-71q0-41 29-70.5t71-29.5q42 0 71 29.5Z"/>
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
