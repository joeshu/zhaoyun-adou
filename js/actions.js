/* v2 操作层：征兵入合成栏 / 拖拽（合成·部署·撤回·铲子·回收）/ 主动道具 / AI 镜像 */
'use strict';

const slotArr = (S, area) => area === 'bar' ? S.bar : S.cells;
const barFree = S => S.bar.findIndex(s => !s.unit);
const summonCost = () => DRAW.cost;                         // 文档：固定 10 馒头一抽

/* ---------- 撤销：玩家侧操作前快照，支持回退上一步 ---------- */
function pushUndo(S) {
  if (!G || !G.undoStack || G.ghostMode || !S || S.side <= 0) return;
  // 仅快照玩家侧可逆转状态（棋盘/合成栏/馒头/开荒数/保底/溢出背包）
  const snap = {
    cells: JSON.parse(JSON.stringify(S.cells)),
    bar: JSON.parse(JSON.stringify(S.bar)),
    mantou: S.mantou, unlocked: S.unlocked, pity: S.pity,
    tempBag: S.tempBag ? JSON.parse(JSON.stringify(S.tempBag)) : null,
  };
  G.undoStack.push(snap);
  if (G.undoStack.length > 20) G.undoStack.shift();
}
function undoAction() {
  if (!G || !G.undoStack || !G.undoStack.length || G.ghostMode) return;
  const s = G.undoStack.pop();
  G.P.cells = s.cells; G.P.bar = s.bar; G.P.mantou = s.mantou;
  G.P.unlocked = s.unlocked; G.P.pity = s.pity; G.P.tempBag = s.tempBag;
  G.P.fate = fateBuff(G.P);
  G.banner = { txt: '已撤销上一步', t: 1 };
  sfx('click');
}

/* ---------- P1-4 录像录制：玩家操作记录到 G.rec.ops ---------- */
// 仅录玩家侧（G.P）的操作；ghostMode 回放时不再录（避免循环）
function recOp(op) {
  if (typeof G === 'undefined' || !G || !G.rec || G.ghostMode) return;
  G.rec.ops.push(Object.assign({ t: +(G.time).toFixed(2) }, op));
}
// ghost 模式回放：按时间戳触发玩家操作
function tickGhost(dt) {
  if (!G || !G.ghostMode || !G.ghost) return;
  const ops = G.ghost.ops;
  while (G.ghostIdx < ops.length && ops[G.ghostIdx].t <= G.time) {
    const o = ops[G.ghostIdx++];
    if (o.op === 'summon') doSummon(G.P);
    else if (o.op === 'drawTen') drawTen(G.P);
    else if (o.op === 'drop') dropUnit(G.P, o.a1, o.i1, o.a2, o.i2);
    else if (o.op === 'recycle') recycleUnit(G.P, o.area, o.idx);
    else if (o.op === 'unlock') unlockCell(G.P, o.idx);
    else if (o.op === 'active') useActive(o.id);
    else if (o.op === 'target') applyTarget(o.id, o.area, o.idx);
  }
  if (G.ghostIdx >= ops.length) G.ghostDone = true;   // 回放完毕
}

/* ---------- 抽卡（10馒头出5-7张，全进合成栏） ---------- */
const rollChar = (S) => {
  // 心愿单加权：玩家侧且已设心愿将时，50%概率从心愿将拆字池取样并标记 wish
  if (S && S.side > 0 && S.wish) {
    const wc = new Set([...S.wish].filter(c => POOL_CHARS.includes(c)));
    if (wc.size && Math.random() < 0.5) {
      const ch = [...wc][(Math.random() * wc.size) | 0];
      return { t: 'char', ch, wish: true };
    }
  }
  return { t: 'char', ch: POOL_CHARS[(Math.random() * POOL_CHARS.length) | 0] };
};
function rollCard(S) {
  const charW = 15 * ((S.side > 0 && hasItem('zhaoxian')) || S.zhaoxian ? 1.6 : 1);
  const pool = [...POOL_TROOP, ['shovel', 10], ['char', charW]];
  for (const ch in IFRAGS) pool.push(['f' + ch, IFRAGS[ch].w]);
  const k = wpick(pool);
  if (TROOPS[k]) return mkTroop(k);
  if (k === 'shovel') return { t: 'shovel' };
  if (k === 'char') return rollChar(S);
  return { t: 'ifrag', ch: k[1], n: 1 };
}
function placeCards(S, cards) {                             // 入栏；栏满→玩家侧进临时背包(≤3)，再满才折现
  let over = 0;
  const placed = [];
  for (const u of cards) {
    const i = barFree(S);
    if (i < 0) {
      if (S.side > 0 && S.tempBag && S.tempBag.length < 3) { S.tempBag.push(u); continue; }
      over++; continue;
    }
    u.animT = 0.25; S.bar[i].unit = u; placed.push(u);
  }
  if (S.side > 0 && S.tempBag.length) fl(60, 480, '临时背包 +' + S.tempBag.length, '#868e96');
  if (over) { S.mantou += over * 2; if (S.side > 0) fl(187, 545, '栏满溢出折现 +' + over * 2, '#8b5e3c'); }
  return placed;
}
function doSummon(S) {
  if (S.mantou < DRAW.cost || barFree(S) < 0) return null;
  if (S.side > 0) pushUndo(S);
  S.mantou -= DRAW.cost; S.summons++;
  if (S.side > 0 && SAVE.stats) SAVE.stats.summons++;            // P2-2 统计
  const n = wpick(DRAW.counts);
  const cards = [];
  for (let i = 0; i < n; i++) cards.push(rollCard(S));
  if (S.pity >= DRAW.pityN && !cards.some(u => u.t === 'char'))
    cards[n - 1] = rollChar();                              // 保底：连3次无将字后必出
  S.pity = cards.some(u => u.t === 'char') ? 0 : S.pity + 1;
  if (S.side > 0 && typeof G !== 'undefined' && G) {
    G.flash = 0.35;
    sfx('summon');                                    // 音效（P1-3）
    recOp({ op: 'summon' });                          // 录像（P1-4）
    if (typeof evSummon === 'function') evSummon(1);
    // 新手引导：抽卡完成 → step 1
    if (G.tutorial && G.tutStep === 0) {
      G.tutStep = 1;
      G.banner = { txt: '【教学2/3】把两个相同的兵种拖到一起升阶', t: 999 };
    }
  }
  return placeCards(S, cards);
}
function drawTen(S) {                                       // 十连：90馒头，保底1完整武将；玩家首十连半价
  const cost = (S.side > 0 && SAVE.firstTen) ? (DRAW.tenCost / 2 | 0) : DRAW.tenCost;
  if (S.mantou < cost || barFree(S) < 0) return null;
  if (S.side > 0) pushUndo(S);
  S.mantou -= cost; S.summons += 10; S.pity = 0;
  if (S.side > 0) {
    if (SAVE.firstTen) { SAVE.firstTen = false; saveSave(); }
    if (SAVE.stats) SAVE.stats.summons += 10;                       // P2-2 统计（十连算10次）
  }
  const cards = [];
  for (let d = 0; d < 10; d++) {
    const n = wpick(DRAW.counts);
    for (let i = 0; i < n; i++) cards.push(rollCard(S));
  }
  placeCards(S, cards);
  const _pool = SAVE.newHeros ? HERO_LIST.filter(n => HEROES[n].grade === 4) : HERO_ORANGE;
  const name = _pool[(Math.random() * _pool.length) | 0];
  const h = mkHero(name, S);
  h.animT = 0.3;
  let i = barFree(S);
  if (i < 0) { i = 0; S.mantou += refundValue(S.bar[0].unit, S); }   // 保底将顶替0号位并折现原卡
  S.bar[i].unit = h;
  if (S.side > 0 && typeof G !== 'undefined' && G) {
    const preview = cards.map(c => c.t === 'troop' ? c.type : c.t === 'char' ? c.ch : c.t === 'ifrag' ? ('碎' + c.ch) : (c.t === 'shovel' ? '铲' : ''));
    G.cardReveal = { list: preview.slice(0, 10), hero: name, t: 1.1 };   // 十连翻牌仪式
    G.summonFx = { name, t: 1.4 }; G.flash = 0.7;
    recOp({ op: 'drawTen' });                        // 录像（P1-4）
    if (typeof evSummon === 'function') evSummon(10);
  }
  return name;
}
function gainItem(S, id) {                                  // 碎片集齐 → 本局道具
  if (S.side <= 0) {                                        // ponytail: AI 不用道具，折现20馒头
    if (id === 'zhaoxian') S.zhaoxian = true; else S.mantou += 20;
    return;
  }
  if (id === 'zhaoxian') { S.zhaoxian = true; G.banner = { txt: '招贤令! 本局将字概率+60%', t: 1.5 }; }
  else { G.itemUses[id] = (G.itemUses[id] || 0) + 1; G.banner = { txt: '合成 ' + ITEMS[id].name + ' ×1', t: 1.2 }; }
}

/* ---------- 棋盘格子馒头解锁（文档 7.3，与铲子并存） ---------- */
// ponytail: 文档梯度 20/30/40/50/60/80/100，简化为 20+10n 线性
const cellCost = S => 20 + S.unlocked * 10;
function unlockCell(S, i) {
  const c = S.cells[i];
  if (!c || c.open || S.mantou < cellCost(S)) return false;
  if (S.side > 0) pushUndo(S);
  S.mantou -= cellCost(S); S.unlocked++;
  c.open = true;
  if (S.side > 0) { fl(c.x, c.y, '开荒!', '#846358'); boom(c.x, c.y, '#846358'); recOp({ op: 'unlock', idx: i }); }
  return true;
}

/* ---------- 拖拽落子（栏/棋盘通用，AI 共用） ---------- */
const noDeploy = u => u.t === 'char' || u.t === 'shovel' || u.t === 'ifrag';
// 返回 'open'|'move'|'upgrade'|'hero'|'item'|'swap'|null
function dropUnit(S, a1, i1, a2, i2) {
  if (a1 === a2 && i1 === i2) return null;
  const src = slotArr(S, a1)[i1], dst = slotArr(S, a2)[i2];
  if (!src || !dst || !src.unit) return null;
  if (S.side > 0) pushUndo(S);
  if (a2 === 'board' && !dst.open) {                        // 铲子开荒
    if (src.unit.t !== 'shovel') return null;
    dst.open = true; src.unit = null;
    if (S.side > 0) recOp({ op: 'drop', a1, i1, a2, i2 });
    return 'open';
  }
  const deployBad = a2 === 'board' && noDeploy(src.unit);
  if (!dst.unit) {
    if (deployBad) return null;                             // 将字/铲子/碎片不可上阵
    dst.unit = src.unit; src.unit = null;
    if (a2 === 'board' || a1 === 'board') S.fate = fateBuff(S);
    // 新手引导：部署完成 → step 3
    if (S.side > 0 && typeof G !== 'undefined' && G && G.tutorial && G.tutStep === 2 && a2 === 'board') {
      G.tutStep = 3;
      G.banner = { txt: '【教学3/3 完成】单位已上阵！点 ×2 加速游戏体验', t: 3 };
      SAVE.tutorial = 99; saveSave();
    }
    if (S.side > 0) recOp({ op: 'drop', a1, i1, a2, i2 });
    return 'move';
  }
  const o = mergeUnit(dst.unit, src.unit);
  if (o.type === 'upgrade') {
    dst.unit = o.unit; dst.unit.animT = 0.25; src.unit = null;
    if (S.side > 0) {
      sfx('upgrade');                                // 音效（P1-3）
      if (SAVE.stats) SAVE.stats.merges++;
      if (typeof orderProgress === 'function') orderProgress('merges');
      if (typeof evMerge === 'function') evMerge('upgrade');
    }
    // 新手引导：合成完成 → step 2
    if (S.side > 0 && typeof G !== 'undefined' && G && G.tutorial && G.tutStep === 1) {
      G.tutStep = 2;
      G.banner = { txt: '【教学2/3 完成】再把单位拖到棋盘格子上阵', t: 999 };
    }
    if (S.side > 0) recOp({ op: 'drop', a1, i1, a2, i2 });
    return 'upgrade';
  }
  if (o.type === 'item') {                                  // 道具碎片集齐
    dst.unit = null; src.unit = null;
    gainItem(S, o.id);
    if (S.side > 0) {
      recOp({ op: 'drop', a1, i1, a2, i2 });
      if (SAVE.stats) SAVE.stats.merges++;
      if (typeof orderProgress === 'function') orderProgress('merges');
      if (typeof evMerge === 'function') evMerge('upgrade');
    }
    return 'item';
  }
  if (o.type === 'hero') {
    // 永久主将与局内同名拼字发生将魂共鸣：不生成重复将，主将升 1 级并回复生命。
    const lead = S.side > 0 ? [...S.cells, ...S.bar].map(x => x.unit).find(x => x && x.t === 'hero' && x.permanent && x.name === o.name) : null;
    if (lead) {
      lead.lvl = Math.min(5, lead.lvl + 1); lead.hp = Math.min(HEROES[lead.name].hp * HERO_LVL_HP(lead.lvl) * heroStarMul(lead.name), lead.hp + HEROES[lead.name].hp * .5);
      dst.unit = null; src.unit = null; G.banner = { txt: o.name + '·将魂共鸣！等级提升', t: 1.8 }; boom(dst.x, dst.y, '#e8a005');
      if (S.side > 0) recOp({ op: 'drop', a1, i1, a2, i2 });
      return 'hero';
    }
    const h = mkHero(o.name, S);
    dst.unit = h; dst.unit.animT = 0.25; src.unit = null;
    if (h.weapon === 'shemao') { addSnake(S); addSnake(S); }
    if (S.side > 0 && typeof G !== 'undefined' && G) {
      G.summonFx = { name: o.name, t: 1.4 }; G.flash = 0.7; sfx('hero');
      recOp({ op: 'drop', a1, i1, a2, i2 });
      if (SAVE.stats) { SAVE.stats.merges++; SAVE.stats.heroes++; }
      if (typeof orderProgress === 'function') { orderProgress('merges'); orderProgress('heroes'); }
      if (typeof evHeroCreated === 'function') evHeroCreated(o.name);
    }
    S.fate = fateBuff(S);
    return 'hero';
  }
  if (deployBad || (a1 === 'board' && noDeploy(dst.unit))) return null;
  const tmp = dst.unit; dst.unit = src.unit; src.unit = tmp;
  S.fate = fateBuff(S);
  if (S.side > 0) recOp({ op: 'drop', a1, i1, a2, i2 });
  return 'swap';
}
function recycleUnit(S, area, idx) {
  const s = slotArr(S, area)[idx];
  if (!s || !s.unit) return 0;
  if (S.side > 0) pushUndo(S);
  const v = refundValue(s.unit, S);
  S.mantou += v; s.unit = null;
  if (area === 'board') S.fate = fateBuff(S);
  if (S.side > 0) {
    fl(RECYCLE.x + RECYCLE.w / 2, RECYCLE.y, '+' + v, '#8b5e3c');
    recOp({ op: 'recycle', area, idx });
  }
  return v;
}

/* ---------- 主动道具 ---------- */
function canTargetItem(id, u) {
  if (!u) return false;
  if (id === 'shenbing') return u.t === 'hero' && u.lvl < 5;
  if (id === 'gongsu') return u.t === 'hero';
  if (id === 'maobi') return u.t === 'char';
  if (id === 'juexing') return !!SAVE.awaken && u.t === 'hero' && u.awaken < 3;
  return false;
}
function bestTarget(id) {
  const all = [...G.P.cells.map((s, i) => ({ area: 'board', idx: i, s })), ...G.P.bar.map((s, i) => ({ area: 'bar', idx: i, s }))]
    .filter(x => canTargetItem(id, x.s.unit));
  if (!all.length) return null;
  if (id === 'shenbing') all.sort((a, b) => a.s.unit.lvl - b.s.unit.lvl || (HEROES[b.s.unit.name].grade - HEROES[a.s.unit.name].grade));
  else if (id === 'gongsu' || id === 'juexing') all.sort((a, b) => HEROES[b.s.unit.name].dmg - HEROES[a.s.unit.name].dmg);
  else if (id === 'maobi') all.sort((a, b) => (a.s.unit.wish ? -1 : 0));
  return all[0];
}
function autoTargetActive() {
  if (!G || !G.targeting) return false;
  const t = bestTarget(G.targeting);
  if (!t) { G.banner = { txt: '暂无可用目标', t: 1.2 }; return false; }
  return applyTarget(G.targeting, t.area, t.idx);
}

function useActive(id) {
  if (!G.itemUses[id]) return false;
  const P = G.P;
  if (id === 'yunshi') {
    for (const m of P.mobs) if (m.hp > 0) dealDmg(P, m, 150 * (typeof adviserDamageMul === 'function' ? adviserDamageMul('meteor') : 1));
    G.flash = 0.8; G.banner = { txt: '陨石天降!', t: 1.2 };
  } else if (id === 'xiangyao') {
    let hit = false;
    for (const m of P.mobs) if (m.hp > 0 && m.boss) { m.stun = Math.max(m.stun, 3); dealDmg(P, m, 250); hit = true; }
    if (!hit) return false;
    G.banner = { txt: '降妖符! BOSS 受制', t: 1.2 };
  } else if (id === 'yuni') {
    if (!P.mobs.some(m => m.hp > 0)) return false;
    P.slowT = 5;
    G.banner = { txt: '淤泥! 全场减速', t: 1 };
  } else if (id === 'shenbing' || id === 'gongsu' || id === 'maobi' || id === 'juexing') {
    if (!bestTarget(id)) { G.banner = { txt: '暂无可用目标', t: 1.2 }; return false; }
    G.targeting = id;
    G.banner = { txt: '点选高亮目标，或点「自动施放」', t: 2 };
    return true;
  } else return false;
  G.itemUses[id]--;
  recOp({ op: 'active', id });                              // 录像（P1-4）
  return true;
}
function applyTarget(id, area, idx) {
  const P = G.P, s = slotArr(P, area)[idx];
  if (!s || !s.unit || !G.itemUses[id] || !canTargetItem(id, s.unit)) {
    G.banner = { txt: '目标不符合条件，请点高亮单位', t: 1.2 };
    return false;
  }
  const u = s.unit;
  if (id === 'shenbing') {
    if (u.t !== 'hero' || u.lvl >= 5) return false;
    u.lvl++; u.hp = HEROES[u.name].hp * HERO_LVL_HP(u.lvl);
    if (u.weapon === 'shemao') addSnake(P);
    fl(s.x, s.y - 24, u.name + ' 升级!', '#e8a005'); boom(s.x, s.y, '#e8a005');
  } else if (id === 'gongsu') {
    if (u.t !== 'hero') return false;
    u.rateMul *= 2;                                         // 文档 6.4：攻速符+100%
    fl(s.x, s.y - 24, '攻速+100%', '#1c7ed6');
  } else if (id === 'maobi') {
    if (u.t !== 'char') return false;
    u.ch = maobiBest(P, u);
    fl(s.x, s.y - 24, '化字·' + u.ch, '#9c36b5');
  } else if (id === 'juexing') {
    if (!SAVE.awaken || u.t !== 'hero' || u.awaken >= 3) return false;
    u.awaken++;
    fl(s.x, s.y - 24, u.name + ' 觉醒' + u.awaken + '!', '#e8590c'); boom(s.x, s.y, '#e8590c');
  } else return false;
  G.itemUses[id]--;
  G.targeting = null;
  recOp({ op: 'target', id, area, idx });                   // 录像（P1-4）
  return true;
}
function maobiBest(S, self) {                               // 找能与场上孤字配对的字
  const chars = [];
  for (const s of [...S.bar, ...S.cells]) if (s.unit && s.unit.t === 'char' && s.unit !== self) chars.push(s.unit.ch);
  for (const x of chars)
    for (const name of HERO_LIST) {
      if (name[0] === x) return name[1];
      if (name[1] === x) return name[0];
    }
  return CHAR_POOL[(Math.random() * CHAR_POOL.length) | 0];
}

/* ---------- AI（镜像操作，强度随关卡） ---------- */
function aiFindMerge(S) {
  const spots = [];
  S.bar.forEach((s, i) => s.unit && spots.push(['bar', i, s.unit]));
  S.cells.forEach((c, i) => c.unit && spots.push(['board', i, c.unit]));
  let up = null;
  for (const a of spots) for (const b of spots) {
    if (a === b) continue;
    const o = mergeUnit(b[2], a[2]);
    if (o.type === 'hero') return [a, b];
    if (o.type === 'upgrade' && !up) up = [a, b];
  }
  return up;
}
/* ---------- AI 难度分层（P0-3） ----------
   easy:   行动间隔慢；偶尔不合成武将；不主动开荒
   normal: 现状基线
   hard:   行动更快；优先合武将；保留主动道具等 BOSS；经济管理保留 ≥30 馒头 */
function aiAct(S) {
  const lvl = SAVE.aiLevel || 'normal';
  // 简单档：30% 概率跳过本回合（模拟"反应慢"）
  if (lvl === 'easy' && Math.random() < 0.3) return;
  // 困难档：BOSS 关且持有道具时延迟部署（保留资源）
  const isBossWave = G && G.wave && stageCfg(G.endless ? STAGE_MAX : G.stage)[3];
  const si = S.bar.findIndex(s => s.unit && s.unit.t === 'shovel');
  if (si >= 0) {
    const cj = S.cells.findIndex(c => !c.open);
    if (cj >= 0) { dropUnit(S, 'bar', si, 'board', cj); return; }
  }
  const pair = aiFindMerge(S);
  if (pair) {
    // 简单档：30% 概率故意跳过合成（让玩家更容易赢）
    if (lvl === 'easy' && Math.random() < 0.3) { /* skip */ }
    else { dropUnit(S, pair[0][0], pair[0][1], pair[1][0], pair[1][1]); return; }
  }
  // 部署：近战/武将去前排，弓系去后排
  const bi = S.bar.findIndex(s => s.unit && !noDeploy(s.unit));
  if (bi >= 0) {
    const u = S.bar[bi].unit;
    const ranged = (u.t === 'troop' && u.type === '弓') || (u.t === 'hero' && HEROES[u.name].wq === '弓');
    const order = ranged ? [2, 1, 0] : [0, 1, 2];
    for (const r of order)
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        if (S.cells[idx].open && !S.cells[idx].unit) { dropUnit(S, 'bar', bi, 'board', idx); return; }
      }
  }
  // 栏满且无操作 → 回收将字/碎片腾位
  if (barFree(S) < 0) {
    const ci = S.bar.findIndex(s => s.unit && (s.unit.t === 'char' || s.unit.t === 'ifrag'));
    if (ci >= 0) { recycleUnit(S, 'bar', ci); return; }
  }
  // 经济管理：困难档保留至少 20 馒头应对突发；简单/普通无保留
  const reserve = lvl === 'hard' ? 20 : 0;
  if (S.mantou >= DRAW.cost + reserve && barFree(S) >= 0) doSummon(S);
  // 困难档：BOSS 来前提前召唤（保留主动道具已由 loadout 控制，此处保留馒头）
  if (lvl === 'hard' && isBossWave && S.mantou >= DRAW.tenCost + reserve && barFree(S) >= 0) drawTen(S);
}
