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
    G.puzzle = { target: 18, limit: 75, stars: 3 };
    G.P.mantou = 45;
    G.banner = { txt: '【群雄演武】75 秒内歼灭 18 名敌军 · 限定残局', t: 3 };
  } else if (G.mode === 'raid') {
    G.raid = { limit: 90, phase: 1, bossSpawned: false };
    G.P.mantou = 80;
    G.banner = { txt: '【黄巾讨伐】90 秒内击破张角军阵', t: 3 };
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
    G.puzzle.limit -= dt;
    if (G.P.totalKills >= G.puzzle.target) { G.puzzle.stars = G.puzzle.limit > 45 ? 3 : G.puzzle.limit > 20 ? 2 : 1; G.rewardTxt = '演武 ' + G.puzzle.stars + ' 星'; endBattle(true); }
    else if (G.puzzle.limit <= 0) { G.rewardTxt = '未完成歼敌目标'; endBattle(false); }
  } else if (G.mode === 'raid') {
    G.raid.limit -= dt;
    if (!G.raid.bossSpawned && G.time > 4) { G.raid.bossSpawned = true; spawnMob(G.P, '兽', 2.4); G.banner = { txt: '讨伐目标：铁甲巨兽现身！', t: 2 }; }
    const boss = G.P.mobs.find(m => m.boss);
    if (G.raid.bossSpawned && !boss) { G.rewardTxt = '讨伐成功 · 剩余 ' + Math.ceil(Math.max(0, G.raid.limit)) + ' 秒'; endBattle(true); }
    else if (G.raid.limit <= 0) { G.rewardTxt = '讨伐时间耗尽'; endBattle(false); }
  }
}

function modeWaveConfig() {
  if (!G || !G.mode) return null;
  if (G.mode === 'rogue') return { waves: 1, per: 5 + G.rogue.floor * 2, mix: [45, 20, 20, 15], hp: 0.85 + G.rogue.floor * 0.12 };
  if (G.mode === 'puzzle') return { waves: 99, per: 6, mix: [45, 35, 10, 10], hp: 0.85 };
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
