import { useState } from 'react';
import { Check } from 'lucide-react';
import { PlayerAppearance } from '../game/types';
import { SKIN_TONES, BODY_COLORS, HAT_COLORS } from '../game/constants';

interface Props {
  onComplete: (appearance: PlayerAppearance) => void;
  onBack: () => void;
}

export function CharacterCreation({ onComplete, onBack }: Props) {
  const [name, setName] = useState('');
  const [skinIdx, setSkinIdx] = useState(0);
  const [bodyIdx, setBodyIdx] = useState(0);
  const [hatIdx, setHatIdx] = useState(0);

  const appearance: PlayerAppearance = {
    name: name || 'Explorer',
    bodyColor: BODY_COLORS[bodyIdx],
    hatColor: HAT_COLORS[hatIdx],
    skinTone: SKIN_TONES[skinIdx],
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-sky-400 to-emerald-200">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Create Your Explorer</h2>

        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-shrink-0">
            <CharacterPreview appearance={appearance} />
          </div>

          <div className="flex-1 space-y-4 w-full">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 12))}
                placeholder="Enter your name..."
                maxLength={12}
                className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:border-emerald-400
                outline-none transition-colors text-slate-800 font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) onComplete(appearance);
                }}
              />
            </div>

            <ColorPicker label="Skin Tone" colors={SKIN_TONES} selected={skinIdx} onSelect={setSkinIdx} />
            <ColorPicker label="Outfit" colors={BODY_COLORS} selected={bodyIdx} onSelect={setBodyIdx} />
            <ColorPicker label="Hat" colors={HAT_COLORS} selected={hatIdx} onSelect={setHatIdx} />
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-between">
          <button onClick={onBack}
            className="px-6 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-all">
            Back
          </button>
          <button
            onClick={() => onComplete(appearance)}
            disabled={!name.trim()}
            className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300
            text-white font-bold rounded-xl shadow-lg transition-all hover:scale-105 flex items-center gap-2
            disabled:scale-100 disabled:cursor-not-allowed"
          >
            <Check className="w-5 h-5" />
            Begin Journey
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ label, colors, selected, onSelect }: {
  label: string;
  colors: string[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-600 mb-1">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {colors.map((c, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`w-8 h-8 rounded-full transition-all border-2 ${
              selected === i ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

function CharacterPreview({ appearance }: { appearance: PlayerAppearance }) {
  const canvasRef = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    let raf: number;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, 120, 160);

      const cx = 60;
      const bob = Math.sin(frame * 0.05) * 2;
      const baseY = 120 + bob;

      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(cx - 8, baseY, 6, 6);
      ctx.fillRect(cx + 2, baseY, 6, 6);

      ctx.strokeStyle = appearance.skinTone;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 5, baseY - 2);
      ctx.lineTo(cx - 5, baseY - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 5, baseY - 2);
      ctx.lineTo(cx + 5, baseY - 20);
      ctx.stroke();

      ctx.fillStyle = appearance.bodyColor;
      ctx.beginPath();
      ctx.roundRect(cx - 12, baseY - 40, 24, 22, 6);
      ctx.fill();

      ctx.strokeStyle = appearance.skinTone;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - 10, baseY - 34);
      ctx.lineTo(cx - 14, baseY - 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 10, baseY - 34);
      ctx.lineTo(cx + 14, baseY - 22);
      ctx.stroke();

      const headY = baseY - 52;
      ctx.fillStyle = appearance.skinTone;
      ctx.beginPath();
      ctx.arc(cx, headY + 10, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx - 4, headY + 8, 3, 0, Math.PI * 2);
      ctx.arc(cx + 4, headY + 8, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath();
      ctx.arc(cx - 4, headY + 8, 1.5, 0, Math.PI * 2);
      ctx.arc(cx + 4, headY + 8, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, headY + 13, 3.5, 0.1, Math.PI - 0.1);
      ctx.stroke();

      ctx.fillStyle = appearance.hatColor;
      ctx.beginPath();
      ctx.arc(cx, headY + 6, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - 14, headY + 5, 28, 3);

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  };

  return (
    <div className="bg-gradient-to-b from-sky-200 to-emerald-100 rounded-xl p-4 shadow-inner">
      <canvas ref={canvasRef} width={120} height={160} />
      <p className="text-center text-sm font-semibold text-slate-700 mt-2">{appearance.name}</p>
    </div>
  );
}
