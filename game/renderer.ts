import type { GameState, Chapter, PlayerState, Particle, Decoration } from './types';
import { CHAPTERS } from './chapters';
import { CANVAS_W, CANVAS_H } from './engine';

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  try {
    // Don't render game canvas if not in a playable phase (let React overlays show)
    if (state.phase !== 'playing' && state.phase !== 'chapterComplete' && state.phase !== 'paused') {
      return;
    }

    const chapter = CHAPTERS[state.currentChapter];
    if (!chapter) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';
      ctx.fillText(`Error: Chapter ${state.currentChapter} not found`, 100, 100);
      return;
    }

    // Verify chapter has required properties
    if (!chapter.clouds || !chapter.backgroundElements || !chapter.platforms) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';
      ctx.fillText(`Ch ${state.currentChapter}: Missing ${!chapter.clouds ? 'clouds' : !chapter.backgroundElements ? 'bg' : 'platforms'}`, 100, 100);
      console.warn(`Chapter ${state.currentChapter} incomplete:`, { clouds: !!chapter.clouds, bg: !!chapter.backgroundElements, platforms: !!chapter.platforms });
      return;
    }

    // ── Sky gradient ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGrad.addColorStop(0, chapter.skyTop);
    skyGrad.addColorStop(1, chapter.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Sun/moon glow ──
    drawSun(ctx, chapter);

    // ── Clouds (parallax, animated) ──
    drawClouds(ctx, chapter, state);

    // ── Parallax background mountains ──
    drawBackgroundLayer(ctx, state, chapter, 1, 0.25);
    drawBackgroundLayer(ctx, state, chapter, 2, 0.45);

    // ── World (camera offset) ──
    ctx.save();
    ctx.translate(-Math.round(state.camera.x), -Math.round(state.camera.y));

    // Platforms
    for (const plat of chapter.platforms) {
      drawPlatform(ctx, plat);
    }

    // Decorations (behind interactables)
    for (const dec of chapter.decorations) {
      drawDecoration(ctx, dec);
    }

    // Interactables
    for (const obj of chapter.interactables) {
      drawInteractable(ctx, obj, state);
    }

    // NPCs
    for (const npc of chapter.npcs) {
      drawNPC(ctx, npc, state);
    }

    // Player
    drawPlayer(ctx, state.player);

    // Balloons (carried by player)
    drawBalloons(ctx, state);

    // Particles
    for (const pt of state.particles) {
      drawParticle(ctx, pt);
    }

    ctx.restore();

    // Reset state after restore
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';

    // ── Productivity visual effects (Chapter 1) ──
    if (chapter.mechanicType === 'stamina' && state.player.productivity < 0.8) {
      const heatIntensity = 1 - state.player.productivity;
      ctx.fillStyle = `rgba(255, 100, 50, ${heatIntensity * 0.15})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Heat waves
      ctx.strokeStyle = `rgba(255, 150, 50, ${heatIntensity * 0.3})`;
      ctx.lineWidth = 1;
      const t = Date.now() / 1000;
      for (let i = 0; i < 5; i++) {
        const y = (CANVAS_H * 0.3) + Math.sin(t * 2 + i * 1.5) * 20 + i * 40;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < CANVAS_W; x += 10) {
          ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 3 + i) * 3 * heatIntensity);
        }
        ctx.stroke();
      }
    }

    // ── Dramatic reveal effect (Chapter 5) ──
    if (chapter.mechanicType === 'altitude' && state.dramaticReveal) {
      const t = Date.now() / 1000;
      const pulse = 0.5 + Math.sin(t * 3) * 0.3;
      ctx.fillStyle = `rgba(100, 150, 255, ${pulse * 0.1})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 100 + Math.sin(t * 2) * 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Interact prompt (speech bubble) ──
    if (state.interactPrompt && !state.dialogue) {
      drawInteractPrompt(ctx, state);
    }

    // ── Message toast ──
    if (state.message) {
      drawMessage(ctx, state);
    }
  } catch (err) {
    console.error('Render error:', err, 'Chapter:', state.currentChapter);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#f00';
    ctx.font = '14px Arial';
    ctx.fillText('Render Exception: ' + String(err).substring(0, 40), 50, 50);
    console.log('CHAPTERS array length:', CHAPTERS.length);
    console.log('Current chapter data:', CHAPTERS[state.currentChapter]);
  }
}

function drawSun(ctx: CanvasRenderingContext2D, chapter: Chapter) {
  const t = Date.now() / 1000;
  const isWarm = chapter.mechanicType === 'stamina' || chapter.mechanicType === 'transport';
  const sunX = CANVAS_W * 0.8;
  const sunY = 80;
  const r = 35;

  // Glow
  const glow = ctx.createRadialGradient(sunX, sunY, r * 0.5, sunX, sunY, r * 2.5);
  glow.addColorStop(0, isWarm ? 'rgba(255,220,100,0.3)' : 'rgba(255,255,255,0.2)');
  glow.addColorStop(1, 'rgba(255,220,100,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - r * 3, sunY - r * 3, r * 6, r * 6);

  // Sun body
  ctx.fillStyle = isWarm ? '#FFD54F' : '#FFF9C4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
  ctx.fill();

  // Cute face
  ctx.fillStyle = 'rgba(255,152,0,0.5)';
  ctx.beginPath();
  ctx.arc(sunX - 10, sunY - 5, 3, 0, Math.PI * 2);
  ctx.arc(sunX + 10, sunY - 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sunX, sunY + 5, 8, 0, Math.PI);
  ctx.strokeStyle = 'rgba(255,152,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rays
  ctx.strokeStyle = isWarm ? 'rgba(255,213,79,0.4)' : 'rgba(255,249,196,0.3)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i + t * 0.1;
    const x1 = sunX + Math.cos(angle) * (r + 8);
    const y1 = sunY + Math.sin(angle) * (r + 8);
    const x2 = sunX + Math.cos(angle) * (r + 18 + Math.sin(t * 2 + i) * 4);
    const y2 = sunY + Math.sin(angle) * (r + 18 + Math.sin(t * 2 + i) * 4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// ─── CLOUDS ────────────────────────────────────────────────────────────

function drawClouds(ctx: CanvasRenderingContext2D, chapter: Chapter, state: GameState) {
  const t = Date.now() / 1000;
  for (const cloud of chapter.clouds) {
    let cx = cloud.x - state.camera.x * 0.15 + t * cloud.speed * 10;
    const totalW = CANVAS_W + 300;
    cx = ((cx % totalW) + totalW) % totalW - 150;
    const cy = cloud.y;

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const puff of cloud.puffs) {
      ctx.beginPath();
      ctx.arc(cx + puff.dx, cy + puff.dy, puff.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(200,220,240,0.3)';
    for (const puff of cloud.puffs) {
      ctx.beginPath();
      ctx.arc(cx + puff.dx, cy + puff.dy + puff.r * 0.3, puff.r * 0.7, 0, Math.PI);
      ctx.fill();
    }
  }
}

// ─── BACKGROUND ───────────────────────────────────────────────────────

function drawBackgroundLayer(ctx: CanvasRenderingContext2D, state: GameState, chapter: Chapter, layer: number, parallax: number) {
  const camX = state.camera.x * parallax;
  for (const el of chapter.backgroundElements) {
    if (el.layer !== layer) continue;
    const x = el.x - camX;
    if (x + el.w < -100 || x > CANVAS_W + 100) continue;

    if (el.type === 'mountain') {
      ctx.fillStyle = el.color;
      ctx.globalAlpha = layer === 1 ? 0.5 : 0.7;
      ctx.beginPath();
      ctx.moveTo(x, CANVAS_H);
      ctx.lineTo(x + el.w * 0.25, CANVAS_H - el.h * 0.5);
      ctx.lineTo(x + el.w * 0.4, CANVAS_H - el.h * 0.65);
      ctx.lineTo(x + el.w * 0.55, CANVAS_H - el.h * 0.8);
      ctx.lineTo(x + el.w * 0.7, CANVAS_H - el.h * 0.6);
      ctx.lineTo(x + el.w * 0.85, CANVAS_H - el.h * 0.4);
      ctx.lineTo(x + el.w, CANVAS_H);
      ctx.closePath();
      ctx.fill();
      if (el.h > 350) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(x + el.w * 0.4, CANVAS_H - el.h * 0.65);
        ctx.lineTo(x + el.w * 0.55, CANVAS_H - el.h * 0.8);
        ctx.lineTo(x + el.w * 0.7, CANVAS_H - el.h * 0.6);
        ctx.lineTo(x + el.w * 0.62, CANVAS_H - el.h * 0.62);
        ctx.lineTo(x + el.w * 0.55, CANVAS_H - el.h * 0.7);
        ctx.lineTo(x + el.w * 0.48, CANVAS_H - el.h * 0.66);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (el.type === 'building') {
      ctx.fillStyle = el.color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, el.y, el.w, el.h);
      ctx.globalAlpha = 1;
    }
  }
}

// ─── PLATFORMS ─────────────────────────────────────────────────────────

function drawPlatform(ctx: CanvasRenderingContext2D, plat: any) {
  if (plat.type === 'ground' || plat.type === 'slope') {
    ctx.fillStyle = plat.color || '#8BC34A';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    ctx.fillStyle = lightenColor(plat.color || '#8BC34A', 25);
    ctx.fillRect(plat.x, plat.y, plat.w, 8);
    ctx.fillStyle = lightenColor(plat.color || '#8BC34A', 35);
    for (let i = 0; i < plat.w; i += 12) {
      ctx.fillRect(plat.x + i, plat.y - 2, 3, 5);
    }
  } else if (plat.type === 'platform') {
    ctx.fillStyle = plat.color || '#A1887F';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    ctx.fillStyle = lightenColor(plat.color || '#A1887F', 15);
    ctx.fillRect(plat.x, plat.y, plat.w, 4);
    ctx.strokeStyle = darkenColor(plat.color || '#A1887F', 15);
    ctx.lineWidth = 1;
    for (let i = 10; i < plat.w; i += 20) {
      ctx.beginPath();
      ctx.moveTo(plat.x + i, plat.y + 2);
      ctx.lineTo(plat.x + i, plat.y + plat.h - 2);
      ctx.stroke();
    }
  } else if (plat.type === 'wall') {
    ctx.fillStyle = plat.color || '#5D4037';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    ctx.fillStyle = lightenColor(plat.color || '#5D4037', -10);
    for (let i = 0; i < plat.h; i += 25) {
      ctx.fillRect(plat.x, plat.y + i, plat.w, 3);
    }
    ctx.fillStyle = lightenColor(plat.color || '#5D4037', 15);
    ctx.fillRect(plat.x, plat.y, plat.w, 4);
  }
}

// ─── DECORATIONS ──────────────────────────────────────────────────────

function drawDecoration(ctx: CanvasRenderingContext2D, dec: Decoration) {
  const t = Date.now() / 1000;
  const sway = Math.sin(t * 0.6 + dec.x * 0.01) * 1;

  switch (dec.type) {
    case 'tree': {
      const color = dec.color || '#66BB6A';
      ctx.fillStyle = '#8D6E63';
      ctx.fillRect(dec.x + dec.w * 0.4, dec.y + dec.h * 0.5, dec.w * 0.2, dec.h * 0.5);
      ctx.fillStyle = darkenColor(color, 10);
      ctx.beginPath();
      ctx.arc(dec.x + dec.w / 2 + sway, dec.y + dec.h * 0.3, dec.w * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dec.x + dec.w * 0.35 + sway, dec.y + dec.h * 0.25, dec.w * 0.3, 0, Math.PI * 2);
      ctx.arc(dec.x + dec.w * 0.65 + sway, dec.y + dec.h * 0.25, dec.w * 0.3, 0, Math.PI * 2);
      ctx.arc(dec.x + dec.w * 0.5 + sway, dec.y + dec.h * 0.15, dec.w * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lightenColor(color, 20);
      ctx.beginPath();
      ctx.arc(dec.x + dec.w * 0.4 + sway, dec.y + dec.h * 0.15, dec.w * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'bush': {
      const color = '#66BB6A';
      ctx.fillStyle = darkenColor(color, 10);
      ctx.beginPath();
      ctx.arc(dec.x + dec.w * 0.3, dec.y + dec.h * 0.6, dec.w * 0.3, 0, Math.PI * 2);
      ctx.arc(dec.x + dec.w * 0.7, dec.y + dec.h * 0.6, dec.w * 0.3, 0, Math.PI * 2);
      ctx.arc(dec.x + dec.w * 0.5, dec.y + dec.h * 0.4, dec.w * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dec.x + dec.w * 0.4, dec.y + dec.h * 0.35, dec.w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      if (dec.variant === 0) {
        ctx.fillStyle = '#FF5252';
        ctx.beginPath();
        ctx.arc(dec.x + dec.w * 0.3, dec.y + dec.h * 0.5, 3, 0, Math.PI * 2);
        ctx.arc(dec.x + dec.w * 0.65, dec.y + dec.h * 0.45, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'flower': {
      const color = dec.color || '#FF6B9D';
      const fx = dec.x + dec.w / 2;
      const fy = dec.y + dec.h / 2;
      ctx.strokeStyle = '#66BB6A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy + dec.h * 0.4);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      ctx.fillStyle = color;
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i + t * 0.2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(angle) * 5, fy + Math.sin(angle) * 5, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'grass': {
      ctx.strokeStyle = '#81C784';
      ctx.lineWidth = 2;
      const gx = dec.x + dec.w / 2;
      const gy = dec.y + dec.h;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx - 3 + sway, gy - dec.h * 0.5, gx + sway, gy - dec.h);
      ctx.moveTo(gx + 4, gy);
      ctx.quadraticCurveTo(gx + 4 + sway, gy - dec.h * 0.4, gx + 6 + sway, gy - dec.h * 0.8);
      ctx.stroke();
      break;
    }

    case 'rock': {
      ctx.fillStyle = '#9E9E9E';
      ctx.beginPath();
      ctx.ellipse(dec.x + dec.w / 2, dec.y + dec.h / 2, dec.w / 2, dec.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#BDBDBD';
      ctx.beginPath();
      ctx.ellipse(dec.x + dec.w * 0.35, dec.y + dec.h * 0.35, dec.w * 0.2, dec.h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'bench': {
      ctx.fillStyle = '#8D6E63';
      ctx.fillRect(dec.x, dec.y + dec.h * 0.3, dec.w, dec.h * 0.2);
      ctx.fillRect(dec.x + 2, dec.y + dec.h * 0.5, 4, dec.h * 0.5);
      ctx.fillRect(dec.x + dec.w - 6, dec.y + dec.h * 0.5, 4, dec.h * 0.5);
      break;
    }

    case 'lantern': {
      ctx.fillStyle = '#FFB74D';
      ctx.beginPath();
      ctx.ellipse(dec.x + dec.w / 2, dec.y + dec.h * 0.5, dec.w / 2, dec.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,215,100,0.2)';
      ctx.beginPath();
      ctx.arc(dec.x + dec.w / 2, dec.y + dec.h * 0.5, dec.w, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(dec.x + dec.w * 0.3, dec.y, dec.w * 0.4, 6);
      break;
    }

    case 'crate': {
      ctx.fillStyle = '#A1887F';
      ctx.fillRect(dec.x, dec.y, dec.w, dec.h);
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 2;
      ctx.strokeRect(dec.x, dec.y, dec.w, dec.h);
      ctx.beginPath();
      ctx.moveTo(dec.x, dec.y);
      ctx.lineTo(dec.x + dec.w, dec.y + dec.h);
      ctx.moveTo(dec.x + dec.w, dec.y);
      ctx.lineTo(dec.x, dec.y + dec.h);
      ctx.stroke();
      break;
    }

    case 'mushroom': {
      ctx.fillStyle = '#FFF8E1';
      ctx.fillRect(dec.x + dec.w * 0.35, dec.y + dec.h * 0.5, dec.w * 0.3, dec.h * 0.5);
      ctx.fillStyle = dec.variant === 0 ? '#EF5350' : '#AB47BC';
      ctx.beginPath();
      ctx.ellipse(dec.x + dec.w / 2, dec.y + dec.h * 0.4, dec.w * 0.45, dec.h * 0.35, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(dec.x + dec.w * 0.35, dec.y + dec.h * 0.3, 3, 0, Math.PI * 2);
      ctx.arc(dec.x + dec.w * 0.6, dec.y + dec.h * 0.25, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'snowman': {
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(dec.x + dec.w * 0.5, dec.y + dec.h * 0.7, dec.w * 0.35, 0, Math.PI * 2);
      ctx.arc(dec.x + dec.w * 0.5, dec.y + dec.h * 0.3, dec.w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(dec.x + dec.w * 0.42, dec.y + dec.h * 0.25, 2, 0, Math.PI * 2);
      ctx.arc(dec.x + dec.w * 0.58, dec.y + dec.h * 0.25, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF8A65';
      ctx.beginPath();
      ctx.moveTo(dec.x + dec.w * 0.5, dec.y + dec.h * 0.3);
      ctx.lineTo(dec.x + dec.w * 0.6, dec.y + dec.h * 0.32);
      ctx.lineTo(dec.x + dec.w * 0.5, dec.y + dec.h * 0.35);
      ctx.fill();
      break;
    }

    case 'hut': {
      ctx.fillStyle = dec.color || '#BCAAA4';
      ctx.fillRect(dec.x, dec.y + dec.h * 0.4, dec.w, dec.h * 0.6);
      ctx.fillStyle = '#8D6E63';
      ctx.beginPath();
      ctx.moveTo(dec.x - 5, dec.y + dec.h * 0.4);
      ctx.lineTo(dec.x + dec.w / 2, dec.y);
      ctx.lineTo(dec.x + dec.w + 5, dec.y + dec.h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(dec.x + dec.w * 0.35, dec.y + dec.h * 0.6, dec.w * 0.3, dec.h * 0.4);
      ctx.fillStyle = '#FFE082';
      ctx.fillRect(dec.x + dec.w * 0.7, dec.y + dec.h * 0.5, dec.w * 0.2, dec.h * 0.15);
      break;
    }

    case 'market': {
      ctx.fillStyle = dec.color || '#FFCC80';
      ctx.fillRect(dec.x, dec.y + dec.h * 0.4, dec.w, dec.h * 0.6);
      ctx.fillStyle = '#EF5350';
      ctx.fillRect(dec.x - 5, dec.y + dec.h * 0.3, dec.w + 10, 12);
      ctx.fillStyle = '#FFEB3B';
      for (let i = 0; i < dec.w + 10; i += 12) {
        ctx.fillRect(dec.x - 5 + i, dec.y + dec.h * 0.3 + 12, 6, 4);
      }
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(dec.x - 3, dec.y + dec.h * 0.3, 3, dec.h * 0.7);
      ctx.fillRect(dec.x + dec.w, dec.y + dec.h * 0.3, 3, dec.h * 0.7);
      break;
    }

    case 'temple': {
      ctx.fillStyle = dec.color || '#B39DDB';
      ctx.fillRect(dec.x, dec.y + dec.h * 0.3, dec.w, dec.h * 0.7);
      ctx.fillStyle = darkenColor(dec.color || '#B39DDB', 15);
      ctx.beginPath();
      ctx.moveTo(dec.x - 8, dec.y + dec.h * 0.3);
      ctx.lineTo(dec.x + dec.w / 2, dec.y);
      ctx.lineTo(dec.x + dec.w + 8, dec.y + dec.h * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(dec.x + dec.w * 0.4, dec.y + dec.h * 0.5, dec.w * 0.2, dec.h * 0.5);
      break;
    }

    case 'building': {
      ctx.fillStyle = dec.color || '#B39DDB';
      ctx.fillRect(dec.x, dec.y, dec.w, dec.h);
      ctx.fillStyle = darkenColor(dec.color || '#B39DDB', 20);
      ctx.fillRect(dec.x - 3, dec.y, dec.w + 6, 8);
      ctx.fillStyle = 'rgba(255,235,150,0.4)';
      for (let wy = dec.y + 15; wy < dec.y + dec.h - 15; wy += 25) {
        for (let wx = dec.x + 8; wx < dec.x + dec.w - 8; wx += 20) {
          ctx.fillRect(wx, wy, 10, 14);
        }
      }
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(dec.x + dec.w * 0.4, dec.y + dec.h - 25, dec.w * 0.2, 25);
      break;
    }
  }
}

// ─── INTERACTABLES ────────────────────────────────────────────────────

function drawInteractable(ctx: CanvasRenderingContext2D, obj: any, _state: GameState) {
  const cx = obj.x + obj.w / 2;
  const cy = obj.y + obj.h / 2;
  const t = Date.now() / 1000;
  const float = Math.sin(t * 2 + cx * 0.01) * 3;

  switch (obj.type) {
    case 'ac': {
      if (!obj.collected) {
        ctx.fillStyle = '#81D4FA';
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.fillStyle = '#0288D1';
        ctx.fillRect(obj.x, obj.y, obj.w, 6);
        ctx.fillStyle = '#E1F5FE';
        ctx.fillRect(obj.x + 10, obj.y + 20, obj.w - 20, 25);
        ctx.fillStyle = '#01579B';
        ctx.font = 'bold 9px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AC', cx, obj.y + 36);
        ctx.fillStyle = 'rgba(79,195,247,0.15)';
        ctx.beginPath();
        ctx.arc(cx, cy, 40 + Math.sin(t * 3) * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0277BD';
        ctx.fillRect(obj.x + obj.w * 0.35, obj.y + obj.h - 25, obj.w * 0.3, 25);
      }
      break;
    }

    case 'beacon': {
      const pulse = 0.5 + Math.sin(t * 2) * 0.3;
      ctx.fillStyle = `rgba(255,215,0,${pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,215,0,${pulse * 0.5})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFB300';
      ctx.fillRect(cx - 3, obj.y, 6, obj.h);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 20px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', cx, obj.y - 5 + float);
      break;
    }

    case 'frost': {
      if (!obj.collected) {
        ctx.save();
        ctx.translate(cx, cy + float);
        ctx.fillStyle = 'rgba(225,245,254,0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#81D4FA';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((Math.PI / 3) * i);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -12);
          ctx.moveTo(0, -4);
          ctx.lineTo(-3, -7);
          ctx.moveTo(0, -4);
          ctx.lineTo(3, -7);
          ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = '#E1F5FE';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'evidence': {
      if (!obj.collected) {
        ctx.save();
        ctx.translate(cx, cy + float);
        const color = obj.data === 'established' ? '#66BB6A' : '#FFB74D';
        ctx.fillStyle = `rgba(${obj.data === 'established' ? '102,187,106' : '255,183,77'},0.2)`;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-10, -10, 20, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 13px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', 0, 5);
        ctx.restore();
      }
      break;
    }

    case 'mosquito': {
      if (!obj.collected) {
        const wobble = Math.sin(t * 10 + cx * 0.1) * 3;
        ctx.fillStyle = '#333';
        ctx.save();
        ctx.translate(cx + wobble, cy);
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-6, -2);
        ctx.moveTo(0, 0);
        ctx.lineTo(6, -2);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'tradeGoods': {
      if (!obj.collected) {
        ctx.save();
        ctx.translate(cx, cy + float);
        ctx.fillStyle = `rgba(255,183,77,0.2)`;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = obj.data === 'flat' ? '#FFCC80' : '#A1887F';
        ctx.fillRect(-10, -8, 20, 16);
        ctx.fillStyle = '#D7CCC8';
        ctx.fillRect(-10, -8, 20, 4);
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-10, -8, 20, 16);
        ctx.restore();
      }
      break;
    }

    case 'bridge': {
      if (!obj.collected) {
        const pulse = 0.5 + Math.sin(t * 3) * 0.3;
        ctx.fillStyle = `rgba(255,215,0,${pulse * 0.3})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.font = 'bold 10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✦', cx, cy + 4);
      } else {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.fillStyle = 'rgba(255,215,0,0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy, 35, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'sign': {
      const shouldDraw = !obj.collected || obj.id === 'sort_board' || obj.id.startsWith('choice') || obj.id.startsWith('sign_');
      if (shouldDraw) {
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(cx - 3, obj.y + 10, 6, obj.h - 10);
        ctx.fillStyle = '#FFF8E1';
        ctx.beginPath();
        ctx.roundRect(obj.x, obj.y, obj.w, obj.h * 0.5, 5);
        ctx.fill();
        ctx.strokeStyle = '#A1887F';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#5D4037';
        ctx.font = '7px "Inter", sans-serif';
        ctx.textAlign = 'center';
        const label = obj.label || '';
        const words = label.split(' ');
        if (words.length > 1) {
          ctx.fillText(words.slice(0, Math.ceil(words.length / 2)).join(' '), cx, obj.y + 14);
          ctx.fillText(words.slice(Math.ceil(words.length / 2)).join(' '), cx, obj.y + 24);
        } else {
          ctx.fillText(label, cx, obj.y + 20);
        }
      }
      break;
    }

    case 'shadedSpot': {
      if (!obj.collected) {
        ctx.fillStyle = 'rgba(46,125,50,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, obj.w * 0.8, obj.h * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(46,125,50,0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, obj.w * 0.8, obj.h * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#66BB6A';
        ctx.font = '10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🍃', cx, cy + 3);
      }
      break;
    }

    case 'dryZone': {
      if (!obj.collected) {
        ctx.fillStyle = 'rgba(255,213,79,0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,152,0,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }

    case 'observation': {
      if (!obj.collected) {
        const pulse = 0.5 + Math.sin(t * 2.5 + cx * 0.02) * 0.3;
        ctx.fillStyle = `rgba(156,39,176,${pulse * 0.2})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(156,39,176,${pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9C27B0';
        ctx.beginPath();
        ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 6);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.icon || '📝', cx, cy);
      }
      break;
    }
  }
}

// ─── NPC ──────────────────────────────────────────────────────────────

function drawNPC(ctx: CanvasRenderingContext2D, npc: any, state: GameState) {
  const cx = npc.x + npc.w / 2;
  const t = Date.now() / 1000;
  const seed = npc.x * 0.013;

  const chapter = CHAPTERS[state.currentChapter];
  let trust = 50;
  if (chapter && chapter.mechanicType === 'balkanize' && state.player.valleyTrust && npc.valley !== undefined) {
    trust = state.player.valleyTrust[npc.valley] || 50;
  }

  const isHostile = trust < 30;
  const isFriendly = trust > 70;
  const npcColor = isHostile ? '#EF5350' : isFriendly ? '#66BB6A' : npc.color;

  const breathe = Math.sin(t * 0.8 + seed) * 0.8;
  const blinkCycle = (t + seed * 3) % 4;
  const blinking = blinkCycle < 0.12;

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, npc.y + npc.h, npc.w * 0.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = npcColor;
  ctx.beginPath();
  ctx.roundRect(npc.x, npc.y + 10, npc.w, npc.h - 10 + breathe, 6);
  ctx.fill();

  ctx.fillStyle = '#FFCC80';
  ctx.beginPath();
  ctx.arc(cx, npc.y + 8, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5D4037';
  ctx.beginPath();
  ctx.arc(cx, npc.y + 4, 11, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = '#333';
  if (blinking) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 5, npc.y + 7);
    ctx.lineTo(cx - 2, npc.y + 7);
    ctx.moveTo(cx + 2, npc.y + 7);
    ctx.lineTo(cx + 5, npc.y + 7);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx - 4, npc.y + 7, 2, 0, Math.PI * 2);
    ctx.arc(cx + 4, npc.y + 7, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, npc.y + 10, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  const nameText = npc.name;
  ctx.font = '8px "Inter", sans-serif';
  ctx.fillStyle = '#FFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeText(nameText, cx, npc.y - 18);
  ctx.fillText(nameText, cx, npc.y - 18);

  if (npc.viewpoint) {
    const colors: Record<string, string> = {
      established: '#4CAF50',
      debated: '#FF9800',
      author: '#2196F3',
    };
    ctx.fillStyle = colors[npc.viewpoint];
    ctx.beginPath();
    ctx.arc(npc.x + npc.w - 2, npc.y + 12, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isHostile) {
    ctx.fillStyle = 'rgba(239, 83, 80, 0.4)';
    ctx.beginPath();
    ctx.arc(cx, npc.y + npc.h / 2, npc.w / 2 + 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (isFriendly) {
    ctx.fillStyle = 'rgba(102, 187, 106, 0.3)';
    ctx.beginPath();
    ctx.arc(cx, npc.y + npc.h / 2, npc.w / 2 + 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── PLAYER ───────────────────────────────────────────────────────────

function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerState) {
  const cx = p.x + p.w / 2;
  const t = Date.now() / 1000;
  const app = p.appearance;
  const sq = p.squashScale;
  const sy = 2 - sq;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, p.y + p.h, p.w * 0.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, p.y + p.h);
  ctx.scale(sq, sy);
  ctx.translate(-cx, -(p.y + p.h));

  // ── Legs (skin tone) ──
  const legSwing = p.state === 'walk' ? Math.sin(t * 12) * 6 : 0;
  ctx.strokeStyle = app.skinTone;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';

  const baseY = p.y + p.h;
  if (p.state === 'jump') {
    // Left leg
    ctx.beginPath();
    ctx.moveTo(cx - 5, baseY - 16);
    ctx.lineTo(cx - 5, baseY - 6);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx + 5, baseY - 16);
    ctx.lineTo(cx + 5, baseY - 6);
    ctx.stroke();
  } else if (p.state === 'walk') {
    // Left leg swinging
    ctx.beginPath();
    ctx.moveTo(cx - 5, baseY - 16);
    ctx.lineTo(cx - 5 + legSwing, baseY - 6 + Math.max(0, legSwing * 0.5));
    ctx.stroke();
    // Right leg swinging
    ctx.beginPath();
    ctx.moveTo(cx + 5, baseY - 16);
    ctx.lineTo(cx + 5 - legSwing, baseY - 6 + Math.max(0, -legSwing * 0.5));
    ctx.stroke();
  } else {
    // Idle legs
    ctx.beginPath();
    ctx.moveTo(cx - 5, baseY - 16);
    ctx.lineTo(cx - 5, baseY - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 5, baseY - 16);
    ctx.lineTo(cx + 5, baseY - 4);
    ctx.stroke();
  }

  // ── Shoes (dark color) ──
  ctx.fillStyle = '#2c3e50';
  if (p.state === 'walk') {
    ctx.fillRect(cx - 8.5 + legSwing, baseY - 6 + Math.max(0, legSwing * 0.5), 6, 6);
    ctx.fillRect(cx + 1.5 - legSwing, baseY - 6 + Math.max(0, -legSwing * 0.5), 6, 6);
  } else if (p.state === 'jump') {
    ctx.fillRect(cx - 8.5, baseY - 8, 6, 6);
    ctx.fillRect(cx + 1.5, baseY - 8, 6, 6);
  } else {
    ctx.fillRect(cx - 8.5, baseY - 6, 6, 6);
    ctx.fillRect(cx + 1.5, baseY - 6, 6, 6);
  }

  // ── Body (block style from ChracterCreation) ──
  ctx.fillStyle = app.bodyColor;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y + 12, p.w, p.h - 26, 6);
  ctx.fill();

  // Highlight stripe
  ctx.fillStyle = lightenColor(app.bodyColor, 15);
  ctx.fillRect(p.x + 2, p.y + 14, 4, p.h - 30);

  // ── Arms (skin tone with slight movement) ──
  const armSwing = p.state === 'walk' ? Math.sin(t * 12 + Math.PI) * 4 : 0;
  ctx.strokeStyle = app.skinTone;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  
  if (p.state === 'walk') {
    ctx.beginPath();
    ctx.moveTo(cx - 10, p.y + 18);
    ctx.lineTo(cx - 14, p.y + 28 + armSwing);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 10, p.y + 18);
    ctx.lineTo(cx + 14, p.y + 28 - armSwing);
    ctx.stroke();
  } else if (p.state === 'jump') {
    ctx.beginPath();
    ctx.moveTo(cx - 10, p.y + 18);
    ctx.lineTo(cx - 13, p.y + 14);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 10, p.y + 18);
    ctx.lineTo(cx + 13, p.y + 14);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 10, p.y + 18);
    ctx.lineTo(cx - 14, p.y + 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 10, p.y + 18);
    ctx.lineTo(cx + 14, p.y + 30);
    ctx.stroke();
  }

  // Hands (round skin circles at the end of arms)
  ctx.fillStyle = app.skinTone;
  if (p.state === 'walk') {
    ctx.beginPath();
    ctx.arc(cx - 14, p.y + 28 + armSwing, 2, 0, Math.PI * 2);
    ctx.arc(cx + 14, p.y + 28 - armSwing, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.state === 'jump') {
    ctx.beginPath();
    ctx.arc(cx - 13, p.y + 14, 2, 0, Math.PI * 2);
    ctx.arc(cx + 13, p.y + 14, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx - 14, p.y + 30, 2, 0, Math.PI * 2);
    ctx.arc(cx + 14, p.y + 30, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Head ──
  ctx.fillStyle = app.skinTone;
  ctx.beginPath();
  ctx.arc(cx, p.y + 8, 10, 0, Math.PI * 2);
  ctx.fill();

  // ── Face ──
  const eyeY = p.y + 7;
  if (p.blinking) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 5, eyeY);
    ctx.lineTo(cx - 2, eyeY);
    ctx.moveTo(cx + 2, eyeY);
    ctx.lineTo(cx + 5, eyeY);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(cx - 3, eyeY, 1.8, 0, Math.PI * 2);
    ctx.arc(cx + 3, eyeY, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(cx - 2.5, eyeY - 0.5, 0.7, 0, Math.PI * 2);
    ctx.arc(cx + 3.5, eyeY - 0.5, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Blush cheeks
  ctx.fillStyle = 'rgba(255,150,150,0.4)';
  ctx.beginPath();
  ctx.arc(cx - 6, p.y + 11, 2, 0, Math.PI * 2);
  ctx.arc(cx + 6, p.y + 11, 2, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, p.y + 11, 3, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // ── Hat (style from ChracterCreation) ──
  ctx.fillStyle = app.hatColor;
  ctx.beginPath();
  ctx.arc(cx, p.y + 4, 10, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(cx - 12, p.y + 3, 24, 3.5);

  ctx.restore();

  // ── Sweat drops (Ch2 humidity) ──
  if (p.sweatDrops > 10) {
    const dropCount = Math.floor(p.sweatDrops / 20);
    ctx.fillStyle = 'rgba(100, 181, 246, 0.7)';
    for (let i = 0; i < dropCount; i++) {
      const sx = cx - 12 + (i * 7) % 24;
      const sy = p.y + 5 + (i * 3) % 10;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Infection effect (Ch3 disease) ──
  if (p.infectionTimer > 0) {
    ctx.fillStyle = 'rgba(239, 83, 80, 0.3)';
    ctx.beginPath();
    ctx.arc(cx, p.y + p.h / 2, p.w / 2 + 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Name Tag (above player head) ──
  const nameText = app.name || 'Explorer';
  ctx.font = '8px "Inter", sans-serif';
  ctx.fillStyle = '#FFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // Thin outline for crisp readability
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeText(nameText, cx, p.y - 18);

  // Text
  ctx.fillText(nameText, cx, p.y - 18);

  // ── Stamina bar (small, above player) ──
  const stamPct = p.stamina / p.maxStamina;
  if (stamPct < 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(p.x - 2, p.y - 10, p.w + 4, 4);
    ctx.fillStyle = stamPct > 0.5 ? '#66BB6A' : stamPct > 0.25 ? '#FFB74D' : '#EF5350';
    ctx.fillRect(p.x, p.y - 9, p.w * stamPct, 2);
  }
}

// ─── BALLOONS ─────────────────────────────────────────────────────────

function drawBalloons(ctx: CanvasRenderingContext2D, state: GameState) {
  const p = state.player;
  const cx = p.x + p.w / 2;

  for (let i = 0; i < state.balloons.length; i++) {
    const b = state.balloons[i];

    // Different sway pattern for each balloon - creates natural floating effect
    const swayX = Math.sin(b.sway + i * 0.5) * 3;
    const swayY = Math.sin(b.sway * 0.7 + i * 0.3) * 5;

    // Behind player: if facing right (+1), go left; if facing left (-1), go right
    const offsetX = -p.facing * (40 + i * 18);

    // Floating UPWARD with vertical variation (not in a line)
    // Each balloon at different height for natural effect
    const baseOffsetY = -45 - i * 6;  // Start high, each one slightly lower
    const offsetY = baseOffsetY + swayY;

    const bx = cx + offsetX + swayX;
    const by = p.y + 24 + offsetY;  // From hand, floating upward

    // String from player's hand to balloon
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - p.facing * 8, p.y + 24);  // From hand
    ctx.lineTo(bx, by);  // To balloon
    ctx.stroke();

    // Balloon body
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.ellipse(bx, by, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(bx - 2.5, by - 3, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Knot
    ctx.fillStyle = darkenColor(b.color, 20);
    ctx.beginPath();
    ctx.moveTo(bx - 2, by + 10);
    ctx.lineTo(bx + 2, by + 10);
    ctx.lineTo(bx, by + 13);
    ctx.closePath();
    ctx.fill();

    // Number on balloon
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 8px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(b.chapterNum), bx, by + 3);
  }
}

// ─── PARTICLES ────────────────────────────────────────────────────────

function drawParticle(ctx: CanvasRenderingContext2D, pt: Particle) {
  const alpha = pt.life / pt.maxLife;
  ctx.globalAlpha = alpha;

  switch (pt.type) {
    case 'heat':
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'sweat':
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'mosquito':
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1, pt.y - 1, 3, 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - 3, pt.y - 2);
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + 3, pt.y - 2);
      ctx.stroke();
      break;
    case 'snow':
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'mold':
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'sparkle':
    case 'star':
      ctx.fillStyle = pt.color;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.life * 0.01);
      ctx.fillRect(-pt.size / 2, -1, pt.size, 2);
      ctx.fillRect(-1, -pt.size / 2, 2, pt.size);
      ctx.restore();
      break;
    case 'dust':
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'leaf':
      ctx.fillStyle = pt.color;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.life * 0.003);
      ctx.beginPath();
      ctx.ellipse(0, 0, pt.size, pt.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    case 'petal':
      ctx.fillStyle = pt.color;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.life * 0.004);
      ctx.beginPath();
      ctx.ellipse(0, 0, pt.size, pt.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    case 'bubble':
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }
  ctx.globalAlpha = 1;
}

// ─── UI ELEMENTS ──────────────────────────────────────────────────────

function drawInteractPrompt(ctx: CanvasRenderingContext2D, state: GameState) {
  const px = state.interactPrompt!.x - state.camera.x;
  const py = state.interactPrompt!.y - state.camera.y;
  const t = Date.now() / 1000;
  const bob = Math.sin(t * 3) * 1.5;

  const text = state.interactPrompt!.label;
  ctx.font = '10px "Inter", sans-serif';
  const tw = ctx.measureText(text).width;
  const boxW = tw + 16;
  const boxH = 22;
  const boxX = px - boxW / 2;
  const boxY = py - 35 + bob;

  // White background like most indie games
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 4);
  ctx.fill();

  // Dark border
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Text (dark color on white background) - CENTERED VERTICALLY
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, px, boxY + boxH / 2);

  // Arrow pointing down (white to match background)
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(px - 5, boxY + boxH);
  ctx.lineTo(px, boxY + boxH + 6);
  ctx.lineTo(px + 5, boxY + boxH);
  ctx.fill();

  // Press E hint (yellow)
  ctx.fillStyle = '#FFB300';
  ctx.font = '8px "Inter", sans-serif';
  ctx.fillText('[E]', px, boxY + boxH + 16);
}

function drawMessage(ctx: CanvasRenderingContext2D, state: GameState) {
  const alpha = Math.min(1, state.messageTimer / 500);
  const slideY = state.messageTimer > 2500 ? (3000 - state.messageTimer) * 0.1 : 0;

  // White background (like most games)
  ctx.fillStyle = `rgba(255,255,255,${0.95 * alpha})`;
  ctx.beginPath();
  ctx.roundRect(CANVAS_W / 2 - 180, 50 + slideY, 360, 36, 10);
  ctx.fill();

  // Dark border
  ctx.strokeStyle = `rgba(0,0,0,${0.2 * alpha})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Dark text on white background - CENTERED VERTICALLY
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.font = '13px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.message!, CANVAS_W / 2, 50 + 18 + slideY);
}

// ─── COLOR UTILS ──────────────────────────────────────────────────────

function lightenColor(color: string, percent: number): string {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return color;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const factor = 1 + percent / 100;
  return `#${Math.min(255, Math.round(r * factor)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(g * factor)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(b * factor)).toString(16).padStart(2, '0')}`;
}

function darkenColor(color: string, percent: number): string {
  return lightenColor(color, -percent);
}
