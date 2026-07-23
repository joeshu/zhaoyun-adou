/* v2 存档：金币/材料/主线/武器/穿戴/道具/彩蛋/无尽（多槽 + 导出导入 + 版本/校验） */
'use strict';

const SAVE_VER = 7;                                // v7：分层存档与日/周挑战

let curSlot = 0;                                  // 当前存档槽 0/1/2
const SLOT_KEY = n => (n === 0 ? 'zyad2' : 'zyad2_slot' + n);   // 槽0兼容旧档 key
let SAVE = defaultSave();
function defaultSave() {
  return {
    ver: SAVE_VER,                       // 存档版本（migrate 用）
    gold: 10000, mat: 2, stage: 1, bestWave: 0, endless: false,
    weapons: [], equips: {},            // equips: {武将名: 武器id}
    itemsOwned: {}, loadout: [],        // loadout: 携带道具 id 列表（≤6，主动≤2）
    eggs: { flag: false, vine: false, acc: false, all: false },
    invincible: false,            // 兵种无敌开关（仅玩家侧作战单位，阿斗不受影响）
    dynPath: false,               // 动态路径开关（重型，默认关，菜单开；仅敌侧出兵口左右偏移）
    bossPhase: false,             // BOSS阶段技能开关（重型，默认关，菜单开；boss按血量切3阶段）
    endlessOn: false,              // 无尽纪元快捷开关（重型，默认关，菜单开；绕过30关门槛直接进无尽）
    newHeros: false,               // 新增6橙将开关（重型，默认关，菜单开；开启后6名新橙将注入抽卡池）
    awaken: false,                 // 武将觉醒开关（重型，默认关，菜单开；开启后觉醒丹可觉醒武将）
    gearOn: false,                 // 装备扩展开关（重型，默认关，菜单开；开启后防具减伤/饰品攻速生效）
    equipArmor: null,              // 玩家防具 id（ARMORS 键，null=无）
    equipAcc: null,                // 玩家饰品 id（ACCESSORIES 键，null=无）
    difficulty: 'normal',         // 全局难度档：easy / normal / hard（影响敌HP/ATK，不影响玩家资源）
    aiLevel: 'normal',             // AI 难度档：easy/normal/hard（P0-3：影响 aiAct 策略与速率）
    firstTen: true,               // 首十连半价标记（每个存档首次十连享半价，用后置false）
    wish: '',                     // 心愿单：玩家选定的橙将名（如'赵云'），空=未启用（仅玩家侧生效）
    savedAt: 0,                   // 上次手动保存时间戳（0=从未手动保存）
    tutorial: 0,                  // 新手引导进度：0=未开始 1/2/3=对应步骤 99=完成（P0-1）
    mute: false,                  // 静音开关（P1-3）
    ach: {},                      // 已完成成就 id→true（P1-1）
    lastDaily: '',                // 上次签到日期 YYYY-MM-DD（P1-2）
    dailyStreak: 0,               // 连续签到天数（P1-2）
    ghosts: [],                   // 录像数据：[{stage,diff,ops:[{t,act,args}]}]（P1-4）
    skins: {},                    // P2-1 皮肤：{武将名: 皮肤id}，未设置=default
    // 永久武将：碎片招募（20片解锁）→ 选择一名主将开局携带。
    heroShards: {},               // {武将名: 碎片数}
    ownedHeroes: { '赵云': true }, // 初始主将，后续英雄通过碎片招募
    heroStars: { '赵云': 1 },
    leadHero: '赵云',             // 当前携带的永久主将
    heroWish: '',                 // 定向招募心愿将
    adviser: 'zhuge',             // 当前军师
    heroRecords: {},              // 群英谱：{武将名: {kills,deployments,wins}}
    heroChallenges: {},            // 英雄挑战完成记录 {武将名:true}
    mapSkin: 0,                   // 地图皮肤编号 0..3
    colorblind: false,            // 色弱可读性：单位底牌改用形状/高对比描边区分
    relicsOn: false,              // 遗物系统：主线/无尽每5波可选一条本局军略（roguelike 元进度）
    forgeSeries: '',              // 锻造选系：''=随机，否则限定武器系（枪/刀/弓/剑）
    forgeDupStreak: 0,            // 锻造连续重复计数（保底：达阈值必出新武器）
    dailyTask: { progress: 0, reward: false, seed: 0 }, // 每日随机任务进度
    stats: {                      // P2-2 累计统计
      kills: 0,                   // 累计击杀
      summons: 0,                 // 累计抽卡次数（含十连算10）
      merges: 0,                  // 累计合成次数
      heroes: 0,                  // 累计合成武将数
      wins: 0,                    // 累计胜场
      losses: 0,                  // 累计败场
      playTime: 0,                // 累计游戏时长（秒）
      maxStage: 1,                // 历史最高关卡
      maxEndlessWave: 0,          // 历史最高无尽波数
      dailyStreakMax: 0,          // 历史最高连续签到
      goldEarned: 0,              // 累计金币收益
    },
  };
}

/* ---------- 存档版本迁移：旧版字段补全/类型校正 ---------- */
function migrateSave(s) {
  if (!s || typeof s !== 'object') return null;
  const v = s.ver || 2;                          // 旧档无 ver 字段视为 2
  // v2 → v3：补 AI 难度、新手引导、成就、签到、ghosts、mute 字段（缺则用默认）
  if (v < 3) {
    if (s.aiLevel === undefined) s.aiLevel = s.difficulty || 'normal';
    if (s.tutorial === undefined) s.tutorial = 0;
    if (s.mute === undefined) s.mute = false;
    if (!s.ach || typeof s.ach !== 'object') s.ach = {};
    if (typeof s.lastDaily !== 'string') s.lastDaily = '';
    if (typeof s.dailyStreak !== 'number') s.dailyStreak = 0;
    if (!Array.isArray(s.ghosts)) s.ghosts = [];
    s.ver = 3;
  }
  // v3 → v4：补 skins + stats（P2-1/P2-2）
  if (v < 4) {
    if (!s.skins || typeof s.skins !== 'object') s.skins = {};
    if (!s.stats || typeof s.stats !== 'object') s.stats = {};
    const def = defaultSave().stats;
    for (const k in def) if (s.stats[k] === undefined || typeof s.stats[k] !== 'number') s.stats[k] = def[k];
    s.ver = 4;
  }
  // v4 → v5：永久武将、碎片与主将选择
  if (v < 5) {
    if (!s.heroShards || typeof s.heroShards !== 'object') s.heroShards = {};
    if (!s.ownedHeroes || typeof s.ownedHeroes !== 'object') s.ownedHeroes = {};
    if (!s.heroStars || typeof s.heroStars !== 'object') s.heroStars = {};
    if (typeof s.leadHero !== 'string') s.leadHero = '';
    if (typeof s.heroWish !== 'string') s.heroWish = '';
    // 老存档也赠送赵云作为新系统的入门主将，避免进入后无可选英雄。
    if (!Object.keys(s.ownedHeroes).length) { s.ownedHeroes['赵云'] = true; s.heroStars['赵云'] = 1; s.leadHero = '赵云'; }
    s.ver = 5;
  }
  // v5 → v6：军师选择
  if (v < 6) {
    if (typeof s.adviser !== 'string') s.adviser = 'zhuge';
    s.ver = 6;
  }
  // v6 → v7：加入群英谱与日/周挑战字段
  if (v < 7) {
    if (!s.heroRecords || typeof s.heroRecords !== 'object') s.heroRecords = {};
    if (!s.heroChallenges || typeof s.heroChallenges !== 'object') s.heroChallenges = {};
    if (!s.dailyTask || typeof s.dailyTask !== 'object') s.dailyTask = { progress: 0, reward: false, seed: 0 };
    s.ver = 7;
  }
  return s;
}

/* ---------- 字段完整性校验：导入存档时防脏数据 ---------- */
function validateSave(s) {
  if (!s || typeof s !== 'object') return false;
  // 关键字段类型校验（允许缺字段，migrate 会补；类型错则拒）
  if (s.gold !== undefined && typeof s.gold !== 'number') return false;
  if (s.mat !== undefined && typeof s.mat !== 'number') return false;
  if (s.stage !== undefined && typeof s.stage !== 'number') return false;
  if (s.weapons !== undefined && !Array.isArray(s.weapons)) return false;
  if (s.equips !== undefined && typeof s.equips !== 'object') return false;
  if (s.loadout !== undefined && !Array.isArray(s.loadout)) return false;
  if (s.eggs !== undefined && typeof s.eggs !== 'object') return false;
  if (s.difficulty !== undefined && !['easy', 'normal', 'hard'].includes(s.difficulty)) return false;
  if (s.aiLevel !== undefined && !['easy', 'normal', 'hard'].includes(s.aiLevel)) return false;
  if (s.tutorial !== undefined && typeof s.tutorial !== 'number') return false;
  if (s.ach !== undefined && typeof s.ach !== 'object') return false;
  if (s.ghosts !== undefined && !Array.isArray(s.ghosts)) return false;
  if (s.skins !== undefined && typeof s.skins !== 'object') return false;
  if (s.heroShards !== undefined && typeof s.heroShards !== 'object') return false;
  if (s.ownedHeroes !== undefined && typeof s.ownedHeroes !== 'object') return false;
  if (s.heroStars !== undefined && typeof s.heroStars !== 'object') return false;
  if (s.leadHero !== undefined && typeof s.leadHero !== 'string') return false;
  if (s.heroWish !== undefined && typeof s.heroWish !== 'string') return false;
  if (s.adviser !== undefined && typeof s.adviser !== 'string') return false;
  if (s.heroRecords !== undefined && typeof s.heroRecords !== 'object') return false;
  if (s.heroChallenges !== undefined && typeof s.heroChallenges !== 'object') return false;
  if (s.stats !== undefined && typeof s.stats !== 'object') return false;
  return true;
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SLOT_KEY(curSlot));
    if (!raw) return;
    let s = JSON.parse(raw);
    if (!validateSave(s)) { console.warn('存档校验失败，丢弃'); return; }
    s = migrateSave(s);
    if (!s) return;
    SAVE = Object.assign(defaultSave(), s, {
      eggs: Object.assign(defaultSave().eggs, s.eggs || {}),
      stats: Object.assign(defaultSave().stats, s.stats || {}),
      heroShards: Object.assign({}, s.heroShards || {}),
      ownedHeroes: Object.assign({}, s.ownedHeroes || {}),
      heroStars: Object.assign({}, s.heroStars || {}),
      heroRecords: Object.assign({}, s.heroRecords || {}),
      heroChallenges: Object.assign({}, s.heroChallenges || {}),
    });
  } catch (e) { /* 无存档/无 localStorage */ }
}
function saveSave() {
  try { localStorage.setItem(SLOT_KEY(curSlot), JSON.stringify(SAVE)); } catch (e) { /* 隐私模式 */ }
}
/* ---------- 手动存档管理（界面层可见入口） ---------- */
function manualSave() {                       // 手动保存：更新时间戳后写盘
  SAVE.savedAt = Date.now();
  saveSave();
}
function clearSave() {                        // 清除当前槽：重置为默认并清盘（不动其他槽）
  SAVE = defaultSave();
  try { localStorage.removeItem(SLOT_KEY(curSlot)); } catch (e) { /* 隐私模式 */ }
}
function fmtSaved() {                         // 时间戳 → 友好文本
  if (!SAVE.savedAt) return '尚未手动保存（进度自动存档中）';
  const d = (Date.now() - SAVE.savedAt) / 1000;
  if (d < 60) return '刚刚保存';
  if (d < 3600) return Math.floor(d / 60) + ' 分钟前保存';
  const t = new Date(SAVE.savedAt);
  const p = n => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())} 保存`;
}
/* ---------- 多槽切换 ---------- */
function switchSlot(n) {                      // 切槽：先存当前槽，再载目标槽
  if (n === curSlot) return;
  saveSave();
  curSlot = n;
  loadSave();
}
function slotMeta(n) {                        // 槽摘要（供 UI 显示）
  try {
    const s = JSON.parse(localStorage.getItem(SLOT_KEY(n)));
    if (!s) return '空槽';
    const d = s.savedAt ? (Date.now() - s.savedAt) / 1000 : 0;
    const when = !s.savedAt ? '未保存' : d < 60 ? '刚刚' : d < 3600 ? Math.floor(d / 60) + '分前' : '早前';
    return '关' + s.stage + ' · ' + s.weapons.length + '武 · ' + when;
  } catch (e) { return '空槽'; }
}
/* ---------- 每日签到（P1-2） ---------- */
function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function yestStr() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function daysBetween(a, b) {
  if (!a || !b) return 0;
  const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}
// 7 日签到奖励循环：[金, 材, 武器?]
const DAILY_REWARDS = [
  { gold: 50, mat: 1, label: '50金+1材' },
  { gold: 80, mat: 0, label: '80金' },
  { gold: 60, mat: 2, label: '60金+2材' },
  { gold: 100, mat: 0, label: '100金' },
  { gold: 80, mat: 2, label: '80金+2材' },
  { gold: 150, mat: 3, label: '150金+3材' },
  { gold: 200, mat: 5, label: '200金+5材(7日大奖)' },
];
function canDaily() {
  return SAVE.lastDaily !== todayStr();
}
function doDaily() {
  if (!canDaily()) return null;
  const today = todayStr();
  // 连续签到判定：上次签到是昨天则 +1，否则重置为 1
  SAVE.dailyStreak = (SAVE.lastDaily === yestStr()) ? SAVE.dailyStreak + 1 : 1;
  if (SAVE.stats && SAVE.stats.dailyStreakMax !== undefined) SAVE.stats.dailyStreakMax = Math.max(SAVE.stats.dailyStreakMax, SAVE.dailyStreak);
  const idx = (SAVE.dailyStreak - 1) % 7;
  const r = DAILY_REWARDS[idx];
  SAVE.gold += r.gold; SAVE.mat += r.mat || 0;
  // 第 7 日大奖：额外随机送一把未拥有武器
  if (idx === 6) {
    const missing = Object.keys(WEAPONS).filter(id => !SAVE.weapons.includes(id));
    if (missing.length) {
      const w = missing[(Math.random() * missing.length) | 0];
      SAVE.weapons.push(w);
      r.weapon = w;
    }
  }
  SAVE.lastDaily = today;
  saveSave();
  return { idx: idx + 1, ...r };
}

/* ---------- 导出 / 导入 ---------- */
function exportSave() {                       // 返回当前槽存档 JSON 字符串
  return JSON.stringify(SAVE);
}
function importSave(str) {                    // 解析 JSON 写盘，返回是否成功
  try {
    let s = typeof str === 'string' ? JSON.parse(str) : str;
    if (!s || typeof s !== 'object') return false;
    if (!validateSave(s)) return false;       // 类型校验失败拒收
    s = migrateSave(s);                       // 自动升版本补字段
    if (!s) return false;
    SAVE = Object.assign(defaultSave(), s, {
      eggs: Object.assign(defaultSave().eggs, s.eggs || {}),
      stats: Object.assign(defaultSave().stats, s.stats || {}),
      heroShards: Object.assign({}, s.heroShards || {}),
      ownedHeroes: Object.assign({}, s.ownedHeroes || {}),
      heroStars: Object.assign({}, s.heroStars || {}),
      heroRecords: Object.assign({}, s.heroRecords || {}),
      heroChallenges: Object.assign({}, s.heroChallenges || {}),
    });
    saveSave();
    return true;
  } catch (e) { return false; }
}

/* ---------- 道具购买 / 携带 ---------- */
function buyItem(id) {
  const it = ITEMS[id];
  if (!it || SAVE.itemsOwned[id] || SAVE.gold < it.price) return false;
  SAVE.gold -= it.price; SAVE.itemsOwned[id] = true; saveSave();
  return true;
}
function toggleLoadout(id) {
  if (!SAVE.itemsOwned[id]) return false;
  const i = SAVE.loadout.indexOf(id);
  if (i >= 0) { SAVE.loadout.splice(i, 1); saveSave(); return true; }
  if (SAVE.loadout.length >= LOADOUT_MAX) return false;
  if (ITEMS[id].act && SAVE.loadout.filter(k => ITEMS[k].act).length >= LOADOUT_ACT_MAX) return false;
  SAVE.loadout.push(id); saveSave();
  return true;
}

const hasItem = id => SAVE.loadout.includes(id);

/* ---------- 永久武将：20 碎片招募 / 升星 / 主将 ---------- */
const HERO_UNLOCK_SHARDS = 20;
const HERO_STAR_COST = { 2: 12, 3: 20, 4: 32, 5: 48 };
function shardCount(name) { return Math.max(0, SAVE.heroShards[name] || 0); }
function heroStar(name) { return SAVE.ownedHeroes[name] ? (SAVE.heroStars[name] || 1) : 0; }
function grantHeroShard(name, n = 1) {
  if (!HEROES[name]) return null;
  SAVE.heroShards[name] = shardCount(name) + n;
  let unlocked = false;
  if (!SAVE.ownedHeroes[name] && shardCount(name) >= HERO_UNLOCK_SHARDS) {
    SAVE.heroShards[name] -= HERO_UNLOCK_SHARDS;
    SAVE.ownedHeroes[name] = true; SAVE.heroStars[name] = 1; unlocked = true;
    if (!SAVE.leadHero) SAVE.leadHero = name;
  }
  saveSave();
  return { name, n, unlocked, count: shardCount(name) };
}
function upgradeHeroStar(name) {
  const star = heroStar(name), need = HERO_STAR_COST[star + 1];
  if (!need || shardCount(name) < need) return false;
  SAVE.heroShards[name] -= need; SAVE.heroStars[name] = star + 1; saveSave(); return true;
}
function setLeadHero(name) {
  if (!SAVE.ownedHeroes[name]) return false;
  SAVE.leadHero = name; saveSave(); return true;
}
function heroStarMul(name) { return 1 + Math.max(0, heroStar(name) - 1) * 0.12; }
function rollHeroShard(preferWish = true) {
  const wish = SAVE.heroWish;
  if (preferWish && wish && HEROES[wish] && Math.random() < 0.45) return wish;
  return HERO_LIST[(Math.random() * HERO_LIST.length) | 0];
}


/* ---------- 锻造 / 穿戴 ---------- */
function forge() {
  if (SAVE.gold < FORGE_COST.gold || SAVE.mat < FORGE_COST.mat) return null;
  SAVE.gold -= FORGE_COST.gold; SAVE.mat -= FORGE_COST.mat;
  // 选系：限定武器系，否则按品质随机
  let pool = Object.keys(WEAPONS);
  if (SAVE.forgeSeries) pool = pool.filter(k => WEAPONS[k].wq === SAVE.forgeSeries);
  // 保底：连续重复达到阈值，强制出一把未拥有的（同系优先）
  let id;
  if (SAVE.forgeDupStreak >= 5) {
    const fresh = pool.filter(k => !SAVE.weapons.includes(k));
    id = (fresh.length ? fresh : pool)[(Math.random() * (fresh.length ? fresh.length : pool.length)) | 0];
    SAVE.forgeDupStreak = 0;
  } else {
    const q = wpick([[2, 50], [3, 35], [4, 15]]);
    const qpool = pool.filter(k => WEAPONS[k].q === q);
    id = qpool.length ? qpool[(Math.random() * qpool.length) | 0] : pool[(Math.random() * pool.length) | 0];
  }
  let dup = false;
  if (SAVE.weapons.includes(id)) { dup = true; SAVE.gold += 30; SAVE.forgeDupStreak++; }   // 重复转 30 金
  else { SAVE.weapons.push(id); SAVE.forgeDupStreak = 0; }
  saveSave();
  return { id, dup };
}
function weaponsFor(hero) {                        // 该武将可用武器
  return SAVE.weapons.filter(id => {
    const w = WEAPONS[id];
    return w.wq === HEROES[hero].wq && (!w.lock || w.lock === hero);
  });
}
function cycleEquip(hero) {                        // 穿戴轮换：无→武器1→…→无
  const list = weaponsFor(hero);
  if (!list.length) return null;
  const cur = SAVE.equips[hero];
  const i = list.indexOf(cur);
  const next = i < 0 ? list[0] : (i + 1 < list.length ? list[i + 1] : null);
  if (next) SAVE.equips[hero] = next; else delete SAVE.equips[hero];
  saveSave();
  return next;
}
