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
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
      </svg>
    ),
  },
  cycling: {
    color: 'text-blue-500',
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    shadow: 'shadow-blue-900/30',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M15.5 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        <path d="M15.5 6.5h-2.5l-3 11M13 6.5l2.5 11M5.5 17.5L9 9.5h4" />
      </svg>
    ),
  },
  swimming: {
    color: 'text-cyan-500',
    bg: 'bg-cyan-600',
    border: 'border-cyan-500',
    shadow: 'shadow-cyan-900/30',
    icon: (
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
        <path d="M2 15c1.6-1 3.1-1.6 4.7-1.6 1.8 0 3.3.8 4.5 1.5 1.1.7 2.2 1.1 3.4 1.1 1.7 0 3.3-.8 4.6-1.5l.3-.2c.4-.3.8-.5 1.3-.6.5-.2 1-.2 1.5-.2 1 0 2 .3 2.7.8V12c-.9-.6-2-1-3.3-1-1.1 0-2.1.3-3.1.9l-.3.2c-1 .6-2.1 1.1-3.4 1.1-1.2 0-2.3-.4-3.4-1.1C10.6 11.4 9.1 10.6 7.3 10.6c-1.8 0-3.3.8-4.7 1.6v2.8zm0 4c1.6-1 3.1-1.6 4.7-1.6 1.8 0 3.3.8 4.5 1.5 1.1.7 2.2 1.1 3.4 1.1 1.7 0 3.3-.8 4.6-1.5l.3-.2c.4-.3.8-.5 1.3-.6.5-.2 1-.2 1.5-.2 1 0 2 .3 2.7.8V16c-.9-.6-2-1-3.3-1-1.1 0-2.1.3-3.1.9l-.3.2c-1 .6-2.1 1.1-3.4 1.1-1.2 0-2.3-.4-3.4-1.1-1.2-.7-2.7-1.5-4.5-1.5-1.8 0-3.3.8-4.7 1.6v2.8z"/>
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
