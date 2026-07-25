'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

export default function AddWordForm({ 
  onSuccessCallback 
}: { 
  onSuccessCallback?: (word: string, count: number) => void 
}) {
  const [wordInput, setWordInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [loadingWord, setLoadingWord] = useState('');
  const [success, setSuccess] = useState<{ 
    word: string; 
    meaning: string;
    example: string;
    partOfSpeech: string;
    count: number 
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const term = wordInput.trim();
      if (term.length > 2) {
        try {
          const res = await fetch(`https://api.datamuse.com/sug?s=${term}`);
          const data = await res.json();
          if (data.length > 0 && data[0].word.toLowerCase() === term.toLowerCase()) {
            setSuggestions([]);
          } else {
            setSuggestions(data.slice(0, 3).map((d: any) => d.word));
          }
        } catch (e) {
          console.error("Failed to fetch spelling suggestions");
        }
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [wordInput]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!wordInput.trim()) return;
    
    setLoading(true);
    setLoadingWord(wordInput.trim());
    setError(null);
    setSuccess(null);
    setShowSuggestions(false);

    try {
      const response = await fetch('/api/word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: wordInput.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add word');
      }

      setSuccess({ 
        word: result.word.word, 
        meaning: result.word.meaning,
        example: result.word.example,
        partOfSpeech: result.word.partOfSpeech,
        count: result.relationshipsCreated 
      });
      setWordInput('');
      
      if (onSuccessCallback) {
        onSuccessCallback(result.word.word, result.relationshipsCreated);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingWord('');
    }
  };

  return (
    <div className="bg-surface-elevated rounded-2xl shadow-sm border border-border p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Add Word</h2>
        <p className="text-foreground-muted mt-1">Just type the word — our AI will automatically define it and map its semantic relationships in the graph.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2 relative">
          <label htmlFor="word" className="block text-sm font-medium text-foreground">
            Word
          </label>
          <input
            type="text"
            name="word"
            id="word"
            required
            disabled={loading}
            value={wordInput}
            onChange={(e) => {
              setWordInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            autoComplete="off"
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow disabled:opacity-50"
            placeholder="e.g. Ephemeral"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-[100%] mt-1 left-0 right-0 bg-surface-elevated border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-2 text-xs font-semibold text-foreground-muted uppercase tracking-wider bg-surface">
                Did you mean?
              </div>
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setWordInput(sug);
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-surface focus:bg-surface text-foreground transition-colors min-h-[44px]"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start space-x-3 p-4 rounded-xl bg-antonym/10 text-antonym border border-antonym/20">
            <ExclamationCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex flex-col space-y-4 p-5 rounded-xl bg-surface border border-synonym/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-synonym"></div>
            
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 text-synonym">
                <CheckCircleIcon className="h-6 w-6" />
                <h3 className="text-lg font-bold">{success.word} added successfully!</h3>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-synonym/10 text-synonym">
                {success.count} relationships
              </span>
            </div>
            
            <div className="space-y-3 pt-2">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-surface-elevated text-foreground-muted uppercase tracking-wide mb-1 border border-border">
                  {success.partOfSpeech}
                </span>
                <p className="text-foreground font-medium">{success.meaning}</p>
              </div>
              <div>
                <p className="text-sm text-foreground italic text-foreground-muted border-l-2 border-border pl-3 py-0.5">
                  "{success.example}"
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !wordInput.trim()}
          className="w-full flex items-center justify-center space-x-2 bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-3.5 rounded-xl font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? (
            <>
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              <span>Looking up &apos;{loadingWord}&apos; and mapping relationships...</span>
            </>
          ) : (
            <>
              <PlusIcon className="h-5 w-5" />
              <span>Add Word to Graph</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
