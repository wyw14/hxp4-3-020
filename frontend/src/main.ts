import { Game } from './game';
import type { LevelCompleteStats } from './game';
import type { LevelData } from './types';
import { healthCheck } from './api';
import {
  BADGE_DEFINITIONS,
  loadAchievements,
  saveAchievements,
  resetAchievements,
  processLevelComplete,
  getBadgeDefinition,
  getUnlockedCount,
  getTotalBadges
} from './achievements';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const game = new Game(canvas);

const levelNumEl = document.getElementById('level-num')!;
const creatureNameEl = document.getElementById('creature-name')!;
const connectedCountEl = document.getElementById('connected-count')!;
const totalCountEl = document.getElementById('total-count')!;
const progressFillEl = document.getElementById('progress-fill')!;
const hintTitleEl = document.getElementById('hint-title')!;
const hintTextEl = document.getElementById('hint-text')!;
const completeModal = document.getElementById('complete-modal')!;
const modalTitleEl = document.getElementById('modal-title')!;
const modalDescEl = document.getElementById('modal-desc')!;
const statTimeEl = document.getElementById('stat-time')!;
const statErrorsEl = document.getElementById('stat-errors')!;
const statHintEl = document.getElementById('stat-hint')!;

const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnHint = document.getElementById('btn-hint') as HTMLButtonElement;
const btnNext = document.getElementById('btn-next') as HTMLButtonElement;

const btnAchievements = document.getElementById('btn-achievements') as HTMLButtonElement;
const badgeCountEl = document.getElementById('badge-count')!;
const achievementWall = document.getElementById('achievement-wall')!;
const btnCloseWall = document.getElementById('btn-close-wall')!;
const btnResetAchievements = document.getElementById('btn-reset-achievements') as HTMLButtonElement;
const badgeGrid = document.getElementById('badge-grid')!;
const recordsGrid = document.getElementById('records-grid')!;
const wallProgressText = document.getElementById('wall-progress-text')!;
const wallProgressFill = document.getElementById('wall-progress-fill')!;

const LEVEL_NAMES: Record<number, string> = {
  1: '苍穹神龙',
  2: '涅槃凤凰',
  3: '祥瑞麒麟'
};
const MAX_LEVELS = 3;

let achievementStore = loadAchievements();
let toastQueue: string[] = [];
let toastShowing = false;

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}m${s}s`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function updateBadgeCount(): void {
  const unlocked = getUnlockedCount(achievementStore);
  const total = getTotalBadges();
  badgeCountEl.textContent = `${unlocked}/${total}`;
}

function renderAchievementWall(): void {
  const unlocked = getUnlockedCount(achievementStore);
  const total = getTotalBadges();
  const pct = total > 0 ? (unlocked / total) * 100 : 0;

  wallProgressText.textContent = `已解锁 ${unlocked} / ${total} 个成就`;
  wallProgressFill.style.width = `${pct}%`;

  badgeGrid.innerHTML = '';
  for (const def of BADGE_DEFINITIONS) {
    const progress = achievementStore.badges[def.id] || { unlocked: false };
    const rarityLabel: Record<string, string> = {
      common: '普通',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说'
    };
    const card = document.createElement('div');
    card.className = `badge-card rarity-${def.rarity} ${progress.unlocked ? 'unlocked' : 'locked'}`;

    let unlockInfo = '';
    if (progress.unlocked && progress.unlockedAt) {
      unlockInfo = `<div class="badge-unlock-date">🗓 解锁于 ${formatDate(progress.unlockedAt)}</div>`;
    }

    card.innerHTML = `
      <div class="badge-rarity ${def.rarity}">${rarityLabel[def.rarity] || def.rarity}</div>
      <div class="badge-icon">${def.icon}</div>
      <div class="badge-name">${progress.unlocked ? def.name : '???'}</div>
      <div class="badge-desc">${def.description}</div>
      <div class="badge-hint">💡 ${def.hint}</div>
      ${unlockInfo}
    `;
    badgeGrid.appendChild(card);
  }

  recordsGrid.innerHTML = '';
  for (let i = 1; i <= MAX_LEVELS; i++) {
    const rec = achievementStore.levels[i];
    const card = document.createElement('div');
    card.className = `record-card ${rec?.completed ? 'completed' : ''}`;

    if (rec?.completed) {
      const bestTime = rec.bestTime ?? rec.timeSpent;
      const minErrors = rec.minErrorCount ?? rec.errorCount;
      const everNoHint = rec.everNoHint ?? !rec.usedHint;
      const everFast = rec.everFast ?? bestTime <= 45;
      card.innerHTML = `
        <div class="record-level-name">${LEVEL_NAMES[i] || `关卡 ${i}`}</div>
        <div class="record-status completed">✅ 已完成</div>
        <div class="record-detail">
          🏆 最佳用时: ${formatTime(bestTime)}<br>
          💎 最少错误: ${minErrors}次<br>
          ${everNoHint ? '👁️ 曾无提示通关' : '📊 尚未无提示通关'}<br>
          ${everFast ? '⚡ 曾快速通关' : '⏱️ 尚未快速通关'}
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="record-level-name">${LEVEL_NAMES[i] || `关卡 ${i}`}</div>
        <div class="record-status">🔒 未完成</div>
        <div class="record-detail" style="color:#555;">
          等待你的挑战...
        </div>
      `;
    }
    recordsGrid.appendChild(card);
  }
}

function showToast(badgeId: string): void {
  const def = getBadgeDefinition(badgeId);
  if (!def) return;

  toastQueue.push(badgeId);
  if (toastShowing) return;
  processToastQueue();
}

function processToastQueue(): void {
  if (toastQueue.length === 0) {
    toastShowing = false;
    return;
  }
  toastShowing = true;

  const badgeId = toastQueue.shift()!;
  const def = getBadgeDefinition(badgeId)!;

  let toast = document.querySelector('.new-badge-toast') as HTMLElement | null;
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'new-badge-toast';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <div class="toast-icon">${def.icon}</div>
    <div class="toast-content">
      <div class="toast-label">🎉 新成就解锁</div>
      <div class="toast-name">${def.name}</div>
      <div class="toast-desc">${def.description}</div>
    </div>
  `;

  requestAnimationFrame(() => {
    toast!.classList.add('show');
  });

  setTimeout(() => {
    toast!.classList.remove('show');
    setTimeout(() => processToastQueue(), 600);
  }, 3500);
}

function openAchievementWall(): void {
  renderAchievementWall();
  achievementWall.classList.add('show');
}

function closeAchievementWall(): void {
  achievementWall.classList.remove('show');
}

updateBadgeCount();

game.setCallbacks({
  onLevelChange: (level: LevelData) => {
    levelNumEl.textContent = String(level.id);
    creatureNameEl.textContent = level.creatureName;
    totalCountEl.textContent = String(level.edges.length);
    connectedCountEl.textContent = '0';
    progressFillEl.style.width = '0%';
    completeModal.classList.remove('show');

    hintTitleEl.textContent = `关卡 ${level.id}: ${level.name}`;
    hintTextEl.textContent = '寻找闪烁频率成倍数关系的恒星，从一颗星拖动到另一颗星连接它们';
  },
  onProgressChange: (current: number, total: number) => {
    connectedCountEl.textContent = String(current);
    const pct = total > 0 ? (current / total) * 100 : 0;
    progressFillEl.style.width = `${pct}%`;

    if (current < total) {
      if (current === 0) {
        hintTitleEl.textContent = '观察星空';
        hintTextEl.textContent = '仔细观察星星的闪烁节奏，找到频率相同或成倍数的恒星';
      } else if (current < total * 0.3) {
        hintTitleEl.textContent = '初见端倪';
        hintTextEl.textContent = '做得好！继续寻找，你会发现恒星间的谐波共振关系';
      } else if (current < total * 0.6) {
        hintTitleEl.textContent = '星脉初现';
        hintTextEl.textContent = '神话生物的轮廓正在浮现，耐心连接剩余的星脉';
      } else if (current < total) {
        hintTitleEl.textContent = '即将完成';
        hintTextEl.textContent = '只剩最后几颗星了！神话生物即将显现';
      }
    }
  },
  onComplete: (desc: string, stats: LevelCompleteStats) => {
    const levelId = game.getCurrentLevel();
    const result = processLevelComplete(achievementStore, levelId, {
      timeSpent: stats.timeSpent,
      errorCount: stats.errorCount,
      usedHint: stats.usedHint
    });
    achievementStore = result.store;
    saveAchievements(achievementStore);
    updateBadgeCount();

    for (const badgeId of result.newUnlocks) {
      showToast(badgeId);
    }

    hintTitleEl.textContent = '✨ 星座完成 ✨';
    hintTextEl.textContent = '星界神话生物已显现！仔细欣赏它的光辉吧';

    statTimeEl.textContent = formatTime(stats.timeSpent);
    statErrorsEl.textContent = String(stats.errorCount);
    statHintEl.textContent = stats.usedHint ? '是' : '否';
    statErrorsEl.style.color = stats.errorCount === 0 ? '#5fd35f' : '#ff6b6b';
    statHintEl.style.color = stats.usedHint ? '#ff6b6b' : '#5fd35f';

    modalTitleEl.textContent = `✨ ${creatureNameEl.textContent} 降临 ✨`;
    modalDescEl.textContent = desc;
    completeModal.classList.add('show');

    if (game.getCurrentLevel() >= MAX_LEVELS) {
      btnNext.textContent = '重新开始';
    } else {
      btnNext.textContent = '下一关';
    }
  }
});

btnUndo.addEventListener('click', () => {
  game.undoLastConnection();
});

btnReset.addEventListener('click', () => {
  if (confirm('确定要重置本关吗？所有连线将被清除，本次统计数据也会重置。')) {
    game.resetLevel();
    btnHint.textContent = '显示频率';
  }
});

btnHint.addEventListener('click', () => {
  const showing = game.toggleFrequencies();
  btnHint.textContent = showing ? '隐藏频率' : '显示频率';
});

btnNext.addEventListener('click', async () => {
  const nextLevel = game.getCurrentLevel() >= MAX_LEVELS
    ? 1
    : game.getCurrentLevel() + 1;

  completeModal.classList.remove('show');
  btnHint.textContent = '显示频率';
  await game.loadLevel(nextLevel);
});

btnAchievements.addEventListener('click', openAchievementWall);
btnCloseWall.addEventListener('click', closeAchievementWall);

achievementWall.addEventListener('click', (e) => {
  if (e.target === achievementWall) {
    closeAchievementWall();
  }
});

btnResetAchievements.addEventListener('click', () => {
  if (confirm('确定要重置所有成就和关卡记录吗？此操作不可撤销！')) {
    achievementStore = resetAchievements();
    updateBadgeCount();
    renderAchievementWall();
  }
});

async function init(): Promise<void> {
  hintTitleEl.textContent = '加载中...';
  hintTextEl.textContent = '正在连接星界数据库...';

  try {
    const backendOk = await healthCheck();
    if (!backendOk) {
      console.warn('后端未启动，尝试使用嵌入数据...');
    }
  } catch {
    console.warn('后端健康检查失败');
  }

  const loaded = await game.loadLevel(1);
  if (!loaded) {
    hintTitleEl.textContent = '⚠️ 加载失败';
    hintTextEl.textContent = '无法加载关卡数据，请确保后端服务器已启动 (npm run dev:backend)';
    return;
  }

  game.start();
}

init().catch(err => {
  console.error('初始化失败:', err);
  hintTitleEl.textContent = '错误';
  hintTextEl.textContent = String(err);
});
