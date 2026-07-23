/* v2 合成算法 + 单位数值（品级/等级/装备/羁绊） + 回收 */
'use strict';

/* 单位模型：
   troop: {t:'troop', type, tier(1..5), hp, acc}
   char : {t:'char', ch}
   hero : {t:'hero', name, lvl, kills, hp, acc, cd, buffN, rateMul, weapon}
   shovel: {t:'shovel'} */

function mkTroop(type) {
  return { t: 'troop', type, tier: 1, hp: TROOPS[type].hp, acc: 0 };
}
function mkHero(name, side, permanent = false) {
  const b = HEROES[name];
  const weapon = (side && side.side > 0 && SAVE.equips[name]) || null;
  const isPermanent = permanent && side && side.side > 0;
  const star = isPermanent ? heroStar(name) : 0;
  return { t: 'hero', name, lvl: 1, kills: 0, hp: b.hp * (isPermanent ? heroStarMul(name) : 1), acc: 0, cd: b.skill ? b.skill.cd : 0, buffN: 0, rateMul: 1, weapon, stun: 0, awaken: 0, permanent: isPermanent, star };
}

/* 拖 src 到 dst：升级 | 成将 | 道具 | 互换。
   将字合成自动识别正反拖拽方向：无论“吕→布”还是“布→吕”，都会合成吕布。 */
function mergeUnit(dst, src) {
  if (dst.t === 'troop' && src.t === 'troop' && dst.type === src.type && dst.tier === src.tier && dst.tier < 5) {
    const u = mkTroop(dst.type);
    u.tier = dst.tier + 1;
    u.hp = TROOPS[dst.type].hp * TIER_MUL[u.tier - 1];
    return { type: 'upgrade', unit: u };
  }
  if (dst.t === 'char' && src.t === 'char') {
    const forward = dst.ch + src.ch, backward = src.ch + dst.ch;
    if (HEROES[forward]) return { type: 'hero', name: forward };
    if (HEROES[backward]) return { type: 'hero', name: backward };
  }
  if (dst.t === 'ifrag' && src.t === 'ifrag' && dst.ch === src.ch) {   // 道具碎片：集齐 need 合成整件
    const n = dst.n + src.n;
    if (n >= IFRAGS[dst.ch].need) return { type: 'item', id: IFRAGS[dst.ch].item };
    return { type: 'upgrade', unit: { t: 'ifrag', ch: dst.ch, n } };
  }
  return { type: 'swap' };
}

/* 羁绊：扫描棋盘武将集合 */
function fateBuff(S) {
  const names = new Set();
  for (const c of S.cells) if (c.unit && c.unit.t === 'hero') names.add(c.unit.name);
  const buff = { dmg: 1, rate: 1, def: 1, list: [] };
  for (const f of FATES) {
    const on = f.pairs ? f.pairs.some(p => p.every(n => names.has(n)))
      : f.need.every(n => names.has(n));
    if (!on) continue;
    buff.dmg *= f.dmg || 1; buff.rate *= f.rate || 1; buff.def *= f.def || 1;
    buff.list.push(f.name);
  }
  return buff;
}

/* 汇总攻击数值（不含每击特效判定） */
function unitStats(u, S) {
  const fb = S.fate || { dmg: 1, rate: 1 };
  const comboMul = (S && S.side > 0 && S.combo >= 3) ? 1.2 : 1;   // 连杀攻速buff（p5：5秒内3杀→攻速+20%）
  const modeDmg = (typeof G !== 'undefined' && G && G.mode === 'rogue' && G.rogue) ? G.rogue.dmg : 1;
  const modeRate = (typeof G !== 'undefined' && G && G.mode === 'rogue' && G.rogue) ? G.rogue.hp : 1;
  // 遗物系统：本局玩家全军增益（仅玩家侧生效）
  const pD = (typeof G !== 'undefined' && G && G.playerDmgMul) ? G.playerDmgMul : 1;
  const pR = (typeof G !== 'undefined' && G && G.playerRateMul) ? G.playerRateMul : 1;
  const pH = (typeof G !== 'undefined' && G && G.playerHpMul) ? G.playerHpMul : 1;
  if (u.t === 'troop') {
    const b = TROOPS[u.type];
    return { ...b, dmg: b.dmg * TIER_MUL[u.tier - 1] * fb.dmg * modeDmg * pD, rate: b.rate * fb.rate * comboMul * modeRate * pR, maxhp: b.hp * TIER_MUL[u.tier - 1] * pH };
  }
  const b = HEROES[u.name];
  const aw = u.awaken || 0, awMul = aw ? Math.pow(1.3, aw) : 1;
  let dmg = b.dmg * HERO_LVL_DMG(u.lvl) * awMul, rng = b.rng * awMul, rate = b.rate * u.rateMul * HERO_LVL_RATE(u.lvl) * awMul, splash = b.splash || 0;
  if (u.permanent) { const sm = heroStarMul(u.name); dmg *= sm; rate *= 1 + (sm - 1) * 0.5; }
  if (SAVE.gearOn && SAVE.equipAcc && ACCESSORIES[SAVE.equipAcc]) rate *= ACCESSORIES[SAVE.equipAcc].spd;
  const w = u.weapon;
  if (w === 'b_dao' || w === 'b_qng' || w === 'b_gong' || w === 'b_jian') dmg *= 1.12;
  if (w === 'hutou') dmg *= 1.4;
  if (w === 'tietai') dmg *= 1.25;
  if (w === 'bawang') rng *= 1.3;
  if (w === 'luori') rng *= 2;
  if (w === 'qinglong') dmg *= 1.2;
  // 补齐沉默武器（与同类武器幅度一致，专武略强）
  if (w === 'guding') dmg *= 1.15;                      // 古锭刀：刀系 +15%
  if (w === 'diangang') dmg *= 1.1;                     // 点钢枪：枪系 +10%（pierceN 在 updUnit 已 +1）
  if (w === 'goulian') dmg *= 1.08;                     // 钩镰枪：+8%（20%概率减速已在 battle.js）
  if (w === 'longdan') { dmg *= 1.25; rate *= 0.85; }   // 龙胆·赵云专武：+25% 攻 +15% 速
  if (w === 'shemao') { dmg *= 1.3; rng *= 1.15; }      // 丈八蛇矛·张飞专武：+30% 攻 +15% 射程
  if (w === 'yitian') dmg *= 1.1;                       // 倚天剑·刘备专武：+10% 攻（cd*0.7 已在 skillCd）
  // 刘备光环：全队增伤（优先用每帧缓存的 S.auraSum，避免每单位遍历 cells）
  let aura = 1;
  if (S && typeof S.auraSum === 'number') {
    const ua = (u.t === 'hero' && HEROES[u.name].aura) ? HEROES[u.name].aura : 0;
    aura = S.auraSum - ua;
  } else if (S) {
    for (const c of S.cells) if (c.unit && c.unit.t === 'hero' && HEROES[c.unit.name].aura && c.unit !== u) aura += HEROES[c.unit.name].aura;
  }
  return { ...b, dmg: dmg * fb.dmg * aura * modeDmg * pD, rng, rate: rate * fb.rate * comboMul * modeRate * pR, splash, maxhp: b.hp * HERO_LVL_HP(u.lvl) * awMul * pH };
}
function skillCd(u) {
  const cd = HEROES[u.name].skill.cd;
  return u.weapon === 'yitian' ? cd * 0.7 : cd;
}

/* 回收返还（文档 7.1：+5×等级，铲子+10；垃圾桶 ×1.5） */
function refundValue(u, S) {
  let v = u.t === 'troop' ? 5 * u.tier
    : u.t === 'char' ? 5 : u.t === 'hero' ? 30 : u.t === 'ifrag' ? 3 * u.n : 10;
  if (S.side > 0 && hasItem('lajitong')) v = Math.round(v * 1.5);
  return v;
}
