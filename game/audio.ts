// Audio system using Web Audio API — all sounds are synthesized, no external files needed.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicNodes: OscillatorNode[] = [];
let musicInterval: ReturnType<typeof setInterval> | null = null;
let audioEnabled = true;

export function initAudio(): void {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.15;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.3;
    sfxGain.connect(masterGain);
  } catch (_e) {
    // Audio not supported
  }
}

export function setAudioEnabled(enabled: boolean): void {
  audioEnabled = enabled;
  if (masterGain) {
    masterGain.gain.value = enabled ? 0.5 : 0;
  }
}

export function isAudioEnabled(): boolean {
  return audioEnabled;
}

// ─── SFX ─────────────────────────────────────────────────────────────

export function playSfx(type: string): void {
  if (!ctx || !sfxGain || !audioEnabled) return;
  const now = ctx.currentTime;

  switch (type) {
    case 'jump': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }

    case 'collect': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.05);
      osc.frequency.setValueAtTime(784, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    }

    case 'interact': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }

    case 'dialogue': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220 + Math.random() * 40, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
    }

    case 'complete': {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.2, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(sfxGain!);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.3);
      });
      break;
    }

    case 'land': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }

    case 'step': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80 + Math.random() * 20, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
    }

    case 'select': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
      break;
    }
  }
}

// ─── MUSIC ───────────────────────────────────────────────────────────

const MUSIC_SCALES: Record<string, number[]> = {
  warm: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
  humid: [220.0, 246.94, 277.18, 329.63, 369.99, 440.0],
  cold: [196.0, 220.0, 261.63, 293.66, 329.63, 392.0],
  mystery: [233.08, 261.63, 311.13, 349.23, 415.3, 466.16],
  ascent: [261.63, 311.13, 349.23, 392.0, 466.16, 523.25],
  trade: [293.66, 349.23, 392.0, 440.0, 523.25, 587.33],
  conflict: [220.0, 233.08, 277.18, 311.13, 369.99, 415.3],
  conclusion: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25],
};

export function startMusic(mood?: string): void {
  if (!ctx || !musicGain || !audioEnabled) return;
  stopMusic();

  const scale = (mood && MUSIC_SCALES[mood]) || MUSIC_SCALES.warm;
  let step = 0;

  musicInterval = setInterval(() => {
    if (!ctx || !musicGain || !audioEnabled) return;
    const now = ctx.currentTime;
    const freq = scale[step % scale.length];

    // Main melody note
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(now);
    osc.stop(now + 0.8);

    // Harmony (octave up occasionally)
    if (step % 3 === 0) {
      const harm = ctx.createOscillator();
      const harmGain = ctx.createGain();
      harm.type = 'triangle';
      harm.frequency.value = freq * 1.5;
      harmGain.gain.setValueAtTime(0, now);
      harmGain.gain.linearRampToValueAtTime(0.04, now + 0.05);
      harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      harm.connect(harmGain);
      harmGain.connect(musicGain);
      harm.start(now);
      harm.stop(now + 0.6);
    }

    step++;
  }, 600);
}

export function stopMusic(): void {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
  for (const osc of musicNodes) {
    try { osc.stop(); } catch (_e) { /* already stopped */ }
  }
  musicNodes = [];
}

export function playClick(): void {
  playSfx('select');
}
