/* v2 战斗模拟：怪物围殴防线 / 单位攻击克制 / 武将技能 / 专武特效 / 灵蛇 / 压力怪 */
'use strict';

function fl(x, y, txt, col) {
  if (!G || G.floats.length > 60) return;
  G.floats.push({ x, y, txt, col, t: 0.8 });
}
function boom(x, y, col) {
  if (!G) return;
  for (let i = 0; i < 8 && G.parts.length < 200; i++)
    G.parts.push({ x, y, vx: rnd(-70, 70), vy: rnd(-100, 10), t: rnd(0.3, 0.7), col, r: rnd(1.5, 3.5) });
}

/* ---------- 伤害结算 ---------- */
function dealDmg(S, m, dmg, byUnit, cell) {
  if (m.hp <= 0) return;
  // 攻击方归属：S 是防守方（怪物侧），玩家攻击特效需用 byUnit 反查，不能用 S.side
  const atkSide = byUnit && G.P.cells.some(c => c.unit === byUnit) ? 1 : -1;
  // 克制
  const mb = MOBS[m.type];
  if (byUnit) {
    if (mb.armor && ((byUnit.t === 'troop' && byUnit.type === '枪') || (byUnit.t === 'hero' && HEROES[byUnit.name].wq === '枪'))) { dmg *= 2; if (atkSide > 0) { boom(m.x, m.y, '#ffd43b'); fl(m.x, m.y - 18, '暴击!', '#ffd43b'); } }
    if (m.type === '弩' && byUnit.t === 'troop' && byUnit.type === '骑') { dmg *= 2; if (atkSide > 0) { boom(m.x, m.y, '#ffd43b'); fl(m.x, m.y - 18, '暴击!', '#ffd43b'); } }
    if (m.type === '骑' && byUnit.t === 'hero' && HEROES[byUnit.name].vs骑) { dmg *= HEROES[byUnit.name].vs骑; if (atkSide > 0) { boom(m.x, m.y, '#ffd43b'); fl(m.x, m.y - 18, '暴击!', '#ffd43b'); } }
  }
  if (mb.armor) dmg *= 1 - mb.armor;
  m.hp -= dmg; m.flash = 0.12;
  // 被动概率眩晕（马超/关兴/张苞）
  if (byUnit && byUnit.t === 'hero' && HEROES[byUnit.name].stunP && Math.random() < HEROES[byUnit.name].stunP && m.hp > 0)
    m.stun = Math.max(m.stun, 1);
  if (m.hp > 0) return;
  m.dead = true;
  const gain = m.gold + (G.goldAdd || 0);                   // 击杀奖励 = 基础 + floor(关卡/3)
  S.mantou += gain;
  S.killCnt++;
  if (S.side > 0) {                          // 连杀：5秒内3杀→攻速+20%（独立计数，不干扰压力怪killCnt）
    S.combo++; S.comboT = 5;
    if (S.combo === 3) { G.banner = { txt: '连杀! 攻速+20%', t: 1.2 }; fl(m.x, m.y - 30, '连杀 x' + S.combo, '#ffd43b'); }
    else if (S.combo > 3 && S.combo % 5 === 0) { fl(m.x, m.y - 30, '连杀 x' + S.combo, '#ffd43b'); }
  }
  if (S.side > 0) {
    fl(m.x, m.y, '+' + gain, '#8b5e3c'); boom(m.x, m.y, '#e03131');
    sfx(m.boss ? 'boss' : 'kill');                          // 音效（P1-3）
    if (m.boss) { G.goldEarn += m.gold; SAVE.mat++; fl(m.x, m.y - 16, '材料+1', '#e8a005'); }
    if (SAVE.stats) SAVE.stats.kills++;                     // P2-2 统计
  }
  // 压力怪：每满阈值给对方生成（阈值随关卡/难度缩放）
  const pk = pressureKills(G.stage || 1, SAVE.difficulty || 'normal');
  if (S.killCnt >= pk) {
    S.killCnt = 0;
    const opp = S === G.P ? G.E : G.P;
    spawnMob(opp, '卒', G.hpMul * 2, true);
    if (opp.side > 0) fl(opp.path[0][0] + 20, opp.path[0][1], '压力怪!', '#c0392b');
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
  if (S.side > 0) fl(holder.x, holder.y - 22, '-' + Math.round(d), '#ff6b6b');
  if (u.hp > 0) return;
  if (holder.unit) {
    if (S.side > 0) { fl(holder.x, holder.y, (u.t === 'hero' ? u.name : u.type || '') + '阵亡', '#868e96'); boom(holder.x, holder.y, '#868e96'); }
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
  const ts = S.mobs.filter(m => m.hp > 0 && Math.hypot(m.x - sn.x, m.y - sn.y) <= 44);
  if (!ts.length) return;
  sn.acc = 0;
  dealDmg(S, ts[0], 8);
  if (Math.random() < 0.25 && ts[0].hp > 0) ts[0].stun = Math.max(ts[0].stun, 0.6);
}

/* ---------- 单位攻击 ---------- */
function inRangeMobs(S, x, y, rng) {
  return S.mobs.filter(m => m.hp > 0 && Math.hypot(m.x - x, m.y - y) <= rng)
    .sort((a, b) => b.d - a.d);
}
function heroHits(S, u, cell, n, mul) {         // 随机 n 段打击
  for (let i = 0; i < n; i++) {
    const alive = S.mobs.filter(m => m.hp > 0);
    if (!alive.length) return;
    const m = alive[(Math.random() * alive.length) | 0];
    dealDmg(S, m, unitStats(u, S).dmg * mul, u, cell);
    G.fx.push({ type: 'line', x1: cell.x, y1: cell.y, x2: m.x, y2: m.y, t: 0.15, t0: 0.15, col: '#e8a005' });
  }
}
function castSkill(S, cell, u) {
  const sk = HEROES[u.name].skill, st = unitStats(u, S);
  if (sk.id === 'qjqc') {                                   // 七进七出
    if (!S.mobs.some(m => m.hp > 0)) return false;
    heroHits(S, u, cell, 7, 1.5);
    if (S.side > 0) { G.banner = { txt: u.name + '·七进七出!', t: 1.2 }; G.flash = 0.5; }
  } else if (sk.id === 'dahe' || sk.id === 'shengjian') {   // 大喝 / 圣剑
    const ts = inRangeMobs(S, cell.x, cell.y, sk.r);
    if (!ts.length) return false;
    for (const m of ts) {
      dealDmg(S, m, st.dmg * (sk.id === 'dahe' ? 1.2 : 2), u, cell);
      if (m.hp > 0) m.stun = Math.max(m.stun, sk.stun);
    }
    G.fx.push({ type: 'ring', x: cell.x, y: cell.y, r: sk.r, t: 0.35, t0: 0.35, col: '#9c36b5' });
    if (sk.id === 'dahe' && u.weapon === 'shemao') for (const sn of S.snakes) sn.buffT = 5;
  } else if (sk.id === 'tiaopi') {                          // 跳劈：强化接下来 n 击
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
  if (u.weapon === 'guding' && Math.random() < 0.25) { dmg *= 2; fl(m.x, m.y - 14, '暴击!', '#e8a005'); }
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
  const st = unitStats(u, S);
  // 技能冷却
  if (u.t === 'hero' && HEROES[u.name].skill) {
    u.cd -= dt;
    if (u.cd <= 0 && castSkill(S, cell, u)) u.cd = skillCd(u);
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

/* ---------- 怪物 ---------- */
function spawnMob(S, type, hpMul, press) {
  const b = MOBS[type];
  const hp = (b.hp + (b.boss ? 0 : (G.hpAdd || 0))) * hpMul * (press ? 1.5 : 1);   // HP=基础+关卡加成
  S.mobs.push({
    type, hp, maxhp: hp, phase: 1, phaseDone: { 2: false, 3: false },
    spd: b.spd, atk: b.atk * (G.atkMul || 1) * Math.sqrt(hpMul), dmg: b.dmg, gold: b.gold, boss: !!b.boss, press: !!press,
    d: 0, x: S.path[0][0], y: S.path[0][1], stun: 0, flash: 0, atkT: 0, castT: b.castIv || 0, slowT: 0,
  });
}
function bossCast(S, m, mb) {                   // BOSS 周期技能（文档 5.3）
  if (mb.cast === 'shehun') {                               // 张梁：全军瘫痪
    for (const c of S.cells) if (c.unit) c.unit.stun = mb.stunT;
    if (S.side > 0) { G.banner = { txt: mb.name + '·摄魂! 全军瘫痪', t: 1.5 }; G.flash = 0.5; }
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
    if (m.castT <= 0) { m.castT = mb.castIv; bossCast(S, m, mb); }
  }
  let spd = m.spd * (m.slowT > 0 ? 0.5 : 1) * (S.slowT > 0 ? 0.5 : 1);
  if (mb.charge && m.hp < m.maxhp * 0.5) spd *= 2;          // 重甲骑兵：半血冲锋
  if (mb.archer) {                                          // 弩：远程射单位/阿斗
    m.atkT += dt;
    const tc = S.cells.find(c => c.unit && c.unit.t !== 'char' && c.unit.t !== 'shovel' && Math.hypot(m.x - c.x, m.y - c.y) <= 90);
    if (tc) {
      if (m.atkT >= 1.5) {
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
  if (S.side > 0) { G.flash = 0.4; fl(S.adou.x, S.adou.y - 30, '阿斗受袭 -' + dmg, '#e03131'); sfx('hurt'); }  // 音效（P1-3）
  if (S.hp <= 0 && S.side > 0 && hasItem('xuming') && !S.xumingUsed) {
    S.xumingUsed = true; S.hp = 3;
    G.banner = { txt: '续命丹! 阿斗回魂', t: 1.5 };
  }
}
