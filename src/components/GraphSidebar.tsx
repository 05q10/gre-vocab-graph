import { XMarkIcon } from '@heroicons/react/24/outline';
import { Word } from '../types/words';
import { RelationshipType } from '../types/relationship';

interface ConnectedWord {
  word: string;
  type: RelationshipType;
}

interface GraphSidebarProps {
  word: Word | null;
  connections: ConnectedWord[];
  onClose: () => void;
}

const getRelBadgeClasses = (type: RelationshipType) => {
  switch (type) {
    case 'SYNONYM_OF': return 'bg-synonym/10 text-synonym border-synonym/20';
    case 'ANTONYM_OF': return 'bg-antonym/10 text-antonym border-antonym/20';
    case 'SIMILAR_TO': return 'bg-similar/10 text-similar border-similar/20';
    case 'CONFUSED_WITH': return 'bg-confused/10 text-confused border-confused/20';
    case 'ROOT_RELATED': return 'bg-root/10 text-root border-root/20';
    case 'DERIVED_FROM': return 'bg-derived/10 text-derived border-derived/20';
    case 'RELATED_TO': return 'bg-related/10 text-related border-related/20';
    default: return 'bg-surface text-foreground border-border';
  }
};

const formatRelType = (type: string) => {
  return type.replace('_', ' ').toLowerCase();
};

export default function GraphSidebar({ word, connections, onClose }: GraphSidebarProps) {
  if (!word) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 md:w-96 bg-surface-elevated border-l border-border shadow-2xl flex flex-col z-40 transform transition-transform duration-300 ease-in-out">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-xl font-bold text-foreground">{word.word}</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-surface text-foreground-muted hover:text-foreground transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <span className="inline-block px-2.5 py-1 rounded-md bg-surface border border-border text-xs font-medium text-foreground-muted uppercase tracking-wider mb-3">
            {word.partOfSpeech}
          </span>
          <p className="text-foreground text-[15px] leading-relaxed">
            {word.meaning}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider mb-2">Example</h3>
          <p className="text-[15px] text-foreground italic border-l-2 border-accent pl-3 py-1">
            "{word.example}"
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">Connections</h3>
            <span className="bg-surface border border-border text-foreground-muted text-xs font-medium px-2 py-0.5 rounded-full">
              {connections.length}
            </span>
          </div>
          
          {connections.length === 0 ? (
            <p className="text-sm text-foreground-muted italic">No connections yet.</p>
          ) : (
            <ul className="space-y-2">
              {connections.map((conn, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded-lg border border-border bg-surface">
                  <span className="font-medium text-foreground">{conn.word}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${getRelBadgeClasses(conn.type)}`}>
                    {formatRelType(conn.type)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
