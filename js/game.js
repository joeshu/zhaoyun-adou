/* v2 对局状态机：开局 / 主循环 / 经济 / 结算 / 彩蛋 / 无尽 */
'use strict';

let G = null;

function mkSide(side, mapIdx) {
  const M = MAPS[mapIdx || 0];
  const rows = side > 0 ? M.ROWS_P : M.ROWS_E;
  const cols = M.COLS;
  const cells = [];
  for (const y of rows) for (const x of cols) cells.push({ x, y, open: false, unit: null });
  // 开放格：优先用 M.open（索引列表，精确还原原布局），否则回退 openRows（前N行全开）
  if (M.open) M.open.forEach(i => { if (cells[i]) cells[i].open = true; });
  else if (M.openRows) {
    const or = Math.min(M.openRows, rows.length);
    cells.forEach((c, i) => { if (Math.floor(i / cols.length) < or) c.open = true; });
  }
  const bar = [];
  for (const y of BAR_ROWS) for (const x of BAR_COLS) bar.push({ x, y, unit: null });
  let hp = ADOU_HP;
  if (side > 0) {
    if (hasItem('dabuwan')) hp += 2;
    if (SAVE.eggs.acc) hp += 1;
  }
  const pathP = side > 0 ? M.PATH_P : M.PATH_E;
  const cum = pathCum(pathP);
  const S = {
    side, cells, bar, mobs: [], snakes: [],
    hp, maxhp: hp, mantou: 30, summons: 0, killCnt: 0,
    pity: 0, unlocked: 0, zhaoxian: false,
    incomeT: 0, luoyangT: 0, slowT: 0, xumingUsed: false,
    shield: 0, noHit: true,            // 阿斗护盾：每波+1、无伤+1，上限2（仅玩家侧有意义）
    tempBag: side > 0 ? [] : null,           // 临时背包：抽卡溢出暂存（仅玩家侧，AI侧为null不渲染）
    combo: 0, comboT: 0,                     // 连杀：5秒内3杀→攻速+20%（仅玩家侧，独立计数不干扰压力怪killCnt）
    path: pathP,
    cum: cum,
    adou: side > 0 ? M.ADOU_P : M.ADOU_E,
    wish: side > 0 ? (SAVE.wish || '') : '',   // 心愿单：仅玩家侧生效，AI侧为空
  };
  S.len = S.cum[S.cum.length - 1];
  S.fate = fateBuff(S);
  return S;
}

function startBattle(stage, endless, mapIdx) {
  const uses = {};
  for (const id of SAVE.loadout) if (ITEMS[id].act) uses[id] = ITEMS[id].uses;
  // 教学模式：SAVE.tutorial<99 且未通关第1关时启动（stage==1 且未无尽）
  const tut = (SAVE.tutorial < 99 && stage === 1 && !endless && SAVE.stage === 1);
  // ghost 回放模式（P1-4）：传入 ghostObj 时按其 ops 自动重现玩家操作
  const ghostMode = !!(arguments[3]);
  G = {
    stage, endless: !!endless, mapIdx: mapIdx || 0,
    P: mkSide(1, mapIdx), E: mkSide(-1, mapIdx),
    wave: 0, spawnQ: [], spawnT: 0, betweenT: 2.5, hpMul: 1, hpAdd: 0, atkMul: 1, goldAdd: 0,
    time: 0, speed: 1, paused: false, state: 'play',
    // AI 行动间隔：困难档加快 25%，简单档放慢 50%，普通档沿用关卡缩放
    aiT: 2,
    aiIv: (() => {
      const base = Math.max(0.7, 1.8 - stage * 0.035);
      const lvl = SAVE.aiLevel || 'normal';
      return lvl === 'hard' ? base * 0.75 : lvl === 'easy' ? base * 1.5 : base;
    })(),
    itemUses: uses, targeting: null,
    fx: [], parts: [], floats: [], banner: null, flash: 0, summonFx: null,
    goldEarn: 0, resultT: 0,
    egg: null,
    // 录像录制：玩家侧每个动作记录时间戳+动作+参数（P1-4 用）；ghost 回放时停止录制
    rec: (!endless && !ghostMode) ? { stage, diff: SAVE.difficulty, ai: SAVE.aiLevel || 'normal', ops: [] } : null,
    // 新手引导：3 步推进；tutStep=0 未开始 / 1=已抽卡 / 2=已合成 / 3=已部署
    tutorial: tut, tutStep: 0,
    // P1-4 ghost 回放：ghostMode 时按 ghost.ops 时间戳触发玩家操作
    ghostMode,
    ghost: ghostMode ? arguments[3] : null,
    ghostIdx: 0, ghostDone: false,
  };
  if (ghostMode) G.banner = { txt: '【录像回放】自动重现玩家操作', t: 3 };
  if (tut) {
    G.banner = { txt: '【教学1/3】点底部"抽卡"按钮获得兵种', t: 999 };
    // 教学模式：玩家馒头足，但只让抽 1 次
    G.P.mantou = 30;
  }
  for (const k in EGGS)
    if (EGGS[k].stage === stage && !SAVE.eggs[k] && !endless) G.egg = { key: k, ...EGGS[k] };
}

function collectEgg() {
  if (!G.egg) return;
  const k = G.egg.key;
  SAVE.eggs[k] = true;
  SAVE.gold += k === 'flag' ? 50 : 100;
  G.banner = { txt: k === 'flag' ? '彩蛋! 赵云限定皮肤 +50金' : '彩蛋! 藤蔓宝藏 +100金', t: 2 };
  boom(G.egg.x, G.egg.y, '#e8a005');
  sfx('egg');                                       // 音效（P1-3）
  G.egg = null;
  checkEggAll();
  saveSave();
}
function eggAccTick(dt) {                        // 第30关结算停留10秒
  if (G.state !== 'win' || G.stage !== 30 || SAVE.eggs.acc) return;
  G.resultT += dt;
  if (G.resultT >= 10) {
    SAVE.eggs.acc = true; SAVE.gold += 200;
    G.banner = { txt: '隐藏彩蛋! 阿斗配饰(血+1) +200金', t: 2.5 };
    checkEggAll();
    saveSave();
  }
}
function checkEggAll() {
  const e = SAVE.eggs;
  if (e.flag && e.vine && e.acc && !e.all) {
    e.all = true; SAVE.gold += 300;
    G.banner = { txt: '全彩蛋达成! 限定皮肤 +300金', t: 3 };
  }
}

function endBattle(win) {
  if (G.state !== 'play') return;
  G.state = win ? 'win' : 'lose';
  G.resultT = 0;
  if (win) {
    const reward = 20 + G.stage * 2 + G.goldEarn;
    SAVE.gold += reward;
    G.rewardTxt = '金币 +' + reward;
    if (!G.endless) {
      if (G.stage % 10 === 0) { SAVE.mat += 2; G.rewardTxt += ' · 材料 +2'; }
      if (G.stage === 30) SAVE.endless = true;
      SAVE.stage = Math.max(SAVE.stage, Math.min(G.stage + 1, STAGE_MAX));
    }
    // P1-4 保存录像到 SAVE.ghosts（仅非无尽非 ghostMode，且有 ops）
    if (G.rec && G.rec.ops.length && !G.endless && !G.ghostMode) {
      if (!Array.isArray(SAVE.ghosts)) SAVE.ghosts = [];
      G.rec.ops = G.rec.ops.slice(-200);                 // 上限200步防爆
      G.rec.result = 'win';
      SAVE.ghosts.unshift(G.rec);
      if (SAVE.ghosts.length > 10) SAVE.ghosts.length = 10;  // 仅保留最近10局
      G.rewardTxt += ' · 录像已保存';
    }
    // P2-2 统计：胜场/金币/历史最高关卡/无尽波数
    if (SAVE.stats) {
      SAVE.stats.wins++;
      SAVE.stats.goldEarned += reward;
      if (!G.endless) SAVE.stats.maxStage = Math.max(SAVE.stats.maxStage, G.stage);
      else SAVE.stats.maxEndlessWave = Math.max(SAVE.stats.maxEndlessWave, G.wave);
    }
  } else {
    SAVE.gold += 5 + G.goldEarn;
    G.rewardTxt = '安慰金币 +' + (5 + G.goldEarn);
    if (SAVE.stats) { SAVE.stats.losses++; SAVE.stats.goldEarned += 5 + G.goldEarn; }
  }
  // 成就检查（P1-1）：同步设置 banner，避免异步回调悬挂
  const newAch = checkAchievements();
  if (newAch.length) {
    G.rewardTxt += ' · 解锁' + newAch.length + '个成就';
    G.banner = { txt: '成就解锁: ' + newAch.map(a => a.name).join(' · '), t: 2.5 };
  }
  sfx(win ? 'win' : 'lose');                        // 音效（P1-3）
  saveSave();
}

function sideIncome(S, dt) {
  S.incomeT += dt;
  if (S.incomeT >= INCOME_IV) {
    S.incomeT -= INCOME_IV;
    // 农民=2馒头/秒（文档7.1），无农民保留基础0.6/秒
    const n = S.side > 0 && hasItem('nongmin') ? INCOME_IV * 2 : INCOME_N;
    S.mantou += n;
    if (S.side > 0) fl(30, 26, '+' + n, '#8b5e3c');
  }
  if (S.side > 0 && hasItem('luoyang')) {
    S.luoyangT += dt;
    if (S.luoyangT >= 45) {
      S.luoyangT = 0;
      const i = barFree(S);
      if (i >= 0) { S.bar[i].unit = { t: 'shovel', animT: 0.25 }; fl(S.bar[i].x, S.bar[i].y - 24, '洛阳铲!', '#846358'); }
    }
  }
}

function update(dt) {
  G.time += dt;
  // P2-2 统计：累计游戏时长（仅玩家正常对局，不含 ghostMode 回放）
  if (!G.ghostMode && SAVE.stats) SAVE.stats.playTime += dt;
  // P1-4 ghost 回放：按时间戳触发玩家操作（在 wave/ai 之前）
  if (G.ghostMode && typeof tickGhost === 'function') tickGhost(dt);
  // 波次投放（双方同刷）
  if (G.spawnQ.length) {
    G.spawnT += dt;
    while (G.spawnQ.length && G.spawnQ[0].t <= G.spawnT) {
      const s = G.spawnQ.shift();
      spawnMob(G.P, s.type, s.hpMul);
      spawnMob(G.E, s.type, s.hpMul);
    }
  } else if (!G.endless && G.wave >= stageCfg(G.stage)[0]) {
    if (!G.P.mobs.length) endBattle(true);                  // 打完全部波次且清场 → 通关
  } else {
    G.betweenT -= dt;
    if (G.betweenT <= 0) { G.betweenT = 5; startWave(); if (G.wave > 1) G.goldEarn += 2; }
  }
  // AI 行动
  G.aiT -= dt;
  if (G.aiT <= 0) { G.aiT = G.aiIv; aiAct(G.E); }
  // 双侧模拟
  for (const S of [G.P, G.E]) {
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }   // 连杀窗口衰减
    sideIncome(S, dt);
    if (S.slowT > 0) S.slowT -= dt;
    for (const c of S.cells) if (c.unit) {
      if (c.unit.animT > 0) c.unit.animT -= dt;
      updUnit(S, c, dt);
    }
    for (const s of S.bar) if (s.unit && s.unit.animT > 0) s.unit.animT -= dt;
    for (const sn of S.snakes) if (!sn.dead) updSnake(S, sn, dt);
    S.snakes = S.snakes.filter(sn => !sn.dead && sn.hp > 0);
    for (const m of S.mobs) if (!m.dead) updMob(S, m, dt);
    S.mobs = S.mobs.filter(m => !m.dead && m.hp > 0);
  }
  if (G.P.hp <= 0) endBattle(false);
  else if (G.E.hp <= 0) endBattle(true);
}
