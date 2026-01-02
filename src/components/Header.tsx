interface HeaderProps {
  currentPage: 'home' | 'workouts' | 'coach';
  onNavigate: (page: 'home' | 'workouts' | 'coach') => void;
}

export function Header({ currentPage, onNavigate }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
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
            <span className="font-bold text-gray-900 text-lg">Workout Builder</span>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1">
            <button
              onClick={() => onNavigate('home')}
              className={`px-3 py-2 rounded-lg font-medium transition-colors text-sm md:text-base md:px-4 ${
                currentPage === 'home'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Accueil
            </button>
            <button
              onClick={() => onNavigate('workouts')}
              className={`px-3 py-2 rounded-lg font-medium transition-colors text-sm md:text-base md:px-4 ${
                currentPage === 'workouts'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Workouts
            </button>
            <button
              onClick={() => onNavigate('coach')}
              className={`px-3 py-2 rounded-lg font-medium transition-colors text-sm md:text-base md:px-4 ${
                currentPage === 'coach'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Coach IA
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
