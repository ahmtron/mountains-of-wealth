export type GamePhase = 'title' | 'customize' | 'map' | 'playing' | 'paused' | 'chapterComplete' | 'gameComplete';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'ground' | 'platform' | 'wall' | 'slope';
  color?: string;
}

export interface InteractiveObject {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'ac' | 'frost' | 'token' | 'evidence' | 'bridge' | 'tradeGoods' | 'sign' | 'shadedSpot' | 'dryZone' | 'beacon' | 'flower' | 'collectible' | 'observation' | 'mosquito';
  collected?: boolean;
  activated?: boolean;
  label?: string;
  data?: string;
  journalEntryId?: string;
  title?: string;
  fact?: string;
  icon?: string;
}

export interface JournalEntry {
  id: string;
  chapterId: number;
  title: string;
  fact: string;
  icon: string;
  discoveredAt?: number;
}

export interface ObservationPoint extends InteractiveObject {
  type: 'observation';
  journalEntryId: string;
  title: string;
  fact: string;
  icon: string;
}

export interface NPC {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  color: string;
  lines: string[];
  viewpoint?: 'established' | 'debated' | 'author';
  icon?: string;
  valley?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'heat' | 'sweat' | 'mosquito' | 'snow' | 'mold' | 'sparkle' | 'dust' | 'leaf' | 'petal' | 'bubble' | 'star';
}

export interface CloudShape {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  puffs: { dx: number; dy: number; r: number }[];
}

export interface Decoration {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'tree' | 'bush' | 'flower' | 'grass' | 'rock' | 'lantern' | 'fence' | 'pond' | 'cactus' | 'snowman' | 'bench' | 'crate' | 'market' | 'temple' | 'hut' | 'signpost' | 'mushroom' | 'crystal' | 'building';
  color?: string;
  variant?: number;
}

export interface BackgroundElement {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'mountain' | 'tree' | 'building' | 'hill' | 'rock' | 'vegetation';
  color: string;
  layer: number;
}

export interface Chapter {
  id: number;
  title: string;
  subtitle: string;
  concept: string;
  width: number;
  groundY: number;
  skyTop: string;
  skyBottom: string;
  ambientColor: string;
  platforms: Platform[];
  interactables: InteractiveObject[];
  npcs: NPC[];
  decorations: Decoration[];
  backgroundElements: BackgroundElement[];
  clouds: CloudShape[];
  objectiveText: string;
  objectiveTarget: number;
  mechanicType: 'stamina' | 'humidity' | 'disease' | 'debate' | 'altitude' | 'transport' | 'balkanize' | 'conclusion';
  introText: string[];
  outroText: string[];
  startTemp?: number;
  endTemp?: number;
  startHumidity?: number;
}

export interface PlayerAppearance {
  name: string;
  skinTone: string;
  bodyColor: string;
  hatColor: string;
}

export interface GameProgress {
  completedLevels: number[];
  totalStars: number;
  totalFacts: number;
  balloons: any[];
  journalEntries: JournalEntry[];
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  facing: 1 | -1;
  animFrame: number;
  animTimer: number;
  state: 'idle' | 'walk' | 'jump' | 'interact' | 'turn';
  stamina: number;
  maxStamina: number;
  temperature: number;
  humidity: number;
  altitude: number;
  collected: string[];
  interactedNPCs: string[];
  sortedEvidence?: { established: string[]; weak: string[]; flawed: string[]; counterexample: string[] };
  evidenceInventory?: { id: string; label: string; correctCategory: string }[];
  bridgesBuilt?: string[];
  goodsDelivered?: { flat: number; mountain: number };
  valleyTrust?: number[];
  finalChoice?: 'lowlands' | 'highlands';
  productivity: number;
  moveSpeedMultiplier: number;
  infectionTimer: number;
  infectionMaxTimer: number;
  sweatDrops: number;
  deliveryTimer: number;
  deliveryCost: number;
  appearance: PlayerAppearance;
  turnTimer: number;
  squashScale: number;
  blinkTimer: number;
  blinking: boolean;
}

export interface Balloon {
  chapterNum: number;
  offsetX: number;
  offsetY: number;
  color: string;
  sway: number;
  swaySpeed: number;
}

export interface GameState {
  phase: GamePhase;
  currentChapter: number;
  player: PlayerState;
  camera: Vec2;
  particles: Particle[];
  objectiveProgress: number;
  dialogue: { name: string; lines: string[]; lineIndex: number; viewpoint?: string } | null;
  showObjective: boolean;
  transitionAlpha: number;
  chapterStartTime: number;
  message: string | null;
  messageTimer: number;
  keys: Record<string, boolean>;
  interactPrompt: { x: number; y: number; label: string } | null;
  temperatureDisplay: number;
  humidityDisplay: number;
  altitudeDisplay: number;
  showStats: boolean;
  statType: string;
  audioEnabled: boolean;
  hintTimer: number;
  hintShown: boolean;
  balloons: Balloon[];
  journalEntries: JournalEntry[];
  showJournal: boolean;
  observationPopup: { title: string; fact: string; icon: string } | null;
  observationPopupTimer: number;
  debateSorting: boolean;
  debateSortIndex: number;
  debateCorrectSorts: number;
  showCausalChain: boolean;
  causalChainIndex: number;
  dramaticReveal: boolean;
  dramaticRevealTimer: number;
  synthesisPath: 'lowlands' | 'highlands' | 'both' | null;
}
