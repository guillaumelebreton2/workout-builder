import { WorkoutForm } from './components/WorkoutForm';
import './index.css';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
        </footer>
      </div>
    </div>
  );
}

export default App;
