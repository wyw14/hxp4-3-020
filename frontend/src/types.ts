export interface AnchorPoint {
  id: string;
  x: number;
  y: number;
  frequency: number;
  name?: string;
  baseBrightness?: number;
  size?: number;
}

export interface ConstellationEdge {
  from: string;
  to: string;
  frequencyRatio: [number, number];
}

export interface LevelData {
  id: number;
  name: string;
  creatureName: string;
  creatureDescription: string;
  anchorPoints: AnchorPoint[];
  edges: ConstellationEdge[];
  lightPollution: {
    baseIntensity: number;
    variability: number;
    speed: number;
  };
  rotationSpeed: number;
}

export interface BackgroundStar {
  x: number;
  y: number;
  z: number;
  size: number;
  baseBrightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  color: string;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface CurvePoint extends ScreenPoint {
  t?: number;
}

export interface Connection {
  from: string;
  to: string;
  curve: CurvePoint[];
  valid: boolean;
  opacity: number;
  glowIntensity: number;
}

export interface DrawState {
  isDrawing: boolean;
  startAnchorId: string | null;
  currentPos: ScreenPoint | null;
  points: CurvePoint[];
  lastSampleTime: number;
}

export interface GameState {
  currentLevel: number;
  levelData: LevelData | null;
  connections: Connection[];
  completedEdges: Set<string>;
  drawState: DrawState;
  rotationOffset: number;
  time: number;
  showFrequencies: boolean;
  isComplete: boolean;
  snapTargetId: string | null;
}

export interface VerifyResult {
  success: boolean;
  valid: boolean;
  isHarmonic: boolean;
  isDefinedEdge: boolean;
  frequencies?: Record<string, number>;
  ratio?: [number, number] | null;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  hint: string;
}

export interface BadgeProgress {
  unlocked: boolean;
  unlockedAt?: number;
  progress?: number;
  total?: number;
  levelRecords?: Record<number, LevelRecord>;
}

export interface LevelRecord {
  completed: boolean;
  completedAt?: number;
  timeSpent: number;
  errorCount: number;
  usedHint: boolean;
  bestTime?: number;
  minErrorCount?: number;
  everNoHint?: boolean;
  everFast?: boolean;
}

export interface AchievementStore {
  badges: Record<string, BadgeProgress>;
  levels: Record<number, LevelRecord>;
  totalCompleted: number;
  firstPlayedAt?: number;
}
