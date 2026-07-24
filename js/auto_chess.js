/* 群雄争霸·自走棋 Phase 3：装备+主公+AI+羁绊+升星（隔离主线实时战斗） */
'use strict';

/* ---- 第一批武将（12名） ---- */
const AC_HEROES = [
  { id:'关平', cost:1, faction:'蜀', job:'猛将', atk:18, hp:110 }, { id:'周仓', cost:1, faction:'蜀', job:'盾', atk:13, hp:150 },
  { id:'李典', cost:1, faction:'魏', job:'猛将', atk:17, hp:115 }, { id:'潘璋', cost:1, faction:'吴', job:'近战', atk:16, hp:115 },
  { id:'黄盖', cost:2, faction:'吴', job:'盾', atk:24, hp:170 }, { id:'徐晃', cost:2, faction:'魏', job:'猛将', atk:27, hp:145 },
  { id:'魏延', cost:2, faction:'蜀', job:'骑', atk:29, hp:135 }, { id:'韩当', cost:2, faction:'吴', job:'弓', atk:28, hp:105 },
  { id:'赵云', cost:3, faction:'蜀', job:'骑', atk:39, hp:180 }, { id:'张郃', cost:3, faction:'魏', job:'枪', atk:37, hp:155 },
  { id:'马超', cost:4, faction:'蜀', job:'骑', atk:54, hp:220 }, { id:'郭嘉', cost:4, faction:'魏', job:'谋士', atk:51, hp:135 },
];

/* ---- 商店概率（2/4/6/8/10人口）---- */
const AC_PROB = { 2:[70,25,5,0], 4:[50,35,12,3], 6:[35,35,20,10], 8:[20,30,25,25], 10:[15,25,30,30] };

/* ---- 装备 ---- */
const AC_ITEMS = [
  { id:'青龙偃月刀', atk:30, desc:'攻击+30，普攻强化' },
  { id:'丈八蛇矛', atk:25, rate:20, desc:'攻击+25，攻速+20%' },
  { id:'方天画戟', atk:35, splash: true, desc:'攻击+35，范围攻击' },
  { id:'仁王盾', armor:25, desc:'护甲+25，物伤减免' },
  { id:'白银狮子', mr:25, heal:8, desc:'魔抗+25，每回合回复' },
  { id:'八卦阵', mr:20, desc:'魔抗+20，法术闪避' },
];

function acPick() {
  const probs = AC_PROB[Math.min(10, Math.max(2, (G.autoChess || {}).pop || 2))] || AC_PROB[2];
  let r = Math.random() * 100, tier = 1;
  for (let i = 0; i < probs.length; i++) { if ((r -= probs[i]) < 0) { tier = i + 1; break; } }
  const pool = AC_HEROES.filter(x => x.cost === tier);
  return { ...(pool[(Math.random() * pool.length) | 0] || AC_HEROES[0]), star: 1 };
}
function acShop() {
  if (G.autoChess.locked && G.autoChess.shop.length) return;
  G.autoChess.shop = Array.from({ length: 5 }, acPick);
}
function acUnit(c) { return { ...c, star: 1, uid: Math.random().toString(36).slice(2) }; }

/* ---- 合成 ---- */
function acMerge() {
  const cells = G.P.cells, groups = {};
  cells.forEach((c, i) => { if (c.unit) (groups[c.unit.id + '@' + c.unit.star] || (groups[c.unit.id + '@' + c.unit.star] = [])).push(i); });
  Object.keys(groups).forEach(k => {
    const ids = groups[k], parts = k.split('@'), next = +parts[1] + 1;
    if (ids.length >= 3 && next <= 3) {
      const keep = cells[ids[0]].unit;
      keep.star = next;
      // 升星只记录星级；战斗属性统一在 fightStats() 里计算，避免重复放大
      ids.slice(1, 3).forEach(i => cells[i].unit = null);
      G.autoChess.msg = keep.id + ' 升至 ' + next + ' 星！';
    }
  });
}
function acBoardCount() { return G.P.cells.filter(c => c.unit).length; }
function acPlace(u) {
  const c = G.P.cells.find(c => !c.unit);
  if (!c) return false;
  c.unit = acUnit(u);
  acMerge();
  return true;
}

/* ---- 羁绊 ---- */
function acBonds() {
  const us = G.P.cells.filter(c => c.unit).map(c => c.unit);
  const f = { 蜀: 0, 魏: 0, 吴: 0 }, j = {};
  us.forEach(u => { f[u.faction] = (f[u.faction] || 0) + 1; j[u.job] = (j[u.job] || 0) + 1; });
  return { f, j };
}
function acBondText() {
  const b = acBonds(), out = [];
  [['蜀', 12], ['魏', 10], ['吴', 10]].forEach(x => { if ((b.f[x[0]] || 0) >= 2) out.push(x[0] + '羁绊+' + x[1] + '%'); });
  [['猛将', 15], ['弓', 8], ['谋士', 15]].forEach(x => { if ((b.j[x[0]] || 0) >= 2) out.push(x[0] + '强化'); });
  return out.join(' · ') || '暂无激活羁绊';
}

function acBuy(i) {
  const a = G.autoChess, u = a.shop[i];
  if (!u || a.gold < u.cost || acBoardCount() >= a.pop) return;
  a.gold -= u.cost;
  acPlace(u);
  a.shop[i] = null;
  a.msg = '招募 ' + u.id + ' · ' + u.faction + ' ' + u.job;
}
function acEconomy() {
  const a = G.autoChess;
  const interest = Math.min(5, Math.floor(a.gold / 10));
  const streakBonus = Math.min(3, Math.floor(Math.abs(a.streak) / 2));
  a.gold += 5 + interest + streakBonus;
  a.lastIncome = { base: 5, interest, streak: streakBonus };
}
function acRefresh() {
  const a = G.autoChess;
  // 孙权·制衡：首刷免费
  if (a.lord && a.lord.name.startsWith('孙权') && !a.freeRefreshUsed) { a.freeRefreshUsed = true; }
  else if (a.gold < 2) return;
  else a.gold -= 2;
  acShop();
  a.msg = '商店已刷新';
}
function acToggleLock() {
  G.autoChess.locked = !G.autoChess.locked;
  G.autoChess.msg = G.autoChess.locked ? '商店已锁定' : '商店已解锁';
}
function acLevel() {
  const a = G.autoChess;
  const cost = [0, 0, 5, 10, 20, 30, 40, 50, 60, 70, 80][a.pop] || 80;
  if (a.pop >= 10 || a.gold < cost) return;
  a.gold -= cost; a.pop++;
  a.msg = '人口提升至 ' + a.pop;
}

/* ---- 装备与主公被动 ---- */
function acItemOffer() {
  const a = G.autoChess;
  a.itemChoices = [...AC_ITEMS].sort(() => Math.random() - .5).slice(0, 3);
  a.phase = 'loot'; a.timer = 0;
  a.msg = '选择一件战利品';
}
function acTakeItem(i) {
  const a = G.autoChess, it = a.itemChoices && a.itemChoices[i];
  if (!it) return;
  a.items.push({ ...it });
  a.itemChoices = null; a.phase = 'prep'; a.timer = 15;
  a.msg = '获得 ' + it.id + '：' + it.desc;
}
function acEquip(i) {
  const a = G.autoChess, it = a.items[i];
  if (!it) return;
  const c = G.P.cells.find(c => c.unit && !c.unit.item);
  if (!c) return;
  c.unit.item = it;
  // 装备只挂载到单位；实际属性统一由 fightStats() 计算，避免攻击力重复叠加
  a.items.splice(i, 1);
  a.msg = c.unit.id + ' 装备 ' + it.id;
}
function acLordEffect() {
  const a = G.autoChess, us = G.P.cells.filter(c => c.unit).map(c => c.unit);
  if (a.lord && a.lord.name.startsWith('刘备')) {
    const t = us[Math.floor(Math.random() * us.length)];
    if (t) { t.hp = Math.min(t.hp * 1.5, t.hp + Math.round(t.hp * 0.15)); a.msg = '仁德加持：' + t.id + ' 恢复生命'; }
  }
}
function acStart() {
  const a = G.autoChess;
  if (a.phase !== 'prep') return;
  a.phase = 'fight'; a.timer = 2.2;
  acLordEffect();
  acInitFightGrid();
  a.msg = '双方交战！';
}

function fightStats(u, side) {
  const a = G.autoChess, b = side === 'player' ? acBonds() : { f: {}, j: {} };
  const starMul = u.star === 3 ? 2.7 : u.star === 2 ? 1.7 : 1;
  let atk = u.atk * starMul, hp = u.hp * starMul;
  let armor = u.armor || 0, mr = u.mr || 0, rate = u.rate || 0, range = 64;
  // 阵营羁绊：实际进入伤害/生命计算
  const fc = b.f[u.faction] || 0;
  if (fc >= 2) { atk *= ({ 蜀: 1.12, 魏: 1.10, 吴: 1.10 }[u.faction] || 1); }
  const jc = b.j[u.job] || 0;
  if (jc >= 2) {
    if (u.job === '猛将') atk *= 1.15;
    if (u.job === '弓') { rate += 25; range = 120; }
    if (u.job === '谋士') atk *= 1.15;
    if (u.job === '盾') armor += 20;
  }
  const item = u.item;
  if (item) { atk += item.atk || 0; armor += item.armor || 0; mr += item.mr || 0; rate += item.rate || 0; if (item.range) range += item.range; }
  if (u.job === '盾') armor += 15;
  return { atk, hp, armor, mr, rate, range, splash: !!(item && item.splash), heal: item && item.heal || 0 };
}
function acInitFightGrid() {
  const a = G.autoChess;
  a.fightUnits = []; a.fightEnemy = [];
  const us = G.P.cells.filter(x => x.unit).map(x => x.unit);
  for (let i = 0; i < us.length; i++) {
    const st = fightStats(us[i], 'player'), ax = 40 + (i % 5) * 36, ay = 150 + Math.floor(i / 5) * 54;
    a.fightUnits.push({ ...us[i], side: 'player', ax, ay, stats: st, hp: st.hp, maxhp: st.hp, acc: 0, curX: ax, curY: ay, dead: false });
  }
  const ai = a.ai[(a.round - 1) % a.ai.length], en = ai.units;
  for (let i = 0; i < en.length; i++) {
    const st = fightStats(en[i], 'enemy'), ax = 210 + (i % 5) * 36, ay = 150 + Math.floor(i / 5) * 54;
    a.fightEnemy.push({ ...en[i], side: 'enemy', ax, ay, stats: st, hp: st.hp, maxhp: st.hp, acc: 0, curX: ax, curY: ay, dead: false });
  }
  a.fightTimer = 0; a.fightPhase = 'approach'; a.fightAI = ai;
}
function nAtkHp(u) { return fightStats(u, u.side === 'enemy' ? 'enemy' : 'player').hp; }

function acFightTick(dt) {
  const a = G.autoChess, us = a.fightUnits, en = a.fightEnemy;
  a.fightTimer += dt;
  const liveUs = us.filter(u => !u.dead), liveEn = en.filter(u => !u.dead);

  // 胜负判定
  if (!liveUs.length || !liveEn.length) {
    const win = liveUs.length > 0;
    a.lastFight = { win, enemy: a.fightAI.units, p: liveUs.length, e: liveEn.length, ai: a.fightAI.name };
    if (win) {
      a.streak = Math.max(1, a.streak + 1);
      a.fightAI.hp = Math.max(0, a.fightAI.hp - (15 + liveUs.length * 2));
      a.msg = '胜利 · 击败' + a.fightAI.name;
      if (a.lord && a.lord.name.startsWith('曹操')) a.gold += 1;
    } else {
      a.streak = Math.min(-1, a.streak - 1);
      a.hp -= 10 + liveEn.length * 2;
      a.msg = '失败 · ' + a.fightAI.name + '击退你';
    }
    acAfterCombat();
    return;
  }

  // 速度倍率
  const step = dt * 2;
  // 每个棋子向最近敌人移动+攻击
  const all = [...liveUs, ...liveEn];
  all.forEach(u => {
    const foes = u.side === 'player' ? liveEn : liveUs;
    if (!foes.length) return;
    // 寻最近敌人
    let best = null, bd = 1e9;
    foes.forEach(f => { const d = Math.hypot(u.curX - f.curX, u.curY - f.curY); if (d < bd) { bd = d; best = f; } });
    if (!best) return;
    if (u.job === '盾') {
      const near = foes.reduce((x, f) => Math.hypot(u.curX - f.curX, u.curY - f.curY) < Math.hypot(u.curX - x.curX, u.curY - x.curY) ? f : x, foes[0]);
      if (near) best = near;
    }
    const dx = best.curX - u.curX, dy = best.curY - u.curY, dist = Math.hypot(dx, dy) || 1;
    const attackRange = u.stats ? u.stats.range : 64;
    const charge = u.job === '骑' && a.fightTimer < 1.2 ? 1.55 : 1;
    if (dist > attackRange) {
      u.curX += (dx / dist) * step * 30 * charge;
      u.curY += (dy / dist) * step * 30 * charge;
    } else {
      u.acc += dt * (0.8 + ((u.stats && u.stats.rate) || 0) / 100);
      if (u.acc >= 1) {
        u.acc = 0;
        const raw = (u.stats ? u.stats.atk : nAtk(u)) * (0.9 + Math.random() * 0.2);
        const defense = (best.stats && (u.job === '谋士' ? best.stats.mr : best.stats.armor)) || 0;
        const dmg = Math.max(1, raw * (100 / (100 + defense)));
        best.hp -= dmg;
        G.fx.push({ type: 'line', x1: u.curX, y1: u.curY, x2: best.curX, y2: best.curY, t: 0.12, t0: 0.12, col: u.side === 'player' ? '#1c7ed6' : '#e03131' });
        if (best.hp <= 0) best.dead = true;
      }
    }
  });

  // 最长战斗 5 秒后强制结束（根据剩余血量判定）
  if (a.fightTimer > 5) {
    const win = liveUs.length >= liveEn.length;
    a.lastFight = { win, enemy: a.fightAI.units, p: liveUs.length, e: liveEn.length, ai: a.fightAI.name };
    if (win) {
      a.streak = Math.max(1, a.streak + 1);
      a.fightAI.hp = Math.max(0, a.fightAI.hp - (15 + liveUs.length * 2));
      a.msg = '僵持胜 · 击败' + a.fightAI.name;
      if (a.lord && a.lord.name.startsWith('曹操')) a.gold += 1;
    } else {
      a.streak = Math.min(-1, a.streak - 1);
      a.hp -= 10 + liveEn.length * 2;
      a.msg = '僵持败 · ' + a.fightAI.name + '击退你';
    }
    acAfterCombat();
  }
}
function acAfterCombat() {
  const a = G.autoChess;
  a.resultT = 1.4;
  a.phase = 'result';
  a.msg = a.lastFight && a.lastFight.win ? '战斗胜利！' : '战斗失败！';
}
function acAdvanceRound() {
  const a = G.autoChess;
  const alive = a.ai.filter(x => x.hp > 0).length;
  if (a.hp <= 0 || a.round >= 20 || alive <= 0) {
    G.rewardTxt = a.hp <= 0 ? '群雄争霸出局' : '群雄争霸完成';
    endBattle(a.hp > 0);
  } else {
    a.round++; a.phase = 'prep'; a.timer = 15;
    acEconomy();
    if (!a.locked) acShop();
    a.fightTimer = 0; a.fightUnits = null; a.fightEnemy = null; a.fightPhase = 'done';
    a.ai.forEach(x => {
      if (x.hp > 0) x.units = x.jobs.map((job, j) => {
        const pool = AC_HEROES.filter(h => h.job === job);
        const u = acUnit(pool[(a.round + j) % Math.max(1, pool.length)] || AC_HEROES[0]);
        u.star = a.round >= 10 && j === 0 ? 2 : 1;
        return u;
      });
    });
    if (a.round % 5 === 0 && a.items.length < 3) acItemOffer();
  }
}
function nAtk(u) { return (u.stats && u.stats.atk) || u.atk * (u.star === 2 ? 1.7 : u.star === 3 ? 2.7 : 1); }
function acMakeAI() {
  const plans = [
    ['曹魏', ['盾','猛将','枪']], ['东吴', ['弓','谋士','盾']], ['西蜀', ['骑','猛将','弓']],
    ['河北', ['盾','猛将','猛将']], ['荆襄', ['枪','弓','谋士']], ['江东', ['弓','弓','盾']], ['关中', ['骑','枪','猛将']]
  ];
  return plans.map(([name, jobs], i) => ({
    name, hp: 100, jobs,
    units: jobs.map(job => acUnit(AC_HEROES.filter(x => x.job === job)[i % Math.max(1, AC_HEROES.filter(y => y.job === job).length)] || AC_HEROES[i % AC_HEROES.length])),
  }));
}
function acChooseLord() {
  const a = G.autoChess;
  a.lord = a.lords[(a.lordIdx + 1) % a.lords.length];
  a.msg = a.lord.name + '：' + a.lord.desc;
}

/* ---- 状态机 ---- */
function autoChessSetup() {
  G.autoChess = {
    round: 1, gold: 3, hp: 100, pop: 2,
    phase: 'prep', timer: 15,
    shop: [], locked: false,
    items: [], itemChoices: null,
    freeRefreshUsed: false, streak: 0,
    msg: '选择主公并招募武将',
    lastFight: null,
    lords: [
      { name: '刘备·仁德', desc: '每回合开始恢复一名友军10%生命' },
      { name: '曹操·挟天子', desc: '每回合胜利额外获得1金' },
      { name: '孙权·制衡', desc: '每回合第一次刷新免费' },
    ],
    lordIdx: 0, lord: null,
    ai: acMakeAI(),
    fightTimer: 0, fightUnits: null, fightEnemy: null, fightPhase: null, fightAI: null,
    resultT: 0, combatSpeed: 1,
  };
  G.P.cells.forEach(c => { c.open = true; c.unit = null; });
  G.E.cells.forEach(c => { c.open = false; c.unit = null; });
  acShop();
  G.banner = { txt: '【群雄争霸】先选主公，再招募武将', t: 3 };
}
function autoChessTick(dt) {
  const a = G.autoChess;
  if (!a || G.state !== 'play') return;
  if (a.phase === 'prep') { a.timer -= dt; if (a.timer <= 0) acStart(); }
  else if (a.phase === 'fight') { if (!a.fightPhase) acInitFightGrid(); for (let i = 0; i < a.combatSpeed; i++) acFightTick(dt); }
  else if (a.phase === 'result') { a.resultT -= dt; if (a.resultT <= 0) acAdvanceRound(); }
}
function autoChessUnitGlyph(u) { return u ? u.id.slice(0, 1) : ''; }

/* ---- 绘制 ---- */
function drawAutoChess() {
  const a = G.autoChess;
  ctx.fillStyle = '#e9e0cd'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3f5648'; ctx.fillRect(0, 0, W, 32);
  txt('群雄争霸', 12, 22, 16, '#fffdf5', 'left', true);
  txt('第' + a.round + '/20回合', W / 2, 22, 12, '#f4d58b', 'center', true);
  txt('金 ' + a.gold + '  血 ' + a.hp + '  人口 ' + acBoardCount() + '/' + a.pop, W - 8, 22, 11, '#fffdf5', 'right', true);

  txt(a.phase === 'prep' ? '准备阶段 ' + Math.ceil(a.timer) + 's' : '自动战斗中', W / 2, 48, 12, a.phase === 'prep' ? '#a61e4e' : '#bd4a31', 'center', true);
  txt(a.lord ? a.lord.name : '主公未选 · 点击下方选择', W / 2, 68, 10, '#6b6256', 'center', true);

  // 战斗阶段绘制双方对战
  if (a.phase === 'fight' && a.fightUnits && a.fightEnemy) {
    ctx.fillStyle = '#1a2420'; ctx.fillRect(0, 120, W, H - 120 - 200);
    txt('⚔ 双方交战  · 速度×' + a.combatSpeed, W / 2, 110, 14, '#f4d58b', 'center', true);
    // 左侧=玩家棋子
    a.fightUnits.forEach(u => {
      if (u.dead) return;
      rr(u.curX - 16, u.curY - 16, 32, 32, 6);
      ctx.fillStyle = u.side === 'player' ? '#1c7ed6' : '#e03131';
      ctx.fill();
      txt(u.id.slice(0, 1), u.curX, u.curY + 6, 22, '#fff', 'center', true);
      // HP条
      const hpPct = Math.max(0, u.hp / u.maxhp);
      ctx.fillStyle = '#555'; ctx.fillRect(u.curX - 16, u.curY + 18, 32, 3);
      ctx.fillStyle = hpPct > 0.3 ? '#2f9e44' : '#e03131';
      ctx.fillRect(u.curX - 16, u.curY + 18, 32 * hpPct, 3);
    });
    // 右侧=敌人棋子
    a.fightEnemy.forEach(u => {
      if (u.dead) return;
      rr(u.curX - 16, u.curY - 16, 32, 32, 6);
      ctx.fillStyle = '#e03131';
      ctx.fill();
      txt(u.id.slice(0, 1), u.curX, u.curY + 6, 22, '#fff', 'center', true);
      const hpPct = Math.max(0, u.hp / u.maxhp);
      ctx.fillStyle = '#555'; ctx.fillRect(u.curX - 16, u.curY + 18, 32, 3);
      ctx.fillStyle = hpPct > 0.3 ? '#2f9e44' : '#e03131';
      ctx.fillRect(u.curX - 16, u.curY + 18, 32 * hpPct, 3);
    });
    txt('我方 ' + a.fightUnits.filter(u => !u.dead).length + ' vs ' + a.fightEnemy.filter(u => !u.dead).length + ' 敌', W / 2, H - 180, 12, '#aaa', 'center');
    btn(12, H - 145, 78, 28, '速度×' + a.combatSpeed, () => { a.combatSpeed = a.combatSpeed === 1 ? 2 : 1; }, { size: 9, bg: '#7250b8' });
    return;
  }
  if (a.phase === 'result') {
    panel(18, 150, 339, 210, { bg: a.lastFight && a.lastFight.win ? '#edf8ee' : '#fff0ed', stroke: a.lastFight && a.lastFight.win ? '#62a66b' : '#d66b5e', r: 14 });
    txt(a.lastFight && a.lastFight.win ? '⚔ 胜利' : '🛡 失败', W / 2, 195, 27, a.lastFight && a.lastFight.win ? '#2f8f46' : '#bd3b2d', 'center', true);
    txt(a.msg, W / 2, 224, 12, '#5f574e', 'center', true);
    txt('存活：我方 ' + (a.lastFight ? a.lastFight.p : 0) + ' · 敌方 ' + (a.lastFight ? a.lastFight.e : 0), W / 2, 254, 12, '#6b6256', 'center');
    txt('下一回合准备中…', W / 2, 300, 11, '#8a7e6c', 'center');
    return;
  }

  // 战利品选择
  if (a.phase === 'loot' && a.itemChoices) {
    panel(12, 80, 351, 100, { bg: '#fffbe6', stroke: '#f59f00', r: 10 });
    txt('⚔ 选择战利品', W / 2, 105, 14, '#8a6d3b', 'center', true);
    for (let i = 0; i < 3; i++) {
      const it = a.itemChoices[i];
      btn(16 + i * 118, 118, 110, 40, it.id, () => acTakeItem(i), { size: 9, bg: '#f59f00' });
    }
    return;
  }

  // 战报卡片
  panel(12, 82, 351, 42, { bg: '#f9f4e8', stroke: '#ccb98d', r: 8 });
  txt(a.lastFight ? (a.lastFight.win ? '上一战胜利 · ' + a.lastFight.ai : '上一战失败 · ' + a.lastFight.ai)
    : 'AI 对手：' + ((a.ai[(a.round - 1) % a.ai.length] || {}).name || '等待匹配'),
    W / 2, 100, 12, a.lastFight ? (a.lastFight.win ? '#318c4a' : '#bd3b2d') : '#6b6256', 'center', true);

  // 装备栏
  if (a.items.length) {
    const itY = 134;
    txt('装备包：', 8, itY + 8, 9, '#5f574e', 'left', true);
    for (let i = 0; i < a.items.length; i++) {
      btn(62 + i * 72, itY, 66, 18, a.items[i].id, () => acEquip(i), { size: 6, bg: '#7250b8' });
    }
    const chessY = a.items.length > 2 ? 162 : 154;
    drawChessBoard(chessY);
    drawACShop(chessY + 170);
  } else {
    drawChessBoard(150);
    drawACShop(320);
  }
}
function drawChessBoard(y0) {
  for (let i = 0; i < 10; i++) {
    const x = 42 + (i % 5) * 72, y = y0 + Math.floor(i / 5) * 76;
    rr(x - 25, y - 25, 50, 50, 8);
    ctx.fillStyle = '#f7f4ea'; ctx.fill();
    ctx.strokeStyle = i < 5 ? '#b78324' : '#79a2aa'; ctx.lineWidth = 2; ctx.stroke();
    const u = G.P.cells[i] && G.P.cells[i].unit;
    if (u) {
      txt(autoChessUnitGlyph(u), x, y + 7, 28, u.faction === '蜀' ? '#2f7f9d' : u.faction === '魏' ? '#555b78' : '#bd4a31', 'center', true);
      txt(u.id + '★' + u.star, x, y + 35, 7, '#6b6256', 'center');
      if (u.item) txt('⚡' + u.item.id, x, y - 18, 6, '#7250b8', 'center');
    }
  }
  txt('前排', 10, y0 + 3, 9, '#8a6d3b', 'left', true);
  txt('后排', 10, y0 + 79, 9, '#467d86', 'left', true);
}
function drawACShop(y0) {
  const a = G.autoChess;
  txt('商店 · 点击购买', W / 2, y0 - 6, 12, '#3f5648', 'center', true);
  for (let i = 0; i < 5; i++) {
    const u = a.shop[i], x = 8 + i * 73;
    panel(x, y0, 67, 83, { bg: u ? '#fffdf4' : '#e6dfd2', stroke: u ? (u.cost >= 3 ? '#9c36b5' : '#c8b58a') : '#d2c9ba', r: 7 });
    if (u) {
      txt(u.id, x + 33, y0 + 23, 14, u.cost >= 3 ? '#9c36b5' : '#6b6256', 'center', true);
      txt(u.cost + '费 ' + u.faction, x + 33, y0 + 42, 8, '#777', 'center');
      txt(u.job, x + 33, y0 + 57, 8, '#777', 'center');
      btn(x, y0, 67, 83, ' ' + u.id + ' ' + u.cost + '费', () => acBuy(i), { size: 8, bg: 'rgba(0,0,0,0)', disabled: a.gold < u.cost || acBoardCount() >= a.pop });
    }
  }
  const by = y0 + 90;
  btn(8, by, 80, 30, '刷新2金', acRefresh, { size: 9, bg: '#7250b8', disabled: a.gold < 2 });
  btn(92, by, 80, 30, '锁店' + (a.locked ? '开' : '关'), acToggleLock, { size: 9, bg: '#8a6d3b' });
  btn(178, by, 70, 30, '升人口', acLevel, { size: 8, bg: '#2f7f9d', disabled: a.pop >= 10 });
  btn(252, by, 113, 30, '开始战斗', acStart, { size: 9, bg: '#bd3b2d', disabled: a.phase !== 'prep' });
  btn(8, by + 40, 110, 27, '选主公', acChooseLord, { size: 10, bg: '#3f5648' });
  const b = acBonds();
  txt('羁绊：' + acBondText(), W / 2, by + 62, 9, '#5f574e', 'center', true);
  txt('阵容：' + (G.P.cells.filter(c => c.unit).map(c => c.unit.id + '★' + c.unit.star).join(' · ') || '暂无'), W / 2, by + 78, 8, '#777', 'center');
  btn(12, 610, 90, 28, '退出', () => { scr = 'modes'; }, { size: 10, bg: '#777' });
}
