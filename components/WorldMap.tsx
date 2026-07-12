import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Star, BookOpen, Lock } from 'lucide-react';
import { GameProgress } from '../game/types';
import { CHAPTERS } from '../game/chapters';
import { BALLOON_COLORS } from '../game/constants';
import { playClick } from '../game/audio';

interface Props {
  progress: GameProgress;
  onLevelSelect: (levelIndex: number) => void;
  onBack: () => void;
}

const ALL_LEVELS = CHAPTERS.map((ch, idx) => ({
  ...ch,
  name: ch.title,
  subtitle: ch.subtitle,
  educationalTheme: ch.concept,
  world: idx === 0 || idx === 1 ? 1 :
         idx === 2 || idx === 3 ? 2 :
         idx === 4 ? 3 :
         idx === 5 ? 4 :
         idx === 6 ? 5 : 6,
  collectibles: ch.interactables
    .filter(obj => ['ac', 'frost', 'evidence', 'bridge', 'tradeGoods'].includes(obj.type))
    .map(obj => ({ type: 'star', id: obj.id }))
}));

const WORLD_NAMES = [
  { name: 'Tropical Coast', theme: 'tropical' as const, color: '#e84393' },
  { name: 'Frost & Colonial', theme: 'frost' as const, color: '#5dade2' },
  { name: 'Mountain Discovery', theme: 'highland' as const, color: '#9b59b6' },
  { name: 'Trade & Transport', theme: 'trade' as const, color: '#3498db' },
  { name: 'Balkanization', theme: 'conflict' as const, color: '#e07a3a' },
  { name: 'Solutions & Future', theme: 'future' as const, color: '#2ecc71' },
];

export function WorldMap({ progress, onLevelSelect, onBack }: Props) {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    let raf: number;

    const draw = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#2c3e50');
      grad.addColorStop(1, '#34495e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 50; i++) {
        const x = (i * 137 + frame * 0.1) % w;
        const y = (i * 73) % h;
        const tw = Math.sin(frame * 0.02 + i) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${tw * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const isUnlocked = (levelIdx: number) => {
    if (levelIdx === 0) return true;
    return progress.completedLevels.includes(levelIdx - 1);
  };

  const getLevelStars = (levelIdx: number) => {
    return ALL_LEVELS[levelIdx]?.collectibles.filter(c => c.type === 'star').length || 0;
  };

  const getCollectedStars = (levelIdx: number) => {
    const level = ALL_LEVELS[levelIdx];
    if (!level) return 0;
    const totalStars = level.collectibles.filter(c => c.type === 'star').length;
    if (progress.completedLevels.includes(levelIdx)) return totalStars;
    return 0;
  };

  return (
    <div className="relative w-full h-full bg-slate-800">
      {/* Background canvas - stars animation */}
      <canvas ref={canvasRef} width={960} height={540}
        className="absolute inset-0" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* Content overlay - scrollable */}
      <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ zIndex: 10 }}>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => { playClick(); onBack(); }}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-white">World Map</h2>
            <div className="ml-auto flex items-center gap-4 text-white text-sm">
              <span className="flex items-center gap-1 bg-white/10 rounded-lg px-3 py-1.5">
                <Star className="w-4 h-4 text-yellow-400" />
                {progress.totalStars} Stars
              </span>
              <span className="flex items-center gap-1 bg-white/10 rounded-lg px-3 py-1.5">
                <BookOpen className="w-4 h-4 text-blue-300" />
                {progress.totalFacts} Facts
              </span>
            </div>
          </div>

          <div className="space-y-6 pb-8">
            {WORLD_NAMES.map((world, wIdx) => {
              const worldLevels = ALL_LEVELS.filter(l => l.world === wIdx + 1);
              return (
                <div key={wIdx}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: world.color }} />
                    <h3 className="text-lg font-bold text-white">World {wIdx + 1}: {world.name}</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {worldLevels.map((level, lIdx) => {
                      const globalIdx = level.id;
                      const unlocked = isUnlocked(globalIdx);
                      const completed = progress.completedLevels.includes(globalIdx);
                      const collected = getCollectedStars(globalIdx);
                      const total = getLevelStars(globalIdx);

                      return (
                        <button
                          key={lIdx}
                          disabled={!unlocked}
                          onClick={() => { playClick(); onLevelSelect(globalIdx); }}
                          onMouseEnter={() => setHoveredLevel(globalIdx)}
                          onMouseLeave={() => setHoveredLevel(null)}
                          className={`relative p-3 rounded-xl transition-all text-left
                            ${unlocked
                              ? 'bg-white/90 hover:bg-white hover:scale-105 shadow-lg cursor-pointer'
                              : 'bg-white/10 cursor-not-allowed opacity-60'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold ${unlocked ? 'text-slate-500' : 'text-slate-400'}`}>
                              {wIdx + 1}-{lIdx + 1}
                            </span>
                            {completed && (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: BALLOON_COLORS[globalIdx % BALLOON_COLORS.length] }}>
                                <span className="text-[8px] font-bold text-white">{globalIdx + 1}</span>
                              </div>
                            )}
                            {!unlocked && <Lock className="w-4 h-4 text-slate-400" />}
                          </div>
                          <p className={`text-sm font-bold ${unlocked ? 'text-slate-800' : 'text-slate-400'}`}>
                            {level.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{level.subtitle}</p>
                          {unlocked && (
                            <div className="flex items-center gap-0.5 mt-1.5">
                              {Array.from({ length: total }).map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${
                                  i < collected ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'
                                }`} />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {hoveredLevel !== null && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-4 py-2 rounded-xl
            shadow-xl text-sm max-w-md text-center">
            {ALL_LEVELS[hoveredLevel]?.educationalTheme}
          </div>
        )}
      </div>
    </div>
  );
}
