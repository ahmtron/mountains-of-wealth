import { useState, useEffect } from 'react';
import { BookOpen, X, Sparkles } from 'lucide-react';
import { JournalEntry } from '../game/types';

interface Props {
  entries: JournalEntry[];
  onClose: () => void;
}

export function FieldJournal({ entries, onClose }: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const entriesPerPage = 4;
  const totalPages = Math.max(1, Math.ceil(entries.length / entriesPerPage));
  const pageEntries = entries.slice(
    currentPage * entriesPerPage,
    (currentPage + 1) * entriesPerPage
  );

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [currentPage, totalPages]);

  const goToPage = (page: number) => {
    if (page < 0 || page >= totalPages) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentPage(page);
      setIsAnimating(false);
    }, 150);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-2xl border-4 border-amber-200 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-white" />
              <h2 className="text-xl font-black text-white tracking-tight">Field Journal</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 min-h-[400px]">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Sparkles className="w-12 h-12 text-amber-300 mb-3" />
                <p className="text-amber-800 font-semibold mb-1">No entries yet</p>
                <p className="text-amber-600 text-sm">Explore the world and press E near glowing objects to discover facts.</p>
              </div>
            ) : (
              <>
                <div
                  className={`transition-opacity duration-150 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}
                >
                  {pageEntries.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="mb-4 p-4 bg-white rounded-xl shadow-sm border border-amber-100 last:mb-0"
                      style={{ animation: `fadeIn 0.3s ease ${idx * 0.05}s both` }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{entry.icon}</span>
                        <div>
                          <h3 className="font-bold text-amber-900 text-sm mb-1">{entry.title}</h3>
                          <p className="text-amber-800 text-sm leading-relaxed">{entry.fact}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-amber-200">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 0}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-50 disabled:text-amber-300 text-amber-800 rounded-lg text-sm font-semibold transition-all"
                    >
                      Previous
                    </button>
                    <span className="text-amber-600 text-sm font-medium">
                      {currentPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= totalPages - 1}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-50 disabled:text-amber-300 text-amber-800 rounded-lg text-sm font-semibold transition-all"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-6 py-3 bg-amber-100/50 border-t border-amber-200 flex items-center justify-between">
            <span className="text-amber-700 text-xs font-medium">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} collected
            </span>
            <span className="text-amber-500 text-xs">Press J to toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
