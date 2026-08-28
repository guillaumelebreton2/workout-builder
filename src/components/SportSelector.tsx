import { Sport, SPORT_LABELS } from '../lib/types';

interface SportSelectorProps {
  value: Sport;
  onChange: (sport: Sport) => void;
}

const SPORT_ICONS: Record<Sport, React.ReactNode> = {
  running: (
    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
    </svg>
  ),
  cycling: (
    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
      <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-2.5l1.5-2.6c.3-.5.1-1.1-.4-1.4-.5-.3-1.1-.1-1.4.4L8.6 18c-.5.2-.8.8-.6 1.3.2.6.8.9 1.4.7h-.6zm9.2-6c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
    </svg>
  ),
  swimming: (
    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 15c1.6-1 3.1-1.6 4.7-1.6 1.8 0 3.3.8 4.5 1.5 1.1.7 2.2 1.1 3.4 1.1 1.7 0 3.3-.8 4.6-1.5l.3-.2c.4-.3.8-.5 1.3-.6.5-.2 1-.2 1.5-.2 1 0 2 .3 2.7.8V12c-.9-.6-2-1-3.3-1-1.1 0-2.1.3-3.1.9l-.3.2c-1 .6-2.1 1.1-3.4 1.1-1.2 0-2.3-.4-3.4-1.1C10.6 11.4 9.1 10.6 7.3 10.6c-1.8 0-3.3.8-4.7 1.6v2.8zm0 4c1.6-1 3.1-1.6 4.7-1.6 1.8 0 3.3.8 4.5 1.5 1.1.7 2.2 1.1 3.4 1.1 1.7 0 3.3-.8 4.6-1.5l.3-.2c.4-.3.8-.5 1.3-.6.5-.2 1-.2 1.5-.2 1 0 2 .3 2.7.8V16c-.9-.6-2-1-3.3-1-1.1 0-2.1.3-3.1.9l-.3.2c-1 .6-2.1 1.1-3.4 1.1-1.2 0-2.3-.4-3.4-1.1-1.2-.7-2.7-1.5-4.5-1.5-1.8 0-3.3.8-4.7 1.6v2.8z"/>
    </svg>
  ),
};

export function SportSelector({ value, onChange }: SportSelectorProps) {
  const sports: Sport[] = ['running', 'cycling', 'swimming'];

  return (
    <div className="flex gap-3">
      {sports.map((sport) => {
        const selected = value === sport;
        return (
          <button
            key={sport}
            type="button"
            onClick={() => onChange(sport)}
            className={`flex-1 py-4 px-3 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-2 ${
              selected
                ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
            }`}
          >
            <span className={selected ? 'text-white' : 'text-[#007CC3]'}>
              {SPORT_ICONS[sport]}
            </span>
            <span className="text-sm font-semibold">{SPORT_LABELS[sport]}</span>
          </button>
        );
      })}
    </div>
  );
}
