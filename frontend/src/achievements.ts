import type {
  BadgeDefinition,
  BadgeProgress,
  LevelRecord,
  AchievementStore
} from './types';

const STORAGE_KEY = 'starmyth_achievements_v2';
const TOTAL_LEVELS = 3;
const FAST_COMPLETE_THRESHOLD = 45;

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_clear',
    name: '初入星界',
    icon: '🌟',
    description: '首次完成任意一关星座连线',
    rarity: 'common',
    hint: '完成第一关即可解锁'
  },
  {
    id: 'flawless_clear',
    name: '完美星图',
    icon: '💎',
    description: '无任何错误连线完成一关',
    rarity: 'rare',
    hint: '挑战自己，不要连错任何一条星脉'
  },
  {
    id: 'no_hint_clear',
    name: '星之直觉',
    icon: '👁️',
    description: '不使用"显示频率"功能完成一关',
    rarity: 'rare',
    hint: '依靠观察星星闪烁的节奏来判断频率关系'
  },
  {
    id: 'all_clear',
    name: '神话收藏家',
    icon: '👑',
    description: '完成全部三个星座',
    rarity: 'epic',
    hint: '苍龙、朱雀、麒麟，三关全部通关'
  },
  {
    id: 'speed_runner',
    name: '闪电连线',
    icon: '⚡',
    description: `单关用时不超过${FAST_COMPLETE_THRESHOLD}秒`,
    rarity: 'epic',
    hint: '快速完成，证明你对频率关系的敏感度'
  },
  {
    id: 'all_flawless',
    name: '星界大师',
    icon: '🏆',
    description: '三关全部完美无错误通关',
    rarity: 'legendary',
    hint: '最高荣誉，零失误全通三关'
  },
  {
    id: 'all_no_hint',
    name: '心灵之眼',
    icon: '🔮',
    description: '三关全部不使用显示频率功能通关',
    rarity: 'legendary',
    hint: '纯粹依靠直觉和观察力，征服所有星座'
  },
  {
    id: 'triple_crown',
    name: '星河至高',
    icon: '🌈',
    description: '三关全部完美、无提示、且每关都在时间内完成',
    rarity: 'legendary',
    hint: '终极挑战：完美+直觉+速度 = 星河至高'
  }
];

export function getBadgeDefinitions(): BadgeDefinition[] {
  return BADGE_DEFINITIONS;
}

function createDefaultLevelRecord(): LevelRecord {
  return {
    completed: false,
    timeSpent: 0,
    errorCount: 0,
    usedHint: false,
    bestTime: undefined,
    minErrorCount: undefined,
    everNoHint: false,
    everFast: false
  };
}

function createDefaultStore(): AchievementStore {
  const badges: Record<string, BadgeProgress> = {};
  for (const def of BADGE_DEFINITIONS) {
    badges[def.id] = { unlocked: false };
  }
  const levels: Record<number, LevelRecord> = {};
  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    levels[i] = createDefaultLevelRecord();
  }
  return {
    badges,
    levels,
    totalCompleted: 0
  };
}

function migrateLevelRecord(rec: Partial<LevelRecord> & { completed: boolean }): LevelRecord {
  const base: LevelRecord = {
    completed: rec.completed ?? false,
    completedAt: rec.completedAt,
    timeSpent: rec.timeSpent ?? 0,
    errorCount: rec.errorCount ?? 0,
    usedHint: rec.usedHint ?? false,
    bestTime: rec.bestTime,
    minErrorCount: rec.minErrorCount,
    everNoHint: rec.everNoHint,
    everFast: rec.everFast
  };

  if (base.completed) {
    if (base.bestTime === undefined) {
      base.bestTime = base.timeSpent;
    }
    if (base.minErrorCount === undefined) {
      base.minErrorCount = base.errorCount;
    }
    if (base.everNoHint === undefined) {
      base.everNoHint = !base.usedHint;
    }
    if (base.everFast === undefined) {
      base.everFast = base.bestTime <= FAST_COMPLETE_THRESHOLD;
    }
  }

  return base;
}

export function loadAchievements(): AchievementStore {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as AchievementStore;
      return normalizeStore(parsed);
    }

    const rawV1 = localStorage.getItem('starmyth_achievements_v1');
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1) as {
        badges?: Record<string, BadgeProgress>;
        levels?: Record<number, Partial<LevelRecord> & { completed: boolean }>;
        totalCompleted?: number;
        firstPlayedAt?: number;
      };
      const migrated = migrateFromV1(parsedV1);
      saveAchievements(migrated);
      try {
        localStorage.removeItem('starmyth_achievements_v1');
      } catch {
        // ignore
      }
      return migrated;
    }

    return createDefaultStore();
  } catch (e) {
    console.warn('加载成就数据失败，使用默认值:', e);
    return createDefaultStore();
  }
}

function migrateFromV1(v1: {
  badges?: Record<string, BadgeProgress>;
  levels?: Record<number, Partial<LevelRecord> & { completed: boolean }>;
  totalCompleted?: number;
  firstPlayedAt?: number;
}): AchievementStore {
  const store = createDefaultStore();

  if (v1.badges) {
    for (const def of BADGE_DEFINITIONS) {
      if (v1.badges[def.id]) {
        store.badges[def.id] = { ...store.badges[def.id], ...v1.badges[def.id] };
      }
    }
  }

  if (v1.levels) {
    let completedCount = 0;
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
      const raw = v1.levels[i];
      if (raw) {
        store.levels[i] = migrateLevelRecord(raw);
        if (store.levels[i].completed) completedCount++;
      }
    }
    if (v1.totalCompleted !== undefined) {
      store.totalCompleted = v1.totalCompleted;
    } else {
      store.totalCompleted = completedCount;
    }
  }

  if (v1.firstPlayedAt) {
    store.firstPlayedAt = v1.firstPlayedAt;
  }

  return store;
}

function normalizeStore(parsed: AchievementStore): AchievementStore {
  const defaults = createDefaultStore();

  if (!parsed.badges || typeof parsed.badges !== 'object') {
    parsed.badges = defaults.badges;
  } else {
    for (const def of BADGE_DEFINITIONS) {
      if (!parsed.badges[def.id]) {
        parsed.badges[def.id] = defaults.badges[def.id];
      }
    }
  }

  if (!parsed.levels || typeof parsed.levels !== 'object') {
    parsed.levels = defaults.levels;
  } else {
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
      const raw = parsed.levels[i];
      if (raw && raw.completed) {
        parsed.levels[i] = migrateLevelRecord(raw);
      } else if (!raw) {
        parsed.levels[i] = defaults.levels[i];
      }
    }
  }

  if (typeof parsed.totalCompleted !== 'number') {
    parsed.totalCompleted = 0;
  }

  return parsed as AchievementStore;
}

export function saveAchievements(store: AchievementStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('保存成就数据失败:', e);
  }
}

export function resetAchievements(): AchievementStore {
  const store = createDefaultStore();
  saveAchievements(store);
  return store;
}

function unlockBadge(store: AchievementStore, badgeId: string): boolean {
  if (store.badges[badgeId] && !store.badges[badgeId].unlocked) {
    store.badges[badgeId].unlocked = true;
    store.badges[badgeId].unlockedAt = Date.now();
    return true;
  }
  return false;
}

export interface LevelCompleteResult {
  newUnlocks: string[];
  store: AchievementStore;
}

function mergeBestRecord(prev: LevelRecord, current: { timeSpent: number; errorCount: number; usedHint: boolean }): LevelRecord {
  const merged: LevelRecord = {
    ...prev,
    completed: true,
    completedAt: Date.now(),
    timeSpent: current.timeSpent,
    errorCount: current.errorCount,
    usedHint: current.usedHint,
    bestTime: prev.bestTime !== undefined
      ? Math.min(prev.bestTime, current.timeSpent)
      : current.timeSpent,
    minErrorCount: prev.minErrorCount !== undefined
      ? Math.min(prev.minErrorCount, current.errorCount)
      : current.errorCount,
    everNoHint: prev.everNoHint || !current.usedHint,
    everFast: prev.everFast || current.timeSpent <= FAST_COMPLETE_THRESHOLD
  };
  return merged;
}

export function processLevelComplete(
  store: AchievementStore,
  levelId: number,
  stats: { timeSpent: number; errorCount: number; usedHint: boolean }
): LevelCompleteResult {
  if (!store.firstPlayedAt) {
    store.firstPlayedAt = Date.now();
  }

  const prevRecord = store.levels[levelId] || createDefaultLevelRecord();
  const isFirstClearThisLevel = !prevRecord.completed;

  if (isFirstClearThisLevel) {
    store.totalCompleted++;
  }

  store.levels[levelId] = mergeBestRecord(prevRecord, stats);

  const newUnlocks: string[] = [];

  if (store.totalCompleted >= 1) {
    if (unlockBadge(store, 'first_clear')) newUnlocks.push('first_clear');
  }

  if (stats.errorCount === 0) {
    if (unlockBadge(store, 'flawless_clear')) newUnlocks.push('flawless_clear');
  }

  if (!stats.usedHint) {
    if (unlockBadge(store, 'no_hint_clear')) newUnlocks.push('no_hint_clear');
  }

  if (stats.timeSpent <= FAST_COMPLETE_THRESHOLD) {
    if (unlockBadge(store, 'speed_runner')) newUnlocks.push('speed_runner');
  }

  let allCompleted = true;
  let allFlawlessBest = true;
  let allNoHintEver = true;
  let allFastEver = true;

  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const rec = store.levels[i];
    if (!rec || !rec.completed) {
      allCompleted = false;
      allFlawlessBest = false;
      allNoHintEver = false;
      allFastEver = false;
      break;
    }
    if ((rec.minErrorCount ?? rec.errorCount) > 0) allFlawlessBest = false;
    if (!rec.everNoHint) allNoHintEver = false;
    if (!rec.everFast) allFastEver = false;
  }

  if (allCompleted) {
    if (unlockBadge(store, 'all_clear')) newUnlocks.push('all_clear');
  }
  if (allFlawlessBest) {
    if (unlockBadge(store, 'all_flawless')) newUnlocks.push('all_flawless');
  }
  if (allNoHintEver) {
    if (unlockBadge(store, 'all_no_hint')) newUnlocks.push('all_no_hint');
  }
  if (allFlawlessBest && allNoHintEver && allFastEver) {
    if (unlockBadge(store, 'triple_crown')) newUnlocks.push('triple_crown');
  }

  saveAchievements(store);

  return { newUnlocks, store };
}

export function getBadgeDefinition(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.id === id);
}

export function getUnlockedCount(store: AchievementStore): number {
  return Object.values(store.badges).filter(b => b.unlocked).length;
}

export function getTotalBadges(): number {
  return BADGE_DEFINITIONS.length;
}

export function getLevelRecord(store: AchievementStore, levelId: number): LevelRecord {
  return store.levels[levelId] || createDefaultLevelRecord();
}
