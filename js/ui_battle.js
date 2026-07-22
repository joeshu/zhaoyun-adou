/* v2 战场渲染：三段式布局 / 单位 / 怪物 / 特效 / 结算 */
'use strict';

function unitGlyph(u) {
  return u.t === 'troop' ? u.type : u.t === 'char' || u.t === 'ifrag' ? u.ch : u.t === 'shovel' ? '铲' : u.name;
}
function unitCol(u) {
  if (u.t === 'troop') return TIER_COL[u.tier - 1];
  if (u.t === 'char') return '#9c36b5';
  if (u.t === 'ifrag') return '#1c7ed6';
  if (u.t === 'shovel') return '#846358';
  // P2-1 皮肤系统：武将颜色由当前皮肤决定
  if (u.t === 'hero' && typeof currentSkin === 'function') {
    const sk = currentSkin(u.name);
    if (sk && sk.col) return sk.col;
  }
  return HEROES[u.name].grade === 4 ? '#b0801f' : '#9c36b5';
}
function drawUnitAt(u, x, y, S) {
  const pop = u.animT > 0 ? 1 + u.animT * 0.6 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
  const col = unitCol(u);
  if (u.t === 'hero') {
    txt(u.name, 0, 4, 14 + u.lvl, col, 'center', true);
    txt('Lv' + u.lvl + (u.weapon ? '·' + WEAPONS[u.weapon].name[0] : ''), 0, 17, 8, col, 'center');
    // P2-1 皮肤装饰：按当前皮肤的 decor 显示角标
    if (typeof currentSkin === 'function') {
      const sk = currentSkin(u.name);
      if (sk && sk.decor && sk.decor !== 'none') {
        const dCol = sk.decor === 'gold' ? '#fab005' : col;
        const dChar = (typeof SKIN_DECOR !== 'undefined' && SKIN_DECOR[sk.decor]) || '★';
        txt(dChar, 16, -12, 11, dCol, 'center');
      }
    }
  } else if (u.t === 'troop') {
    txt(u.type, 0, 6, 22, col, 'center', true);
    txt(TIER_NAME[u.tier - 1], 0, 18, 8, col, 'center');
  } else if (u.t === 'char') {
    txt(u.ch, 0, 7, 22, col, 'center', true);
    txt('将字', 0, 18, 7, '#adb5bd', 'center');
  } else if (u.t === 'ifrag') {
    txt(u.ch, 0, 7, 22, u.wish ? '#ffd700' : col, 'center', true);
    txt(ITEMS[IFRAGS[u.ch].item].name + ' ' + u.n + '/' + IFRAGS[u.ch].need, 0, 18, 7, '#adb5bd', 'center');
    if (u.wish) txt('★', 14, -10, 12, '#ffd700', 'center');   // 心愿碎片金色星标（1.2.4 视觉反馈）
  } else txt('铲', 0, 7, 20, col, 'center', true);
  ctx.restore();
  if (S && (u.t === 'troop' || u.t === 'hero')) {
    const st = unitStats(u, S);
    if (u.hp < st.maxhp) hpBar(x - 18, y + 21, 36, u.hp / st.maxhp, '#2f9e44');
    if (u.animT > 0) { ctx.strokeStyle = 'rgba(255,107,107,.7)'; ctx.lineWidth = 2; ctx.strokeRect(x - 22, y - 14, 44, 30); }   // 受击红描边（全局坐标）
  }
  if (u.stun > 0) txt('✦', x + 16, y - 14, 10, '#5f3dc4', 'center');
}
function drawCell(c, S, hide) {
  const x = c.x - CELL / 2, y = c.y - CELL / 2;
  rr(x, y, CELL, CELL, 6);
  if (!c.open) {
    ctx.fillStyle = '#d9d2c2'; ctx.fill();
    ctx.strokeStyle = '#c6bda8'; ctx.lineWidth = 1; ctx.stroke();
    txt('荒', c.x, c.y - 1, 12, '#b3a888', 'center');
    if (S && S.side > 0) txt('馒' + cellCost(S), c.x, c.y + 15, 8, '#b3a888', 'center');   // 点击花馒头开荒
    return;
  }
  ctx.fillStyle = '#ffffffcc'; ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = !c.unit ? '#dee2e6' : unitCol(c.unit);
  ctx.stroke();
  if (c.unit && !hide) drawUnitAt(c.unit, c.x, c.y, S);
  if (S && S.side > 0 && G && G.targeting && typeof canTargetItem === 'function' && canTargetItem(G.targeting, c.unit)) {
    ctx.strokeStyle = '#e8a005'; ctx.lineWidth = 3; ctx.setLineDash([3, 2]); ctx.strokeRect(x - 2, y - 2, CELL + 4, CELL + 4); ctx.setLineDash([]);
  }
}
function drawBarSlot(s, hide) {
  const x = s.x - CELL / 2, y = s.y - CELL / 2;
  rr(x, y, CELL, CELL, 6);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = s.unit ? unitCol(s.unit) : '#ced4da';
  if (s.unit && noDeploy(s.unit)) ctx.setLineDash([3, 3]);
  ctx.stroke(); ctx.setLineDash([]);
  if (s.unit && !hide) drawUnitAt(s.unit, s.x, s.y, null);
  if (G && G.targeting && typeof canTargetItem === 'function' && canTargetItem(G.targeting, s.unit)) {
    ctx.strokeStyle = '#e8a005'; ctx.lineWidth = 3; ctx.setLineDash([3, 2]); ctx.strokeRect(x - 2, y - 2, CELL + 4, CELL + 4); ctx.setLineDash([]);
  }
}
function drawPath(S) {
  ctx.strokeStyle = '#e3ded2'; ctx.lineWidth = 18; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  S.path.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.stroke();
}
function drawMob(m) {
  const size = m.boss ? 28 : 16;
  const col = m.flash > 0 ? '#f59f00' : m.boss ? '#a61e4e' : m.press ? '#5c1e1e' : '#c0392b';
  txt(m.type, m.x, m.y + size * 0.35, size, col, 'center', true);
  if (m.boss) txt(MOBS[m.type].name, m.x, m.y - size * 0.72, 9, '#a61e4e', 'center', true);
  const bw = m.boss ? 40 : 22;
  hpBar(m.x - bw / 2, m.y + size * 0.62 + 3, bw, m.hp / m.maxhp, '#fa5252');
  if (m.boss && MOBS[m.type].castIv) {
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(m.x - 20, m.y + size * .62 + 9, 40, 3);
    ctx.fillStyle = m.warnCast ? '#f59f00' : '#7250b8'; ctx.fillRect(m.x - 20, m.y + size * .62 + 9, 40 * (1 - m.castT / MOBS[m.type].castIv), 3);
  }
  if (m.stun > 0) txt('✦', m.x + size * 0.6, m.y - size * 0.5, 10, '#e8a005', 'center');
  if (m.slowT > 0) txt('泥', m.x - size * 0.7, m.y - size * 0.5, 8, '#846358', 'center');
}
function drawAdou(S) {
  const mine = S.side > 0;
  // 玩家阿斗的实际终点仍在底部；仅将状态标记上移，避免被合成栏遮挡。
  const y = mine ? S.adou.y - 38 : S.adou.y;
  txt('阿斗', S.adou.x, y + 7, 20, mine ? '#343a40' : '#c0392b', 'center', true);
  txt('♥' + Math.max(0, S.hp), S.adou.x + 36, y + 5, 12, '#e03131', 'left', true);
  if (S.hp < ADOU_HP) hpBar(S.adou.x - 18, y + 14, 36, Math.max(0, S.hp) / ADOU_HP, '#e03131');
}

function drawGame() {
  // 战场采用羊皮纸、敌我阵营与操作区三层配色，降低格子/按钮间的视觉噪声。
  ctx.fillStyle = '#fff5f0'; ctx.fillRect(0, TOP, W, 296 - TOP);
  ctx.fillStyle = '#fbf7ed'; ctx.fillRect(0, 300, W, 532 - 300);
  ctx.fillStyle = '#edf0f2'; ctx.fillRect(0, 532, W, H - 532);
  ctx.fillStyle = '#b9a995'; ctx.fillRect(0, 296, W, 3);
  drawPath(G.E); drawPath(G.P);
  drawAdou(G.E);
  G.E.cells.forEach(c => drawCell(c, G.E, false));
  G.P.cells.forEach((c, i) => {
    drawCell(c, G.P, drag && drag.area === 'board' && drag.from === i);
    // 拖拽落点高亮：绿=可合成 / 蓝=可部署 / 红=不可放置 / 橙=合成武将 / 黄=开荒
    if (drag && drag.hintType) {
      const hit = Math.abs(drag.x - c.x) <= CELL / 2 && Math.abs(drag.y - c.y) <= CELL / 2;
      if (hit) {
        const ht = drag.hintType;
        const col = ht === 'hero' ? '#e8a005' : ht === 'upgrade' || ht === 'item' ? '#2f9e44'
          : ht === 'deploy' || ht === 'move' ? '#1c7ed6' : ht === 'open' ? '#f59f00' : ht === 'swap' ? '#9c36b5' : '#e03131';
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.strokeRect(c.x - CELL / 2 - 2, c.y - CELL / 2 - 2, CELL + 4, CELL + 4);
      }
    }
  });
  G.P.bar.forEach((s, i) => {
    drawBarSlot(s, drag && drag.area === 'bar' && drag.from === i);
    if (drag && drag.hintType) {
      const hit = Math.abs(drag.x - s.x) <= CELL / 2 && Math.abs(drag.y - s.y) <= CELL / 2;
      if (hit) {
        const ht = drag.hintType;
        const col = ht === 'hero' ? '#e8a005' : ht === 'upgrade' || ht === 'item' ? '#2f9e44'
          : ht === 'move' ? '#1c7ed6' : ht === 'swap' ? '#9c36b5' : '#e03131';
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.strokeRect(s.x - CELL / 2 - 2, s.y - CELL / 2 - 2, CELL + 4, CELL + 4);
      }
    }
  });
  // 玩家阿斗状态置于手牌绘制之后，确保不会被底部栏遮挡。
  drawAdou(G.P);
  for (const sn of G.P.snakes) { txt('蛇', sn.x, sn.y + 5, 15, '#2f9e44', 'center', true); hpBar(sn.x - 12, sn.y + 12, 24, sn.hp / 150, '#2f9e44'); }
  for (const sn of G.E.snakes) txt('蛇', sn.x, sn.y + 5, 15, '#2f9e44', 'center', true);
  for (const m of G.E.mobs) drawMob(m);
  for (const m of G.P.mobs) drawMob(m);
  if (G.egg) {
    const f = 0.7 + Math.sin(G.time * 5) * 0.3;
    ctx.globalAlpha = f;
    txt(G.egg.ch, G.egg.x, G.egg.y + 6, 20, '#e8a005', 'center', true);
    ctx.globalAlpha = 1;
  }
  if (G.P.fate.list.length) txt('羁绊：' + G.P.fate.list.join('·'), 10, 315, 10, '#e8a005', 'left', true);
  // 特效
  for (const f of G.fx) {
    ctx.globalAlpha = clamp(f.t / f.t0, 0, 1) * 0.8;
    if (f.type === 'line') {
      ctx.strokeStyle = f.col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
    } else if (f.type === 'ring') {
      ctx.strokeStyle = f.col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.3 - f.t / f.t0 * 0.3), 0, 7); ctx.stroke();
    } else if (f.type === 'lane') {
      ctx.strokeStyle = f.col; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, f.y); ctx.lineTo(W, f.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    f.t -= DT60;
  }
  G.fx = G.fx.filter(f => f.t > 0);
  for (const p of G.parts) {
    ctx.globalAlpha = clamp(p.t / 0.7, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    p.x += p.vx * DT60; p.y += p.vy * DT60; p.vy += 200 * DT60; p.t -= DT60;
  }
  ctx.globalAlpha = 1;
  G.parts = G.parts.filter(p => p.t > 0);
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.t / 0.8, 0, 1);
    txt(f.txt, f.x, f.y, 10, f.col, 'center', true);
    f.y -= 26 * DT60; f.t -= DT60;
  }
  ctx.globalAlpha = 1;
  G.floats = G.floats.filter(f => f.t > 0);
  // 顶栏：资源、关卡与快捷控制保持同一阅读基线
  ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = '#e4d9c8'; ctx.fillRect(0, TOP - 3, W, 3);
  txt('馒 ' + G.P.mantou, 8, 22, 14, '#8b5e3c', 'left', true);
  txt('金 ' + SAVE.gold, 78, 22, 12, '#b0801f', 'left', true);
  txt((G.mode ? G.modeLabel : (G.endless ? '无尽' : '第' + G.stage + '关')) + '·第' + G.wave + '波', 175, 22, 12, '#495057', 'center');
  if (SAVE.invincible) txt('无敌', 200, 22, 12, '#2f9e44', 'center', true);
  // 特别玩法状态条：保留战斗视野，不弹出额外常驻面板。
  if (G.mode === 'fire') {
    txt('🔥 ' + G.wind + ' · 守城 ' + Math.ceil(Math.max(0, G.modeTime)) + ' 秒', W / 2, 48, 11, '#bd4a31', 'center', true);
    for (const f of G.fireCells) { ctx.globalAlpha = .22 + Math.sin(G.time * 8) * .08; ctx.fillStyle = '#e8590c'; ctx.beginPath(); ctx.arc(f.x, f.y, 30, 0, 7); ctx.fill(); ctx.globalAlpha = 1; txt('🔥', f.x, f.y + 7, 18, '#e8590c', 'center'); }
  } else if (G.mode === 'escort') {
    txt('🐎 护送进度 ' + Math.floor(G.escort.progress) + '%', W / 2, 48, 11, '#2f7f9d', 'center', true);
    ctx.fillStyle = '#d9e8ec'; ctx.fillRect(112, 53, 151, 4); ctx.fillStyle = '#2f7f9d'; ctx.fillRect(112, 53, 151 * G.escort.progress / 100, 4);
  } else if (G.mode === 'puzzle') {
    txt('♟ 歼敌 ' + G.P.totalKills + '/' + G.puzzle.target + ' · ' + Math.ceil(Math.max(0, G.puzzle.limit)) + ' 秒', W / 2, 48, 11, '#b78324', 'center', true);
  } else if (G.mode === 'raid') {
    txt('👑 讨伐剩余 ' + Math.ceil(Math.max(0, G.raid.limit)) + ' 秒', W / 2, 48, 11, '#8d3543', 'center', true);
  } else if (G.mode === 'rogue') {
    txt('⚔ 五虎试炼 · 第 ' + G.rogue.floor + '/' + G.rogue.maxFloor + ' 战 · 军略 ' + G.rogue.picks, W / 2, 48, 11, '#7250b8', 'center', true);
  }
  btn(234, 4, 33, 24, '×' + G.speed, () => { G.speed = G.speed === 1 ? 2 : 1; }, { bg: '#495057', size: 11 });
  btn(269, 4, 33, 24, G.paused ? '▶' : 'Ⅱ', () => { G.paused = !G.paused; }, { bg: '#495057', size: 11 });
  // 静音切换（P1-3）
  btn(304, 4, 33, 24, SAVE.mute ? '🔇' : '🔊', () => { SAVE.mute = !SAVE.mute; saveSave(); sfx('click'); },
    { bg: SAVE.mute ? '#e03131' : '#2f9e44', size: 12 });
  btn(339, 4, 33, 24, '菜单', () => { scr = 'menu'; }, { bg: '#868e96', size: 9 });
  // 临时背包：空时完全隐藏；有溢出卡时用右下「包」打开抽屉，避免常驻挤占手牌区。
  if (G.P.tempBag && G.P.tempBag.length > 0) {
    btn(256, 638, 28, 26, '包' + G.P.tempBag.length, () => { G.tempOpen = !G.tempOpen; }, { size: 8, bg: '#7250b8' });
    if (G.tempOpen) {
      panel(8, 510, 272, 66, { bg: '#fffdf9', stroke: '#cfc4af', r: 9, blur: 5 });
      txt('临时背包 · 点卡牌放回合成栏', 18, 525, 10, '#6f6556', 'left', true);
      const bx = [16, 68, 120], by = 532, bs = 40;
      for (let i = 0; i < 3; i++) {
        const u = G.P.tempBag[i];
        rr(bx[i], by, bs, bs, 6); ctx.fillStyle = '#f5f2eb'; ctx.fill(); ctx.setLineDash([3, 2]); ctx.strokeStyle = '#8d96a0'; ctx.stroke(); ctx.setLineDash([]);
        if (u) { txt(unitGlyph(u), bx[i] + bs / 2, by + 25, 20, unitCol(u), 'center', true); }
        const idx = i;
        btns.push({ x: bx[i], y: by, w: bs, h: bs, fn: () => {
          const card = G.P.tempBag[idx], fi = barFree(G.P); if (!card) return;
          if (fi < 0) { fl(60, 505, '合成栏已满', '#e03131'); return; }
          G.P.tempBag.splice(idx, 1); card.animT = .25; G.P.bar[fi].unit = card;
          if (!G.P.tempBag.length) G.tempOpen = false;
        }});
      }
      btn(174, 534, 46, 28, '折现', () => { const n = G.P.tempBag.length; G.P.tempBag = []; G.P.mantou += n * 2; G.tempOpen = false; fl(120, 505, '背包折现 +' + n * 2, '#8b5e3c'); }, { size: 10, bg: '#8e98a3' });
      btn(226, 534, 42, 28, '收起', () => { G.tempOpen = false; }, { size: 9, bg: '#7c8792' });
    }
  } else G.tempOpen = false;
  btn(8, 638, 62, 26, '抽卡 馒' + DRAW.cost, () => doSummon(G.P),
    { size: 11, bg: '#c0392b', disabled: G.P.mantou < DRAW.cost || barFree(G.P) < 0 });
  const tenCostNow = SAVE.firstTen ? (DRAW.tenCost / 2 | 0) : DRAW.tenCost;
  btn(74, 638, 62, 26, '十连 ' + tenCostNow, () => drawTen(G.P),
    { size: 11, bg: '#a61e4e', disabled: G.P.mantou < tenCostNow || barFree(G.P) < 0 });
  const acts = Object.keys(ITEMS).filter(id => ITEMS[id].act && (G.itemUses[id] || SAVE.loadout.includes(id)));
  acts.slice(0, 2).forEach((id, i) => {
    const n = G.itemUses[id] || 0;
    btn(140 + i * 58, 638, 54, 26, ITEMS[id].name + '×' + n, () => useActive(id),
      { size: 9, bg: G.targeting === id ? '#e8a005' : '#5f3dc4', disabled: !n });
  });
  rr(RECYCLE.x, RECYCLE.y, RECYCLE.w, RECYCLE.h, 6);
  ctx.fillStyle = '#e9ecef'; ctx.fill();
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#868e96'; ctx.stroke(); ctx.setLineDash([]);
  txt('回收♻', RECYCLE.x + RECYCLE.w / 2, RECYCLE.y + 19, 12, '#868e96', 'center', true);
  txt('拖单位到此回收', RECYCLE.x + RECYCLE.w / 2, RECYCLE.y + RECYCLE.h - 4, 9, '#adb5bd', 'center');
  if (G.targeting) {
    const label = ITEMS[G.targeting] ? ITEMS[G.targeting].name : '道具';
    // 道具上下文操作移至敌我战场分隔带，不再侵占底部手牌与回收区。
    txt(label + '：点金色虚线目标', W / 2, 282, 10, '#b78324', 'center', true);
    btn(86, 292, 96, 22, '自动施放', () => autoTargetActive(), { size: 10, bg: '#e8a005' });
    btn(194, 292, 96, 22, '取消', () => { G.targeting = null; }, { size: 10, bg: '#868e96' });
  }
  // 拖拽跟随：单位 + 提示标签 + 半透明预览产物
  if (drag) {
    const u = (drag.area === 'bar' ? G.P.bar : G.P.cells)[drag.from].unit;
    if (u) {
      // 预览产物：在落点附近绘制合成结果虚影
      if (drag.preview && (drag.hintType === 'upgrade' || drag.hintType === 'hero')) {
        ctx.globalAlpha = 0.45;
        drawUnitAt(drag.preview, drag.x, drag.y - 36, G.P);
        ctx.globalAlpha = 1;
        txt('→ 合成预览', drag.x, drag.y - 60, 9, '#495057', 'center');
      }
      ctx.globalAlpha = 0.85;
      txt(unitGlyph(u), drag.x, drag.y + 8, 26, unitCol(u), 'center', true);
      if (drag.hint) {
        const ht = drag.hintType;
        const hintCol = ht === 'hero' ? '#e8a005' : ht === 'upgrade' || ht === 'item' ? '#2f9e44'
          : ht === 'deploy' || ht === 'move' ? '#1c7ed6' : ht === 'open' ? '#f59f00' : ht === 'recycle' ? '#8b5e3c' : '#e8590c';
        txt(drag.hint, drag.x, drag.y - 18, 11, hintCol, 'center', true);
      }
      ctx.globalAlpha = 1;
    }
  }
  // 横幅 / 闪光 / 武将登场
  if (G.banner) {
    ctx.globalAlpha = clamp(G.banner.t, 0, 1);
    // 教学提示常驻显示（t>10 表示教学横幅，不衰减）
    const isTut = G.banner.t > 10;
    txt(G.banner.txt, W / 2, 288, 17, isTut ? '#1c7ed6' : '#343a40', 'center', true);
    ctx.globalAlpha = 1;
    if (!isTut) { G.banner.t -= DT60; if (G.banner.t <= 0) G.banner = null; }
  }
  if (G.flash > 0) {
    ctx.globalAlpha = G.flash * 0.4; ctx.fillStyle = '#ffe066';
    ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    G.flash -= 0.03;
  }
  if (G.summonFx) {
    const s = G.summonFx, p = 1 - s.t / 1.4;
    ctx.globalAlpha = clamp(s.t * 2, 0, 1);
    txt(s.name, W / 2, H / 2 - 40, 34 + p * 30, '#e8a005', 'center', true);
    txt(HEROES[s.name].tip + '!', W / 2, H / 2 - 4, 13, '#495057', 'center');
    ctx.globalAlpha = 1;
    s.t -= DT60; if (s.t <= 0) G.summonFx = null;
  }
  // 结算 / 暂停
  if (G.mode === 'rogue' && G.rogueChoices) {
    ctx.fillStyle = 'rgba(26,24,35,.72)'; ctx.fillRect(0, 0, W, H);
    panel(24, 210, 327, 190, { bg: '#fffdf9', stroke: '#dacdf0', r: 14 });
    txt('选择一条军略', W / 2, 244, 21, '#503b83', 'center', true);
    txt('本局生效 · 选择后继续远征', W / 2, 264, 10, '#8f8a9c', 'center');
    G.rogueChoices.forEach((c, i) => {
      const y = 279 + i * 35;
      btn(42, y, 291, 29, c.n + ' · ' + c.d, () => chooseRogue(i), { size: 11, bg: '#7250b8' });
    });
  }
  if (G.state === 'win') {
    const acts2 = [];
    if (!G.endless && G.stage < STAGE_MAX) acts2.push(['下一关', () => { startBattle(G.stage + 1, false, G.mapIdx); }]);
    acts2.push(['再来一局', () => { startBattle(G.stage, G.endless, G.mapIdx); }]);
    acts2.push(['返回菜单', () => { scr = 'menu'; selStage = SAVE.stage; }, '#868e96']);
    let desc = G.rewardTxt;
    if (G.stage === 30 && !SAVE.eggs.acc) desc += '  (停留' + Math.max(0, Math.ceil(10 - G.resultT)) + 's…)';
    overlay('胜 利', desc, acts2);
  } else if (G.state === 'lose') {
    overlay('失 败', '阿斗被掳走 · ' + G.rewardTxt, [
      ['再来一局', () => { startBattle(G.stage, G.endless, G.mapIdx); }],
      ['返回菜单', () => { scr = 'menu'; }, '#868e96'],
    ]);
  } else if (G.paused) {
    overlay('已暂停', '', [
      ['继续', () => { G.paused = false; }],
      ['退出对局', () => { scr = 'menu'; }, '#868e96'],
    ]);
  }
}
function overlay(title, desc, actions) {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  btns = [];
  rr(50, 230, 275, 190 + actions.length * 12, 14); ctx.fillStyle = '#fff'; ctx.fill();
  txt(title, W / 2, 282, 28, '#343a40', 'center', true);
  txt(desc, W / 2, 312, 11, '#868e96', 'center');
  actions.forEach((a, i) => btn(87, 332 + i * 38, 200, 31, a[0], a[1], { size: 13, bg: a[2] }));
}
