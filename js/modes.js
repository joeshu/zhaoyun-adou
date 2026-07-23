/* 特别玩法：复用现有合成、布阵、波次和战斗内核，专注于改变胜利目标。 */
'use strict';

const SPECIAL_MODES = [
  { id: 'fire', icon: '🔥', name: '赤壁火攻', sub: '守住水寨 · 借风焚敌', col: '#bd4a31', unlock: 6 },
  { id: 'rogue', icon: '⚔', name: '五虎试炼', sub: '随机军略 · 八战远征', col: '#7250b8', unlock: 10 },
  { id: 'escort', icon: '🐎', name: '长坂独胆', sub: '护送阿斗 · 三路突围', col: '#2f7f9d', unlock: 14 },
  { id: 'puzzle', icon: '♟', name: '群雄演武', sub: '每日残局 · 三星挑战', col: '#b78324', unlock: 4 },
  { id: 'raid', icon: '👑', name: '黄巾讨伐', sub: '90 秒讨伐 · 阶段 Boss', col: '#8d3543', unlock: 20 },
];
const specialMode = id => SPECIAL_MODES.find(m => m.id === id);
const modeUnlocked = m => SAVE.stage >= m.unlock;

function startSpecialMode(id) {
  const m = specialMode(id);
  if (!m || !modeUnlocked(m)) return false;
  // 第五参数为扩展配置，保持录像回放的第四参数兼容。
  startBattle(Math.max(1, Math.min(SAVE.stage, 20)), false, id === 'fire' ? 1 : 0, null, { mode: id });
  scr = 'game';
  return true;
}

function modeSetup() {
  if (!G.mode) return;
  G.modeLabel = (specialMode(G.mode) || {}).name || '';
  if (G.mode === 'fire') {
    G.modeTime = 150; G.modeScore = 0; G.wind = '东南风'; G.windT = 30;
    G.fireCells = [{ x: 80, y: 380 }, { x: 295, y: 436 }];
    G.banner = { txt: '【赤壁火攻】守住水寨 150 秒 · 风势将改变火路', t: 3 };
    spawnBuilding(80, 380, 'tower'); spawnBuilding(295, 436, 'trap');
  } else if (G.mode === 'rogue') {
    G.rogue = { floor: 1, maxFloor: 8, picks: 0, dmg: 1, hp: 1, income: 0 };
    G.banner = { txt: '【五虎试炼】每场胜利选择一条军略', t: 3 };
  } else if (G.mode === 'escort') {
    G.escort = { progress: 0, target: 100, rescued: 0 };
    G.banner = { txt: '【长坂独胆】清路护送阿斗抵达长坂桥', t: 3 };
  } else if (G.mode === 'puzzle') {
    // 群雄演武：禁抽卡/禁合成，进入关卡选择；布阵与 auto-battle 在 puzzleLoadLevel 后开始。
    G.P.mantou = 0;
    G.mapEventT = 0;   // 群雄演武不触发地图补给（无经济系统）
    G.puzzle = { choosing: true, levelIdx: 0, cur: null, maxAttempts: 0, attempt: 0, solved: false, prep: false, started: false, spawned: false, attemptT: 0 };
    G.banner = { txt: '【群雄演武】选择残局', t: 3 };
  } else if (G.mode === 'raid') {
    // 黄巾讨伐：90 秒击破张角；弱点按序轮转暴露，非暴露侧被护盾大幅减伤。
    const rb = RAID_BOSS;
    let minX = 1e9, maxX = -1e9;
    for (const c of G.P.cells) { if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x; }
    const mid = (minX + maxX) / 2, band = (maxX - minX) / 3;
    G.raid = {
      limit: 90, phase: 1, bossSpawned: false,
      rotation: rb.rotation.slice(), weakIndex: 0, cycle: rb.cycle, weakTimer: rb.cycle,
      exposed: rb.rotation[0],
      shields: { left: 0, mid: 0, right: 0 },
      phaseDone: { 2: false, 3: false },
      bounds: { minX, maxX, mid, band },
    };
    G.P.mantou = 80;
    G.mapEventT = 0;   // 黄巾讨伐不触发地图补给（经济仅初期 80 馒）
    G.banner = { txt: '【黄巾讨伐】90 秒内击破张角 · 弱点轮转暴露', t: 3 };
  }
}

function modeTick(dt) {
  if (!G || !G.mode || G.state !== 'play') return;
  if (G.mode === 'fire') {
    G.modeTime -= dt; G.windT -= dt;
    if (G.windT <= 0) { G.windT = 30; G.wind = G.wind === '东南风' ? '西北风' : '东南风'; G.banner = { txt: '风向变为' + G.wind + '！火势蔓延', t: 1.8 }; }
    // 火油与风向对双方战场同时生效，维持镜像对抗的公平性。
    for (const side of [G.P, G.E]) for (const m of side.mobs) for (const f of G.fireCells)
      if (Math.hypot(m.x - f.x, m.y - f.y) < 76) m.hp -= (G.wind === '东南风' ? 18 : 11) * dt;
    if (G.modeTime <= 0) { G.rewardTxt = '火攻战功 ' + Math.floor(G.modeScore + G.P.killCnt); endBattle(true); }
  } else if (G.mode === 'escort') {
    // 前方敌军越少，护送越快；抵达时以剩余生命结算。
    const danger = G.P.mobs.length;
    G.escort.progress = Math.min(100, G.escort.progress + dt * (danger ? 0.35 : 1.25));
    if (G.escort.progress >= 100) { G.rewardTxt = '护送成功 · 救援 ' + G.escort.rescued + ' 人'; endBattle(true); }
  } else if (G.mode === 'puzzle') {
    // 群雄演武：布阵阶段(prep)不结算；开战后(auto-battle)歼灭敌阵=胜，尝试耗尽=败。
    const p = G.puzzle;
    if (p.choosing || !p.cur) return;
    if (p.prep) return;
    if (!p.spawned) return;
    p.attemptT += dt;
    const enemies = G.P.mobs.filter(m => m.hp > 0).length;
    const playerUnits = G.P.cells.some(c => c.unit) || G.P.bar.some(s => s.unit);
    if (enemies === 0) {
      p.solved = true;
      G.rewardTxt = '残局破! 用 ' + p.attempt + '/' + p.maxAttempts + ' 次';
      endBattle(true);
    } else if (!playerUnits && p.attemptT > 3) {
      puzzleAttemptFail();                 // 玩家单位全灭且敌阵尚在 → 本次失败
    } else if (p.attemptT > 150) {
      puzzleAttemptFail();                 // 安全超时，避免僵局
    }
  } else if (G.mode === 'raid') {
    const r = G.raid, rb = RAID_BOSS;
    r.limit -= dt;
    // 弱点轮转（左→中→右…）
    r.weakTimer -= dt;
    if (r.weakTimer <= 0) {
      r.weakIndex = (r.weakIndex + 1) % r.rotation.length;
      r.exposed = r.rotation[r.weakIndex];
      r.weakTimer = r.cycle;
      G.banner = { txt: '弱点暴露：' + RAID_SIDE_NAME[r.exposed] + ' 侧！集火该侧', t: 1.3 };
      G.flash = Math.max(G.flash, 0.18);
    }
    // 护盾再生（非暴露侧持续回复，暴露侧归零）
    for (const s of ['left', 'mid', 'right']) r.shields[s] = (s === r.exposed) ? 0 : Math.min(1, r.shields[s] + dt / 2.5);
    // 阶段切换（66% / 33%）：重排弱点 + 加速轮转 + 召唤小怪
    const boss = G.P.mobs.find(m => m.raidBoss);
    if (boss) {
      const ratio = boss.hp / boss.maxhp;
      rb.phases.forEach((ph, i) => {
        const pn = i + 2;
        if (!r.phaseDone[pn] && ratio <= ph.at) {
          r.phaseDone[pn] = true; r.phase = pn;
          r.rotation = ph.rotation.slice(); r.weakIndex = 0; r.exposed = r.rotation[0]; r.cycle = ph.cycle; r.weakTimer = ph.cycle;
          for (const t of (ph.summon || [])) spawnMob(G.P, t, G.hpMul || 1);
          G.banner = { txt: '张角·第' + pn + '阶段：弱点重排 + 召唤信徒!', t: 2 };
          G.flash = Math.max(G.flash, 0.4); addShake(5);
        }
      });
    }
    // 生成 Boss（复用 MOBS['角']，标记 raidBoss 以走门控伤害路径）
    if (!r.bossSpawned && G.time > 3) {
      r.bossSpawned = true;
      spawnMob(G.P, rb.type, 1.0);
      const b = G.P.mobs[G.P.mobs.length - 1];
      b.raidBoss = true; b.name = MOBS[rb.type].name;
      G.banner = { txt: '讨伐目标：' + MOBS[rb.type].name + ' 现身！', t: 2 };
    }
    // 胜负：Boss 消失即胜；超时即败（阿斗基地破走 update 的失败路径）
    const bossAlive = G.P.mobs.some(m => m.raidBoss && m.hp > 0);
    if (r.bossSpawned && !bossAlive) { G.rewardTxt = '讨伐成功 · 剩余 ' + Math.ceil(Math.max(0, r.limit)) + ' 秒'; endBattle(true); }
    else if (r.limit <= 0) { G.rewardTxt = '讨伐时间耗尽'; endBattle(false); }
  }
}

function modeWaveConfig() {
  if (!G || !G.mode) return null;
  if (G.mode === 'rogue') return { waves: 1, per: 5 + G.rogue.floor * 2, mix: [45, 20, 20, 15], hp: 0.85 + G.rogue.floor * 0.12 };
  if (G.mode === 'puzzle') return { waves: 0, per: 0, hp: 0.85 };   // 敌阵由 puzzleStartAttempt 手动生成，不走波次
  if (G.mode === 'escort') return { waves: 99, per: 5, mix: [45, 20, 25, 10], hp: 0.9 + G.escort.progress / 400 };
  if (G.mode === 'fire') return { waves: 99, per: 5, mix: [45, 25, 20, 10], hp: 1, hpAdd: 0, atkTier: 1 };
  if (G.mode === 'raid') return { waves: 0, per: 0, mix: [100, 0, 0, 0], hp: 1 };
  return null;
}

function rogueOffer() {
  const all = [
    { n: '龙胆军略', d: '全军伤害 +25%', apply: () => G.rogue.dmg *= 1.25 },
    { n: '屯田令', d: '每波馒头 +20', apply: () => { G.P.mantou += 20; G.rogue.income += 1; } },
    { n: '背水一战', d: '阿斗血量 +2，攻速 +15%', apply: () => { G.P.hp += 2; G.P.maxhp += 2; G.rogue.hp *= 1.15; } },
  ];
  G.rogueChoices = all.sort(() => Math.random() - .5).slice(0, 3);
  G.paused = true;
}
/* 遗物系统（#27 / Phase 2 #37）：主线/无尽每 5 波触发，复用 rogueChoices 选择 UI。
   增益作用于本局玩家全军（playerDmgMul 等由 unitStats 读取）。
   Phase 2 加权衡：纯增益 + 双刃（有代价），倍率随波次放大，且每轮保底至少 1 个纯增益。 */
function offerRelic() {
  if (!G) return;
  const scale = 1 + Math.min(0.5, (G.wave - 5) / 60);   // 倍率随波次放大（第5波=1，第35波≈1.5）
  // 纯增益（保底至少 1 个）
  const pos = [
    { n: '龙胆军略', d: '全军伤害 +' + Math.round(25 * scale) + '%', apply: () => { G.playerDmgMul *= 1 + 0.25 * scale; } },
    { n: '疾风军略', d: '全军攻速 +' + Math.round(15 * scale) + '%', apply: () => { G.playerRateMul *= 1 + 0.15 * scale; } },
    { n: '铁壁军略', d: '全军血量 +' + Math.round(20 * scale) + '%', apply: () => { G.playerHpMul *= 1 + 0.2 * scale; G.P.cells.forEach(c => { if (c.unit) c.unit.hp *= 1 + 0.2 * scale; }); } },
    { n: '屯田令', d: '立即 +30 馒头', apply: () => { G.P.mantou += 30; } },
    { n: '资军略', d: '立即 +50 馒头', apply: () => { G.P.mantou += 50; } },
    { n: '回血军略', d: '阿斗回复 3 血', apply: () => { G.P.hp = Math.min(G.P.maxhp, G.P.hp + 3); } },
  ];
  // 双刃（有代价，逼出真抉择）
  const dual = [
    { n: '背水军略', d: '伤害+' + Math.round(30 * scale) + '% 但阿斗-2血', apply: () => { G.playerDmgMul *= 1 + 0.3 * scale; G.P.hp = Math.max(1, G.P.hp - 2); G.P.maxhp = Math.max(1, G.P.maxhp - 2); } },
    { n: '孤注军略', d: '攻速+' + Math.round(25 * scale) + '% 但阿斗上限-1', apply: () => { G.playerRateMul *= 1 + 0.25 * scale; G.P.maxhp = Math.max(1, G.P.maxhp - 1); G.P.hp = Math.min(G.P.hp, G.P.maxhp); } },
    { n: '疲兵军略', d: '血量+' + Math.round(25 * scale) + '% 但攻速-10%', apply: () => { G.playerHpMul *= 1 + 0.25 * scale; G.playerRateMul *= 0.9; } },
  ];
  const pool = pos.concat(dual);
  // 保证至少 1 个纯增益：先固定 1 个 positive，再随机 2 个（可能仍是 positive 或 dual）
  const pick = [pos[(Math.random() * pos.length) | 0]];
  for (let i = 0; i < 2; i++) pick.push(pool[(Math.random() * pool.length) | 0]);
  pick.sort(() => Math.random() - 0.5);                 // 打乱展示顺序
  G.rogueChoices = pick;
  G.paused = true;
}
function chooseRogue(i) {
  const c = G && G.rogueChoices && G.rogueChoices[i]; if (!c) return;
  c.apply(); G.rogueChoices = null; G.paused = false;
  // rogue 模式有 floor 进度与通关判定；遗物模式（无 G.rogue）仅应用增益
  if (G.rogue) {
    G.rogue.picks++; G.rogue.floor++;
    if (G.rogue.floor > G.rogue.maxFloor) { G.rewardTxt = '试炼完成 · 获得 ' + G.rogue.picks + ' 条军略'; endBattle(true); return; }
  }
  G.banner = { txt: c.n + '：' + c.d, t: 2 }; G.betweenT = 1;
}

/* ========== raid / puzzle 辅助（垂直切片，全部以 G.mode 门控） ========== */

// 攻击方棋盘 x 坐标 → 左/中/右 三分区（用于弱点门控，仅 raid 使用）
// 按 [minX,maxX] 三等分：左=最左 1/3，中=中间 1/3，右=最右 1/3（5 列布局下约为 2/1/2 列）。
function raidRegionOf(x) {
  const b = G.raid.bounds;
  const t = (x - b.minX) / ((b.maxX - b.minX) || 1);   // 归一化 0..1
  if (t < 1 / 3) return 'left';
  if (t > 2 / 3) return 'right';
  return 'mid';
}

// 给定 (x,y) 求其在某侧路径上的路径距离 d（用于 puzzle 敌阵按坐标落位）
function pathDAt(S, x, y) {
  let best = 0, bd = 1e9;
  for (let i = 0; i <= 48; i++) {
    const d = S.len * i / 48;
    const p = pathPos(S.path, S.cum, d);
    const dd = Math.hypot(p.x - x, p.y - y);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

// 群雄演武：进入某一残局（应用地形 + 预置部队入栏 + 进入布阵阶段）
function puzzleLoadLevel(idx) {
  const lvl = PUZZLE_LEVELS[idx];
  if (!lvl) return;
  G.state = 'play'; G.paused = false;   // 从胜负 overlay「再来一局/重试」重开时复位对局状态
  G.puzzle.levelIdx = idx;
  G.puzzle.cur = lvl;
  G.puzzle.maxAttempts = lvl.par;
  G.puzzle.attempt = 1;
  G.puzzle.solved = false;
  G.puzzle.choosing = false;
  G.puzzle.prep = true;
  G.puzzle.started = false;
  G.puzzle.spawned = false;
  G.puzzle.attemptT = 0;
  // 重置棋盘：群雄演武为布阵解谜，开放全部格（地形 pass 随后封锁），清空单位与地形
  G.P.cells.forEach(c => { c.open = true; c.terrain = null; c.unit = null; });
  G.P.bar.forEach(s => s.unit = null);
  // 应用地形（坐标匹配最近格；pass 置不可部署，high 保留可部署并 +射程）
  for (const t of (lvl.terrain || [])) {
    let best = null, bd = 1e9;
    for (const c of G.P.cells) { const d = Math.hypot(c.x - t.x, c.y - t.y); if (d < bd) { bd = d; best = c; } }
    if (best) { best.terrain = t.mod; if (t.mod === 'pass') best.open = false; }
  }
  // 预置部队入合成栏（玩家随后手动部署到棋盘）
  for (const p of lvl.playerPreset) {
    for (let k = 0; k < p.count; k++) {
      const i = barFree(G.P); if (i < 0) break;
      G.P.bar[i].unit = mkTroop(p.troopId); G.P.bar[i].unit.animT = 0.25;
    }
  }
  G.banner = { txt: '【群雄演武】' + lvl.name + ' · 布阵后开战（第1/' + lvl.par + '次）', t: 3 };
}

// 群雄演武：清空棋盘与栏，按当前关预置重新入栏（不消耗尝试）
function puzzleResetToPrep() {
  G.P.cells.forEach(c => c.unit = null);
  G.P.bar.forEach(s => s.unit = null);
  const lvl = G.puzzle.cur;
  for (const p of lvl.playerPreset) {
    for (let k = 0; k < p.count; k++) {
      const i = barFree(G.P); if (i < 0) break;
      G.P.bar[i].unit = mkTroop(p.troopId); G.P.bar[i].unit.animT = 0.25;
    }
  }
}

// 群雄演武：开战（一次性生成固定敌阵，进入 auto-battle）
function puzzleStartAttempt() {
  if (!G.puzzle.prep || G.puzzle.started) return;
  G.puzzle.prep = false; G.puzzle.started = true; G.puzzle.spawned = true; G.puzzle.attemptT = 0;
  G.P.mobs = [];
  for (const e of G.puzzle.cur.enemyFormation) {
    spawnMob(G.P, e.mobId, 1.0);
    const m = G.P.mobs[G.P.mobs.length - 1];
    m.x = e.x; m.y = e.y; m.d = pathDAt(G.P, e.x, e.y); m.flash = 0;
  }
  G.banner = { txt: '开战！歼灭敌阵', t: 1.2 };
}

// 群雄演武：本次尝试失败 → 消耗一次尝试；仍有余次则重置布阵，否则判负
function puzzleAttemptFail() {
  G.puzzle.attempt++;
  if (G.puzzle.attempt > G.puzzle.maxAttempts) {
    G.rewardTxt = '残局未破 · 尝试耗尽 (' + G.puzzle.maxAttempts + ')';
    endBattle(false);
    return;
  }
  G.P.hp = G.P.maxhp; G.P.shield = 0;
  G.P.mobs = [];
  puzzleResetToPrep();
  G.puzzle.started = false; G.puzzle.prep = true; G.puzzle.spawned = false; G.puzzle.attemptT = 0;
  G.state = 'play';
  G.banner = { txt: '第 ' + G.puzzle.attempt + '/' + G.puzzle.maxAttempts + ' 次尝试 · 重新布阵', t: 2 };
}
