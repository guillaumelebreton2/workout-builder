import { useState, useEffect } from 'react';
import { WorkoutForm } from './components/WorkoutForm';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { Header } from './components/Header';
import { CoachPage } from './components/CoachPage';
import { StatsPage } from './components/StatsPage';
import { LandingPage } from './components/LandingPage';
import './index.css';

type Page = 'home' | 'workouts' | 'coach' | 'stats';

function getPageFromPath(path: string): Page {
  if (path === '/workouts') return 'workouts';
  if (path === '/coach') return 'coach';
  if (path === '/stats') return 'stats';
  return 'home';
}

function getPathFromPage(page: Page): string {
  if (page === 'workouts') return '/workouts';
  if (page === 'coach') return '/coach';
  if (page === 'stats') return '/stats';
  return '/';
}

function App() {
  // Simple routing based on pathname
  const path = window.location.pathname;

  if (path === '/privacy') {
    return <PrivacyPolicy />;
  }

  const [currentPage, setCurrentPage] = useState<Page>(() => getPageFromPath(path));

  // Update URL when page changes
  useEffect(() => {
    const newPath = getPathFromPage(currentPage);
    if (window.location.pathname !== newPath) {
      window.history.pushState({}, '', newPath);
    }
  }, [currentPage]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getPageFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />

      {currentPage === 'home' && (
        <LandingPage onNavigate={setCurrentPage} />
      )}

      {currentPage === 'workouts' && (
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Créer une séance
            </h1>
            <p className="text-gray-600">
              Décris ta séance, l'IA la structure pour toi
            </p>
          </header>

          {/* Main form */}
          <main className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
            <WorkoutForm />
          </main>
        </div>
      )}

      {currentPage === 'coach' && (
        <CoachPage />
      )}

      {currentPage === 'stats' && (
        <StatsPage />
      )}
    </div>
  );
}

export default App;
