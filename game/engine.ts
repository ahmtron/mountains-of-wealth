import type { GameState, PlayerState, Chapter, Particle, Platform, JournalEntry } from './types';
import { CHAPTERS } from './chapters';
import { playSfx, startMusic, stopMusic } from './audio';

export const GRAVITY = 0.7;
export const MOVE_SPEED = 4.2;
export const JUMP_FORCE = 14;
export const MAX_FALL = 16;
export const CANVAS_W = 960;
export const CANVAS_H = 540;

const MUSIC_MOODS: Record<string, string> = {
  stamina: 'warm',
  humidity: 'humid',
  disease: 'cold',
  debate: 'mystery',
  altitude: 'ascent',
  transport: 'trade',
  balkanize: 'conflict',
  conclusion: 'conclusion',
};

export const CAUSAL_CHAINS = [
  {
    from: 'Temperature',
    to: 'Productivity Loss',
    connection: '+1°C above 27°C → -4% manual labor productivity',
    icon: '🌡️→🧠',
  },
  {
    from: 'Humidity',
    to: 'Heat + Productivity Loss',
    connection: '100% humidity blocks sweat → body can\'t cool → worse productivity',
    icon: '💧→😓',
  },
  {
    from: 'Disease',
    to: 'Poverty Trap',
    connection: 'Sick people can\'t work → dead people can\'t teach → less investment per child',
    icon: '🦟→💔',
  },
  {
    from: 'Altitude',
    to: 'Temperature + Disease',
    connection: 'Higher altitude → cooler + drier → less disease → more productivity',
    icon: '⛰️→🌡️',
  },
  {
    from: 'Mountains',
    to: 'Less Trade',
    connection: 'No navigable rivers + steep passes → transport costs 3x higher → less wealth',
    icon: '🏔️→🚢',
  },
  {
    from: 'Isolation',
    to: 'Conflict',
    connection: 'Less movement between valleys → less trust → more ethnic conflict',
    icon: '🚧→⚔️',
  },
  {
    from: 'Geography',
    to: 'Root Cause',
    connection: 'It\'s not about blame. It\'s about root causes we can act on.',
    icon: '🌍→💡',
  },
];

export function createInitialState(): GameState {
  return {
    phase: 'title',
    currentChapter: 0,
    player: createPlayer(),
    camera: { x: 0, y: 0 },
    particles: [],
    objectiveProgress: 0,
    dialogue: null,
    showObjective: false,
    transitionAlpha: 0,
    chapterStartTime: 0,
    message: null,
    messageTimer: 0,
    keys: {},
    interactPrompt: null,
    temperatureDisplay: 27,
    humidityDisplay: 60,
    altitudeDisplay: 0,
    showStats: false,
    statType: '',
    audioEnabled: true,
    hintTimer: 0,
    hintShown: false,
    balloons: [],
    journalEntries: [],
    showJournal: false,
    observationPopup: null,
    observationPopupTimer: 0,
    debateSorting: false,
    debateSortIndex: 0,
    debateCorrectSorts: 0,
    showCausalChain: false,
    causalChainIndex: 0,
    dramaticReveal: false,
    dramaticRevealTimer: 0,
    synthesisPath: null,
  };
}

export function createPlayer(appearance?: PlayerState['appearance']): PlayerState {
  return {
    x: 80,
    y: 400,
    vx: 0,
    vy: 0,
    w: 24,
    h: 44,
    onGround: false,
    facing: 1,
    animFrame: 0,
    animTimer: 0,
    state: 'idle',
    stamina: 100,
    maxStamina: 100,
    temperature: 27,
    humidity: 60,
    altitude: 0,
    collected: [],
    interactedNPCs: [],
    appearance: appearance || {
      name: 'Explorer',
      skinTone: '#ffd3b6',
      bodyColor: '#2563eb',
      hatColor: '#e11d48',
    },
    turnTimer: 0,
    squashScale: 1,
    blinkTimer: 3000,
    blinking: false,
    productivity: 1,
    moveSpeedMultiplier: 1,
    infectionTimer: 0,
    infectionMaxTimer: 0,
    sweatDrops: 0,
    deliveryTimer: 0,
    deliveryCost: 0,
    valleyTrust: [0, 0, 0, 0],
  };
}

export function resetPlayerForChapter(chapter: Chapter, appearance: PlayerState['appearance']): PlayerState {
  const p = createPlayer(appearance);
  p.temperature = chapter.startTemp ?? 27;
  p.humidity = chapter.startHumidity ?? 60;
  p.altitude = 0;
  return p;
}

export function resetChapterInteractables(chapter: Chapter): void {
  for (const obj of chapter.interactables) {
    obj.collected = false;
    obj.activated = false;
  }
  if (chapter.mechanicType === 'balkanize') {
    const originalColors: Record<string, string> = {
      'valley1_elder': '#FFAB91',
      'valley2_elder': '#FFCC80',
      'valley3_elder': '#EF9A9A',
      'valley4_elder': '#FFAB91',
      'political_scientist': '#EF9A9A',
    };
    for (const npc of chapter.npcs) {
      if (originalColors[npc.id]) {
        npc.color = originalColors[npc.id];
      }
    }
  }
}

// ─── PHYSICS ──────────────────────────────────────────────────────────

function rectOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function resolvePlatformCollision(p: PlayerState, plat: Platform): boolean {
  if (!rectOverlap(p.x, p.y, p.w, p.h, plat.x, plat.y, plat.w, plat.h)) return false;

  const overlapLeft = p.x + p.w - plat.x;
  const overlapRight = plat.x + plat.w - p.x;
  const overlapTop = p.y + p.h - plat.y;
  const overlapBottom = plat.y + plat.h - p.y;
  const minH = Math.min(overlapLeft, overlapRight);
  const minV = Math.min(overlapTop, overlapBottom);

  if (minV < minH) {
    if (overlapTop < overlapBottom) {
      p.y = plat.y - p.h;
      if (p.vy > 0) {
        if (p.vy > 6) {
          playSfx('land');
          p.squashScale = 0.7;
        }
        p.vy = 0;
      }
      p.onGround = true;
    } else {
      p.y = plat.y + plat.h;
      p.vy = 0;
    }
  } else {
    if (overlapLeft < overlapRight) {
      p.x = plat.x - p.w;
    } else {
      p.x = plat.x + plat.w;
    }
    p.vx = 0;
  }
  return true;
}

// ─── UPDATE ───────────────────────────────────────────────────────────

export function updateGame(state: GameState, dt: number): void {
  if (state.phase !== 'playing') return;
  const chapter = CHAPTERS[state.currentChapter];
  if (!chapter) return;
  const p = state.player;

  // ── Blink timer ──
  p.blinkTimer -= dt;
  if (p.blinkTimer <= 0) {
    p.blinking = true;
    if (p.blinkTimer < -150) {
      p.blinking = false;
      p.blinkTimer = 2000 + Math.random() * 3000;
    }
  }

  // ── Squash recovery ──
  if (p.squashScale < 1) {
    p.squashScale = Math.min(1, p.squashScale + 0.08);
  }

  // ── Turn timer ──
  if (p.turnTimer > 0) {
    p.turnTimer -= dt;
    p.state = 'turn';
  }

  // ── Input ──
  let moving = false;
  if (state.keys['ArrowLeft'] || state.keys['KeyA']) {
    p.vx = -MOVE_SPEED * p.moveSpeedMultiplier;
    if (p.facing !== -1) {
      p.facing = -1;
      p.turnTimer = 150;
    }
    moving = true;
  } else if (state.keys['ArrowRight'] || state.keys['KeyD']) {
    p.vx = MOVE_SPEED * p.moveSpeedMultiplier;
    if (p.facing !== 1) {
      p.facing = 1;
      p.turnTimer = 150;
    }
    moving = true;
  } else {
    p.vx *= 0.7;
    if (Math.abs(p.vx) < 0.1) p.vx = 0;
  }

  if ((state.keys['ArrowUp'] || state.keys['KeyW'] || state.keys['Space']) && p.onGround) {
    p.vy = -JUMP_FORCE;
    p.onGround = false;
    p.squashScale = 1.3;
    playSfx('jump');
  }

  // ── Apply gravity ──
  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  // ── Move X ──
  p.x += p.vx;
  if (p.x < 0) p.x = 0;
  if (p.x + p.w > chapter.width) p.x = chapter.width - p.w;

  // ── Move Y ──
  p.y += p.vy;
  p.onGround = false;

  // ── Collisions ──
  for (const plat of chapter.platforms) {
    resolvePlatformCollision(p, plat);
  }

  // ── Animation ──
  p.animTimer += dt;
  if (p.animTimer > 100) {
    p.animTimer = 0;
    p.animFrame = (p.animFrame + 1) % 4;
  }
  if (p.turnTimer > 0) {
    p.state = 'turn';
  } else if (!p.onGround) {
    p.state = 'jump';
  } else if (moving) {
    p.state = 'walk';
    if (p.animFrame % 2 === 0 && p.animTimer < 20) {
      playSfx('step');
    }
  } else {
    p.state = 'idle';
  }

  // ── Camera (smooth follow, centered) ──
  const targetCamX = p.x - CANVAS_W / 2 + p.w / 2;
  const targetCamY = Math.max(0, p.y - CANVAS_H * 0.6);
  state.camera.x += (targetCamX - state.camera.x) * 0.12;
  state.camera.y += (targetCamY - state.camera.y) * 0.08;
  if (state.camera.x < 0) state.camera.x = 0;
  if (state.camera.x > chapter.width - CANVAS_W) state.camera.x = chapter.width - CANVAS_W;
  if (state.camera.y < 0) state.camera.y = 0;

  // ── Chapter mechanics ──
  updateChapterMechanics(state, chapter, dt);

  // ── Particles ──
  updateParticles(state, chapter, dt);

  // ── Interact prompt ──
  updateInteractPrompt(state, chapter);

  // ── Message timer ──
  if (state.message) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) state.message = null;
  }

  // ── Observation popup timer ──
  if (state.observationPopup) {
    state.observationPopupTimer -= dt;
    if (state.observationPopupTimer <= 0) {
      state.observationPopup = null;
    }
  }

  // ── Dramatic reveal timer (Chapter 5) ──
  if (state.dramaticReveal) {
    state.dramaticRevealTimer -= dt;
    if (state.dramaticRevealTimer <= 0) {
      state.dramaticReveal = false;
    }
  }

  // ── Hint timer ──
  if (!state.hintShown) {
    state.hintTimer += dt;
  }

  // ── Balloons ──
  updateBalloons(state, dt);
}

function updateChapterMechanics(state: GameState, chapter: Chapter, _dt: number): void {
  const p = state.player;
  const mech = chapter.mechanicType;

  switch (mech) {
    case 'stamina': {
      const tempProgress = p.x / chapter.width;
      p.temperature = (chapter.startTemp ?? 27) + tempProgress * ((chapter.endTemp ?? 37) - (chapter.startTemp ?? 27));

      let nearShade = false;
      for (const obj of chapter.interactables) {
        if (obj.type === 'shadedSpot' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            nearShade = true;
            break;
          }
        }
      }

      const tempFactor = Math.max(0, (p.temperature - 20) / 20);
      const targetProductivity = nearShade ? 1 : Math.max(0.35, 1 - tempFactor * 0.65);

      if (nearShade) {
        p.productivity = Math.min(1, p.productivity + 0.03);
      } else {
        p.productivity = Math.max(targetProductivity, p.productivity - 0.008);
      }

      p.moveSpeedMultiplier = p.productivity;

      for (const obj of chapter.interactables) {
        if (obj.type === 'ac' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            state.objectiveProgress = 1;
            p.productivity = 1;
            p.moveSpeedMultiplier = 1;
            p.temperature = 22;
            state.message = 'The AC wakes you up. Your mind clears.';
            state.messageTimer = 3000;
            playSfx('complete');
          }
        }
      }
      break;
    }

    case 'humidity': {
      const progress = p.x / chapter.width;
      p.humidity = 100 - progress * 70;

      const drainRate = (p.humidity / 100) * 0.25;
      if (p.humidity < 50) {
        p.stamina = Math.min(p.maxStamina, p.stamina + 0.3);
        p.sweatDrops = Math.max(0, p.sweatDrops - 0.05);
      } else {
        p.stamina = Math.max(0, p.stamina - drainRate);
        p.sweatDrops = Math.min(100, p.sweatDrops + 0.03);
      }

      if (p.stamina < 30) p.vx *= 0.4;

      const goal = chapter.interactables.find(o => o.id === 'dry_goal');
      if (goal && !goal.collected) {
        if (rectOverlap(p.x, p.y, p.w, p.h, goal.x, goal.y, goal.w, goal.h)) {
          goal.collected = true;
          state.objectiveProgress = 1;
          p.humidity = 30;
          p.stamina = p.maxStamina;
          p.sweatDrops = 0;
          state.message = 'You reached the dry plateau. Sweat evaporates here!';
          state.messageTimer = 3000;
          playSfx('complete');
        }
      }
      break;
    }

    case 'disease': {
      const tempProgress = p.x / chapter.width;
      p.temperature = (chapter.startTemp ?? 30) - tempProgress * ((chapter.startTemp ?? 30) - (chapter.endTemp ?? 5));
      p.humidity = Math.max(20, (chapter.startHumidity ?? 80) - tempProgress * 60);

      if (p.infectionTimer > 0) {
        p.infectionTimer -= 1;
        p.moveSpeedMultiplier = 0.5;
      } else {
        p.moveSpeedMultiplier = 1;
      }

      for (const obj of chapter.interactables) {
        if (obj.type === 'mosquito' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            p.infectionTimer = p.infectionMaxTimer || 3000;
            p.infectionMaxTimer = 3000;
            p.stamina = Math.max(0, p.stamina - 15);
            state.message = 'Mosquito bite! You feel feverish... (slow for 3s)';
            state.messageTimer = 2500;
            playSfx('interact');
          }
        }
      }

      let frostCollected = 0;
      for (const obj of chapter.interactables) {
        if (obj.type === 'frost' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            frostCollected++;
            p.stamina = p.maxStamina;
            p.infectionTimer = 0;
            state.message = 'Frost crystal! Full stamina restored. Pathogens die in the cold.';
            state.messageTimer = 2000;
            playSfx('collect');
          }
        }
      }

      const totalFrostCollected = chapter.interactables.filter(o => o.type === 'frost' && o.collected).length;
      state.objectiveProgress = Math.min(totalFrostCollected, chapter.objectiveTarget - 1);

      const beaconDisease = chapter.interactables.find(o => o.type === 'beacon');
      if (beaconDisease && totalFrostCollected >= chapter.objectiveTarget && !beaconDisease.collected) {
        if (rectOverlap(p.x, p.y, p.w, p.h, beaconDisease.x, beaconDisease.y, beaconDisease.w, beaconDisease.h)) {
          beaconDisease.collected = true;
          state.objectiveProgress = chapter.objectiveTarget;
          state.message = 'You reached the highlands! Disease-free.';
          state.messageTimer = 2000;
          playSfx('complete');
        }
      }
      break;
    }

    case 'debate': {
      for (const obj of chapter.interactables) {
        if (obj.type === 'evidence' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            if (!p.evidenceInventory) {
              p.evidenceInventory = [];
            }
            const categories: Record<string, string> = {
              'ev_institutions': 'established',
              'ev_crops': 'established',
              'ev_ajr': 'flawed',
              'ev_race': 'counterexample',
              'ev_colonial': 'weak',
              'ev_disease': 'established',
              'ev_geography': 'established'
            };
            p.evidenceInventory.push({
              id: obj.id,
              label: obj.label || 'Evidence',
              correctCategory: categories[obj.id] || 'weak'
            });
            state.message = `Evidence collected: "${obj.label || 'Evidence'}"`;
            state.messageTimer = 2000;
            playSfx('collect');
          }
        }
      }

      const npcsTalked = p.interactedNPCs.length;
      const evidenceCount = p.evidenceInventory ? p.evidenceInventory.length : 0;
      state.objectiveProgress = Math.min(chapter.objectiveTarget, npcsTalked + evidenceCount);

      const board = chapter.interactables.find(o => o.type === 'sign' && o.id === 'sort_board');
      if (board && p.evidenceInventory && p.evidenceInventory.length > 0 && !state.debateSorting) {
        if (rectOverlap(p.x, p.y, p.w, p.h, board.x, board.y, board.w, board.h)) {
          state.debateSorting = true;
          state.debateSortIndex = 0;
          state.debateCorrectSorts = 0;
          p.sortedEvidence = { established: [], weak: [], flawed: [], counterexample: [] };
          state.message = 'Sort this evidence: Established, Weak, Flawed, or Counterexample?';
          state.messageTimer = 3000;
          playSfx('interact');
        }
      }

      if (state.debateSorting && board) {
        if (rectOverlap(p.x, p.y, p.w, p.h, board.x, board.y, board.w, board.h)) {
          const current = p.evidenceInventory?.[state.debateSortIndex];
          if (current && p.sortedEvidence && !p.sortedEvidence[current.correctCategory as keyof typeof p.sortedEvidence].includes(current.label)) {
            const choice = state.keys['Digit1'] ? 'established' :
                          state.keys['Digit2'] ? 'weak' :
                          state.keys['Digit3'] ? 'flawed' :
                          state.keys['Digit4'] ? 'counterexample' : null;
            if (choice) {
              const categoryKey = current.correctCategory as keyof typeof p.sortedEvidence;
              p.sortedEvidence[categoryKey].push(current.label);
              if (choice === current.correctCategory) {
                state.debateCorrectSorts++;
                state.message = `Correct! "${current.label}" is ${current.correctCategory} evidence.`;
              } else {
                state.message = `Not quite. "${current.label}" is actually ${current.correctCategory} evidence.`;
              }
              state.messageTimer = 2500;
              state.debateSortIndex++;
              playSfx('select');
              if (state.debateSortIndex >= (p.evidenceInventory?.length || 0)) {
                state.debateSorting = false;
                board.collected = true;
                state.objectiveProgress = chapter.objectiveTarget;
                state.message = `Evidence sorted! ${state.debateCorrectSorts}/${p.evidenceInventory?.length || 0} correct.`;
                state.messageTimer = 3000;
                playSfx('complete');
              }
            }
          }
        }
      }
      break;
    }

    case 'altitude': {
      const baseAlt = (p.x / chapter.width) * 2600;
      const heightBonus = Math.max(0, (400 - p.y) * 3);
      const prevAlt = p.altitude;
      p.altitude = Math.round(Math.min(2600, baseAlt + heightBonus));
      p.temperature = Math.round((35 - (p.altitude / 1000) * 7) * 10) / 10;
      p.humidity = Math.max(20, 90 - (p.altitude / 1000) * 30);

      if (p.altitude > 1000) {
        p.stamina = Math.min(p.maxStamina, p.stamina + 0.15);
      } else if (p.temperature > 28) {
        p.stamina = Math.max(0, p.stamina - 0.1);
      }

      const capital = chapter.interactables.find(o => o.id === 'sign_2600');
      if (capital && !capital.collected) {
        if (rectOverlap(p.x, p.y, p.w, p.h, capital.x, capital.y, capital.w, capital.h)) {
          capital.collected = true;
          state.objectiveProgress = 1;
          state.message = 'You\'ve reached Bogotá — 2,600m. It\'s 14°C here!';
          state.messageTimer = 3000;
          playSfx('complete');
        }
      }

      if (!state.dramaticReveal && p.altitude >= 1500 && prevAlt < 1500) {
        state.dramaticReveal = true;
        state.dramaticRevealTimer = 5000;
        state.message = 'Wait... Nairobi is COOLER than Lisbon?';
        state.messageTimer = 5000;
        playSfx('complete');
      }
      if (!state.dramaticReveal && p.altitude >= 2000 && prevAlt < 2000) {
        state.message = 'People in warm countries live in the MOUNTAINS, not the coast!';
        state.messageTimer = 4000;
      }
      if (!state.dramaticReveal && p.altitude >= 2600 && prevAlt < 2600) {
        state.message = 'Bogotá is COLDER than Madrid. The Incan Empire was a mountain empire.';
        state.messageTimer = 5000;
      }
      break;
    }

    case 'transport': {
      if (!p.goodsDelivered) p.goodsDelivered = { flat: 0, mountain: 0 };

      for (const obj of chapter.interactables) {
        if (obj.type === 'tradeGoods' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            if (obj.data === 'flat') {
              p.goodsDelivered.flat++;
              p.deliveryTimer = 0;
              p.deliveryCost = 0;
              state.message = 'Flat route: 1 day, $10 profit.';
            } else {
              p.goodsDelivered.mountain++;
              p.deliveryTimer = 5;
              p.deliveryCost = 30;
              state.message = 'Mountain route: 5 days, $30 cost (3x more!).';
            }
            state.messageTimer = 2500;
            playSfx('collect');
          }
        }
      }

      const totalGoodsCollected = chapter.interactables.filter(o => o.type === 'tradeGoods' && o.collected).length;
      state.objectiveProgress = Math.min(totalGoodsCollected, chapter.objectiveTarget - 1);

      const beaconTransport = chapter.interactables.find(o => o.type === 'beacon');
      if (beaconTransport && totalGoodsCollected >= chapter.objectiveTarget && !beaconTransport.collected) {
        if (rectOverlap(p.x, p.y, p.w, p.h, beaconTransport.x, beaconTransport.y, beaconTransport.w, beaconTransport.h)) {
          beaconTransport.collected = true;
          state.objectiveProgress = chapter.objectiveTarget;
          const flatProfit = (p.goodsDelivered.flat || 0) * 10;
          const mtnCost = (p.goodsDelivered.mountain || 0) * 30;
          state.message = `Delivered all goods! Flat: $${flatProfit} profit. Mountain: $${mtnCost} cost (3x!).`;
          state.messageTimer = 3000;
          playSfx('complete');
        }
      }
      break;
    }

    case 'balkanize': {
      if (!p.valleyTrust) p.valleyTrust = [0, 0, 0, 0];

      const bridgesConnected = chapter.interactables.filter(o => o.type === 'bridge' && o.collected).length;
      const newTrust = Math.round((bridgesConnected / chapter.objectiveTarget) * 100);

      for (let i = 0; i < p.valleyTrust.length; i++) {
        p.valleyTrust[i] = newTrust;
      }

      for (const npc of chapter.npcs) {
        if (npc.valley !== undefined && p.valleyTrust) {
          const trust = p.valleyTrust[npc.valley] || 0;
          if (trust < 30) {
            npc.color = '#EF5350';
          } else if (trust > 70) {
            npc.color = '#66BB6A';
          } else {
            const originalColors: Record<number, string> = { 0: '#FFAB91', 1: '#FFCC80', 2: '#EF9A9A', 3: '#FFAB91' };
            npc.color = originalColors[npc.valley] || '#FFAB91';
          }
        }
      }

      for (const obj of chapter.interactables) {
        if (obj.type === 'bridge' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            obj.activated = true;
            const newBridges = chapter.interactables.filter(o => o.type === 'bridge' && o.collected).length;
            state.message = `Valley ${newBridges} connected! Trust grows.`;
            state.messageTimer = 2500;
            playSfx('complete');
          }
        }
      }

      const totalBridgesCollected = chapter.interactables.filter(o => o.type === 'bridge' && o.collected).length;
      state.objectiveProgress = Math.min(totalBridgesCollected, chapter.objectiveTarget - 1);

      const beaconBalkanize = chapter.interactables.find(o => o.type === 'beacon');
      if (beaconBalkanize && totalBridgesCollected >= chapter.objectiveTarget && !beaconBalkanize.collected) {
        if (rectOverlap(p.x, p.y, p.w, p.h, beaconBalkanize.x, beaconBalkanize.y, beaconBalkanize.w, beaconBalkanize.h)) {
          beaconBalkanize.collected = true;
          state.objectiveProgress = chapter.objectiveTarget;
          state.message = 'All valleys connected! Trust unites. Journey complete.';
          state.messageTimer = 2000;
          playSfx('complete');
        }
      }
      break;
    }

    case 'conclusion': {
      const chapter = CHAPTERS[state.currentChapter];
      if (!chapter) break;

      let lowlandsVisited = false;
      let highlandsVisited = false;
      let policyMakerMet = false;

      for (const obj of chapter.interactables) {
        if (obj.type === 'sign' && (obj.id === 'lowlands_path' || obj.id === 'highlands_path') && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x - 20, obj.y - 20, obj.w + 40, obj.h + 40)) {
            obj.collected = true;
            if (obj.id === 'lowlands_path') {
              lowlandsVisited = true;
              state.message = 'Lowlands path: AC and disease control can work.';
            } else {
              highlandsVisited = true;
              state.message = 'Highlands path: transport infrastructure can work.';
            }
            state.messageTimer = 3000;
            playSfx('collect');
          }
        }

        if (obj.type === 'ac' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            lowlandsVisited = true;
            state.message = 'AC installations restore productivity in warm lowlands.';
            state.messageTimer = 3000;
            playSfx('collect');
          }
        }

        if (obj.type === 'frost' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            lowlandsVisited = true;
            state.message = 'Disease eradication breaks the poverty trap.';
            state.messageTimer = 3000;
            playSfx('collect');
          }
        }

        if (obj.type === 'bridge' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            highlandsVisited = true;
            state.message = 'Transport infrastructure connects isolated valleys.';
            state.messageTimer = 3000;
            playSfx('collect');
          }
        }

        if (obj.type === 'tradeGoods' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            highlandsVisited = true;
            state.message = 'Trade routes bring wealth to mountain communities.';
            state.messageTimer = 3000;
            playSfx('collect');
          }
        }

        if (obj.type === 'beacon' && !obj.collected) {
          if (rectOverlap(p.x, p.y, p.w, p.h, obj.x, obj.y, obj.w, obj.h)) {
            obj.collected = true;
            policyMakerMet = true;
            state.message = 'The Policy Maker: Both paths need investment. It\'s not about blame.';
            state.messageTimer = 4000;
            playSfx('complete');
          }
        }
      }

      let pathsExplored = 0;
      if (lowlandsVisited) pathsExplored++;
      if (highlandsVisited) pathsExplored++;
      if (policyMakerMet) pathsExplored++;

      state.objectiveProgress = Math.min(pathsExplored, chapter.objectiveTarget);

      if (state.objectiveProgress >= chapter.objectiveTarget) {
        state.synthesisPath = lowlandsVisited && highlandsVisited ? 'both' : lowlandsVisited ? 'lowlands' : 'highlands';
      }
      break;
    }
  }
}

// ─── PARTICLES ────────────────────────────────────────────────────────

function updateParticles(state: GameState, chapter: Chapter, dt: number): void {
  const p = state.player;
  const spawnRate = dt / 100;

  switch (chapter.mechanicType) {
    case 'stamina':
      if (p.temperature > 28 && Math.random() < spawnRate * 1.5) {
        state.particles.push(createParticle('heat', state.camera.x + Math.random() * CANVAS_W, CANVAS_H - 80 + Math.random() * 60));
      }
      if (p.stamina < 50 && p.onGround && Math.random() < spawnRate * 2) {
        state.particles.push(createParticle('sweat', p.x + p.w / 2, p.y));
      }
      if (Math.random() < spawnRate * 0.8) {
        state.particles.push(createParticle('petal', state.camera.x + Math.random() * CANVAS_W, 50 + Math.random() * 100));
      }
      break;

    case 'humidity':
      if (p.humidity > 70 && Math.random() < spawnRate * 2) {
        state.particles.push(createParticle('bubble', state.camera.x + Math.random() * CANVAS_W, CANVAS_H - 60 + Math.random() * 40));
      }
      if (p.sweatDrops > 10 && Math.random() < spawnRate * 3) {
        const isSticky = p.humidity > 70;
        state.particles.push({
          x: p.x + p.w / 2,
          y: p.y + p.h * 0.3,
          vx: (Math.random() - 0.5) * 1.5,
          vy: isSticky ? 0.5 + Math.random() * 0.5 : -1 - Math.random(),
          life: isSticky ? 1200 : 600,
          maxLife: isSticky ? 1200 : 600,
          size: 2 + Math.random() * 2,
          color: '#64B5F6',
          type: 'sweat',
        });
      }
      if (p.humidity < 50 && Math.random() < spawnRate * 1.5) {
        state.particles.push(createParticle('leaf', state.camera.x + Math.random() * CANVAS_W, 60 + Math.random() * 80));
      }
      break;

    case 'disease':
      if (p.temperature > 20 && Math.random() < spawnRate * 1.5) {
        state.particles.push(createParticle('mosquito', state.camera.x + Math.random() * CANVAS_W, 100 + Math.random() * 300));
      }
      if (p.temperature < 10 && Math.random() < spawnRate * 2.5) {
        state.particles.push(createParticle('snow', state.camera.x + Math.random() * CANVAS_W, Math.random() * 200));
      }
      break;

    case 'altitude':
      if (p.altitude > 1500 && Math.random() < spawnRate * 2) {
        state.particles.push(createParticle('snow', state.camera.x + Math.random() * CANVAS_W, Math.random() * 200));
      }
      if (p.temperature > 28 && Math.random() < spawnRate) {
        state.particles.push(createParticle('heat', state.camera.x + Math.random() * CANVAS_W, CANVAS_H - 80));
      }
      break;

    case 'transport':
      if (Math.abs(p.vx) > 1 && p.onGround && Math.random() < spawnRate * 1.5) {
        state.particles.push(createParticle('dust', p.x, p.y + p.h - 5));
      }
      break;

    case 'balkanize':
      if (Math.random() < spawnRate * 0.8) {
        state.particles.push(createParticle('dust', state.camera.x + Math.random() * CANVAS_W, CANVAS_H - 60));
      }
      break;

    case 'conclusion':
      if (Math.random() < spawnRate * 1.5) {
        state.particles.push(createParticle('star', state.camera.x + Math.random() * CANVAS_W, Math.random() * CANVAS_H));
      }
      break;
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    if (pt.type === 'heat' || pt.type === 'bubble' || pt.type === 'snow' || pt.type === 'petal' || pt.type === 'leaf') {
      pt.vy += 0.01;
    } else if (pt.type === 'mosquito') {
      pt.vx += (Math.random() - 0.5) * 0.3;
      pt.vy += (Math.random() - 0.5) * 0.2;
    } else {
      pt.vy += 0.05;
    }
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }

  if (state.particles.length > 150) {
    state.particles.splice(0, state.particles.length - 150);
  }
}

function createParticle(type: Particle['type'], x: number, y: number): Particle {
  switch (type) {
    case 'heat':
      return { x, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.8 - Math.random() * 0.5, life: 1200, maxLife: 1200, size: 4 + Math.random() * 4, color: '#FF8A65', type };
    case 'sweat':
      return { x, y, vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), life: 600, maxLife: 600, size: 2 + Math.random() * 2, color: '#64B5F6', type };
    case 'mosquito':
      return { x, y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1, life: 2500, maxLife: 2500, size: 3, color: '#333', type };
    case 'snow':
      return { x, y, vx: (Math.random() - 0.5) * 0.4, vy: 0.4 + Math.random() * 0.6, life: 3500, maxLife: 3500, size: 2 + Math.random() * 3, color: '#E3F2FD', type };
    case 'mold':
      return { x, y, vx: 0, vy: -0.2, life: 2000, maxLife: 2000, size: 3 + Math.random() * 5, color: '#558B2F', type };
    case 'sparkle':
    case 'star':
      return { x, y, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, life: 1200, maxLife: 1200, size: 2 + Math.random() * 3, color: '#FFD700', type };
    case 'dust':
      return { x, y, vx: -Math.random() * 1.5, vy: -Math.random() * 0.8, life: 500, maxLife: 500, size: 2 + Math.random() * 2, color: '#D7CCC8', type };
    case 'leaf':
      return { x, y, vx: (Math.random() - 0.5) * 0.8, vy: 0.2 + Math.random() * 0.4, life: 3000, maxLife: 3000, size: 3 + Math.random() * 3, color: '#81C784', type };
    case 'petal':
      return { x, y, vx: (Math.random() - 0.5) * 0.6, vy: 0.15 + Math.random() * 0.3, life: 4000, maxLife: 4000, size: 3 + Math.random() * 2, color: '#FF6B9D', type };
    case 'bubble':
      return { x, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.3 - Math.random() * 0.4, life: 1500, maxLife: 1500, size: 3 + Math.random() * 4, color: 'rgba(200,230,255,0.4)', type };
  }
}

// ─── INTERACTION ──────────────────────────────────────────────────────

function updateInteractPrompt(state: GameState, chapter: Chapter): void {
  const p = state.player;
  state.interactPrompt = null;

  for (const npc of chapter.npcs) {
    if (rectOverlap(p.x, p.y, p.w, p.h, npc.x - 30, npc.y - 30, npc.w + 60, npc.h + 60)) {
      state.interactPrompt = { x: npc.x + npc.w / 2, y: npc.y - 20, label: `Talk to ${npc.name}` };
      return;
    }
  }

  for (const obj of chapter.interactables) {
    if (obj.type === 'observation' && !obj.collected) {
      if (rectOverlap(p.x, p.y, p.w, p.h, obj.x - 20, obj.y - 20, obj.w + 40, obj.h + 40)) {
        state.interactPrompt = { x: obj.x + obj.w / 2, y: obj.y - 20, label: `Examine ${obj.label}` };
        return;
      }
    }
    if (obj.type === 'sign' && !obj.collected) {
      if (rectOverlap(p.x, p.y, p.w, p.h, obj.x - 20, obj.y - 20, obj.w + 40, obj.h + 40)) {
        state.interactPrompt = { x: obj.x + obj.w / 2, y: obj.y - 20, label: obj.label || 'Read' };
        return;
      }
    }
  }
}

export function tryInteract(state: GameState): void {
  if (state.phase !== 'playing') return;
  const chapter = CHAPTERS[state.currentChapter];
  if (!chapter) return;
  const p = state.player;

  for (const npc of chapter.npcs) {
    if (rectOverlap(p.x, p.y, p.w, p.h, npc.x - 30, npc.y - 30, npc.w + 60, npc.h + 60)) {
      state.dialogue = {
        name: npc.name,
        lines: npc.lines,
        lineIndex: 0,
        viewpoint: npc.viewpoint,
      };
      if (!p.interactedNPCs.includes(npc.id)) {
        p.interactedNPCs.push(npc.id);
      }
      playSfx('interact');
      return;
    }
  }

  for (const obj of chapter.interactables) {
    if (obj.type === 'observation' && !obj.collected) {
      if (rectOverlap(p.x, p.y, p.w, p.h, obj.x - 20, obj.y - 20, obj.w + 40, obj.h + 40)) {
        obj.collected = true;
        const entry: JournalEntry = {
          id: obj.journalEntryId || obj.id,
          chapterId: chapter.id,
          title: obj.title || obj.label || 'Observation',
          fact: obj.fact || '',
          icon: obj.icon || '📝',
          discoveredAt: Date.now(),
        };
        if (!state.journalEntries.find(j => j.id === entry.id)) {
          state.journalEntries.push(entry);
        }
        state.observationPopup = { title: entry.title, fact: entry.fact, icon: entry.icon };
        state.observationPopupTimer = 4000;
        playSfx('collect');
        return;
      }
    }

    if (chapter.mechanicType === 'conclusion' && obj.type === 'sign' && (obj.id === 'choice_lowlands' || obj.id === 'choice_highlands')) {
      if (rectOverlap(p.x, p.y, p.w, p.h, obj.x - 20, obj.y - 20, obj.w + 40, obj.h + 40) && !obj.collected) {
        obj.collected = true;
        p.finalChoice = obj.id === 'choice_lowlands' ? 'lowlands' : 'highlands';
        state.objectiveProgress = chapter.objectiveTarget;
        if (obj.id === 'choice_lowlands') {
          state.message = 'You chose the lowlands: AC and disease eradication.';
        } else {
          state.message = 'You chose the highlands: invest in transport.';
        }
        state.messageTimer = 3000;
        playSfx('complete');
        return;
      }
    }

    if (obj.type === 'sign' && !obj.collected && obj.id !== 'sort_board' && obj.id !== 'choice_lowlands' && obj.id !== 'choice_highlands' && obj.id !== 'lowlands_path' && obj.id !== 'highlands_path') {
      if (rectOverlap(p.x, p.y, p.w, p.h, obj.x - 20, obj.y - 20, obj.w + 40, obj.h + 40)) {
        state.dialogue = {
          name: obj.label || 'Sign',
          lines: [obj.label || ''],
          lineIndex: 0,
        };
        playSfx('interact');
        return;
      }
    }
  }
}

export function advanceDialogue(state: GameState): void {
  if (!state.dialogue) return;
  state.dialogue.lineIndex++;
  if (state.dialogue.lineIndex >= state.dialogue.lines.length) {
    state.dialogue = null;
  } else {
    playSfx('dialogue');
  }
}

export function checkChapterComplete(state: GameState): boolean {
  const chapter = CHAPTERS[state.currentChapter];
  if (!chapter) return false;
  return state.objectiveProgress >= chapter.objectiveTarget;
}

export function startChapterMusic(chapter: Chapter): void {
  const mood = MUSIC_MOODS[chapter.mechanicType] || 'warm';
  startMusic(mood);
}

export function stopChapterMusic(): void {
  stopMusic();
}

// ─── BALLOONS ─────────────────────────────────────────────────────────

const BALLOON_COLORS = ['#EF5350', '#42A5F5', '#66BB6A', '#AB47BC', '#FFB74D', '#26C6DA', '#FF8A65', '#9CCC65'];

export function addBalloon(state: GameState, chapterNum: number): void {
  const idx = state.balloons.length;
  state.balloons.push({
    chapterNum,
    offsetX: -18 - idx * 20,
    offsetY: -38,
    color: BALLOON_COLORS[(chapterNum - 1) % BALLOON_COLORS.length],
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 1.2 + Math.random() * 0.5,
  });
}

export function updateBalloons(state: GameState, dt: number): void {
  const dts = dt / 1000;

  for (const b of state.balloons) {
    // Gentle sway only — balloons stay behind player, no drift
    b.sway += b.swaySpeed * dts;
  }
}
