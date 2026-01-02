import { ChatMessage } from '../lib/types';
import { WorkoutPreview } from './WorkoutPreview';
import { WorkoutActions } from './WorkoutActions';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onWorkoutSaved?: () => void;
  onWorkoutSynced?: () => void;
}

export function ChatMessageBubble({ message, onWorkoutSaved, onWorkoutSynced }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[75%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar + Message */}
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
          {/* Avatar */}
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
              ${isUser
                ? 'bg-blue-500'
                : 'bg-gradient-to-br from-orange-500 to-orange-600'
              }
            `}
          >
            {isUser ? (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
          </div>

          {/* Contenu */}
          <div className="flex-1">
            {/* Label */}
            <div className={`text-xs text-gray-500 mb-1 ${isUser ? 'text-right' : ''}`}>
              {isUser ? 'Vous' : 'Coach IA'} - {formatTime(message.timestamp)}
            </div>

            {/* Bulle de message */}
            <div
              className={`
                rounded-2xl px-4 py-3
                ${isUser
                  ? 'bg-blue-500 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
                }
              `}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>

            {/* Séance générée (si présente) */}
            {message.workout && (
              <div className="mt-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <h4 className="font-semibold text-gray-900">{message.workout.name}</h4>
                  {message.workout.description && (
                    <p className="text-sm text-gray-600 mt-1">{message.workout.description}</p>
                  )}
                </div>
                <div className="p-4">
                  <WorkoutPreview steps={message.workout.steps} />
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50">
                  <WorkoutActions
                    workout={message.workout}
                    source="coach"
                    onSaved={onWorkoutSaved}
                    onSynced={onWorkoutSynced}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant pour l'indicateur de chargement
export function ChatLoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] md:max-w-[75%]">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-orange-500 to-orange-600">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          {/* Contenu */}
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">Coach IA</div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm">Réflexion en cours...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
