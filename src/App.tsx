import { useState, useEffect } from 'react';
import { WorkoutForm } from './components/WorkoutForm';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { Header } from './components/Header';
import { CoachPage } from './components/CoachPage';
import './index.css';

type Page = 'home' | 'coach';

function App() {
  // Simple routing based on pathname
  const path = window.location.pathname;

  if (path === '/privacy') {
    return <PrivacyPolicy />;
  }

  const [currentPage, setCurrentPage] = useState<Page>(() => {
    if (path === '/coach') return 'coach';
    return 'home';
  });

  // Update URL when page changes
  useEffect(() => {
    const newPath = currentPage === 'coach' ? '/coach' : '/';
    if (window.location.pathname !== newPath) {
      window.history.pushState({}, '', newPath);
    }
  }, [currentPage]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/coach') setCurrentPage('coach');
      else setCurrentPage('home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />

      {currentPage === 'home' ? (
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Workout Builder
            </h1>
            <p className="text-gray-600">
              Créez vos séances d'entraînement et synchronisez-les avec Garmin Connect
            </p>
          </header>

          {/* Main form */}
          <main className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
            <WorkoutForm />
          </main>

          {/* Footer */}
          <footer className="text-center mt-8 text-sm text-gray-500">
            <p>Compatible avec Garmin Connect et les montres Garmin</p>
            <a href="/privacy" className="text-blue-600 hover:underline mt-1 inline-block">
              Privacy Policy
            </a>
          </footer>
        </div>
      ) : (
        <CoachPage />
      )}
    </div>
  );
}

export default App;
