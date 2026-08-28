import { Sport, SPORT_LABELS } from '../lib/types';

interface SportSelectorProps {
  value: Sport;
  onChange: (sport: Sport) => void;
}

const SPORT_CONFIG: Record<Sport, { color: string; bg: string; border: string; shadow: string; icon: React.ReactNode }> = {
  running: {
    color: 'text-orange-500',
    bg: 'bg-orange-600',
    border: 'border-orange-500',
    shadow: 'shadow-orange-900/30',
    icon: (
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 -960 960 960">
        <path d="M520-40v-240l-84-80-40 176-276-56 16-80 192 40 64-324-72 28v136h-80v-188l158-68q35-15 51.5-19.5T480-720q21 0 39 11t29 29l40 64q26 42 70.5 69T760-520v80q-66 0-123.5-27.5T540-540l-24 120 84 80v300h-80Zm-36.5-723.5Q460-787 460-820t23.5-56.5Q507-900 540-900t56.5 23.5Q620-853 620-820t-23.5 56.5Q573-740 540-740t-56.5-23.5Z"/>
      </svg>
    ),
  },
  cycling: {
    color: 'text-blue-500',
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    shadow: 'shadow-blue-900/30',
    icon: (
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 -960 960 960">
        <path d="M200-80q-83 0-141.5-58.5T0-280q0-83 58.5-141.5T200-480q83 0 141.5 58.5T400-280q0 83-58.5 141.5T200-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Zm155-5v-200L312-512q-12-11-18-25.5t-6-30.5q0-16 6.5-30.5T312-624l112-112q12-12 27.5-18t32.5-6q17 0 32.5 6t27.5 18l76 76q28 28 64 44t76 16v80q-57 0-108.5-22T560-604l-32-32-96 96 88 92v248h-80Zm123.5-563.5Q540-787 540-820t23.5-56.5Q587-900 620-900t56.5 23.5Q700-853 700-820t-23.5 56.5Q653-740 620-740t-56.5-23.5ZM760-80q-83 0-141.5-58.5T560-280q0-83 58.5-141.5T760-480q83 0 141.5 58.5T960-280q0 83-58.5 141.5T760-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Z"/>
      </svg>
    ),
  },
  swimming: {
    color: 'text-cyan-500',
    bg: 'bg-cyan-600',
    border: 'border-cyan-500',
    shadow: 'shadow-cyan-900/30',
    icon: (
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 -960 960 960">
        <path d="M80-120v-80q38 0 57-20t75-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-160q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-54.5 20T80-120Zm0-180v-80q38 0 57-20t75-20q56 0 77.5 20t56.5 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-340q-36 0-55.5 20T614-300q-57 0-77.5-20T480-340q-38 0-56.5 20T346-300q-59 0-78.5-20T212-340q-36 0-54.5 20T80-300Zm196-204 133-133-40-40q-33-33-70-48t-91-15v-100q75 0 124 16.5t96 63.5l256 256q-17 11-33 17.5t-37 6.5q-36 0-57-20t-77-20q-56 0-77 20t-57 20q-21 0-37-6.5T276-504Zm463-306.5q29 29.5 29 70.5 0 42-29 71t-71 29q-42 0-71-29t-29-71q0-41 29-70.5t71-29.5q42 0 71 29.5Z"/>
      </svg>
    ),
  },
};

export function SportSelector({ value, onChange }: SportSelectorProps) {
  const sports: Sport[] = ['running', 'cycling', 'swimming'];

  return (
    <div className="flex gap-3">
      {sports.map((sport) => {
        const selected = value === sport;
        const config = SPORT_CONFIG[sport];
        return (
          <button
            key={sport}
            type="button"
            onClick={() => onChange(sport)}
            className={`flex-1 py-4 px-3 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-2 ${
              selected
                ? `${config.border} ${config.bg} text-white shadow-lg ${config.shadow}`
                : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
            }`}
          >
            <span className={selected ? 'text-white' : config.color}>
              {config.icon}
            </span>
            <span className="text-sm font-semibold">{SPORT_LABELS[sport]}</span>
          </button>
        );
      })}
    </div>
  );
}
