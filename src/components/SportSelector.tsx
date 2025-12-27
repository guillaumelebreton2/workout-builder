import { Sport, SPORT_LABELS } from '../lib/types';

interface SportSelectorProps {
  value: Sport;
  onChange: (sport: Sport) => void;
}

const SPORT_ICONS: Record<Sport, string> = {
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
};

export function SportSelector({ value, onChange }: SportSelectorProps) {
  const sports: Sport[] = ['running', 'cycling', 'swimming'];

  return (
    <div className="flex gap-2">
      {sports.map((sport) => (
        <button
          key={sport}
          type="button"
          onClick={() => onChange(sport)}
          className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
            value === sport
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <span className="text-2xl block mb-1">{SPORT_ICONS[sport]}</span>
          <span className="text-sm font-medium">{SPORT_LABELS[sport]}</span>
        </button>
      ))}
    </div>
  );
}
