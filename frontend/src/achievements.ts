import type {
  BadgeDefinition,
  BadgeProgress,
  LevelRecord,
  AchievementStore
} from './types';

const STORAGE_KEY = 'starmyth_achievements_v1';
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

function createDefaultStore(): AchievementStore {
  const badges: Record<string, BadgeProgress> = {};
  for (const def of BADGE_DEFINITIONS) {
    badges[def.id] = { unlocked: false };
  }
  const levels: Record<number, LevelRecord> = {};
  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    levels[i] = {
      completed: false,
      timeSpent: 0,
      errorCount: 0,
      usedHint: false
    };
  }
  return {
    badges,
    levels,
    totalCompleted: 0
  };
}

export function loadAchievements(): AchievementStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultStore();
    const parsed = JSON.parse(raw) as AchievementStore;
    const defaults = createDefaultStore();
    for (const def of BADGE_DEFINITIONS) {
      if (!parsed.badges[def.id]) {
        parsed.badges[def.id] = defaults.badges[def.id];
      }
    }
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
      if (!parsed.levels[i]) {
        parsed.levels[i] = defaults.levels[i];
      }
    }
    if (typeof parsed.totalCompleted !== 'number') {
      parsed.totalCompleted = 0;
    }
    return parsed;
  } catch {
    return createDefaultStore();
  }
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

export function processLevelComplete(
  store: AchievementStore,
  levelId: number,
  stats: { timeSpent: number; errorCount: number; usedHint: boolean }
): LevelCompleteResult {
  if (!store.firstPlayedAt) {
    store.firstPlayedAt = Date.now();
  }

  const prevRecord = store.levels[levelId] || {
    completed: false,
    timeSpent: 0,
    errorCount: 0,
    usedHint: false
  };

  const isFirstClearThisLevel = !prevRecord.completed;
  if (isFirstClearThisLevel) {
    store.totalCompleted++;
  }

  const newRecord: LevelRecord = {
    completed: true,
    completedAt: Date.now(),
    timeSpent: stats.timeSpent,
    errorCount: stats.errorCount,
    usedHint: stats.usedHint,
    bestTime: prevRecord.bestTime
      ? Math.min(prevRecord.bestTime, stats.timeSpent)
      : stats.timeSpent
  };
  store.levels[levelId] = newRecord;

  const newUnlocks: string[] = [];

  const isFirstClear = store.totalCompleted === 1 && isFirstClearThisLevel;
  if (isFirstClear) {
    if (unlockBadge(store, 'first_clear')) newUnlocks.push('first_clear');
  } else if (store.totalCompleted >= 1) {
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
  let allFlawless = true;
  let allNoHint = true;
  let allFast = true;

  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const rec = store.levels[i];
    if (!rec || !rec.completed) {
      allCompleted = false;
      allFlawless = false;
      allNoHint = false;
      allFast = false;
      break;
    }
    if (rec.errorCount > 0) allFlawless = false;
    if (rec.usedHint) allNoHint = false;
    if ((rec.bestTime ?? rec.timeSpent) > FAST_COMPLETE_THRESHOLD) allFast = false;
  }

  if (allCompleted) {
    if (unlockBadge(store, 'all_clear')) newUnlocks.push('all_clear');
  }
  if (allFlawless) {
    if (unlockBadge(store, 'all_flawless')) newUnlocks.push('all_flawless');
  }
  if (allNoHint) {
    if (unlockBadge(store, 'all_no_hint')) newUnlocks.push('all_no_hint');
  }
  if (allFlawless && allNoHint && allFast) {
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
