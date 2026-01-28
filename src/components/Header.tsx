import { useAuth } from '../lib/authContext';

interface HeaderProps {
  currentPage: 'home' | 'workouts' | 'coach' | 'stats' | 'profile' | 'login';
  onNavigate: (page: 'home' | 'workouts' | 'coach' | 'stats' | 'profile' | 'login') => void;
}

export function Header({ currentPage, onNavigate }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onNavigate('home');
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onNavigate('home')}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg hidden sm:inline">Enduzo</span>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1">
            <button
              onClick={() => onNavigate('home')}
              className={`px-2 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base md:px-4 ${
                currentPage === 'home'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Accueil
            </button>
            <button
              onClick={() => onNavigate('workouts')}
              className={`px-2 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base md:px-4 ${
                currentPage === 'workouts'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Workouts
            </button>
            <button
              onClick={() => onNavigate('coach')}
              className={`px-2 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base md:px-4 ${
                currentPage === 'coach'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Coach
            </button>
            <button
              onClick={() => onNavigate('stats')}
              className={`px-2 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm md:text-base md:px-4 ${
                currentPage === 'stats'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Stats
            </button>
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <span className="text-sm text-gray-600 hidden md:inline">
                  {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Deconnexion"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                Connexion
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
