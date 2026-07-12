import { useRef, useEffect, useState, useCallback } from 'react';
import type { GameState, PlayerAppearance, GameProgress } from './game/types';
import { CHAPTERS } from './game/chapters';
import {
  createInitialState,
  updateGame,
  tryInteract,
  advanceDialogue,
  checkChapterComplete,
  resetPlayerForChapter,
  resetChapterInteractables,
  startChapterMusic,
  stopChapterMusic,
  addBalloon,
  CANVAS_W,
  CANVAS_H,
} from './game/engine';
import { render } from './game/renderer';
import { initAudio, setAudioEnabled, isAudioEnabled, playSfx } from './game/audio';
import { MainMenu } from './components/MainMenu';
import { CharacterCreation } from './components/ChracterCreation';
import { WorldMap } from './components/WorldMap';
import { FieldJournal } from './components/FieldJournal';
import { BALLOON_COLORS } from './game/constants';
import { BookOpen } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const lastTimeRef = useRef<number>(0);
  const [, forceUpdate] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const [appearance, setAppearance] = useState<PlayerAppearance>({
    name: 'Explorer',
    skinTone: '#ffd3b6',
    bodyColor: '#2563eb',
    hatColor: '#e11d48',
  });
  // Keep a ref so startChapter always uses latest appearance
  const appearanceRef = useRef<PlayerAppearance>(appearance);
  useEffect(() => { appearanceRef.current = appearance; }, [appearance]);
  const [progress, setProgress] = useState<GameProgress>(() => {
    try {
      const saved = localStorage.getItem('edu_game_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          completedLevels: parsed.completedLevels || [],
          totalStars: parsed.totalStars || 0,
          totalFacts: parsed.totalFacts || 0,
          balloons: parsed.balloons || [],
          journalEntries: parsed.journalEntries || [],
        };
      }
    } catch (e) {
      console.error(e);
    }
    return {
      completedLevels: [],
      totalStars: 0,
      totalFacts: 0,
      balloons: [],
      journalEntries: [],
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('edu_game_progress', JSON.stringify(progress));
    } catch (e) {
      console.error(e);
    }
  }, [progress]);

  function getChapterCollectiblesCount(ch: typeof CHAPTERS[0]): number {
    return ch.interactables.filter(o =>
      ['ac', 'frost', 'evidence', 'bridge', 'tradeGoods'].includes(o.type)
    ).length;
  }

  const triggerRender = useCallback(() => forceUpdate(n => n + 1), []);

  // ── Game loop ──
  useEffect(() => {
    let frameId = 0;
    const loop = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        frameId = requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        frameId = requestAnimationFrame(loop);
        return;
      }

      const dt = Math.min(33, time - (lastTimeRef.current || time));
      lastTimeRef.current = time;

      const state = stateRef.current;

      // Always render if we have a context, but only update game logic when playing
      if (state.phase === 'playing' || state.phase === 'chapterComplete' || state.phase === 'paused') {
        updateGame(state, dt);
        render(ctx, state);
        triggerRender();

        if (state.phase === 'playing' && checkChapterComplete(state)) {
          state.phase = 'chapterComplete';
          stopChapterMusic();
          addBalloon(state, state.currentChapter + 1);
          playSfx('complete');
        }
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // ── Keyboard ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      state.keys[e.code] = true;

      if (e.code === 'KeyE' || e.code === 'Enter') {
        if (state.phase === 'playing' && !state.dialogue) {
          tryInteract(state);
          triggerRender();
        } else if (state.dialogue) {
          advanceDialogue(state);
          triggerRender();
        }
      }

      if (e.code === 'Space') {
        if (state.dialogue) {
          advanceDialogue(state);
          triggerRender();
          e.preventDefault();
        }
      }

      if (e.code === 'Escape') {
        if (state.phase === 'playing') {
          state.phase = 'paused';
          triggerRender();
        } else if (state.phase === 'paused') {
          state.phase = 'playing';
          triggerRender();
        }
      }

      if (e.code === 'KeyJ') {
        if (state.phase === 'playing' || state.phase === 'paused') {
          state.showJournal = !state.showJournal;
          triggerRender();
        }
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [triggerRender]);

  const startChapter = (chapterIndex: number) => {
    initAudio();
    const state = stateRef.current;
    const currentAppearance = appearanceRef.current;
    const chapter = CHAPTERS[chapterIndex];

    resetChapterInteractables(chapter);

    state.phase = 'playing';
    state.currentChapter = chapterIndex;
    state.player = resetPlayerForChapter(chapter, currentAppearance);
    state.camera = { x: 0, y: 0 };
    state.particles = [];
    state.objectiveProgress = 0;
    state.dialogue = null;
    state.showObjective = true;
    state.chapterStartTime = Date.now();
    state.hintShown = false;
    state.hintTimer = 0;
    state.showCausalChain = false;
    state.causalChainIndex = 0;
    state.dramaticReveal = false;
    state.dramaticRevealTimer = 0;
    state.synthesisPath = null;

    // Preserve journal entries across chapters
    state.journalEntries = progress.journalEntries || [];

    // Generate balloons from previously completed chapters
    state.balloons = Array.from({ length: chapterIndex }).map((_, i) => ({
      chapterNum: i + 1,
      offsetX: -15 - i * 12,
      offsetY: -20 - i * 5,
      color: BALLOON_COLORS[i % BALLOON_COLORS.length],
      sway: Math.random() * Math.PI,
      swaySpeed: 0.05 + Math.random() * 0.05,
    }));

    startChapterMusic(chapter);
    triggerRender();
  };

  const nextChapter = () => {
    const state = stateRef.current;
    const currentIdx = state.currentChapter;

    setProgress(prev => {
      const completed = prev.completedLevels.includes(currentIdx)
        ? prev.completedLevels
        : [...prev.completedLevels, currentIdx];

      const totalStars = completed.reduce((sum, idx) => {
        return sum + getChapterCollectiblesCount(CHAPTERS[idx]);
      }, 0);

      const totalFacts = prev.totalFacts + state.player.interactedNPCs.length;

      return {
        completedLevels: completed,
        totalStars,
        totalFacts,
        balloons: completed,
        journalEntries: state.journalEntries,
      };
    });

    if (state.currentChapter >= CHAPTERS.length - 1) {
      state.phase = 'gameComplete';
      stopChapterMusic();
      triggerRender();
      return;
    }

    state.phase = 'map';
    stopChapterMusic();
    triggerRender();
  };

  const resumeGame = () => {
    stateRef.current.phase = 'playing';
    triggerRender();
  };

  const toggleAudio = () => {
    const newState = !isAudioEnabled();
    setAudioEnabled(newState);
    stateRef.current.audioEnabled = newState;
    triggerRender();
  };

  const state = stateRef.current;
  const chapter = CHAPTERS[state.currentChapter];

  const isGamePhase = state.phase === 'playing' || state.phase === 'chapterComplete' || state.phase === 'paused';
  const isOverlayPhase = state.phase === 'title' || state.phase === 'customize' || state.phase === 'map';

  return (
    <div className={`min-h-screen w-full flex items-center justify-center transition-colors duration-500 ${
      darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-blue-50 to-cyan-50'
    }`}>
      {/* Full screen overlay phases — completely replace game view */}
      {isOverlayPhase && (
        <div style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100vw', maxHeight: '100vh', position: 'relative', overflow: 'hidden', borderRadius: '12px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
          {state.phase === 'title' && (
            <MainMenu
              progress={progress}
              onStart={() => {
                setProgress({ completedLevels: [], totalStars: 0, totalFacts: 0, balloons: [], journalEntries: [] });
                stateRef.current.phase = 'customize';
                triggerRender();
              }}
              onContinue={() => {
                stateRef.current.phase = 'map';
                triggerRender();
              }}
            />
          )}
          {state.phase === 'customize' && (
            <CharacterCreation
              onComplete={(app) => {
                setAppearance(app);
                appearanceRef.current = app;
                stateRef.current.phase = 'map';
                triggerRender();
              }}
              onBack={() => {
                stateRef.current.phase = 'title';
                triggerRender();
              }}
            />
          )}
          {state.phase === 'map' && (
            <WorldMap
              progress={progress}
              onLevelSelect={(lvlIdx) => {
                startChapter(lvlIdx);
              }}
              onBack={() => {
                stateRef.current.phase = 'title';
                triggerRender();
              }}
            />
          )}
        </div>
      )}

      {/* Game canvas — only shown during gameplay phases */}
      {isGamePhase && (
        <div className="relative flex items-center justify-center" style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100vw', maxHeight: '100vh' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-xl shadow-2xl"
            style={{ width: '100%', height: '100%', display: 'block', backgroundColor: '#000' }}
          />

          {/* ── HUD (when playing) ── */}
          {state.phase === 'playing' && chapter && (
            <Hud state={state} chapter={chapter} darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} onToggleAudio={toggleAudio} onToggleJournal={() => { state.showJournal = !state.showJournal; triggerRender(); }} />
          )}

          {/* ── Dialogue overlay ── */}
          {state.dialogue && <DialogueBox dialogue={state.dialogue} onAdvance={() => { advanceDialogue(state); triggerRender(); }} />}

          {/* ── Observation popup ── */}
          {state.observationPopup && (
            <div className="absolute bottom-24 left-4 right-4 z-20" style={{ animation: 'fadeIn 0.3s ease' }}>
              <div className="bg-purple-900/90 backdrop-blur-md rounded-2xl p-4 border border-purple-400/30 shadow-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{state.observationPopup.icon}</span>
                  <div>
                    <h3 className="font-bold text-purple-100 text-sm mb-1">{state.observationPopup.title}</h3>
                    <p className="text-purple-200 text-sm leading-relaxed">{state.observationPopup.fact}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Chapter intro ── */}
          {state.phase === 'playing' && state.showObjective && chapter && (
            <ChapterIntro chapter={chapter} onClose={() => { state.showObjective = false; triggerRender(); }} />
          )}

          {/* ── Chapter complete ── */}
          {state.phase === 'chapterComplete' && chapter && (
            <ChapterComplete chapter={chapter} onNext={nextChapter} isLast={state.currentChapter >= CHAPTERS.length - 1} balloonCount={state.balloons.length} />
          )}

          {/* ── Dramatic Reveal Overlay ── */}
          {state.dramaticReveal && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl z-30 pointer-events-none">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div className="relative z-10 text-center px-8 max-w-lg" style={{ animation: 'fadeIn 0.5s ease' }}>
                <div className="text-6xl mb-4">⛰️</div>
                <h2 className="text-3xl font-black text-white mb-3" style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
                  The Mountains Reveal
                </h2>
                <p className="text-lg text-amber-300 font-semibold">
                  People in warm countries don't live where you think they live.
                </p>
                <p className="text-sm text-gray-300 mt-2">
                  They live in the MOUNTAINS — where it's cooler and healthier.
                </p>
              </div>
            </div>
          )}

          {/* ── Game complete ── */}
          {state.phase === 'gameComplete' && (
            <GameComplete
              onRestart={() => {
                stopChapterMusic();
                setProgress({ completedLevels: [], totalStars: 0, totalFacts: 0, balloons: [], journalEntries: [] });
                stateRef.current = createInitialState();
                stateRef.current.phase = 'title';
                triggerRender();
              }}
            />
          )}

          {/* ── Paused ── */}
          {state.phase === 'paused' && <PauseScreen onResume={resumeGame} onQuit={() => { stopChapterMusic(); stateRef.current = createInitialState(); triggerRender(); }} />}

          {/* ── Field Journal ── */}
          {state.showJournal && (
            <FieldJournal
              entries={state.journalEntries}
              onClose={() => { state.showJournal = false; triggerRender(); }}
            />
          )}

          {/* ── Debate Sort Overlay ── */}
          {state.debateSorting && state.debateSortIndex < (state.player.evidenceInventory?.length || 0) && (
            <DebateSortOverlay
              state={state}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── HUD ──────────────────────────────────────────────────────────────

function Hud({ state, chapter, darkMode, onToggleDark, onToggleAudio, onToggleJournal }: { state: GameState; chapter: any; darkMode: boolean; onToggleDark: () => void; onToggleAudio: () => void; onToggleJournal: () => void }) {
  const p = state.player;
  const objPct = Math.min(100, (state.objectiveProgress / chapter.objectiveTarget) * 100);
  const isStaminaChapter = chapter.mechanicType === 'stamina';
  const prodPct = Math.min(100, p.productivity * 100);

  return (
    <>
      <div className="absolute top-3 left-3 pointer-events-none">
        <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md ${darkMode ? 'bg-black/40 text-white' : 'bg-white/70 text-gray-800'}`}>
          <span className="opacity-60">Ch.{chapter.id + 1}</span> · {chapter.title}
        </div>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-auto">
        <div className="px-2.5 py-1.5 rounded-lg bg-black/40 text-white text-xs backdrop-blur-md flex items-center gap-1">
          <span className="text-orange-400">●</span>
          <span className="font-mono">{p.temperature.toFixed(0)}°C</span>
        </div>
        <div className="px-2.5 py-1.5 rounded-lg bg-black/40 text-white text-xs backdrop-blur-md flex items-center gap-1">
          <span className="text-cyan-400">●</span>
          <span className="font-mono">{p.humidity.toFixed(0)}%</span>
        </div>
        {chapter.mechanicType === 'altitude' && (
          <div className="px-2.5 py-1.5 rounded-lg bg-black/40 text-white text-xs backdrop-blur-md flex items-center gap-1">
            <span className="text-purple-300">▲</span>
            <span className="font-mono">{p.altitude}m</span>
          </div>
        )}
        {isStaminaChapter && (
          <div className="px-2.5 py-1.5 rounded-lg bg-black/40 text-white text-xs backdrop-blur-md flex items-center gap-1">
            <span className="text-amber-400">⚡</span>
            <span className="font-mono">{prodPct.toFixed(0)}%</span>
          </div>
        )}
        {state.balloons.length > 0 && (
          <div className="px-2.5 py-1.5 rounded-lg bg-black/40 text-white text-xs backdrop-blur-md flex items-center gap-1">
            <span>🎈</span>
            <span className="font-mono">{state.balloons.length}</span>
          </div>
        )}
        <button onClick={onToggleJournal} className="px-2 py-1.5 rounded-lg bg-black/40 text-white text-xs backdrop-blur-md hover:bg-black/60 transition-colors" title="Field Journal (J)">
          <BookOpen className="w-4 h-4" />
        </button>
        <button onClick={onToggleAudio} className="px-2 py-1.5 rounded-lg bg-black/40 text-white text-xs backdrop-blur-md hover:bg-black/60 transition-colors">
          {state.audioEnabled ? '🔊' : '🔇'}
        </button>
        <button onClick={onToggleDark} className="px-2 py-1.5 rounded-lg bg-black/40 text-white text-xs backdrop-blur-md hover:bg-black/60 transition-colors">
          {darkMode ? '☀' : '☾'}
        </button>
      </div>

      <div className="absolute bottom-3 left-3 pointer-events-none">
        <div className={`px-3 py-2 rounded-lg backdrop-blur-md ${darkMode ? 'bg-black/40' : 'bg-white/70'} max-w-xs`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${objPct >= 100 ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{chapter.objectiveText}</span>
          </div>
          <div className={`h-1 rounded-full overflow-hidden ${darkMode ? 'bg-white/20' : 'bg-gray-300'}`}>
            <div className="h-full bg-gradient-to-r from-amber-400 to-green-400 transition-all duration-500" style={{ width: `${objPct}%` }} />
          </div>
          <div className={`text-[10px] mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {state.objectiveProgress} / {chapter.objectiveTarget}
          </div>
          {isStaminaChapter && (
            <div className={`text-[10px] mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Productivity: {prodPct.toFixed(0)}% {prodPct < 50 ? '(heat slows you down)' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 pointer-events-none">
        <div className={`px-2.5 py-1.5 rounded-lg text-[10px] backdrop-blur-md ${darkMode ? 'bg-black/30 text-gray-300' : 'bg-white/60 text-gray-600'}`}>
          <kbd className="font-mono">A/D</kbd> move · <kbd className="font-mono">W</kbd> jump · <kbd className="font-mono">E</kbd> interact · <kbd className="font-mono">J</kbd> journal
        </div>
      </div>
    </>
  );
}

// ─── Dialogue ─────────────────────────────────────────────────────────

function DialogueBox({ dialogue, onAdvance }: { dialogue: any; onAdvance: () => void }) {
  const line = dialogue.lines[dialogue.lineIndex];
  const isLast = dialogue.lineIndex >= dialogue.lines.length - 1;

  const viewpointStyles: Record<string, { label: string; color: string }> = {
    established: { label: 'Established', color: 'bg-green-500' },
    debated: { label: 'Debated', color: 'bg-orange-500' },
    author: { label: "Author's Theory", color: 'bg-blue-500' },
  };
  const vp = dialogue.viewpoint ? viewpointStyles[dialogue.viewpoint] : null;

  return (
    <div className="absolute bottom-20 left-4 right-4 z-20 cursor-pointer" onClick={onAdvance}>
      <div className="bg-black/85 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:bg-black/90 transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold">
            {dialogue.name.charAt(0)}
          </div>
          <span className="text-sm font-bold text-white">{dialogue.name}</span>
          {vp && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${vp.color} text-white`}>
              {vp.label}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-100 leading-relaxed pl-10">{line}</p>
        <div className="flex items-center justify-between mt-3 pl-10">
          <span className="text-xs text-gray-500">
            {dialogue.lineIndex + 1} / {dialogue.lines.length}
          </span>
          <span className="text-xs text-amber-400 animate-pulse">
            {isLast ? 'Click to close' : 'Click / Space for next'}
          </span>
        </div>
      </div>
    </div>
  );
}


// ─── Chapter Intro ────────────────────────────────────────────────────

function ChapterIntro({ chapter, onClose }: { chapter: any; onClose: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl z-30" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 text-center px-8 max-w-lg" style={{ animation: 'fadeIn 0.4s ease' }}>
        <div className="text-xs text-amber-400 uppercase tracking-widest mb-1">Chapter {chapter.id + 1}</div>
        <h2 className="text-3xl font-black text-white mb-1">{chapter.title}</h2>
        <p className="text-base text-amber-200 mb-4">{chapter.subtitle}</p>
        <div className="bg-white/10 rounded-xl p-4 mb-5 border border-white/10">
          {chapter.introText.map((line: string, i: number) => (
            <p key={i} className="text-sm text-gray-200 leading-relaxed mb-1.5 last:mb-0">{line}</p>
          ))}
        </div>
        <div className="inline-block bg-amber-500/20 rounded-lg px-4 py-2 mb-5 border border-amber-500/30">
          <span className="text-xs text-amber-300 uppercase tracking-wider">Goal</span>
          <p className="text-sm text-white font-semibold mt-0.5">{chapter.objectiveText}</p>
        </div>
        <div>
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-all hover:scale-105"
          >
            Start →
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3">Follow the glowing beacons ★ to find your way</p>
      </div>
    </div>
  );
}

// ─── Chapter Complete ─────────────────────────────────────────────────

function ChapterComplete({ chapter, onNext, isLast, balloonCount }: { chapter: any; onNext: () => void; isLast: boolean; balloonCount: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl z-30">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative z-10 text-center px-8 max-w-lg" style={{ animation: 'fadeIn 0.4s ease' }}>
        <div className="text-5xl mb-2">🎈</div>
        <div className="text-xs text-green-400 uppercase tracking-widest mb-1">Chapter {chapter.id + 1} Complete</div>
        <h2 className="text-2xl font-black text-white mb-3">{chapter.title}</h2>
        <div className="text-sm text-amber-300 mb-3">You earned a balloon! (Chapter {chapter.id + 1}) · Total: {balloonCount}</div>
        <div className="bg-white/10 rounded-xl p-4 mb-5 border border-white/10 text-left max-h-64 overflow-y-auto">
          {chapter.outroText.map((line: string, i: number) => (
            <p key={i} className={`text-sm leading-relaxed mb-1.5 last:mb-0 ${line.startsWith('THE') || line.startsWith('WHAT') ? 'text-amber-300 font-bold mt-3' : line === '' ? 'h-2' : 'text-gray-200'}`}>
              {line || '\u00A0'}
            </p>
          ))}
        </div>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-400 hover:to-blue-400 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-105"
        >
          {isLast ? 'See Conclusion →' : 'Next Chapter →'}
        </button>
      </div>
    </div>
  );
}

// ─── Game Complete ────────────────────────────────────────────────────

function GameComplete({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl z-30">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500" />
      <div className="relative z-10 text-center px-8 max-w-2xl">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-4xl font-black text-white mb-3">Journey Complete!</h2>
        <p className="text-base text-blue-100 mb-6">You've explored the hidden geography of global inequality.</p>

        <div className="bg-white/15 rounded-xl p-5 mb-6 border border-white/20 text-left">
          <h3 className="text-amber-200 font-bold text-sm uppercase tracking-wider mb-3">What You Learned</h3>
          <ul className="space-y-1.5 text-sm text-white/90">
            <li>• Heat reduces productivity — it's biology, not laziness</li>
            <li>• Humidity blocks sweat cooling at 100% saturation</li>
            <li>• Diseases thrive in warm zones, die in frost</li>
            <li>• Critical thinking: Even Nobel theories have flaws</li>
            <li>• People in warm countries live in MOUNTAINS, not where you think</li>
            <li>• Mountains break trade, breed conflict, fragment institutions</li>
            <li>• Solutions: AC + disease control in lowlands, transport in highlands</li>
            <li>• It's not about blame. It's about root causes we can act on.</li>
          </ul>
        </div>

        <button
          onClick={onRestart}
          className="px-8 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl border border-white/30 transition-all hover:scale-105"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

// ─── Debate Sort Overlay ────────────────────────────────────────────────

function DebateSortOverlay({ state }: { state: GameState }) {
  const current = state.player.evidenceInventory?.[state.debateSortIndex];
  if (!current) return null;

  const categories = [
    { key: 'Digit1', label: '1', name: 'Established', color: 'bg-green-500' },
    { key: 'Digit2', label: '2', name: 'Weak', color: 'bg-yellow-500' },
    { key: 'Digit3', label: '3', name: 'Flawed', color: 'bg-orange-500' },
    { key: 'Digit4', label: '4', name: 'Counterexample', color: 'bg-red-500' },
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl z-30">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 text-center px-8 max-w-lg" style={{ animation: 'fadeIn 0.3s ease' }}>
        <div className="text-xs text-amber-400 uppercase tracking-widest mb-2">Argument Analysis</div>
        <h3 className="text-xl font-black text-white mb-2">Sort This Evidence</h3>
        <div className="bg-white/10 rounded-xl p-4 mb-4 border border-white/10">
          <p className="text-sm text-gray-200 mb-1">Evidence:</p>
          <p className="text-lg text-white font-semibold">"{current.label}"</p>
        </div>
        <div className="flex gap-2 justify-center mb-4 flex-wrap">
          {categories.map(cat => (
            <div key={cat.key} className={`px-3 py-1.5 rounded-lg ${cat.color} text-white font-bold text-xs`}>
              [{cat.label}] {cat.name}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">Press 1, 2, 3, or 4 to categorize</p>
      </div>
    </div>
  );
}

// ─── Pause ────────────────────────────────────────────────────────────

function PauseScreen({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl z-30">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 text-center">
        <h2 className="text-3xl font-black text-white mb-6">Paused</h2>
        <div className="flex flex-col gap-3">
          <button onClick={onResume} className="px-8 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-all">
            Resume
          </button>
          <button onClick={onQuit} className="px-8 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold rounded-xl border border-red-500/30 transition-all">
            Quit to Title
          </button>
        </div>
      </div>
    </div>
  );
}
