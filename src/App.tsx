import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/authContext';
import { LoginPage } from './components/LoginPage';
import { WorkoutForm } from './components/WorkoutForm';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { Header } from './components/Header';
import { CoachPage } from './components/CoachPage';
import { StatsPage } from './components/StatsPage';
import { LandingPage } from './components/LandingPage';
import { AthleteProfilePage } from './components/AthleteProfilePage';
import { AccountPage } from './components/AccountPage';
import { SavedWorkoutsPage } from './components/SavedWorkoutsPage';
import './index.css';

type Page = 'home' | 'workouts' | 'saved-workouts' | 'coach' | 'stats' | 'profile' | 'account' | 'login';

// Pages that require authentication
const PROTECTED_PAGES: Page[] = ['workouts', 'saved-workouts', 'coach', 'stats', 'profile', 'account'];

function getPageFromPath(path: string): Page {
  if (path === '/workouts') return 'workouts';
  if (path === '/saved-workouts') return 'saved-workouts';
  if (path === '/coach') return 'coach';
  if (path === '/stats') return 'stats';
  if (path === '/profile') return 'profile';
  if (path === '/account') return 'account';
  if (path === '/login') return 'login';
  return 'home';
}

function getPathFromPage(page: Page): string {
  if (page === 'workouts') return '/workouts';
  if (page === 'saved-workouts') return '/saved-workouts';
  if (page === 'coach') return '/coach';
  if (page === 'stats') return '/stats';
  if (page === 'profile') return '/profile';
  if (page === 'account') return '/account';
  if (page === 'login') return '/login';
  return '/';
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();
  const path = window.location.pathname;

  // Handle privacy page separately (always accessible)
  if (path === '/privacy') {
    return <PrivacyPolicy />;
  }

  const [currentPage, setCurrentPage] = useState<Page>(() => getPageFromPath(path));

  // Redirect to login if trying to access protected page while not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && PROTECTED_PAGES.includes(currentPage)) {
      setCurrentPage('login');
    }
  }, [isLoading, isAuthenticated, currentPage]);

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

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Show login page if not authenticated and trying to access protected content
  if (currentPage === 'login' || (!isAuthenticated && PROTECTED_PAGES.includes(currentPage))) {
    return <LoginPage />;
  }

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
              Creer une seance
            </h1>
            <p className="text-gray-600">
              Decris ta seance, l'IA la structure pour toi
            </p>
          </header>

          {/* Main form */}
          <main className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
            <WorkoutForm />
          </main>
        </div>
      )}

      {currentPage === 'saved-workouts' && (
        <SavedWorkoutsPage onNavigate={setCurrentPage} />
      )}

      {currentPage === 'coach' && (
        <CoachPage />
      )}

      {currentPage === 'stats' && (
        <StatsPage onNavigate={setCurrentPage} />
      )}

      {currentPage === 'profile' && (
        <AthleteProfilePage onNavigate={setCurrentPage} />
      )}

      {currentPage === 'account' && (
        <AccountPage />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
