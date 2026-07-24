/* 特别玩法：复用现有合成、布阵、波次和战斗内核，专注于改变胜利目标。 */
'use strict';

const SPECIAL_MODES = [
  { id: 'fire', icon: '🔥', name: '赤壁火攻', sub: '守住水寨 · 借风焚敌', col: '#bd4a31', unlock: 6 },
  { id: 'rogue', icon: '⚔', name: '五虎试炼', sub: '随机军略 · 八战远征', col: '#7250b8', unlock: 10 },
  { id: 'escort', icon: '🐎', name: '长坂独胆', sub: '护送阿斗 · 三路突围', col: '#2f7f9d', unlock: 14 },
  { id: 'puzzle', icon: '♟', name: '群雄演武', sub: '每日残局 · 三星挑战', col: '#b78324', unlock: 4 },
  { id: 'raid', icon: '👑', name: '黄巾讨伐', sub: '90 秒讨伐 · 阶段 Boss', col: '#8d3543', unlock: 20 },
  { id: 'siege', icon: '🏯', name: '反向攻城', sub: '夺隘破垒 · 逆袭敌营', col: '#8a6d3b', unlock: 24 },
];
const specialMode = id => SPECIAL_MODES.find(m => m.id === id);
const modeUnlocked = m => SAVE.stage >= m.unlock;

/* 长坂独胆（escort）调参常量：全部以 G.mode==='escort' 门控，不影响其它模式/数值平衡。
   阿斗沿中央走廊(187)自底部(600)上行至长坂桥(BRIDGE_Y=70)；守军沿左右两翼部署。 */
const ESCORT_BRIDGE_Y = 70;          // 长坂桥（终点）y
const ESCORT_START_X = 187;          // 中央通道中轴
const ESCORT_START_Y = 600;          // 起点 y（≈底部）
const ESCORT_X_MIN = 126, ESCORT_X_MAX = 248;        // 阿斗横向微移钳制（走廊更宽，操控更友好）
const ESCORT_CORRIDOR_X0 = 100, ESCORT_CORRIDOR_X1 = 274;  // 走位空白带（输入命中区）
const ESCORT_V_BASE = 28, ESCORT_K = 0.04, ESCORT_CAP = 2.4, ESCORT_MOMENTUM = 1.0;
const ESCORT_R_BLOCK = 52, ESCORT_BLOCK_FAIL = 5;    // 拦截兵逼停半径 / 判负秒数（更宽容）
const ESCORT_INTERCEPT_CAP = 5;      // 同屏拦截兵上限
const ESCORT_TELE_ARROW = 1.8, ESCORT_TELE_ROCK = 1.4;    // 威胁 telegraph 时长（加长便于反应）
const ESCORT_ROCK_VY = 200, ESCORT_ARROW_HW = 44;          // 落石下落速度（稍慢）/ 箭雨半宽（稍微宽容）

/* 赤壁火攻（fire）调参常量：全部以 G.mode==='fire' 门控，不影响其它模式/数值平衡。
   玩家侧不刷镜像军，只点燃预置「火油格」借风焚敌，守住水寨(=PATH_E 末端)存活即胜。 */
const FIRE_TIME        = 120;   // 存活目标秒
const FIRE_WIND_T     = 22;    // 风向周期秒
const FIRE_BURN_T     = 5.0;   // 单格燃烧持续秒
const FIRE_WILD_T     = 2.5;   // 野火（非火油格）持续秒
const FIRE_SPREAD_DT  = 1.0;   // 蔓延间隔秒
const FIRE_R          = 44;    // 火格伤害半径(px)
const FIRE_DPS_SE     = 24;    // 东南风(顺)每秒伤害
const FIRE_DPS_NW     = 14;    // 西北风(逆)每秒伤害
const FIRE_SELF_DPS   = 8;     // 火噬己方单位每秒
const FIRE_STRONG_Y   = 90;    // 水寨带阈值(y<此值=顶部水寨区)
const FIRE_STRONG_HP  = 24;    // 水寨初始耐久
const FIRE_STRONG_DPS = 6;     // 火噬水寨每秒
const FIRE_BREACH_HP  = 3;     // 单敌抵水寨扣耐久
const FIRE_OIL_START  = 6;     // 控火油初值
const FIRE_OIL_MAX    = 10;    // 控火油上限
const FIRE_OIL_CD     = 3.0;   // 控火油回充间隔秒(另每击杀+1)
// 火油格：沿赤壁 MAPS[1].PATH_E 走线 + 两侧均布约 10 格（采样路径并垂直错开、钳制在战场/水寨带之外）
const FIRE_CELLS = (function () {
  const pts = MAPS[1].PATH_E, cum = pathCum(pts), len = cum[cum.length - 1];
  const N = 10, STEP = 18, cells = [];
  for (let i = 0; i < N; i++) {
    const d = (i + 0.5) / N * len;
    const p = pathPos(pts, cum, d);
    const p2 = pathPos(pts, cum, Math.min(len, d + 2));
    const dx = p2.x - p.x, dy = p2.y - p.y, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l, sgn = (i % 2 === 0) ? 1 : -1;   // 垂直错开两侧
    cells.push({
      x: Math.round(Math.max(24, Math.min(351, p.x + nx * STEP * sgn))),
      y: Math.round(Math.max(96, Math.min(286, p.y + ny * STEP * sgn))),
    });
  }
  return cells;
})();

/* 五虎试炼（rogue）调参常量：全部以 G.mode==='rogue' 门控，不影响其它模式/数值平衡。
   纵队(=G.P.mobs)沿专属 ROGUE_PATH 自玩家营(底)向敌营(顶)行军，与沿 ROGUE_PATH 反向的
   G.E.mobs(敌)对向相遇交火；构建(编成/羁绊/路线/数值)决定纵队战力，是胜负关键变量。
   注意：PATH_P/PATH_E 分处战场下半/上半、互不接触，原生无 mob 互战，故 rogue 用专属贯穿路径。 */
const ROGUE_MAX_FLOOR  = 8;
const ROGUE_POOL_HERO = ['赵云', '关羽', '张飞', '马超', '黄忠', '刘备'];  // 可编入纵队将军
const ROGUE_POOL_TROOP= ['枪', '弓', '刀', '盾', '骑'];                   // 可编入纵队兵种
const ROGUE_QUEUE_MAX  = 8;     // 纵队最大队列位
const ROGUE_ROUTES     = 3;     // 可切换行军路线数(=ROGUE_PATHS 变体)
const ROGUE_WAVE_PER  = f => 5 + f * 2;     // 每层敌数（沿用文档 2.5）
const ROGUE_WAVE_HP   = f => 0.85 + f * 0.12; // 每层敌 HP 曲线
// 军略池（apply 改写 column；含 2 条数值保底）——保底逻辑见 pickRogueStrats
const ROGUE_STRATS = [
  { n: '编入赵云', d: '纵队+赵云(领队技:将军突破)', apply: c => { c.lead = '赵云'; } },
  { n: '扩列',     d: '纵队队列 +2 位',            apply: c => { c.queue = c.queue.concat(['枪', '弓']).slice(0, ROGUE_QUEUE_MAX); } },
  { n: '解锁五虎', d: '常驻五虎羁绊',             apply: c => { if (!c.bonds.includes('五虎羁绊')) c.bonds.push('五虎羁绊'); } },
  { n: '疾行',     d: '纵队移速 +20%',            apply: c => { c.speedMul *= 1.2; } },
  { n: '变阵',     d: '切换行军路线',             apply: c => { c.route = (c.route + 1) % ROGUE_ROUTES; } },
  { n: '锋锐军略', d: '纵队伤害 +25%',            apply: c => { c.dmgMul *= 1.25; } },   // 数值保底
  { n: '坚壁军略', d: '纵队血量 +25%',           apply: c => { c.hpMul *= 1.25; } },    // 数值保底
];
// 纵队行军路径（贯穿全战场：玩家营[底] → 敌营[顶]）；3 条变体供「变阵」切换。
// 关键：路径为单侧缓弯（非蛇形往复），保证 G.P.mobs 上行与 G.E.mobs 反向下行始终在同一条线相遇、
// 真实交火；若用蛇形往复，双向行军会走路径的相反"车道"而错身而过、永不接战（实测验证）。
const ROGUE_PATHS = [
  [[187, 524], [187, 430], [187, 336], [187, 242], [187, 148], [187, 66]],            // 中道直行
  [[120, 524], [140, 400], [160, 280], [175, 150], [187, 66]],                        // 左翼斜插
  [[255, 524], [235, 400], [215, 280], [195, 150], [187, 66]],                        // 右翼斜插
];
// 选 3 条军略，保底至少 1 条数值(锋锐/坚壁)，兼容 chooseRogue「保底」结构
function pickRogueStrats() {
  const num = ROGUE_STRATS.filter(s => s.n === '锋锐军略' || s.n === '坚壁军略');
  const rest = ROGUE_STRATS.filter(s => s.n !== '锋锐军略' && s.n !== '坚壁军略');
  const pick = [num[(Math.random() * num.length) | 0]];
  while (pick.length < 3 && rest.length) pick.push(rest.splice((Math.random() * rest.length) | 0, 1)[0]);
  return pick.sort(() => Math.random() - 0.5);
}

/* ========== 五虎试炼（rogue）：战前编列 + 行军纵队 + 真实交火 ==========
   全部以 G.mode==='rogue' 门控；复用 ROGUE_PATHS 贯穿路径（G.P 上行 / G.E 反向下行），
   纵队(=G.P.mobs)与敌军(=G.E.mobs)对向相遇、于战场中道真实交火（原生无 mob 互战，
   故 rogueUpdMob 内做跨侧判定）。构建(column)决定纵队战力，是核心变量。 */
const ROGUE_LEAD_SKILL_INTERVAL = 4;     // 主将技(将军突破)冷却秒
const ROGUE_LEAD_SKILL_DMG_MUL = 1.8;    // 主将技伤害倍率（相对普攻）
const ROGUE_LEAD_SKILL_R        = 120;   // 主将技作用半径(px)
const ROGUE_TROOP_SPD = 32;              // 纵队兵种行军速度(px/s，引擎量级 兵30~骑62 取中段)
const ROGUE_HERO_SPD  = 30;              // 主将行军速度(px/s)
const ROGUE_QUEUE_GAP = 34;

/* ========== 反向攻城·夺隘(siege) ==========
   全部以 G.mode==='siege' 门控；玩家=进攻方沿 SIEGE_PATH 上行突破末端敌垒；
   敌方=静止工事(SIEGE_TOWERS)射击。不改动 fire/rogue/escort/puzzle/raid/普通模式任何逻辑与数值（铁律）。 */
const SIEGE_TIME = 90;          // 攻城时限秒
const SIEGE_PATH = [            // 玩家突击 PATH（长坂坡坐标系，单线自下而上，中段轻微蛇形便于两侧布防）
  [187,524],[187,470],[140,410],[187,350],[234,290],[187,230],[187,150],[187,76]
];
const SIEGE_FORT = { x:187, y:66, hp:260, maxhp:260 };  // 末端敌垒(=隘口)，血量归零=破城
const SIEGE_BREAK_MUL  = 1.0;   // 突破力倍率（作用于每兵 break）
const SIEGE_RUSH_CD    = 12;    // 突进令 CD 秒
const SIEGE_RUSH_DUR   = 4;     // 突进持续秒
const SIEGE_RUSH_SPD   = 1.6;   // 突进期间突击队移速倍率
const SIEGE_FOCUS_CD   = 16;    // 集火令 CD 秒
const SIEGE_FOCUS_DUR  = 5;     // 集火持续秒
const SIEGE_FOCUS_BREAK= 1.8;   // 集火期间突破力额外倍率（砸城更强）
const SIEGE_HEAL_CD    = 20;    // 鼓舞令 CD 秒
const SIEGE_HEAL_AMT   = 0.35;  // 鼓舞：突击队按最大生命回复比例
const SIEGE_TOWER_DEFS = {      // 工事类型（镜像玩家塔量级，数据驱动）
  箭塔: { glyph:'箭', range:90,  rate:1.5, dmg:9,  col:'#c0392b' },
  炮塔: { glyph:'炮', range:112, rate:2.0, dmg:20, col:'#a61e4e' },
  滚石: { glyph:'石', range:60,  rate:1.0, dmg:14, col:'#8b5e3c' },
};
const SIEGE_TOWERS = [          // 沿 PATH 两侧布防，越靠末端越密
  { type:'箭塔', x:110, y:470 }, { type:'箭塔', x:264, y:470 },
  { type:'炮塔', x:88,  y:410 }, { type:'箭塔', x:286, y:410 },
  { type:'滚石', x:140, y:350 }, { type:'炮塔', x:236, y:290 },
  { type:'箭塔', x:120, y:250 }, { type:'箭塔', x:256, y:250 },
  { type:'滚石', x:140, y:180 }, { type:'炮塔', x:236, y:150 },
];
const SIEGE_PRESETS = [         // 战前 3 选 1 编成（复用 rogue 列面板范式）
  { n:'突骑陷阵', lead:'赵云', queue:['骑','骑','枪','刀','盾'], tip:'高速突破·七进七出' },
  { n:'弓步协同', lead:'黄忠', queue:['弓','弓','刀','枪','盾'], tip:'远程消耗·火箭烈' },
  { n:'重甲攻坚', lead:'张飞', queue:['盾','甲','枪','刀','骑'], tip:'铁壁扛塔·大喝控场' },
];
const SIEGE_ASSAULT_GAP = 34;   // 突击队沿 PATH 队列间隔(px)
const SIEGE_TROOP_SPD   = 30;   // 兵种行军速度(px/s，引擎量级 兵30~骑62 取低段)
const SIEGE_HERO_SPD    = 28;   // 主将行军速度(px/s)
const SIEGE_HP_MUL      = 1.4;  // 突击队局部血量倍率（仅本局，不溢出全局）
const SIEGE_DMG_MUL     = 1.2;  // 突击队局部伤害倍率（仅本局，不溢出全局）

// 据 column 生成纵队(G.P.mobs) + 主将(rogueLead)；敌军由 startWave→spawnMob(G.E) 生成并 rogueEnemyAug 增强。
function rogueBuildColumn() {
  const col = G.rogue.column;
  const rp = ROGUE_PATHS[col.route];
  G.P.path = rp; G.P.cum = pathCum(rp); G.P.len = G.P.cum[G.P.cum.length - 1];
  G.E.path = rp.slice().reverse(); G.E.cum = pathCum(G.E.path); G.E.len = G.E.cum[G.E.cum.length - 1];
  G.colOff = 0;                  // 试炼走专属贯穿路径，禁动态偏移保证两军对位
  G.P.mobs = [];
  // 主将（领队，置于纵队最前）
  const lead = mkRogueMob('hero', col.lead, col);
  lead.rogueLead = true;
  G.P.mobs.push(lead);
  // 队列兵种（顺序即纵队顺序）
  for (const tk of col.queue) {
    const tm = mkRogueMob('troop', tk, col);
    tm.rogueTroop = tk;
    G.P.mobs.push(tm);
  }
  layoutRogueColumn(G.P);
}

// 沿 G.P.path 自下而上铺开纵队：lead 在最前(d 最大，最接近敌营)，队列依次递减至玩家营(d=0)
function layoutRogueColumn(S) {
  const n = S.mobs.length;
  for (let i = 0; i < n; i++) {
    const m = S.mobs[i];
    m.d = Math.min(S.len, (n - 1 - i) * ROGUE_QUEUE_GAP);
    const p = pathPos(S.path, S.cum, m.d);
    m.x = p.x; m.y = p.y;
  }
}

// 构造单个纵队单位（hero/troop）；数值取自 HEROES/TROOPS，按 column 倍率放大并附带试炼战斗字段
function mkRogueMob(kind, key, col) {
  let hp, dmg, spd, atkR, atkIv, glyph;
  if (kind === 'hero') {
    const h = HEROES[key];
    glyph = key[0];
    hp = h.hp * 2 * col.hpMul;
    dmg = h.dmg * 1.2 * col.dmgMul;
    spd = ROGUE_HERO_SPD * col.speedMul;
    atkR = 46; atkIv = 1 / h.rate;
  } else {
    const t = TROOPS[key];
    glyph = key;
    hp = t.hp * 2 * col.hpMul;
    dmg = t.dmg * 1.5 * col.dmgMul;
    spd = ROGUE_TROOP_SPD * col.speedMul;
    atkR = (t.rng >= 100) ? 90 : (key === '骑' ? 50 : 40);   // 弓远程 / 骑冲锋 / 近战贴身
    atkIv = 1 / t.rate;
  }
  return {
    type: 'rogue_' + kind, kind, key, glyph,
    hp, maxhp: hp, spd, dmg, atkR, atkIv, atkT: 0,
    d: 0, x: 0, y: 0, flash: 0, stun: 0, dead: false,
    skillT: ROGUE_LEAD_SKILL_INTERVAL,
  };
}

// 敌军增强：spawnMob 生成的敌(m.type∈MOBS)追加试炼跨侧交火字段；dmg 取 atk（单位对单位），随难度/层曲线缩放
function rogueEnemyAug(m, hpMul) {
  const b = MOBS[m.type];
  m.atkR = b.archer ? 90 : 40;
  m.atkIv = 1.0;
  m.dmg = m.atk;                 // 试炼单位对单位：用 atk（已含 G.atkMul 与 sqrt(hpMul)），弃用 base dmg
  m.rogueEnemy = true;
}

// rogue 专用伤害结算：直接扣血 + 死亡演出 + 主将阵亡即判负（绕过 dealDmg 对 MOBS[m.type] 的依赖）
function rogueDealDmg(dmg, target) {
  if (target.hp <= 0) return;
  target.hp -= dmg;
  target.flash = 0.12;
  if (target.hp > 0) return;
  target.dead = true;
  if (target.rogueLead) { endBattle(false); G.rewardTxt = '主将阵亡 · 纵队溃散'; return; }
  if (G.deaths) G.deaths.push({ x: target.x, y: target.y, type: target.rogueTroop || target.glyph || '卒', boss: false, t: 0.4, t0: 0.4, col: '#c0392b' });
  boom(target.x, target.y, '#c0392b');
}

// 敌抵达玩家营：伤害玩家基地（阿斗）
function rogueHurtMob(S, m) {
  m.dead = true;
  const dmg = m.dmg;
  G.P.hp -= dmg;
  boom(G.P.adou.x, G.P.adou.y, '#e03131');
  if (G) { G.flash = Math.max(G.flash, 0.4); addShake(4); popFloat(G.P.adou.x, G.P.adou.y - 30, 'dmg', dmg, { txt: '阿斗受袭 -' + dmg }); }
  if (G.P.hp <= 0) { endBattle(false); G.rewardTxt = '阿斗营破 · 纵队溃散'; }
}

// 纵队/敌军的真实行军 + 跨侧交火（替代原生 updMob 的 mob-vs-同侧-cells）
function rogueUpdMob(S, m, dt) {
  if (m.flash > 0) m.flash -= dt;
  if (m.stun > 0) { m.stun = Math.max(0, m.stun - dt); return; }
  const opp = S === G.P ? G.E : G.P;
  const spd = m.spd * (S.slowT > 0 ? 0.5 : 1);
  // 主将技：将军突破（周期 AOE，仅我方主将）
  if (m.rogueLead) {
    m.skillT -= dt;
    if (m.skillT <= 0) {
      m.skillT = ROGUE_LEAD_SKILL_INTERVAL;
      let hit = 0;
      for (const e of opp.mobs) {
        if (e.hp <= 0 || e.dead) continue;
        if (Math.hypot(e.x - m.x, e.y - m.y) <= ROGUE_LEAD_SKILL_R) { rogueDealDmg(m.dmg * ROGUE_LEAD_SKILL_DMG_MUL, e); hit++; }
      }
      if (hit && G) { boomRadial(m.x, m.y, '#1c7ed6'); G.fx.push({ type: 'ring', x: m.x, y: m.y, r: ROGUE_LEAD_SKILL_R, t: 0.4, t0: 0.4, col: '#1c7ed6' }); }
    }
  }
  // 找对面最近可攻击单位
  let near = null, nd = 1e9;
  for (const o of opp.mobs) {
    if (o.hp <= 0 || o.dead) continue;
    const d = Math.hypot(o.x - m.x, o.y - m.y);
    if (d < nd) { nd = d; near = o; }
  }
  if (near && nd <= m.atkR) {
    m.atkT += dt;
    if (m.atkT >= m.atkIv) {
      m.atkT = 0;
      rogueDealDmg(m.dmg, near);
      if (S.side > 0 && near.rogueEnemy) popFloat(near.x, near.y - 16, 'dmg', Math.round(m.dmg), { col: '#ff6b6b' });
    }
    return;
  }
  // 行军
  m.d += spd * dt;
  const p = pathPos(S.path, S.cum, m.d);
  m.x = p.x; m.y = p.y;
  if (S.side < 0) m.x += (G.colOff || 0);
  // 抵达对面基地
  if (m.d >= S.len) {
    if (S.side < 0) rogueHurtMob(S, m);                 // 敌抵玩家营 → 伤害玩家
    else { m.d = S.len; const pp = pathPos(S.path, S.cum, S.len); m.x = pp.x; m.y = pp.y; }  // 纵队抵敌营 → 钳制等待(清场判定在 update)
  }
}

// 羁绊组合技（试炼专属，绕过原生 tickFateSkills 对 MOBS 的依赖）
function rogueTickFate(dt) {
  const col = G.rogue.column;
  if (!col.bonds || !col.bonds.length) return;
  G.rogue.bondT = (G.rogue.bondT || 0) - dt;
  if (col.bonds.includes('五虎羁绊') && G.rogue.bondT <= 0) {
    G.rogue.bondT = 30;
    let hit = 0;
    for (const e of G.E.mobs) { if (e.hp <= 0 || e.dead) continue; rogueDealDmg(35 * col.dmgMul, e); hit++; }
    if (hit && G) { G.banner = { txt: '五虎破阵：全线冲锋', t: 1.4 }; G.fx.push({ type: 'lane', y: 320, t: .5, t0: .5, col: '#e8a005' }); }
  }
}

/* ========== 反向攻城·夺隘(siege)：镜像塔防 ==========
   全部以 G.mode==='siege' 门控，不触及 fire/rogue/escort/puzzle/raid 与普通模式。
   玩家=进攻方：突击队(=G.P.mobs)沿 SIEGE_PATH 上行突破末端敌垒(SIEGE_FORT)；
   敌方=静止工事(SIEGE_TOWERS)：经 siegeTickTowers 朝射程内最近突击队结算 siegeDealDmg。
   v1 工事永久不可摧毁（§3.3）；胜负：敌垒破=胜，突击队全灭/超时=败（§5）。 */

// 构造单个突击单位（hero/troop）；数值取自 HEROES/TROOPS，按 column 倍率放大并附 siege 战斗字段（镜像 mkRogueMob）
function mkSiegeMob(kind, key, col) {
  let hp, dmg, spd, glyph, atkR, atkIv;
  if (kind === 'hero') {
    const h = HEROES[key];
    glyph = key[0];
    hp = h.hp * 2 * col.hpMul;
    dmg = h.dmg * 1.2 * col.dmgMul;
    spd = SIEGE_HERO_SPD * col.speedMul;
    atkR = 46; atkIv = 1 / h.rate;
  } else {
    const t = TROOPS[key];
    glyph = key;
    hp = t.hp * 2 * col.hpMul;
    dmg = t.dmg * 1.5 * col.dmgMul;
    spd = SIEGE_TROOP_SPD * col.speedMul;
    atkR = (t.rng >= 100) ? 90 : (key === '骑' ? 50 : 40);
    atkIv = 1 / t.rate;
  }
  // 突破力（§4.1）：break = round(maxhp*0.2) + dmg，砸城时按倍率结算
  const brk = Math.round(hp * 0.2) + dmg;
  return {
    type: 'siege_' + kind, kind, key, glyph,
    hp, maxhp: hp, spd, dmg, atkR, atkIv, atkT: 0,
    break: brk, siegeAssault: true,
    d: 0, x: 0, y: 0, flash: 0, stun: 0, dead: false,
  };
}

// 战前编成确认后生成突击队(=G.P.mobs)；结构镜像 rogueBuildColumn + layoutRogueColumn（单线 SIEGE_PATH，领队最前）
function siegeBuildAssault() {
  const col = G.siege.column;
  G.P.mobs = [];
  const lead = mkSiegeMob('hero', col.lead, col);
  G.P.mobs.push(lead);
  for (const tk of col.queue) G.P.mobs.push(mkSiegeMob('troop', tk, col));
  const S = G.P, n = S.mobs.length;
  for (let i = 0; i < n; i++) {
    const m = S.mobs[i];
    m.d = Math.min(S.len, (n - 1 - i) * SIEGE_ASSAULT_GAP);
    const p = pathPos(S.path, S.cum, m.d);
    m.x = p.x; m.y = p.y;
  }
}

// 敌工事射击玩家突击队（与 updUnit→dealDmg(G.E,...) 物理隔离；只读写 G.siege.towers 与 G.P.mobs）
function siegeTickTowers(dt) {
  const sg = G.siege;
  for (const t of sg.towers) {
    t.atkT += dt;
    if (t.atkT < t.rate) continue;
    let near = null, nd = 1e9;
    for (const m of G.P.mobs) {
      if (m.hp <= 0 || m.dead) continue;
      const d = Math.hypot(m.x - t.x, m.y - t.y);
      if (d <= t.range && d < nd) { nd = d; near = m; }
    }
    if (near) { t.atkT = 0; siegeDealDmg(near, t.dmg); fxLine(t.x, t.y, near.x, near.y, t.col); }
  }
}

// HUD 指令按钮调用：rush/focus/heal 各有 CD 门控（§7.4）
function siegeCmd(name) {
  const sg = G.siege; if (!sg) return;
  if (name === 'rush' && sg.cmds.rush <= 0) { sg.rushT = SIEGE_RUSH_DUR; sg.cmds.rush = SIEGE_RUSH_CD; }
  else if (name === 'focus' && sg.cmds.focus <= 0) { sg.focusT = SIEGE_FOCUS_DUR; sg.cmds.focus = SIEGE_FOCUS_CD; }
  else if (name === 'heal' && sg.cmds.heal <= 0) {
    sg.cmds.heal = SIEGE_HEAL_CD;
    for (const m of G.P.mobs) if (m.hp > 0 && !m.dead) m.hp = Math.min(m.maxhp, m.hp + m.maxhp * SIEGE_HEAL_AMT);
  }
}

// 战前编成：选 1 套预设写入 column 并解除 build、生成突击队、置 assaultReady（§7.2）
function chooseSiegePreset(i) {
  const sg = G.siege; if (!sg || !sg.build) return;
  const p = SIEGE_PRESETS[i]; if (!p) return;
  sg.column = {
    lead: p.lead,
    queue: p.queue.slice(),
    dmgMul: SIEGE_DMG_MUL,
    hpMul: SIEGE_HP_MUL,
    speedMul: 1,
  };
  sg.build = false;
  G.paused = false;
  siegeBuildAssault();
  sg.assaultReady = true;
  G.banner = { txt: '【' + p.n + '】' + p.tip + ' · 突破敌垒!', t: 2.5 };
}

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
    // 实时放火：仅敌方(G.E)出怪，玩家侧改用点格点火；水寨=PATH_E 末端，守存活即胜。
    G.modeTime = FIRE_TIME; G.modeScore = 0;
    G.wind = '东南风';
    G.fire = {
      oil: FIRE_OIL_START, oilMax: FIRE_OIL_MAX, stronghold: FIRE_STRONG_HP,
      windT: FIRE_WIND_T, burnT: 0, spreadT: 0, wild: [],
      cells: FIRE_CELLS.map(c => ({ x: c.x, y: c.y, state: 'idle', t: 0 })),
    };
    G.banner = { txt: '【赤壁火攻】守住水寨 ' + FIRE_TIME + ' 秒 · 借风放火焚敌', t: 3 };
  } else if (G.mode === 'rogue') {
    // 战前编列行军纵队：构建(编成/羁绊/路线/数值)决定战力，是胜负关键变量（非抽象倍率）。
    // 首层给一个可玩默认纵队（lead 默认赵云 + 基础兵种），每层战后由军略改写 column 重建。
    G.rogue = {
      floor: 1, maxFloor: ROGUE_MAX_FLOOR, picks: 0,
      column: { lead: ROGUE_POOL_HERO[0], queue: ['枪', '弓', '刀', '盾'], bonds: [], route: 0, dmgMul: 1, hpMul: 1, speedMul: 1 },
    };
    // 纵队/敌军专属行军路径（贯穿全场、对向相遇）；敌方部署格置空(rogue 无部署、AI 不占格)
    const rp = ROGUE_PATHS[G.rogue.column.route];
    G.P.path = rp; G.P.cum = pathCum(rp); G.P.len = G.P.cum[G.P.cum.length - 1];
    G.E.path = rp.slice().reverse(); G.E.cum = pathCum(G.E.path); G.E.len = G.E.cum[G.E.cum.length - 1];
    G.E.cells.forEach(c => { c.open = false; c.unit = null; });
    G.banner = { txt: '【五虎试炼】编列你的行军纵队', t: 3 };
    G.P.mantou = 30;
    rogueBuildColumn();            // 据 column 生成纵队(=G.P.mobs) + 主将(rogueLead)
    startWave();                   // 填充本层敌军 spawnQ（敌=G.E.mobs，由 spawn 块 spawnMob 生成）
    G.colOff = 0;                  // 试炼走专属贯穿路径，禁动态偏移保证两军对位
  } else if (G.mode === 'escort') {
    G.escort = {
      progress: 0, target: 100, rescued: 0,
      hp: ESCORT_ADOU_HP, maxhp: ESCORT_ADOU_HP,
      bridgeY: ESCORT_BRIDGE_Y,
      run: false, paused: false, walkActive: false, dragX: ESCORT_START_X,
      repelling: false, repelVx: 0, repelT: 0,
      blockTimer: 0, blockWarn: false,
      threats: [], spawnSchedule: escortSpawnSchedule(),
      arrowT: 4, rockT: 6, interCap: ESCORT_INTERCEPT_CAP,
    };
    // 阿斗移动对象：新建独立对象并替换 G.P.adou，避免改写共享的 MAPS[0].ADOU_P 常量（导致跨局泄漏）
    G.P.adou = { x: ESCORT_START_X, y: ESCORT_START_Y };
    // 部署区：开放除中央列(187)外的所有格 → 中央列禁部署，天然区分"走位操控"与"部署拖拽"
    G.P.cells.forEach(c => { c.open = (c.x !== ESCORT_START_X); });
    G.banner = { txt: '【长坂独胆】布阵左右两翼，护送阿斗直抵长坂桥', t: 3 };
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
  } else if (G.mode === 'siege') {
    // 反向攻城：玩家为进攻方，突击队沿 SIEGE_PATH 上行突破末端敌垒；敌方为静止工事射击。
    G.siege = {
      column: { lead: SIEGE_PRESETS[0].lead, queue: SIEGE_PRESETS[0].queue.slice(),
                dmgMul: SIEGE_DMG_MUL, hpMul: SIEGE_HP_MUL, speedMul: 1 },
      fort: { ...SIEGE_FORT },
      towers: SIEGE_TOWERS.map(t => ({ ...t, ...SIEGE_TOWER_DEFS[t.type], atkT: 0, hp: 1e9 })),
      rushT: 0, focusT: 0,
      cmds: { rush: 0, focus: 0, heal: 0 },
      assaultReady: false,
      build: true,            // 战前编成面板开启中
    };
    G.P.path = SIEGE_PATH; G.P.cum = pathCum(SIEGE_PATH); G.P.len = G.P.cum[G.P.cum.length - 1];
    G.E.path = SIEGE_PATH; // 敌无 mob，仅占位
    G.P.cells.forEach(c => { c.open = false; c.unit = null; });   // 玩家不部署
    G.E.cells.forEach(c => { c.open = false; c.unit = null; });   // 敌方不部署（工事在 towers[]）
    G.modeTime = SIEGE_TIME;
    G.banner = { txt: '【反向攻城】编列突击队，突破敌垒', t: 3 };
    G.paused = true;   // 等战前编成确认
  }
}

function modeTick(dt) {
  if (!G || !G.mode || G.state !== 'play') return;
  if (G.mode === 'fire') {
    G.modeTime -= dt;
    tickFire(dt);
    if (G.modeTime <= 0 && G.fire.stronghold > 0) {
      endBattle(true);
      G.rewardTxt = '赤壁火攻成功 · 守寨 ' + Math.max(0, Math.ceil(G.fire.stronghold)) + ' 耐久';
    }
  } else if (G.mode === 'escort') {
    const e = G.escort, S = G.P;
    // 备战倒计时（复用 betweenT）→ 转入 run 阶段
    if (!e.run) {
      G.betweenT -= dt;
      if (G.betweenT <= 0) { e.run = true; G.banner = { txt: '突围开始！护送阿斗上行至长坂桥', t: 2.5 }; }
      return;
    }
    // run 阶段：阿斗沿中央走廊上行（y 为位置真值，progress 由其推导）
    e.progress = clamp((ESCORT_START_Y - S.adou.y) / (ESCORT_START_Y - ESCORT_BRIDGE_Y) * 100, 0, 100);
    const p = e.progress / 100;
    const N = S.cells.filter(c => c.unit).length;                 // 存活守军数
    const near = S.mobs.some(m => m.intercept && Math.hypot(m.x - S.adou.x, m.y - S.adou.y) <= ESCORT_R_BLOCK);
    // 修反人类：兵越多越快越稳；near(被拦截兵逼近)时失去惯性加速，谨慎慢行
    const V = ESCORT_V_BASE * clamp(1 + ESCORT_K * N, 1, ESCORT_CAP) * (near ? 1 : ESCORT_MOMENTUM);
    // 重力感：按住走位（walkActive）时速度减半，松开恢复全速→鼓励精准闪避而非一直按住
    const speedMul = (e.walkActive && !e.repelling) ? 0.5 : 1.0;
    if (!e.paused) S.adou.y -= V * dt * speedMul;                // AUTO-ADVANCE；暂停(走廊按住)时不前进
    // 走位推拒：repelling 时阿斗反方向弹开（被拦截兵逼近时推开，不能靠走位硬吃拦截兵）
    if (e.repelling) { S.adou.x += e.repelVx * dt; e.repelT -= dt; if (e.repelT <= 0) e.repelling = false; }
    if (e.walkActive) S.adou.x = clamp(e.dragX, ESCORT_X_MIN, ESCORT_X_MAX);  // 走位横向微移
    S.adou.x = clamp(S.adou.x, ESCORT_X_MIN, ESCORT_X_MAX);
    // 威胁生成（频率随 p 升级；伤害前必有 telegraph）
    e.arrowT -= dt; if (e.arrowT <= 0) { e.arrowT = lerp(6.0, 2.5, p); spawnArrow(S, e); }
    e.rockT -= dt; if (e.rockT <= 0) { e.rockT = lerp(9.0, 4.5, p); spawnRock(S, e); }
    while (e.spawnSchedule.length && e.spawnSchedule[0].at <= p) {
      const s = e.spawnSchedule.shift();
      spawnInterceptor(S, e, s.x, s.y, s.type);
    }
    tickEscortThreats(e, S, dt);
    // 胜负：胜=抵达长坂桥且 hp>0；败=①hp≤0 ②被拦截兵逼停≥4s
    if (e.hp <= 0) { G.rewardTxt = '阿斗阵亡 · 护送失败'; endBattle(false); }
    else if (e.blockTimer >= ESCORT_BLOCK_FAIL) { G.rewardTxt = '阿斗被拦截 · 护送失败'; endBattle(false); }
    else if (S.adou.y <= ESCORT_BRIDGE_Y) { e.rescued = N; G.rewardTxt = '护送成功 · 救援 ' + N + ' 守军'; endBattle(true); }
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
  } else if (G.mode === 'siege') {
    const sg = G.siege;
    G.modeTime -= dt;
    // 指令 CD 递减
    for (const k of ['rush', 'focus', 'heal']) if (sg.cmds[k] > 0) sg.cmds[k] = Math.max(0, sg.cmds[k] - dt);
    if (sg.rushT > 0) sg.rushT -= dt;
    if (sg.focusT > 0) sg.focusT -= dt;
    siegeTickTowers(dt);                       // 敌工事射击玩家突击队
    if (sg.fort.hp <= 0) { sg.fort.hp = 0; endBattle(true); G.rewardTxt = '反向攻城·敌垒已破'; return; }
    if (sg.assaultReady && !G.P.mobs.length) { endBattle(false); G.rewardTxt = '突击队全灭·攻城失败'; return; }
    if (G.modeTime <= 0) { endBattle(false); G.rewardTxt = '攻城超时'; return; }
  }
}

function modeWaveConfig() {
  if (!G || !G.mode) return null;
  if (G.mode === 'rogue') return { waves: 1, per: 5 + G.rogue.floor * 2, mix: [45, 20, 20, 15], hp: 0.85 + G.rogue.floor * 0.12 };
  if (G.mode === 'puzzle') return { waves: 0, per: 0, hp: 0.85 };   // 敌阵由 puzzleStartAttempt 手动生成，不走波次
  if (G.mode === 'escort') return { waves: 0, per: 0, mix: [0, 0, 0, 0], hp: 0.9 + G.escort.progress / 400 };  // 不刷无限波；拦截兵由 spawnSchedule 按进度生成（保留 toughness 曲线钩子）
  if (G.mode === 'fire') return { waves: 99, per: 6, mix: [55, 20, 20, 5], hp: 1, hpAdd: 0, atkTier: 1 };
  if (G.mode === 'raid') return { waves: 0, per: 0, mix: [100, 0, 0, 0], hp: 1 };
  if (G.mode === 'siege') return { waves: 0, per: 0, mix: [0, 0, 0, 0], hp: 1 };  // 无波次，工事由 modeSetup 预置
  return null;
}

/* ========== 赤壁火攻（fire）：实时放火 ==========
   全部以 G.mode==='fire' 门控，不触及 escort/puzzle/raid/rogue 与普通模式。
   玩家点空闲火油格 → 点燃(fireIgnite)；tickFire 每帧：风周期翻转、燃烧格烧敌、蔓延(fireSpread)、
   野火生成、水寨反噬扣耐久、敌抵末端扣水寨并移除、控火油 CD 回充、水寨≤0 判负。 */

// 风向→网格方向：东南风(dx:+1,dy:-1)逆敌行军横扫；西北风(dx:-1,dy:+1)顺敌行军纵深纵火。
function fireWindDir() {
  return G.wind === '东南风' ? { dx: 1, dy: -1 } : { dx: -1, dy: 1 };
}

// 点空闲火油格点燃：消耗 1 控火油；油不足/已燃则忽略（fire 模式下禁用普通部署，故不冲突）。
function fireIgnite(cell) {
  const f = G.fire;
  if (!f || !cell || cell.state !== 'idle') return;
  if (f.oil < 1) { fl(cell.x, cell.y - 18, '控火油不足', '#e03131'); return; }
  f.oil -= 1;
  cell.state = 'burning'; cell.t = FIRE_BURN_T;
  boom(cell.x, cell.y, '#e8590c'); fl(cell.x, cell.y - 18, '点火!', '#e8590c');
}

// 蔓延：每 FIRE_SPREAD_DT 秒，对每个 burning 火油格按风向推出一格——邻格为火油格→点燃；否则生成短命野火。
function fireSpread() {
  const f = G.fire, dir = fireWindDir(), STEP = 40;
  for (const c of f.cells) {
    if (c.state !== 'burning') continue;
    const nx = c.x + dir.dx * STEP, ny = c.y + dir.dy * STEP;
    let hit = null;
    for (const o of f.cells) {
      if (o !== c && o.state === 'idle' && Math.hypot(o.x - nx, o.y - ny) <= 28) { hit = o; break; }
    }
    if (hit) { hit.state = 'burning'; hit.t = FIRE_BURN_T; }
    else f.wild.push({ x: nx, y: ny, t: FIRE_WILD_T });   // 野火：仅烧敌、不持续蔓延
  }
}

function tickFire(dt) {
  const f = G.fire;
  // 风周期翻转
  f.windT -= dt;
  if (f.windT <= 0) {
    f.windT = FIRE_WIND_T;
    G.wind = G.wind === '东南风' ? '西北风' : '东南风';
    G.banner = { txt: '风向变为' + G.wind + '！火势蔓延', t: 1.8 };
  }
  // 控火油 CD 回充（击杀回充在 dealDmg 的 fire 分支内）
  f.oil = Math.min(f.oilMax, f.oil + dt / FIRE_OIL_CD);
  // 蔓延计时
  f.spreadT += dt;
  if (f.spreadT >= FIRE_SPREAD_DT) { f.spreadT -= FIRE_SPREAD_DT; fireSpread(); }
  // 东南风 dps > 西北风
  const dps = G.wind === '东南风' ? FIRE_DPS_SE : FIRE_DPS_NW;
  // 燃烧火油格：烧敌 + 反噬（水寨带 / 己方单位）
  for (const c of f.cells) {
    if (c.state !== 'burning') continue;
    c.t -= dt;
    for (const m of G.E.mobs) {
      if (m.dead) continue;
      if (Math.hypot(m.x - c.x, m.y - c.y) <= FIRE_R) dealDmg(G.E, m, dps * dt);
    }
    if (c.y < FIRE_STRONG_Y) f.stronghold -= FIRE_STRONG_DPS * dt;   // 反噬：落在水寨带
    for (const cu of G.P.cells) {                                    // 反噬：落在己方单位（fire 禁用部署，通常为空，稳健处理）
      if (cu.unit && Math.hypot(cu.x - c.x, cu.y - c.y) <= FIRE_R) damageUnit(G.P, cu, FIRE_SELF_DPS * dt);
    }
    if (c.t <= 0) c.state = 'idle';
  }
  // 野火：短命、仅烧敌、可能反噬水寨带
  for (const w of f.wild) {
    w.t -= dt;
    for (const m of G.E.mobs) {
      if (m.dead) continue;
      if (Math.hypot(m.x - w.x, m.y - w.y) <= FIRE_R) dealDmg(G.E, m, dps * dt);
    }
    if (w.y < FIRE_STRONG_Y) f.stronghold -= FIRE_STRONG_DPS * dt;
  }
  f.wild = f.wild.filter(w => w.t > 0);
  // 敌抵末端（水寨=PATH_E 末端）扣耐久并移除该 mob
  for (const m of G.E.mobs) {
    if (!m.dead && m.d >= G.E.len - 4) {
      f.stronghold -= FIRE_BREACH_HP; m.dead = true;
      boom(187, 70, '#e03131'); fl(187, 70, '水寨 -' + FIRE_BREACH_HP, '#e03131');
    }
  }
  // 胜负：水寨≤0 败（单一条件，避免双失败歧义）
  if (f.stronghold <= 0) {
    f.stronghold = 0;
    G.rewardTxt = '水寨失守 · 赤壁火攻失败';
    endBattle(false);
  }
}

// 火油格 / 野火 渲染（由 ui_battle.js 的 drawGame 在 fire 分支调用）
function drawFire() {
  const f = G.fire; if (!f) return;
  for (const c of f.cells) {
    if (c.state === 'burning') {
      ctx.save();
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#e8590c';
      ctx.beginPath(); ctx.arc(c.x, c.y, FIRE_R, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      txt('🔥', c.x, c.y + 6, 18, '#e8590c', 'center');
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = 'rgba(184,74,49,.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(c.x, c.y, 16, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      txt('油', c.x, c.y + 5, 13, '#bd4a31', 'center', true);
      ctx.restore();
    }
  }
  if (f.wild) for (const w of f.wild) {
    ctx.save(); ctx.globalAlpha = clamp(w.t / FIRE_WILD_T, 0, 1) * 0.9;
    ctx.fillStyle = '#e8590c'; ctx.beginPath(); ctx.arc(w.x, w.y, 14, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; txt('🔥', w.x, w.y + 5, 13, '#e8590c', 'center'); ctx.restore();
  }
}

/* ========== 长坂独胆（escort）：护送走位重做 ==========
   全部以 G.mode==='escort' 门控，不触及 fire/rogue/puzzle/raid 与普通模式。
   阿斗沿中央走廊(187)上行至长坂桥(BRIDGE_Y=70)；守军沿左右两翼部署；run 阶段阿斗自动上行，
   玩家在走廊带内点/按=暂停前进、左右拖拽=横向微移；run 阶段禁重新部署。
   威胁(箭雨/落石/拦截兵)频率随进度 p 升级，伤害前必有 telegraph。 */

// 生成有限刷怪调度：拦截兵按进度阈值触发（避免无限堆怪），频率随 p 收紧。
function escortSpawnSchedule() {
  const sched = [];
  const Vnom = ESCORT_V_BASE * clamp(1 + ESCORT_K * 4, 1, ESCORT_CAP) * ESCORT_MOMENTUM;
  const span = ESCORT_START_Y - ESCORT_BRIDGE_Y;
  let p = 0, t = 2.5;   // 首个拦截兵延迟，给布阵/起步时间
  while (p < 0.96) {
    const freq = lerp(7.0, 3.5, p);
    t += freq;
    p = clamp(p + Vnom * freq / span, 0, 1);
    const cnt = 1 + (p > 0.5 ? 1 : 0);   // 数量 1→2 随 p 递增
    for (let i = 0; i < cnt; i++) {
      const top = Math.random() < 0.6;
      const x = top ? lerp(150, 224, Math.random())
                    : (Math.random() < 0.5 ? lerp(64, 112, Math.random()) : lerp(224, 311, Math.random()));
      const y = top ? lerp(80, 130, Math.random())
                    : lerp(ESCORT_BRIDGE_Y + 80, ESCORT_START_Y - 80, Math.random());
      sched.push({ at: p, x, y, type: wpick([['兵', 60], ['卒', 40]]) });
    }
  }
  return sched;
}

// 箭雨：在阿斗前方预埋 y_trig 线，telegraph 后结算（|adou.x - x_center| ≤ halfWidth → -1HP）
function spawnArrow(S, e) {
  const yTrig = clamp(S.adou.y - lerp(140, 220, Math.random()), ESCORT_BRIDGE_Y + 30, ESCORT_START_Y);
  e.threats.push({ kind: 'arrow', yTrig, xCenter: lerp(ESCORT_X_MIN, ESCORT_X_MAX, Math.random()), halfWidth: ESCORT_ARROW_HW, phase: 'warn', t: ESCORT_TELE_ARROW, t0: ESCORT_TELE_ARROW });
}

// 落石：从顶部某 x_rock 下落，telegraph 后落到阿斗所在行结算（|adou.x - x_rock| ≤ R → -1HP）
function spawnRock(S, e) {
  e.threats.push({ kind: 'rock', xRock: lerp(120, 254, Math.random()), R: 26, y: 0, vy: ESCORT_ROCK_VY, phase: 'warn', t: ESCORT_TELE_ROCK, t0: ESCORT_TELE_ROCK });
}

// 拦截兵：顶部/侧翼生成，直扑阿斗（m.intercept 在 updMob 内走"直追"分支，不沿路径、不造成 HP 伤害）
function spawnInterceptor(S, e, x, y, type) {
  if (S.mobs.filter(m => m.intercept).length >= e.interCap) return;
  spawnMob(S, type, lerp(0.9, 1.15, e.progress / 100), false);
  const m = S.mobs[S.mobs.length - 1];
  m.x = x; m.y = y; m.d = 0; m.intercept = true; m.boss = false;
}

// 威胁系统：telegraph 倒计时 → 结算(hp 伤害) / 拦截兵逼停计时
function tickEscortThreats(e, S, dt) {
  for (const t of e.threats) {
    if (t.kind === 'arrow') {
      t.t -= dt;
      if (t.phase === 'warn' && t.t <= 0) {
        if (Math.abs(S.adou.x - t.xCenter) <= t.halfWidth) {
          e.hp -= 1;
          popFloat(S.adou.x, S.adou.y - 30, 'dmg', 1, { txt: '箭雨 -1', col: '#e03131' });
          boom(S.adou.x, S.adou.y, '#e03131');
        }
        t.phase = 'done'; t.t = 0.3; t.t0 = 0.3;
      }
    } else if (t.kind === 'rock') {
      if (t.phase === 'warn') {
        t.t -= dt;
        if (t.t <= 0) { t.phase = 'fall'; t.y = 0; }
      } else if (t.phase === 'fall') {
        t.y += t.vy * dt;
        if (t.y >= S.adou.y) {   // 落到阿斗所在行
          if (Math.abs(S.adou.x - t.xRock) <= t.R) {
            e.hp -= 1;
            popFloat(S.adou.x, S.adou.y - 30, 'dmg', 1, { txt: '落石 -1', col: '#e03131' });
            boom(S.adou.x, S.adou.y, '#e03131');
          }
          t.phase = 'done'; t.t = 0.3; t.t0 = 0.3;
        } else if (t.y > H + 20) { t.phase = 'done'; t.t = 0.001; }
      }
    }
  }
  e.threats = e.threats.filter(t => !(t.phase === 'done' && t.t <= 0));
  // 拦截兵逼停：任一进入 R_BLOCK 内累积 blockTimer；同时阿斗被推拒弹开
  let near = false;
  for (const m of S.mobs) if (m.intercept && Math.hypot(m.x - S.adou.x, m.y - S.adou.y) <= ESCORT_R_BLOCK) {
    near = true;
    // 推拒：拦截兵靠近时阿斗反向弹开（小幅横向位移，制造紧张感而非死锁）
    if (!e.repelling) { e.repelling = true; e.repelT = 0.35; e.repelVx = (m.x - S.adou.x) > 0 ? -30 : 30; }
    break;
  }
  if (near) { e.blockTimer += dt; e.blockWarn = true; }
  else { e.blockTimer = Math.max(0, e.blockTimer - dt * 3); if (e.blockTimer <= 0) e.blockWarn = false; }
  // 赵云护驾：棋盘存在赵云且存活时，拦截兵逼停计时衰减更慢，blockTimer 积累速度减半
  const hasZhaoyun = S.cells.some(c => c.unit && c.unit.name === '赵云');
  if (hasZhaoyun && e.blockTimer > 0) e.blockTimer -= dt * 0.3;
}

function rogueOffer() {
  // 本层敌军清空 → 选 1 条军略改写 column（保底至少 1 条数值，见 pickRogueStrats）
  G.rogueChoices = pickRogueStrats();
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
  if (G.rogue) c.apply(G.rogue.column); else c.apply();   // 试炼：军略改写 column；遗物：纯增益无参
  G.rogueChoices = null; G.paused = false;
  // rogue 模式有 floor 进度与通关判定；遗物模式（无 G.rogue）仅应用增益
  if (G.rogue) {
    G.rogue.picks++;
    G.rogue.floor++;
    if (G.rogue.floor > G.rogue.maxFloor) {
      endBattle(true); G.rewardTxt = '试炼完成 · 获得 ' + G.rogue.picks + ' 条军略'; return;
    }
    G.E.mobs = [];                 // 清场残留（本层已清空，稳妥）；新敌由 startWave 生成
    rogueBuildColumn();            // 据最新 column 重建纵队 + 主将
    G.P.mantou = 30;
    startWave();                   // 填充本层敌军 spawnQ
    G.colOff = 0;                  // 禁动态偏移保证两军对位
    G.banner = { txt: c.n + '：' + c.d + ' · 第' + G.rogue.floor + '层', t: 2 };
  } else {
    G.banner = { txt: c.n + '：' + c.d, t: 2 };
  }
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
