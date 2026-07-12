import { useState, useEffect, useRef } from 'react';
import { Play, Trophy, Volume2, VolumeX } from 'lucide-react';
import { initAudio, startMusic, setAudioEnabled, isAudioEnabled } from '../game/audio';
import { GameProgress } from '../game/types';

interface Props {
  progress: GameProgress;
  onStart: () => void;
  onContinue: () => void;
}

export function MainMenu({ progress, onStart, onContinue }: Props) {
  const [audioOn, setAudioOn] = useState(isAudioEnabled());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;

    const draw = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#7ec8e3');
      grad.addColorStop(0.5, '#a8d8e8');
      grad.addColorStop(1, '#d4e8d4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 5; i++) {
        const cx = ((i * 250 + frame * 0.3) % (w + 200)) - 100;
        const cy = 40 + i * 25;
        const scale = 0.8 + (i % 3) * 0.3;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(cx, cy, 20 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 20 * scale, cy - 5 * scale, 25 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 45 * scale, cy, 18 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#5a9e6e';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) {
        const wave = Math.sin((x + frame * 0.5) * 0.01) * 20 + Math.sin((x + frame * 0.3) * 0.005) * 40;
        ctx.lineTo(x, h - 120 + wave);
      }
      ctx.lineTo(w, h);
      ctx.fill();

      ctx.fillStyle = '#4a8c5a';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) {
        const wave = Math.sin((x + frame * 0.3) * 0.015) * 15;
        ctx.lineTo(x, h - 60 + wave);
      }
      ctx.lineTo(w, h);
      ctx.fill();

      for (let i = 0; i < 8; i++) {
        const tx = (i * 180 + 50) % w;
        const ty = h - 70;
        const sway = Math.sin(frame * 0.02 + i * 0.5) * 3;
        ctx.fillStyle = '#6B4226';
        ctx.fillRect(tx - 2, ty - 25, 4, 25);
        const greens = ['#3a8a4a', '#2d7a3d', '#4a9a5a'];
        ctx.fillStyle = greens[i % 3];
        ctx.beginPath();
        ctx.arc(tx + sway, ty - 35, 18, 0, Math.PI * 2);
        ctx.arc(tx - 12 + sway, ty - 28, 13, 0, Math.PI * 2);
        ctx.arc(tx + 12 + sway, ty - 28, 13, 0, Math.PI * 2);
        ctx.arc(tx + sway, ty - 45, 13, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const toggleAudio = () => {
    const newState = !audioOn;
    setAudioOn(newState);
    setAudioEnabled(newState);
    if (newState) {
      initAudio();
      startMusic();
    }
  };

  const hasProgress = progress.completedLevels.length > 0;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas ref={canvasRef} width={960} height={540}
        className="absolute inset-0 w-full h-full object-cover" />

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white drop-shadow-lg tracking-tight"
            style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.3), 0 0 30px rgba(255,255,255,0.3)' }}>
            Mountains of Wealth
          </h1>
          <p className="text-lg text-white/90 mt-2 drop-shadow-md font-medium">
            An Educational Journey Through Climate and Geography
          </p>
        </div>

        <div className="flex flex-col gap-3 items-center">
          {hasProgress && (
            <button onClick={onContinue}
              className="px-8 py-3 bg-white/95 hover:bg-white text-slate-800 font-bold rounded-xl shadow-lg
              transition-all hover:scale-105 hover:shadow-xl flex items-center gap-2">
              <Play className="w-5 h-5" />
              Continue Journey
            </button>
          )}
          <button onClick={onStart}
            className="px-8 py-3 bg-emerald-500/95 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg
            transition-all hover:scale-105 hover:shadow-xl flex items-center gap-2">
            <Play className="w-5 h-5" />
            {hasProgress ? 'New Game' : 'Start Adventure'}
          </button>
        </div>

        {hasProgress && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4
            bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm font-medium">
            <span className="flex items-center gap-1">
              <Trophy className="w-4 h-4" />
              {progress.completedLevels.length} / 30 Levels
            </span>
            <span className="text-white/50">|</span>
            <span>{progress.totalStars} Stars</span>
            <span className="text-white/50">|</span>
            <span>{progress.totalFacts} Facts</span>
            <span className="text-white/50">|</span>
            <span>{progress.balloons.length} Balloons</span>
          </div>
        )}

        <button onClick={toggleAudio}
          className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30
          rounded-lg text-white transition-all">
          {audioOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
