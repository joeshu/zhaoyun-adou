/* v2 战斗模拟：怪物围殴防线 / 单位攻击克制 / 武将技能 / 专武特效 / 灵蛇 / 压力怪 */
'use strict';

// 统一飘字入口：所有 fl() 调用经此汇入 popFloat（info 类），保证淡出/封顶/样式统一（#3）。
function fl(x, y, txt, col) {
  popFloat(x, y, 'info', null, { txt, col });
}
// 统一上浮飘字类型（伤害/治疗/金/馒/暴击）；挂载受击、治疗、资源入账处（battle/actions/game）
const FLOAT_KINDS = {
  dmg:    { col: '#ff6b6b', size: 11 },
  heal:   { col: '#2f9e44', size: 11 },
  gold:   { col: '#b0801f', size: 13 },
  mantou: { col: '#8b5e3c', size: 13 },
  crit:   { col: '#ffd43b', size: 13 },
  info:   { col: '#868e96', size: 10 },
};
function popFloat(x, y, kind, val, opt) {
  if (!G || G.floats.length > 80) return;
  const k = FLOAT_KINDS[kind] || FLOAT_KINDS.info;
  let s = (opt && opt.txt != null) ? opt.txt : (val != null ? String(val) : '');
  if (val != null && (kind === 'gold' || kind === 'mantou')) s = '+' + val;
  G.floats.push({ x, y, txt: s, col: (opt && opt.col) || k.col, size: (opt && opt.size) || k.size, t: (opt && opt.t) || 0.9, t0: (opt && opt.t) || 0.9, vy: (opt && opt.vy) || 30 });
}
function boom(x, y, col) {
  if (!G) return;
  for (let i = 0; i < 8 && G.parts.length < 200; i++)
    G.parts.push({ x, y, vx: rnd(-70, 70), vy: rnd(-100, 10), t: rnd(0.3, 0.7), col, r: rnd(1.5, 3.5) });
}
// 径向爆裂粒子（击杀/技能爆发用，比 boom 更"炸"）
function boomRadial(x, y, col) {
  if (!G) return;
  for (let i = 0; i < 14 && G.parts.length < 200; i++) {
    const a = Math.random() * Math.PI * 2, sp = rnd(80, 200);
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: rnd(0.3, 0.7), col, r: rnd(2, 4) });
  }
}
// 单位死亡/消散演出：溶解环 + 轻微粒子（复用 fxRing/粒子骨架，不进入模拟逻辑，零回归风险）
function fxDissolve(x, y, col) {
  if (!G) return;
  fxRing(x, y, 16, col, 0.4);
  for (let i = 0; i < 6 && G.parts.length < 200; i++) {
    const a = Math.random() * Math.PI * 2, sp = rnd(20, 60);
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, t: rnd(0.3, 0.6), col, r: rnd(1.5, 3) });
  }
}
// 屏震：累积最大幅度，drawGame 每帧衰减
function addShake(m) { if (G) G.shake = Math.max(G.shake || 0, m); }

// 统一特效辅助（Phase 3 #38）：把 ring/line/lane 推入 G.fx，带默认时长，供各演出复用
function fxRing(x, y, r, col, t) { if (G) G.fx.push({ type: 'ring', x, y, r, t: t || 0.3, t0: t || 0.3, col }); }
function fxLine(x1, y1, x2, y2, col, t) { if (G) G.fx.push({ type: 'line', x1, y1, x2, y2, t: t || 0.12, t0: t || 0.12, col }); }
function fxLane(y, col, t) { if (G) G.fx.push({ type: 'lane', y, t: t || 0.25, t0: t || 0.25, col }); }

// 复用数组，消除战斗热路径每帧 Array.filter 分配（降低 iOS WebView GC 压力）
const _rangeScratch = [];
const _aliveScratch = [];

/* ---------- 伤害结算 ---------- */
function dealDmg(S, m, dmg, byUnit, cell) {
  if (m.hp <= 0) return;
  // 攻击方归属：S 是防守方（怪物侧），玩家攻击特效需用 byUnit 反查，不能用 S.side
  const atkSide = byUnit && G.P.cells.some(c => c.unit === byUnit) ? 1 : -1;
  // 克制
  const mb = MOBS[m.type];
  let crit = false;
  if (byUnit) {
    if (mb.armor && ((byUnit.t === 'troop' && byUnit.type === '枪') || (byUnit.t === 'hero' && HEROES[byUnit.name].wq === '枪'))) { dmg *= 2; crit = crit || atkSide > 0; if (atkSide > 0) { boom(m.x, m.y, '#ffd43b'); popFloat(m.x, m.y - 18, 'crit', null, { txt: '暴击!' }); } }
    if (m.type === '弩' && byUnit.t === 'troop' && byUnit.type === '骑') { dmg *= 2; crit = crit || atkSide > 0; if (atkSide > 0) { boom(m.x, m.y, '#ffd43b'); popFloat(m.x, m.y - 18, 'crit', null, { txt: '暴击!' }); } }
    if (m.type === '骑' && byUnit.t === 'hero' && HEROES[byUnit.name].vs骑) { dmg *= HEROES[byUnit.name].vs骑; crit = crit || atkSide > 0; if (atkSide > 0) { boom(m.x, m.y, '#ffd43b'); popFloat(m.x, m.y - 18, 'crit', null, { txt: '暴击!' }); } }
  }
  if (mb.armor) dmg *= 1 - mb.armor;
  // 黄巾讨伐（raid）弱点门控：仅当前暴露侧(左/中/右)的单位对该 Boss 造成满额伤害，
  // 其余区域攻击被护盾大幅减伤（shieldFactor）。迫使用户多向覆盖 + 随阶段轮换。
  if (typeof G !== 'undefined' && G && G.mode === 'raid' && m.raidBoss) {
    const atkCell = (byUnit && G.P.cells.find(c => c.unit === byUnit)) || null;
    const region = atkCell ? raidRegionOf(atkCell.x) : null;
    if (!region || region !== G.raid.exposed) dmg *= RAID_BOSS.shieldFactor;
  }
  m.hp -= dmg; m.flash = 0.12;
  // 暴击白闪 + BOSS 破防高光（Phase 3 #41）
  if (atkSide > 0 && crit) boom(m.x, m.y, '#ffffff');
  if (m.boss && !m.breakShown && m.hp > 0 && m.hp / m.maxhp < 0.5) {
    m.breakShown = true;
    if (atkSide > 0) { addShake(4); boomRadial(m.x, m.y, '#ffffff'); fl(m.x, m.y - 20, '破防!', '#ffffff'); if (G) G.flash = Math.max(G.flash, 0.3); }
  }
  // 被动概率眩晕（马超/关兴/张苞）
  if (byUnit && byUnit.t === 'hero' && HEROES[byUnit.name].stunP && Math.random() < HEROES[byUnit.name].stunP && m.hp > 0)
    m.stun = Math.max(m.stun, 1);
  if (m.hp > 0) return;
  m.dead = true;
  if (G.deaths) G.deaths.push({ x: m.x, y: m.y, type: m.type, boss: !!m.boss, t: 0.4, t0: 0.4, col: mb.boss ? '#a61e4e' : '#c0392b' });  // 死亡溶解演出层
  if (m.boss) { addShake(6); boomRadial(m.x, m.y, '#e8a005'); }   // BOSS 爆裂屏震
  const gain = m.gold + (G.goldAdd || 0);                   // 击杀奖励 = 基础 + floor(关卡/3)
  S.mantou += gain;
  S.killCnt++;
  S.totalKills = (S.totalKills || 0) + 1;
  if (S.side > 0 && G && G.mode === 'fire') G.modeScore = (G.modeScore || 0) + 1;
  if (S.side > 0) {                          // 连杀：5秒内3杀→攻速+20%（独立计数，不干扰压力怪killCnt）
    S.combo++; S.comboT = 5;
    if (S.combo === 3) { G.banner = { txt: '连杀! 攻速+20%', t: 1.2 }; popFloat(m.x, m.y - 30, 'crit', null, { txt: '连杀 x' + S.combo }); }
    else if (S.combo > 3 && S.combo % 5 === 0) { popFloat(m.x, m.y - 30, 'crit', null, { txt: '连杀 x' + S.combo }); }
  }
  if (S.side > 0) {
    popFloat(m.x, m.y, 'gold', gain); boom(m.x, m.y, '#e03131');
    sfx(m.boss ? 'boss' : 'kill');                          // 音效（P1-3）
    if (m.boss) { G.goldEarn += m.gold; SAVE.mat++; popFloat(m.x, m.y - 16, 'info', null, { txt: '材料+1', col: '#e8a005' }); }
    if (m.type === '粮') { S.mantou += 10; popFloat(m.x, m.y - 16, 'mantou', 10, { txt: '截获补给 +10馒' }); }
    if (SAVE.stats) SAVE.stats.kills++;
    if (typeof orderProgress === 'function') orderProgress('kills');
    if (typeof evKill === 'function') evKill(S.side, m);
  }
  // 压力怪：每满阈值给对方生成（阈值随关卡/难度缩放）
  const pk = pressureKills(G.stage || 1, SAVE.difficulty || 'normal');
  if (S.killCnt >= pk) {
    S.killCnt = 0;
    const opp = S === G.P ? G.E : G.P;
    const cap = mobCap(G.mode);
    if (opp.mobs.length < cap) {
      spawnMob(opp, '卒', G.hpMul * 2, true);
      if (opp.side > 0) fl(opp.path[0][0] + 20, opp.path[0][1], '压力怪!', '#c0392b');
    }
  }
  // 武将击杀升级
  if (byUnit && byUnit.t === 'hero' && byUnit.lvl < 5) {
    byUnit.kills++;
    if (byUnit.kills >= HERO_KILLS_UP(byUnit.lvl)) {
      byUnit.kills = 0; byUnit.lvl++;
      byUnit.hp = HEROES[byUnit.name].hp * HERO_LVL_HP(byUnit.lvl);
      if (byUnit.weapon === 'shemao') addSnake(S);
      if (S.side > 0 && cell) { fl(cell.x, cell.y - 26, byUnit.name + ' 升级!', '#e8a005'); boom(cell.x, cell.y, '#e8a005'); }
    }
  }
}
function damageUnit(S, holder, atk) {         // holder: cell 或 snake
  if (S.side > 0 && SAVE.invincible) return;   // 兵种无敌：玩家侧作战单位免伤（阿斗仍走 hurtAdou）
  const u = holder.unit || holder;
  let d = atk * (S.fate ? S.fate.def : 1);
  if (u.t === 'troop' && TROOPS[u.type].armor) d *= TROOPS[u.type].armor;
  u.hp -= d;
  // 打击反馈：受击闪白（复用 drawUnitAt 红描边）+ 伤害飘字（粒子留给击杀段，避免翻倍）
  u.animT = Math.max(u.animT || 0, 0.18);
  if (S.side > 0) popFloat(holder.x, holder.y - 22, 'dmg', Math.round(d));
  if (u.hp > 0) return;
  if (holder.unit) {
    if (S.side > 0) { fl(holder.x, holder.y, (u.t === 'hero' ? u.name : u.type || '') + '阵亡', '#868e96'); boom(holder.x, holder.y, '#868e96'); }
    if (u.permanent && S.side > 0 && G && Array.isArray(G.heroRespawns)) {
      G.heroRespawns.push({ name: u.name, t: 12 });
      fl(holder.x, holder.y - 14, u.name + '撤回整备·12秒', '#7250b8');
      if (typeof evHeroRespawn === 'function') evHeroRespawn(u.name);
    }
    holder.unit = null;
    S.fate = fateBuff(S);
  } else holder.dead = true;
}

/* ---------- 灵蛇（丈八蛇矛） ---------- */
function addSnake(S) {
  const k = S.snakes.length;
  const d = S.len * clamp(0.25 + k * 0.12, 0.1, 0.85);
  const p = pathPos(S.path, S.cum, d);
  S.snakes.push({ t: 'snake', x: p.x, y: p.y, hp: 150, acc: 0, buffT: 0 });
}
function updSnake(S, sn, dt) {
  if (sn.buffT > 0) sn.buffT -= dt;
  sn.acc += dt * (sn.buffT > 0 ? 2 : 1);
  if (sn.acc < 1) return;
  _aliveScratch.length = 0;
  for (const m of S.mobs) if (m.hp > 0 && Math.hypot(m.x - sn.x, m.y - sn.y) <= 44) _aliveScratch.push(m);
  if (!_aliveScratch.length) return;
  sn.acc = 0;
  dealDmg(S, _aliveScratch[0], 8);
  if (Math.random() < 0.25 && _aliveScratch[0].hp > 0) _aliveScratch[0].stun = Math.max(_aliveScratch[0].stun, 0.6);
}

/* ---------- 单位攻击 ---------- */
function inRangeMobs(S, x, y, rng) {
  _rangeScratch.length = 0;
  const r2 = rng * rng;
  for (const m of S.mobs) {
    if (m.hp <= 0) continue;
    const dx = m.x - x, dy = m.y - y;
    if (dx * dx + dy * dy <= r2) _rangeScratch.push(m);
  }
  _rangeScratch.sort((a, b) => b.d - a.d);   // 沿路径更靠前(距离基地更近)者优先，保持原排序语义
  return _rangeScratch;
}
function heroHits(S, u, cell, n, mul) {         // 随机 n 段打击
  _aliveScratch.length = 0;
  for (const m of S.mobs) if (m.hp > 0) _aliveScratch.push(m);
  for (let i = 0; i < n; i++) {
    if (!_aliveScratch.length) return;
    const m = _aliveScratch[(Math.random() * _aliveScratch.length) | 0];
    dealDmg(S, m, unitStats(u, S).dmg * mul, u, cell);
    G.fx.push({ type: 'line', x1: cell.x, y1: cell.y, x2: m.x, y2: m.y, t: 0.15, t0: 0.15, col: '#e8a005' });
  }
}
function castSkill(S, cell, u) {
  const sk = HEROES[u.name].skill, st = unitStats(u, S);
  if (sk.id === 'qjqc') {                                   // 七进七出
    if (!S.mobs.some(m => m.hp > 0)) return false;
    heroHits(S, u, cell, 7, 1.5);
    // 皮肤专属战斗特效：赵云非默认皮肤释放额外飞枪
    if (S.side > 0 && u.name === '赵云') {
      var skinId = (typeof currentSkin === 'function') ? (currentSkin('赵云') || {}).id : 'default';
      if (skinId && skinId !== 'default') { heroHits(S, u, cell, 3, 0.7); fl(cell.x, cell.y - 26, '飞枪!', '#1c7ed6'); }
    }
    if (S.side > 0) { G.banner = { txt: u.name + '·七进七出!', t: 1.2 }; G.flash = 0.5; addShake(3); }
  } else if (sk.id === 'dahe' || sk.id === 'shengjian') {   // 大喝 / 圣剑
    const ts = inRangeMobs(S, cell.x, cell.y, sk.r);
    if (!ts.length) return false;
    for (const m of ts) {
      dealDmg(S, m, st.dmg * (sk.id === 'dahe' ? 1.2 : 2), u, cell);
      if (m.hp > 0) m.stun = Math.max(m.stun, sk.stun);
    }
    // 张飞非默认皮肤大喝效果提升
    if (S.side > 0 && u.name === '张飞') {
      var zSkin = (typeof currentSkin === 'function') ? (currentSkin('张飞')||{}).id : 'default';
      if (zSkin && zSkin !== 'default') { for (var y = 0; y < ts.length; y++) if (ts[y].hp > 0) { ts[y].stun = Math.max(ts[y].stun, (sk.stun || 1.5) + 0.5); } }
    }
    G.fx.push({ type: 'ring', x: cell.x, y: cell.y, r: sk.r, t: 0.35, t0: 0.35, col: '#9c36b5' });
    if (S.side > 0) addShake(3);
    if (sk.id === 'dahe' && u.weapon === 'shemao') for (const sn of S.snakes) sn.buffT = 5;
  } else if (sk.id === 'tiaopi') {                          // 跳劈：强化接下来 n 击
      if (S.side > 0 && u.name === '关羽') {
        var cSkin = (typeof currentSkin === 'function') ? (currentSkin('关羽') || {}).id : 'default';
        if (cSkin === 'gold' || cSkin === 'red') { u.buffN = (sk.n || 2) + 1; fl(cell.x, cell.y - 22, '武圣加持', '#a61e4e'); }
      }
      if (!S.mobs.some(m => m.hp > 0)) return false;
      u.buffN = sk.n;
  } else if (sk.id === 'huojian') {                         // 火箭烈：全屏
    if (!S.mobs.some(m => m.hp > 0)) return false;
    for (const m of S.mobs) if (m.hp > 0) {
      dealDmg(S, m, st.dmg, u, cell);
      if (m.hp > 0) { m.stun = Math.max(m.stun, sk.stun); m.d = Math.max(0, m.d - 20); }
    }
    if (S.side > 0) G.banner = { txt: u.name + '·火箭烈!', t: 1 };
  } else if (sk.id === 'jianyu') {                          // 箭雨
    if (!S.mobs.some(m => m.hp > 0)) return false;
    heroHits(S, u, cell, sk.n, 1);
  } else return false;
  if (S.side > 0) sfx('skill');                  // 音效（P1-3）：技能释放
  return true;
}
function hitOne(S, u, cell, m, st) {            // 单发命中（含每击特效）
  let dmg = st.dmg;
  if (u.weapon === 'guding' && Math.random() < 0.25) { dmg *= 2; popFloat(m.x, m.y - 14, 'crit', null, { txt: '暴击!' }); }
  if (u.weapon === 'luori') dmg *= 1 + Math.hypot(m.x - cell.x, m.y - cell.y) / 300;
  if (u.weapon === 'goulian' && Math.random() < 0.2) { m.slowT = 2; }
  dealDmg(S, m, dmg, u, cell);
  if (u.weapon === 'longdan' && Math.random() < 0.1) {      // 飞枪全场
    heroHits(S, u, cell, 5, 0.8);
    if (S.side > 0) fl(cell.x, cell.y - 26, '飞枪!', '#1c7ed6');
  }
}
function updUnit(S, cell, dt) {
  const u = cell.unit;
  if (u.stun > 0) { u.stun = Math.max(0, u.stun - dt); return; }   // 眩晕中：减帧并跳过本帧行动
  if (u.t === 'char' || u.t === 'shovel') return;
  const st = unitStats(u, S, cell);
  // 技能冷却
  if (u.t === 'hero' && HEROES[u.name].skill) {
    u.cd -= dt;
    if (u.cd <= 0) {
      // 手动大招（Phase 2 #36）：实验室开启时玩家侧不自动释放，等待玩家点「大招」
      const manual = (typeof SAVE !== 'undefined' && SAVE.manualUlt && S.side > 0);
      if (manual) { if (u.cd < 0) u.cd = 0; }            // 保持就绪，不自动放
      else if (castSkill(S, cell, u)) u.cd = skillCd(u);
    }
  }
  u.acc = Math.min(1, u.acc + dt * st.rate);
  if (u.acc < 1) return;
  const targets = inRangeMobs(S, cell.x, cell.y, st.rng);
  if (!targets.length) return;
  u.acc = 0; u.animT = 0.2;
  const t0 = targets[0];
  G.fx.push({ type: 'line', x1: cell.x, y1: cell.y, x2: t0.x, y2: t0.y, t: 0.12, t0: 0.12, col: u.t === 'hero' ? '#e8a005' : '#868e96' });
  if (u.t === 'hero' && u.buffN > 0) {                      // 跳劈强化击
    u.buffN--;
    const sk = HEROES[u.name].skill;
    const r = sk.splash * (u.weapon === 'qinglong' ? 1.5 : 1);
    hitOne(S, u, cell, t0, st);
    for (const m of S.mobs)
      if (m !== t0 && m.hp > 0 && Math.hypot(m.x - t0.x, m.y - t0.y) <= r) dealDmg(S, m, st.dmg * 0.5, u, cell);
    if (t0.hp > 0) t0.d = Math.max(0, t0.d - 28);
    G.fx.push({ type: 'ring', x: t0.x, y: t0.y, r, t: 0.25, t0: 0.25, col: '#e8a005' });
    return;
  }
  const kind = st.kind;
  if (kind === 'single') hitOne(S, u, cell, t0, st);
  else if (kind === 'pierce') {
    let n = st.pierceN || 2;
    if (u.weapon === 'diangang') n++;
    targets.slice(0, n).forEach(m => hitOne(S, u, cell, m, st));
  } else if (kind === 'splash') {
    for (const m of S.mobs)
      if (m.hp > 0 && Math.hypot(m.x - t0.x, m.y - t0.y) <= st.splash) hitOne(S, u, cell, m, st);
    G.fx.push({ type: 'ring', x: t0.x, y: t0.y, r: st.splash, t: 0.25, t0: 0.25, col: '#adb5bd' });
  } else if (kind === 'lane') {                             // 赵云贯穿横道
    for (const m of S.mobs)
      if (m.hp > 0 && Math.abs(m.y - t0.y) < 24) hitOne(S, u, cell, m, st);
    G.fx.push({ type: 'lane', y: t0.y, t: 0.25, t0: 0.25, col: '#1c7ed6' });
  }
}


/* ---------- 羁绊组合技：完整阵容会周期性产生战术效果 ---------- */
function tickFateSkills(S, dt) {
  if (!S || !S.fate || !S.fate.list.length) return;
  for (const name of S.fate.list) S.fateCd[name] = Math.max(0, (S.fateCd[name] || 0) - dt);
  const ready = name => !(S.fateCd[name] > 0);
  if (S.fate.list.includes('桃园羁绊') && ready('桃园羁绊')) {
    S.fateCd['桃园羁绊'] = 25;
    for (const c of S.cells) if (c.unit && !noDeploy(c.unit)) { const st = unitStats(c.unit, S); c.unit.hp = Math.min(st.maxhp, c.unit.hp + st.maxhp * .22); }
    if (S.side > 0) { G.banner = { txt:'桃园结义：全军恢复', t:1.4 }; popFloat(187, 320, 'heal', null, { txt: '桃园结义 全军恢复', col: '#2f9e44' }); }
    if (typeof evFateSkill === 'function') evFateSkill('桃园羁绊');
  }
  if (S.fate.list.includes('五虎羁绊') && ready('五虎羁绊')) {
    S.fateCd['五虎羁绊'] = 30;
    for (const m of S.mobs) if (m.hp > 0) dealDmg(S, m, 35);
    if (S.side > 0) { G.banner = { txt:'五虎破阵：全线冲锋', t:1.4 }; G.fx.push({ type:'lane', y: 408, t:.5, t0:.5, col:'#e8a005' }); }
    if (typeof evFateSkill === 'function') evFateSkill('五虎羁绊');
  }
  if (S.fate.list.includes('父子羁绊') && ready('父子羁绊')) {
    S.fateCd['父子羁绊'] = 22;
    S.shield = Math.min(2, S.shield + 1);
    if (S.side > 0) { G.banner = { txt:'父子同心：阿斗护盾 +1', t:1.4 }; fl(187, 520, '护盾 +1', '#1c7ed6'); }
    if (typeof evFateSkill === 'function') evFateSkill('父子羁绊');
  }
}

function spawnMob(S, type, hpMul, press) {
  const b = MOBS[type];
  const hp = (b.hp + (b.boss ? 0 : (G.hpAdd || 0))) * hpMul * (press ? 1.5 : 1);   // HP=基础+关卡加成
  S.mobs.push({
    type, hp, maxhp: hp, phase: 1, phaseDone: { 2: false, 3: false },
    spd: b.spd, atk: b.atk * (G.atkMul || 1) * Math.sqrt(hpMul), dmg: b.dmg, gold: b.gold, boss: !!b.boss, press: !!press,
    d: 0, x: S.path[0][0], y: S.path[0][1], stun: 0, flash: 0, atkT: 0, castT: b.castIv || 0, warnCast: false, slowT: 0,
  });
}
function bossCast(S, m, mb) {                   // BOSS 周期技能（文档 5.3）
  if (typeof evBossSkill === 'function') evBossSkill(mb.name, mb.cast);
  if (mb.cast === 'shehun') {                               // 张梁：全军瘫痪
    for (const c of S.cells) if (c.unit) c.unit.stun = mb.stunT;
    if (S.side > 0) { G.banner = { txt: mb.name + '·摄魂! 全军瘫痪', t: 1.5 }; G.flash = 0.5; addShake(8); }
    G.fx.push({ type: 'ring', x: m.x, y: m.y, r: 130, t: 0.5, t0: 0.5, col: '#5f3dc4' });
  } else if (mb.cast === 'volley') {                        // 弓箭统领：箭雨射随机3格
    const occ = S.cells.filter(c => c.unit && !noDeploy(c.unit));
    for (let i = 0; i < 3 && occ.length; i++) {
      const c = occ.splice((Math.random() * occ.length) | 0, 1)[0];
      damageUnit(S, c, m.atk * 1.5);
      G.fx.push({ type: 'line', x1: m.x, y1: m.y, x2: c.x, y2: c.y, t: 0.2, t0: 0.2, col: '#c0392b' });
    }
    if (S.side > 0) G.banner = { txt: mb.name + '·箭雨!', t: 1 };
  } else if (mb.cast === 'summon') {                        // 曹操/司马懿/铁/帅/兽：按 BOSS 名召唤对应兵种
    const mob = { '重甲骑兵': '斧', '骑兵统帅': '骑', '铁甲巨兽': '卒', '曹操': '卒', '司马懿': '卒' }[mb.name] || '卒';
    for (let i = 0; i < 2; i++) {
      spawnMob(S, mob, G.hpMul || 1);
      S.mobs[S.mobs.length - 1].d = m.d;
    }
    if (S.side > 0) G.banner = { txt: mb.name + '·召唤援军!', t: 1 };
  }
}
function findBlocker(S, m, noTaunt) {           // 盾嘲讽优先（疾驰BOSS无视），其次贴身单位/灵蛇
  let taunt = null, near = null;
  for (const c of S.cells) {
    if (!c.unit || noDeploy(c.unit)) continue;
    const dist = Math.hypot(m.x - c.x, m.y - c.y);
    if (c.unit.t === 'troop' && TROOPS[c.unit.type].taunt && dist <= 46) taunt = taunt || c;
    if (dist <= 30 && !near) near = c;
  }
  if (taunt && !noTaunt) return taunt;
  if (near) return near;
  for (const sn of S.snakes) if (!sn.dead && Math.hypot(m.x - sn.x, m.y - sn.y) <= 30) return sn;
  return null;
}
function updMob(S, m, dt) {
  const mb = MOBS[m.type];
  if (m.flash > 0) m.flash -= dt;
  if (m.slowT > 0) m.slowT -= dt;
  if (m.stun > 0) { m.stun = Math.max(0, m.stun - dt); return; }   // 眩晕中：减帧并定身
  if (SAVE.bossPhase && m.boss && m.maxhp) {
    const r = m.hp / m.maxhp;
    if (r <= 0.3 && !m.phaseDone[3]) { m.phase = 3; m.phaseDone[3] = true; m.atk *= 1.3; if (typeof G !== 'undefined' && G) G.banner = { txt: m.name + '·狂暴!', t: 1.2 }; }
    else if (r <= 0.6 && !m.phaseDone[2]) { m.phase = 2; m.phaseDone[2] = true; m.spd *= 1.2; if (typeof G !== 'undefined' && G) G.banner = { txt: m.name + '·疾行!', t: 1.2 }; }
  }
  if (m.castT) {
    m.castT -= dt;
    if (m.boss && S.side > 0 && m.castT <= 1.5 && !m.warnCast) {
      m.warnCast = true;
      if (typeof evBossWarning === 'function') evBossWarning(mb.name);
      G.banner = { txt: mb.name + '即将发动：' + (mb.tip || '技能'), t: 1.5 };
    }
    if (m.castT <= 0) { m.castT = mb.castIv; m.warnCast = false; bossCast(S, m, mb); }
  }
  let spd = m.spd * (m.slowT > 0 ? 0.5 : 1) * (S.slowT > 0 ? 0.5 : 1);
  if (mb.charge && m.hp < m.maxhp * 0.5) spd *= 2;          // 重甲骑兵：半血冲锋
  if (mb.archer) {                                          // 弩：远程射单位/阿斗
    m.atkT += dt;
    const archerRng = mb.rng || 90;                        // 抽离原硬编码 90 → 数据驱动（mb.rng）
    const archerRate = mb.rate || 1.5;                     // 抽离原硬编码 1.5 → 数据驱动（mb.rate）
    const tc = S.cells.find(c => c.unit && c.unit.t !== 'char' && c.unit.t !== 'shovel' && Math.hypot(m.x - c.x, m.y - c.y) <= archerRng);
    if (tc) {
      if (m.atkT >= archerRate) {
        m.atkT = 0; damageUnit(S, tc, m.atk);
        G.fx.push({ type: 'line', x1: m.x, y1: m.y, x2: tc.x, y2: tc.y, t: 0.12, t0: 0.12, col: '#c0392b' });
      }
      return;
    }
    if (m.d >= S.len * 0.55) {
      if (m.atkT >= 5) {
        m.atkT = 0; hurtAdou(S, 1);
        G.fx.push({ type: 'line', x1: m.x, y1: m.y, x2: S.adou.x, y2: S.adou.y, t: 0.2, t0: 0.2, col: '#c0392b' });
      }
      return;
    }
  } else {
    const blk = findBlocker(S, m, mb.rush);                 // 骑兵统帅疾驰：无视嘲讽
    if (blk) {
      m.atkT += dt;
      const iv = mb.rage && m.hp < m.maxhp * 0.3 ? 0.5 : 1; // 曹操：低血攻速翻倍
      if (m.atkT >= iv) {
        m.atkT = 0;
        let atk = m.atk;
        if (m.type === '骑' && blk.unit && blk.unit.t === 'troop' && blk.unit.type === '弓') atk *= 2;
        damageUnit(S, blk, atk);
      }
      return;
    }
  }
  m.d += spd * dt;
  const p = pathPos(S.path, S.cum, m.d);
  m.x = p.x; m.y = p.y;
  if (S.side < 0) m.x += (G.colOff || 0);   // 动态路径：仅敌侧出兵口左右偏移
  if (m.d >= S.len) { m.dead = true; hurtAdou(S, m.dmg); }
}
function hurtAdou(S, dmg) {
  S.noHit = false;                                  // 本波已受击（无论被盾吸收还是扣血）
  if (S.side > 0 && S.shield > 0) {                 // 护盾吸收优先于续命丹
    S.shield--;
    fl(S.adou.x, S.adou.y - 30, '护盾抵消', '#1c7ed6');
    return;
  }
  if (S.side > 0 && SAVE.gearOn && SAVE.equipArmor && ARMORS[SAVE.equipArmor]) dmg *= (1 - ARMORS[SAVE.equipArmor].def);
    S.hp -= dmg;
    boom(S.adou.x, S.adou.y, '#e03131');
    if (S.side > 0) { G.flash = 0.4; addShake(4); popFloat(S.adou.x, S.adou.y - 30, 'dmg', dmg, { txt: '阿斗受袭 -' + dmg }); sfx('hurt'); }  // 音效（P1-3）
  if (S.hp <= 0 && S.side > 0 && hasItem('xuming') && !S.xumingUsed) {
    S.xumingUsed = true; S.hp = 3;
    G.banner = { txt: '续命丹! 阿斗回魂', t: 1.5 };
    popFloat(S.adou.x, S.adou.y - 30, 'heal', 3, { txt: '续命丹! 回魂', col: '#2f9e44' });
  }
}
