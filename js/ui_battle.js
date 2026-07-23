/* v2 战场渲染：三段式布局 / 单位 / 怪物 / 特效 / 结算 */
/* 视觉升级：MAP_THEMES / 地图背景缓存 / 双线路径 / 瓷面格 / 阿斗牌匾 / 朱砂横幅 */
'use strict';

/* ========== MAP_THEMES: per-map visual identity ==========
   Index matches MAPS[] in data.js:
   0 = 长坂坡 (dust/sand)  1 = 赤壁 (river)  2 = 街亭 (pass)  3 = 函谷关 (cliff)
   Each theme defines: bg gradient, accent color, motif painter, path color, cell style. */
var MAP_THEMES = [
  {                                   /* 0 长坂坡 — 漫天黄沙 */
    name: '长坂坡',
    bgTop: '#f5ede0', bgBot: '#e6dcc8',
    bgBoldTop: '#e0d4bc', bgBoldBot: '#cfb898',
    accent: '#c4a26c', accentBold: '#a07840',
    motif: 'dust',
    pathCol: '#b09060', pathColBold: '#8a6838',
    pathInner: '#d4bc98', pathInnerBold: '#c4a878',
    cellFill: '#fdfaf3', cellBorder: '#d8ccb8',
    cellFillBold: '#f5efe0', cellBorderBold: '#bfa978',
    barrenFill: '#f0ebe0', barrenBorder: '#c9bca8',
    dustColor: '#d4b896', dustColorBold: '#b89868',
  },
  {                                   /* 1 赤壁 — 江风水势 */
    name: '赤壁',
    bgTop: '#dde6ec', bgBot: '#cfd8e2',
    bgBoldTop: '#c4d0dc', bgBoldBot: '#a8b8c8',
    accent: '#7a98a8', accentBold: '#587890',
    motif: 'river',
    pathCol: '#6a8898', pathColBold: '#486878',
    pathInner: '#a8c0cc', pathInnerBold: '#88a8b8',
    cellFill: '#f5f8fc', cellBorder: '#b8c4d0',
    cellFillBold: '#eaf0f6', cellBorderBold: '#98a8b8',
    barrenFill: '#e8eef2', barrenBorder: '#a8b8c8',
    riverColor: '#a8c0d0', riverColorBold: '#7898b0',
  },
  {                                   /* 2 街亭 — 山岭要道 */
    name: '街亭',
    bgTop: '#e8e0d2', bgBot: '#dad0bc',
    bgBoldTop: '#d8ceb6', bgBoldBot: '#c4b498',
    accent: '#a09068', accentBold: '#807048',
    motif: 'pass',
    pathCol: '#9a8860', pathColBold: '#786840',
    pathInner: '#c4b498', pathInnerBold: '#b4a488',
    cellFill: '#faf8f0', cellBorder: '#d0c4ae',
    cellFillBold: '#f2ead8', cellBorderBold: '#b8a888',
    barrenFill: '#ece6da', barrenBorder: '#beb098',
    passColor: '#c4b090', passColorBold: '#a09070',
  },
  {                                   /* 3 函谷关 — 险峻峡谷 */
    name: '函谷关',
    bgTop: '#dcdfe6', bgBot: '#caced6',
    bgBoldTop: '#c8cdd8', bgBoldBot: '#a8b0c0',
    accent: '#788090', accentBold: '#58606e',
    motif: 'cliff',
    pathCol: '#687080', pathColBold: '#48505e',
    pathInner: '#98a4b4', pathInnerBold: '#788898',
    cellFill: '#f2f3f5', cellBorder: '#b8bec8',
    cellFillBold: '#e8eaee', cellBorderBold: '#98a0ae',
    barrenFill: '#e4e6ea', barrenBorder: '#a8aeb8',
    cliffColor: '#98a4b4', cliffColorBold: '#788898',
  },
];

/* ========== Offscreen map-background cache ==========
   Key format: "mapIdx:intensity". Avoids repainting every frame. */
var _mapBgCache = {};

function getMapBg(mapIdx, intensity) {
  var key = mapIdx + ':' + (intensity | 0);
  if (_mapBgCache[key]) return _mapBgCache[key];
  var c = document.createElement('canvas');
  c.width = W; c.height = H;
  var cx = c.getContext('2d');
  paintMapBg(cx, W, H, mapIdx, intensity | 0);
  _mapBgCache[key] = c;
  return c;
}

function paintMapBg(cx, w, h, mapIdx, intensity) {
  var mt = MAP_THEMES[mapIdx] || MAP_THEMES[0];
  var bold = intensity >= 1;
  var tTop = bold ? mt.bgBoldTop : mt.bgTop;
  var tBot = bold ? mt.bgBoldBot : mt.bgBot;
  var g = cx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, tTop); g.addColorStop(1, tBot);
  cx.fillStyle = g; cx.fillRect(0, 0, w, h);
  drawMapMotif(cx, w, h, mapIdx, intensity);
}

/* Per-map motif dispatcher */
function drawMapMotif(cx, w, h, mapIdx, intensity) {
  switch (mapIdx) {
    case 0: paintDust(cx, w, h, intensity); break;     /* 长坂坡 → 黄沙 */
    case 1: paintRiver(cx, w, h, intensity); break;    /* 赤壁 → 水纹 */
    case 2: paintPass(cx, w, h, intensity); break;     /* 街亭 → 山道 */
    case 3: paintCliff(cx, w, h, intensity); break;     /* 函谷关 → 峭壁 */
  }
}

/* --- Motif: 长坂坡 Dust (warm sand tone) ---
   APPROVED look: mostly sand color, subtle atmospheric patches, no heavy silhouettes. */
function paintDust(cx, w, h, intensity) {
  var mt = MAP_THEMES[0];
  var col = intensity >= 1 ? mt.dustColorBold : mt.dustColor;
  var aBase = intensity >= 1 ? 0.18 : 0.10;
  cx.save();
  cx.globalAlpha = aBase;
  /* Soft sand-tone blobs for atmospheric warmth */
  var spots = [
    [w * 0.15, TOP + 40, 120, 80], [w * 0.75, TOP + 100, 140, 90],
    [w * 0.4, TOP + 180, 160, 70], [w * 0.85, TOP + 220, 110, 60],
    [w * 0.1, 340, 130, 75], [w * 0.6, 420, 150, 85], [w * 0.3, 500, 120, 65],
  ];
  for (var i = 0; i < spots.length; i++) {
    var s = spots[i];
    cx.beginPath(); cx.ellipse(s[0], s[1], s[2], s[3], 0, 0, 7);
    cx.fillStyle = col; cx.fill();
  }
  /* Fine sand speckles */
  cx.globalAlpha = aBase * 0.5; cx.fillStyle = col;
  for (var d = 0; d < 40; d++) {
    var sx = Math.random() * w; var sy = TOP + Math.random() * (h - TOP);
    var sr = 0.5 + Math.random() * 1.5;
    cx.beginPath(); cx.arc(sx, sy, sr, 0, 7); cx.fill();
  }
  cx.restore();
  /* Subtle horizon line */
  cx.save(); cx.globalAlpha = intensity >= 1 ? 0.12 : 0.07;
  cx.strokeStyle = col; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(0, TOP + 8); cx.lineTo(w, TOP + 12); cx.stroke();
  cx.restore();
}

/* --- Motif: 赤壁 River (water / mist layers) --- */
function paintRiver(cx, w, h, intensity) {
  var mt = MAP_THEMES[1];
  var col = intensity >= 1 ? mt.riverColorBold : mt.riverColor;
  var aBase = intensity >= 1 ? 0.15 : 0.08;
  cx.save(); cx.globalAlpha = aBase;
  /* Horizontal wave bands suggesting water/mist */
  var bands = [
    { y: TOP + 30, h: 20, a: 1.0 }, { y: TOP + 90, h: 28, a: 0.7 },
    { y: TOP + 170, h: 22, a: 0.85 }, { y: 340, h: 25, a: 0.75 },
    { y: 430, h: 18, a: 0.6 }, { y: 510, h: 20, a: 0.5 },
  ];
  for (var i = 0; i < bands.length; i++) {
    var b = bands[i]; cx.globalAlpha = aBase * b.a;
    cx.fillStyle = col; cx.fillRect(0, b.y, w, b.h);
  }
  /* Mist wisps */
  cx.globalAlpha = aBase * 0.6;
  var mists = [
    [w * 0.2, TOP + 55, 90, 35], [w * 0.7, TOP + 145, 110, 40],
    [w * 0.35, 360, 100, 30], [w * 0.8, 450, 80, 28],
  ];
  for (var j = 0; j < mists.length; j++) {
    var m = mists[j];
    cx.beginPath(); cx.ellipse(m[0], m[1], m[2], m[3], 0, 0, 7); cx.fill();
  }
  cx.restore();
}

/* --- Motif: 街亭 Pass (mountain road + flags) --- */
function paintPass(cx, w, h, intensity) {
  var mt = MAP_THEMES[2];
  var col = intensity >= 1 ? mt.passColorBold : mt.passColor;
  var aBase = intensity >= 1 ? 0.14 : 0.08;
  cx.save(); cx.globalAlpha = aBase;
  /* Distant mountain silhouettes */
  var peaks = [
    { x: w * 0.1, h: 28, base: 18 }, { x: w * 0.35, h: 38, base: 24 },
    { x: w * 0.65, h: 32, base: 20 }, { x: w * 0.88, h: 24, base: 16 },
  ];
  cx.fillStyle = col;
  for (var i = 0; i < peaks.length; i++) {
    var p = peaks[i];
    cx.beginPath(); cx.moveTo(p.x - p.base, TOP + 6);
    cx.lineTo(p.x, TOP + 6 - p.h); cx.lineTo(p.x + p.base, TOP + 6); cx.closePath(); cx.fill();
  }
  /* Road-side marker flags */
  cx.globalAlpha = aBase * 1.2;
  var flagCol = intensity >= 1 ? '#bf3b2d' : '#c94a3a';
  _drawMiniFlag(cx, 12, TOP + 70, flagCol); _drawMiniFlag(cx, 8, 200, flagCol);
  _drawMiniFlag(cx, 14, 360, flagCol); _drawMiniFlag(cx, 10, 480, flagCol);
  _drawMiniFlag(cx, w - 16, TOP + 50, flagCol); _drawMiniFlag(cx, w - 12, 190, flagCol);
  _drawMiniFlag(cx, w - 14, 350, flagCol); _drawMiniFlag(cx, w - 10, 490, flagCol);
  cx.restore();
}

function _drawMiniFlag(cx, x, y, col) {
  cx.strokeStyle = col; cx.lineWidth = 1.2;
  cx.beginPath(); cx.moveTo(x, y - 12); cx.lineTo(x, y + 8); cx.stroke();
  cx.fillStyle = col;
  cx.beginPath(); cx.moveTo(x, y - 12); cx.lineTo(x + 8, y - 7); cx.lineTo(x, y - 2); cx.closePath(); cx.fill();
}

/* --- Motif: 函谷关 Cliff (narrow canyon walls + strata) --- */
function paintCliff(cx, w, h, intensity) {
  var mt = MAP_THEMES[3];
  var col = intensity >= 1 ? mt.cliffColorBold : mt.cliffColor;
  var aBase = intensity >= 1 ? 0.16 : 0.09;
  cx.save();
  /* Left canyon wall */
  cx.globalAlpha = aBase;
  var lg = cx.createLinearGradient(0, 0, 40, 0);
  lg.addColorStop(0, col); lg.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = lg; cx.fillRect(0, TOP, 40, h - TOP);
  /* Right canyon wall */
  var rg = cx.createLinearGradient(w - 40, 0, w, 0);
  rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, col);
  cx.fillStyle = rg; cx.fillRect(w - 40, TOP, 40, h - TOP);
  /* Rock strata lines */
  cx.globalAlpha = aBase * 0.6; cx.strokeStyle = col; cx.lineWidth = 1;
  var strataY = [TOP + 45, TOP + 110, 180, 260, 340, 420, 500, 570];
  for (var i = 0; i < strataY.length; i++) {
    cx.beginPath(); cx.moveTo(0, strataY[i]);
    cx.quadraticCurveTo(w * 0.33, strataY[i] + (i % 2 ? 2 : -2), w * 0.66, strataY[i] + (i % 2 ? -1 : 1));
    cx.lineTo(w, strataY[i] + (i % 3 ? 1 : 0)); cx.stroke();
  }
  /* Rocky texture spots */
  cx.globalAlpha = aBase * 0.4; cx.fillStyle = col;
  var rocks = [
    [25, TOP + 60, 8, 5], [w - 30, TOP + 90, 10, 6],
    [20, 250, 7, 4], [w - 28, 300, 9, 5],
    [22, 430, 8, 5], [w - 25, 500, 11, 7],
  ];
  for (var r = 0; r < rocks.length; r++) {
    var rk = rocks[r];
    cx.beginPath(); cx.ellipse(rk[0], rk[1], rk[2], rk[3], 0, 0, 7); cx.fill();
  }
  cx.restore();
}

/* Decorative map accents (reserved for future overlays) */
function drawMapAccent(mapIdx, cx, w, h, intensity) {
  /* Motifs are painted inline by paintMapBg; this hook exists for optional post-process ornaments. */
}


/* ========== Unit helpers (unchanged signatures) ========== */

function unitGlyph(u) {
  return u.t === 'troop' ? u.type : u.t === 'char' || u.t === 'ifrag' ? u.ch : u.t === 'shovel' ? '铲' : u.name;
}
function unitCol(u) {
  if (u.t === 'troop') return TIER_COL[u.tier - 1];
  if (u.t === 'char') return '#9c36b5';
  if (u.t === 'ifrag') return '#1c7ed6';
  if (u.t === 'shovel') return '#846358';
  /* P2-1 皮肤系统：武将颜色由当前皮肤决定 */
  if (u.t === 'hero' && typeof currentSkin === 'function') {
    const sk = currentSkin(u.name);
    if (sk && sk.col) return sk.col;
  }
  return HEROES[u.name].grade === 4 ? '#b0801f' : '#9c36b5';
}

/* 棋子底衬：圆/盾/菱/方按类型区分；色弱模式加高对比描边。
   浓墨模式(=limited-skin)额外添加柔和光晕角标。 */
function drawBase(u) {
  const hero = u.t === 'hero';
  const g = hero ? (HEROES[u.name].grade === 4 ? '#e8a005' : '#9c36b5') : null;
  ctx.save();
  if (u.t === 'troop') {
    const c = TIER_COL[u.tier - 1];
    ctx.fillStyle = c; ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.stroke();
  } else if (hero) {
    rr(-19, -19, 38, 38, 9); ctx.fillStyle = g; ctx.globalAlpha = 0.20; ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.strokeStyle = g; rr(-19, -19, 38, 38, 9); ctx.stroke();
    /* 浓墨模式：柔和光晕环 */
    if (SAVE.mapSkin === 1) {
      ctx.globalAlpha = 0.12; ctx.strokeStyle = g; ctx.lineWidth = 3;
      rr(-23, -23, 46, 46, 11); ctx.stroke();
      ctx.globalAlpha = 1;
      /* 角标水印 */
      ctx.fillStyle = g; ctx.globalAlpha = 0.25;
      ctx.font = '8px "PingFang SC","Microsoft YaHei",sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('★', 17, 17); ctx.globalAlpha = 1;
    }
  } else if (u.t === 'char') {
    rr(-16, -16, 32, 32, 7); ctx.fillStyle = '#9c36b5'; ctx.globalAlpha = 0.18; ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = '#9c36b5'; rr(-16, -16, 32, 32, 7); ctx.stroke();
  } else if (u.t === 'ifrag') {
    ctx.fillStyle = '#1c7ed6'; ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(17, 0); ctx.lineTo(0, 17); ctx.lineTo(-17, 0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = '#1c7ed6';
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(17, 0); ctx.lineTo(0, 17); ctx.lineTo(-17, 0); ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
  if (SAVE.colorblind) {
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = '#222';
    if (hero) rr(-19, -19, 38, 38, 9);
    else if (u.t === 'char') rr(-16, -16, 32, 32, 7);
    else if (u.t === 'ifrag') { ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(17, 0); ctx.lineTo(0, 17); ctx.lineTo(-17, 0); ctx.closePath(); }
    else { ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); }
    ctx.stroke(); ctx.restore();
  }
}

function drawUnitAt(u, x, y, S) {
  const pop = u.animT > 0 ? 1 + u.animT * 0.6 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
  drawBase(u);
  const col = unitCol(u);
  if (u.t === 'hero') {
    txt(u.name, 0, 4, 14 + u.lvl, col, 'center', true);
    txt('Lv' + u.lvl + (u.weapon ? '·' + WEAPONS[u.weapon].name[0] : ''), 0, 17, 8, col, 'center');
    if (HEROES[u.name].skill) {
      var cdMax = (typeof skillCd === 'function') ? skillCd(u) : HEROES[u.name].skill.cd;
      var cdRatio = 1 - Math.min(1, Math.max(0, (u.cd || 0) / cdMax));
      ctx.strokeStyle = cdRatio >= 1 ? '#2f9e44' : '#5f3dc4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -5, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdRatio); ctx.stroke();
    }
    if (u.awaken > 0) {
      for (let k = 0; k < u.awaken; k++) { ctx.fillStyle = '#e8590c'; ctx.beginPath(); ctx.arc(-8 + k * 8, 20, 2.4, 0, 7); ctx.fill(); }
    }
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
    if (S && S.side > 0) {
      var paired = null;
      for (var i = 0; i < HERO_LIST.length && !paired; i++) {
        var n = HERO_LIST[i]; if (n[0] === u.ch) paired = n[1]; else if (n[1] === u.ch) paired = n[0];
      }
      if (paired) txt('配:' + paired, 0, 30, 8, '#b78324', 'center');
    }
  } else if (u.t === 'ifrag') {
    txt(u.ch, 0, 7, 22, u.wish ? '#ffd700' : col, 'center', true);
    txt(ITEMS[IFRAGS[u.ch].item].name + ' ' + u.n + '/' + IFRAGS[u.ch].need, 0, 18, 7, '#adb5bd', 'center');
    if (u.wish) txt('★', 14, -10, 12, '#ffd700', 'center');
  } else txt('铲', 0, 7, 20, col, 'center', true);
  ctx.restore();
  /* buff 标识（Phase 3 #39） */
  if (S && S.side > 0) {
    let _bx = x - 20;
    if (u.rateMul > 1) { txt('⚡', _bx, y - 22, 11, '#f59f00', 'center', true); _bx += 12; }
    if (u.buffN > 0) { txt('⚔', _bx, y - 22, 11, '#e8590c', 'center', true); _bx += 12; }
    if (SAVE.manualUlt && u.t === 'hero' && HEROES[u.name].skill && u.cd <= 0) {
      const _pr = 22 + Math.sin((G ? G.time : 0) * 6) * 2;
      ctx.strokeStyle = 'rgba(232,160,5,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 5, _pr, 0, 7); ctx.stroke();
    }
  }
  if (S && (u.t === 'troop' || u.t === 'hero')) {
    const st = unitStats(u, S);
    if (u.hp < st.maxhp) hpBar(x - 18, y + 21, 36, u.hp / st.maxhp, '#2f9e44');
    if (u.animT > 0) { ctx.strokeStyle = 'rgba(255,107,107,.7)'; ctx.lineWidth = 2; ctx.strokeRect(x - 22, y - 14, 44, 30); }
  }
  if (u.stun > 0) txt('✦', x + 16, y - 14, 10, '#5f3dc4', 'center');
}

/* ========== Celadon cell rendering (瓷面格) ==========
   Gradient fill + top highlight + ink border + bottom-right shadow.
   Barren cells get dashed outline + gravel dots. */
function drawCell(c, S, hide) {
  const x = c.x - CELL / 2, y = c.y - CELL / 2;
  rr(x, y, CELL, CELL, 6);

  /* Resolve per-map cell style from MAP_THEMES */
  var mi = (G && G.mapIdx !== undefined) ? G.mapIdx : 0;
  var mt = MAP_THEMES[mi] || MAP_THEMES[0];
  var bold = SAVE.mapSkin === 1;
  var cFill = bold ? mt.cellFillBold : mt.cellFill;
  var cBord = bold ? mt.cellBorderBold : mt.cellBorder;

  if (!c.open) {
    /* 荒地：低饱和底色 + 虚线描边 + 「荒」字 + 碎石点 */
    var bf = bold ? shade(mt.barrenFill, 0.94) : mt.barrenFill;
    var bb = bold ? shade(mt.barrenBorder, 0.88) : mt.barrenBorder;
    /* Gradient fill */
    var bg = ctx.createLinearGradient(x, y, x, y + CELL);
    bg.addColorStop(0, bf); bg.addColorStop(1, shade(bf, 0.92));
    ctx.fillStyle = bg; ctx.fill();
    /* Dashed outline */
    ctx.setLineDash([3, 3]); ctx.strokeStyle = bb; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    txt('荒', c.x, c.y - 1, 10, shade(bb, 0.75), 'center');
    if (S && S.side > 0) txt('馒' + cellCost(S), c.x, c.y + 13, 8, shade(bb, 0.65), 'center');
    /* Gravel dots */
    ctx.fillStyle = shade(bb, 0.5); ctx.globalAlpha = 0.35;
    var gx = [x + 8, x + CELL - 10, x + CELL/2], gy = [y + CELL - 8, y + CELL - 6, y + CELL - 10];
    for (let gi = 0; gi < 3; gi++) { ctx.beginPath(); ctx.arc(gx[gi], gy[gi], 1.2, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    return;
  }

  /* Open cell: celadon gradient fill */
  var cg = ctx.createLinearGradient(x, y, x, y + CELL);
  cg.addColorStop(0, cFill); cg.addColorStop(1, shade(cFill, 0.94));
  ctx.fillStyle = cg; ctx.fill();

  /* Top highlight strip (瓷面高光) */
  ctx.save();
  var hl = ctx.createLinearGradient(x, y, x, y + CELL * 0.45);
  hl.addColorStop(0, 'rgba(255,255,255,.28)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  rr(x + 1, y + 1, CELL - 2, (CELL - 2) * 0.45, 5);
  ctx.fillStyle = hl; ctx.fill();
  ctx.restore();

  /* Ink border */
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = !c.unit ? cBord : unitCol(c.unit);
  ctx.stroke();

  /* Bottom-right inner shadow */
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.07)'; ctx.shadowBlur = 3; ctx.shadowOffsetX = 1.5; ctx.shadowOffsetY = 1.5;
  rr(x + 2, y + 2, CELL - 4, CELL - 4, 4);
  ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.restore();

  if (c.unit && !hide) drawUnitAt(c.unit, c.x, c.y, S);
  if (S && S.side > 0 && G && G.targeting && typeof canTargetItem === 'function' && canTargetItem(G.targeting, c.unit)) {
    ctx.strokeStyle = '#e8a005'; ctx.lineWidth = 3; ctx.setLineDash([3, 2]);
    ctx.strokeRect(x - 2, y - 2, CELL + 4, CELL + 4); ctx.setLineDash([]);
  }
}

function drawBarSlot(s, hide) {
  const x = s.x - CELL / 2, y = s.y - CELL / 2;
  rr(x, y, CELL, CELL, 6);
  var mi = (G && G.mapIdx !== undefined) ? G.mapIdx : 0;
  var mt = MAP_THEMES[mi] || MAP_THEMES[0];
  var bold = SAVE.mapSkin === 1;
  var cFill = bold ? mt.cellFillBold : mt.cellFill;
  var cBord = bold ? mt.cellBorderBold : mt.cellBorder;
  var cg = ctx.createLinearGradient(x, y, x, y + CELL);
  cg.addColorStop(0, cFill); cg.addColorStop(1, shade(cFill, 0.94));
  ctx.fillStyle = cg; ctx.fill();
  ctx.save();
  var hl = ctx.createLinearGradient(x, y, x, y + CELL * 0.45);
  hl.addColorStop(0, 'rgba(255,255,255,.28)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  rr(x + 1, y + 1, CELL - 2, (CELL - 2) * 0.45, 5); ctx.fillStyle = hl; ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = s.unit ? unitCol(s.unit) : cBord;
  if (s.unit && noDeploy(s.unit)) ctx.setLineDash([3, 3]);
  ctx.stroke(); ctx.setLineDash([]);
  if (s.unit && !hide) drawUnitAt(s.unit, s.x, s.y, null);
  if (G && G.targeting && typeof canTargetItem === 'function' && canTargetItem(G.targeting, s.unit)) {
    ctx.strokeStyle = '#e8a005'; ctx.lineWidth = 3; ctx.setLineDash([3, 2]);
    ctx.strokeRect(x - 2, y - 2, CELL + 4, CELL + 4); ctx.setLineDash([]);
  }
}

/* ========== Path: double-line fix (bug #1) ==========
   Outer 5px faction/map color + inner 3px lighter + 1px center dashed.
   Replaces old ugly 18px solid line. */
function drawPath(S) {
  if (!S || !S.path || !S.path.length) return;
  var mi = (G && G.mapIdx !== undefined) ? G.mapIdx : 0;
  var mt = MAP_THEMES[mi] || MAP_THEMES[0];
  var bold = SAVE.mapSkin === 1;
  var outerCol = bold ? mt.pathColBold : mt.pathCol;
  var innerCol = bold ? mt.pathInnerBold : mt.pathInner;

  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  /* Outer line: 5px map-themed color */
  ctx.strokeStyle = outerCol; ctx.lineWidth = 5;
  ctx.beginPath();
  S.path.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.stroke();

  /* Inner line: 3px lighter tone */
  ctx.strokeStyle = innerCol; ctx.lineWidth = 3;
  ctx.beginPath();
  S.path.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.stroke();

  /* Center dash: 1px cream/white dashed */
  ctx.strokeStyle = 'rgba(255,252,245,.55)'; ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  S.path.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.stroke();
  ctx.setLineDash([]);
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

/* ========== Adou plaque (bug fix: faction plaque + seal + label) ========== */
function drawAdou(S) {
  const mine = S.side > 0;
  const y = mine ? S.adou.y - (G && (G.mapIdx === 3 || G.mapIdx === 2) ? 42 : 38) : S.adou.y;

  /* Faction-colored rounded plaque background */
  var plaqueCol = mine ? '#2f9e44' : '#e03131';
  var textCol = mine ? '#343a40' : '#c0392b';
  var labelCol = mine ? '#2f9e44' : '#e03131';

  ctx.save();
  /* Plaque body: rounded capsule behind 阿斗 */
  var pw = 58, ph = 28, pr = 14;
  rr(S.adou.x - pw / 2, y - 6, pw, ph, pr);
  ctx.fillStyle = mine ? 'rgba(47,158,68,.10)' : 'rgba(224,49,49,.10)';
  ctx.fill();
  ctx.strokeStyle = plaqueCol; ctx.lineWidth = 1.5; ctx.stroke();

  /* Seal stamp on left side of plaque */
  seal(S.adou.x - 18, y + 8, 7, mine ? '友' : '敌', plaqueCol);

  /* 「我方/敌军」label above plaque */
  txt(mine ? '我方' : '敌军', S.adou.x, y - 6, 9, labelCol, 'center', true);

  /* 阿斗 name + HP inside plaque */
  txt('阿斗', S.adou.x + 2, y + 7, 18, textCol, 'center', true);
  txt('♥' + Math.max(0, S.hp), S.adou.x + 34, y + 5, 12, '#e03131', 'left', true);
  ctx.restore();

  if (S.hp < ADOU_HP) hpBar(S.adou.x - 18, y + 14, 36, Math.max(0, S.hp) / ADOU_HP, '#e03131');

  /* Shield icons */
  for (let i = 0; i < (S.shield || 0); i++) {
    const sx = S.adou.x - 18 + i * 14;
    ctx.fillStyle = '#1c7ed6';
    ctx.beginPath();
    ctx.moveTo(sx, y + 19); ctx.lineTo(sx + 9, y + 19); ctx.lineTo(sx + 9, y + 26);
    ctx.lineTo(sx + 4.5, y + 30); ctx.lineTo(sx, y + 26); ctx.closePath();
    ctx.fill();
  }
}


/* ========== Main game renderer (drawGame) ==========
   Key upgrades over baseline:
   - Background from cached getMapBg() instead of flat fills
   - 备战 banner → 朱砂/墨色 capsule (bug fix #3, was blue)
   - 羁绊 banners → central safe zone at y=288 as 朱砂 capsule #bf3b2d (bug fix #2)
   - All other rendering preserved. */
function drawGame() {
  var sh = G.shake || 0;
  ctx.save();
  if (sh > 0) ctx.translate((Math.random() * 2 - 1) * sh, (Math.random() * 2 - 1) * sh);

  /* ---- Cached map background (replaces old skins array) ---- */
  var intensity = SAVE.mapSkin || 0;
  var mapCanvas = getMapBg(G.mapIdx, intensity);
  ctx.drawImage(mapCanvas, 0, 0);

  /* ---- Path (double-line, bug #1 fixed) ---- */
  drawPath(G.E); drawPath(G.P);

  /* ---- Adou plaques ---- */
  drawAdou(G.E);
  G.E.cells.forEach(c => drawCell(c, G.E, false));
  G.P.cells.forEach((c, i) => {
    drawCell(c, G.P, drag && drag.area === 'board' && drag.from === i);
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

  /* Player Adou (over cards) */
  drawAdou(G.P);

  /* Hero respawn status */
  if (G.heroRespawns && G.heroRespawns.length) {
    const r = G.heroRespawns[0];
    panel(10, 504, 118, 20, { bg: 'rgba(255,253,249,.92)', stroke: '#d9c8ec', r: 6, blur: 1, offsetY: 0 });
    txt(r.name + '整备 ' + Math.ceil(Math.max(0, r.t)) + '秒', 18, 518, 10, '#7250b8', 'left', true);
  }

  /* Snakes */
  for (const sn of G.P.snakes) { txt('蛇', sn.x, sn.y + 5, 15, '#2f9e44', 'center', true); hpBar(sn.x - 12, sn.y + 12, 24, sn.hp / 150, '#2f9e44'); }
  for (const sn of G.E.snakes) txt('蛇', sn.x, sn.y + 5, 15, '#2f9e44', 'center', true);

  /* Mobs */
  for (const m of G.E.mobs) drawMob(m);
  for (const m of G.P.mobs) drawMob(m);

  /* Egg */
  if (G.egg) {
    const f = 0.7 + Math.sin(G.time * 5) * 0.3;
    ctx.globalAlpha = f;
    txt(G.egg.ch, G.egg.x, G.egg.y + 6, 20, '#e8a005', 'center', true);
    ctx.globalAlpha = 1;
  }

  /* ---- Orders + Fate unified into 朱砂/墨色 divider band (bug fixes #2 & #3) ---- */
  var hasOrders = G.orders && G.orders.length;
  var hasFate = G.P.fate.list && G.P.fate.list.length;
  if (hasOrders || hasFate) {
    var bandY = 288; /* Central safe divider band */
    var bandH = 24;
    var bandW = W - 20;
    var bandX = 10;

    /* 朱砂 capsule background (#bf3b2d) */
    ctx.save();
    rr(bandX, bandY, bandW, bandH, 12);
    var bandGrad = ctx.createLinearGradient(bandX, bandY, bandX, bandY + bandH);
    bandGrad.addColorStop(0, '#bf3b2d'); bandGrad.addColorStop(1, '#a33225');
    ctx.fillStyle = bandGrad; ctx.fill();
    ctx.strokeStyle = 'rgba(180,50,35,.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

    /* Content layout within capsule */
    var curX = bandX + 10;
    if (hasOrders) {
      const brief = G.orders.map(o => (o.done ? '✓' : '') + o.name + ' ' + o.value + '/' + o.need).join(' · ');
      txt(brief, curX, bandY + bandH / 2 + 4, 9, 'rgba(255,245,240,.92)', 'left', true);
      curX += ctx.measureText ? ctx.measureText(brief).width + 12 : 160;
    }
    if (hasFate) {
      /* Separator dot if both present */
      if (hasOrders) { txt(' · ', curX, bandY + bandH / 2 + 4, 9, 'rgba(255,200,190,.6)', 'left', true); curX += 14; }
      txt('羁绊：' + G.P.fate.list.join('·'), curX, bandY + bandH / 2 + 4, 9, 'rgba(255,235,225,.92)', 'left', true);
    }
  }

  /* Effects */
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

  /* Particles */
  for (const p of G.parts) {
    ctx.globalAlpha = clamp(p.t / 0.7, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    p.x += p.vx * DT60; p.y += p.vy * DT60; p.vy += 200 * DT60; p.t -= DT60;
  }
  ctx.globalAlpha = 1;
  G.parts = G.parts.filter(p => p.t > 0);

  /* Float texts */
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.t / 0.8, 0, 1);
    txt(f.txt, f.x, f.y, 10, f.col, 'center', true);
    f.y -= 26 * DT60; f.t -= DT60;
  }
  ctx.globalAlpha = 1;
  G.floats = G.floats.filter(f => f.t > 0);

  /* ---- Top bar (not affected by screen shake) ---- */
  if (G.shake > 0) G.shake = Math.max(0, G.shake - 0.6);
  ctx.restore();

  ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = '#e4d9c8'; ctx.fillRect(0, TOP - 3, W, 3);

  /* Resource chips */
  resChip('馒 ' + G.P.mantou, 6, 7, '#8b5e3c');
  resChip('金 ' + SAVE.gold, 76, 7, '#b0801f');

  /* Stage/wave info */
  txt((G.mode ? G.modeLabel : (G.endless ? '无尽' : '第' + G.stage + '关')) + '·第' + G.wave + '波' + (SAVE.invincible ? ' ·无敌' : ''), 232, 20, 12, '#495057', 'right', true);

  /* Next wave preview */
  if (G.previewQ && G.previewQ.pool && G.previewQ.pool.length) {
    const p = G.previewQ;
    const parts = p.pool.map(x => x[0] + '×' + Math.round(p.per * x[1] / 100)).filter(s => !s.endsWith('×0'));
    let s = '下波 ▸ ' + parts.join(' ') + (p.boss ? '  ☠BOSS' : '');
    txt(s, 8, 44, 10, '#8a7e6c', 'left');
  }

  /* Mode status bars */
  if (G.mode === 'fire') {
    txt('🔥 ' + G.wind + ' · 守城 ' + Math.ceil(Math.max(0, G.modeTime)) + ' 秒', W / 2, 48, 11, '#bd4a31', 'center', true);
    drawBuildings();
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

  /* Right-side control buttons */
  btn(240, 4, 32, 24, '×' + G.speed, () => { G.speed = G.speed >= 4 ? 1 : G.speed + 1; }, { bg: '#495057', size: 11 });
  btn(273, 4, 32, 24, G.paused ? '▶' : 'Ⅱ', () => { G.paused = !G.paused; }, { bg: '#495057', size: 11 });
  btn(306, 4, 32, 24, SAVE.mute ? '🔇' : '🔊', () => { SAVE.mute = !SAVE.mute; saveSave(); sfx('click'); if (typeof stopBgm === 'function') stopBgm(); },
    { bg: SAVE.mute ? '#e03131' : '#2f9e44', size: 12 });
  btn(339, 4, 32, 24, '菜单', () => { scr = 'menu'; }, { bg: '#868e96', size: 9 });

  /* Temp bag */
  if (G.P.tempBag && G.P.tempBag.length > 0) {
    btn(256, UI_LAYOUT.actionBar.y, 28, UI_LAYOUT.actionBar.h, '包' + G.P.tempBag.length, () => { G.tempOpen = !G.tempOpen; }, { size: 8, bg: '#7250b8' });
    if (G.tempOpen) {
      const dl = UI_LAYOUT.tempDrawer;
      panel(dl.x, dl.y, dl.w, dl.h, { bg: '#fffdf9', stroke: '#cfc4af', r: 9, blur: 5 });
      txt('临时背包 · 点卡牌放回合成栏', dl.x + 10, dl.y + 15, 10, '#6f6556', 'left', true);
      const bx = [dl.x + 8, dl.x + 60, dl.x + 112], by = dl.y + 22, bs = 38;
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
      btn(dl.x + 166, dl.y + 24, 46, 28, '折现', () => { const n = G.P.tempBag.length; G.P.tempBag = []; G.P.mantou += n * 2; G.tempOpen = false; fl(120, 505, '背包折现 +' + n * 2, '#8b5e3c'); }, { size: 10, bg: '#8e98a3' });
      btn(dl.x + 218, dl.y + 24, 42, 28, '收起', () => { G.tempOpen = false; }, { size: 9, bg: '#7c8792' });
    }
  } else G.tempOpen = false;

  /* Action bar */
  const ay = UI_LAYOUT.actionBar.y, ah = UI_LAYOUT.actionBar.h;

  /* Manual ultimate */
  if (SAVE.manualUlt) {
    let _ready = 0;
    for (const _c of G.P.cells) if (_c.unit && _c.unit.t === 'hero' && HEROES[_c.unit.name].skill && _c.unit.cd <= 0) _ready++;
    btn(196, ay, 54, ah, '大招×' + _ready, () => manualUlt(G.P), { size: 10, bg: '#e8a005', disabled: !_ready });
  }
  btn(254, ay, 32, ah, '撤销', () => undoAction(),
    { size: 9, bg: '#8e98a3', disabled: G.ghostMode || !G.undoStack || !G.undoStack.length });
  btn(8, ay, 62, ah, '抽卡 馒' + DRAW.cost, () => doSummon(G.P),
    { size: 11, bg: '#c0392b', disabled: G.P.mantou < DRAW.cost || barFree(G.P) < 0 });
  const tenCostNow = SAVE.firstTen ? (DRAW.tenCost / 2 | 0) : DRAW.tenCost;
  btn(74, ay, 62, ah, '十连 ' + tenCostNow, () => drawTen(G.P),
    { size: 11, bg: '#a61e4e', disabled: G.P.mantou < tenCostNow || barFree(G.P) < 0 });

  /* Active items */
  const acts = Object.keys(ITEMS).filter(id => ITEMS[id].act && (G.itemUses[id] || SAVE.loadout.includes(id)));
  acts.slice(0, 2).forEach((id, i) => {
    const n = G.itemUses[id] || 0;
    btn(140 + i * 58, ay, 54, ah, ITEMS[id].name + '×' + n, () => useActive(id),
      { size: 9, bg: G.targeting === id ? '#e8a005' : '#5f3dc4', disabled: !n });
  });

  /* Recycle slot */
  const rc = RECYCLE;
  rr(rc.x, rc.y, rc.w, rc.h, 6);
  ctx.fillStyle = '#e9ecef'; ctx.fill();
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#868e96'; ctx.stroke(); ctx.setLineDash([]);
  txt('回收♻', rc.x + rc.w / 2, rc.y + rc.h / 2 + 4, 11, '#868e96', 'center', true);
  txt('拖单位回收', rc.x + rc.w / 2, rc.y + rc.h - 3, 8, '#adb5bd', 'center');

  /* Targeting context */
  if (G.targeting) {
    const label = ITEMS[G.targeting] ? ITEMS[G.targeting].name : '道具';
    txt(label + '：点金色虚线目标', W / 2, 282, 10, '#b78324', 'center', true);
    btn(86, 292, 96, 22, '自动施放', () => autoTargetActive(), { size: 10, bg: '#e8a005' });
    btn(194, 292, 96, 22, '取消', () => { G.targeting = null; }, { size: 10, bg: '#868e96' });
  }

  /* Drag follow */
  if (drag) {
    const u = (drag.area === 'bar' ? G.P.bar : G.P.cells)[drag.from].unit;
    if (u) {
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

  /* Banner / flash / summon FX / card reveal */
  if (G.banner) {
    ctx.globalAlpha = clamp(G.banner.t, 0, 1);
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
  if (G.cardReveal && G.cardReveal.t > 0) {
    const cr = G.cardReveal, prog = 1 - cr.t / 1.1, n = cr.list.length;
    const cw = 30, gap = 4, total = n * cw + (n - 1) * gap, x0 = (W - total) / 2, y = 235;
    ctx.globalAlpha = clamp(cr.t * 1.5, 0, 1);
    panel(x0 - 12, y - 28, total + 24, 88, { bg: '#fffdf9', stroke: '#e6c98b', r: 12, blur: 4 });
    txt('十连!', W / 2, y - 8, 15, '#a61e4e', 'center', true);
    cr.list.forEach((g, i) => {
      if (prog < i / n) return;
      const x = x0 + i * (cw + gap);
      rr(x, y, cw, cw, 5); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#ced4da'; ctx.lineWidth = 1; ctx.stroke();
      txt(g, x + cw / 2, y + cw / 2 + 7, 15, '#495057', 'center', true);
    });
    txt('保底武将 · ' + cr.hero, W / 2, y + cw + 16, 11, '#e8a005', 'center');
    ctx.globalAlpha = 1;
    cr.t -= DT60; if (cr.t <= 0) G.cardReveal = null;
  }

  /* Overlay states: win / lose / paused / rogue choices / chapter */
  if (G.rogueChoices) {
    ctx.fillStyle = 'rgba(26,24,35,.72)'; ctx.fillRect(0, 0, W, H);
    panel(24, 210, 327, 190, { bg: '#fffdf9', stroke: '#dacdf0', r: 14 });
    txt('选择一条军略', W / 2, 244, 21, '#503b83', 'center', true);
    txt(G.rogue ? '本局生效 · 选择后继续远征' : '本局遗物 · 选择后继续作战', W / 2, 264, 10, '#8f8a9c', 'center');
    G.rogueChoices.forEach((c, i) => {
      const cy = 279 + i * 35;
      btn(42, cy, 291, 29, c.n + ' · ' + c.d, () => chooseRogue(i), { size: 11, bg: '#7250b8' });
    });
  }
  if (G.chapterFire) {
    for (const f of G.chapterFire) { ctx.globalAlpha=.22; ctx.fillStyle='#e8590c'; ctx.beginPath(); ctx.arc(f.x,f.y,26,0,7); ctx.fill(); ctx.globalAlpha=1; txt('🔥',f.x,f.y+6,16,'#e8590c','center'); }
    txt('赤壁·'+G.wind, W/2, 48, 10, '#bd4a31', 'center', true);
  }
  if (G.chapterChoice) {
    ctx.fillStyle='rgba(32,28,20,.55)'; ctx.fillRect(0,0,W,H);
    panel(30,250,315,145,{bg:'#fffdf9',stroke:'#e5c98b',r:14});
    txt('流民求援',W/2,282,22,'#b78324','center',true);
    txt('救援换取金币与护盾，或固守获得即时馒头',W/2,306,11,'#656d76','center');
    btn(48,330,130,38,'救援 · -10馒',()=>chooseRefugee(true),{size:12,bg:'#318c4a'});
    btn(197,330,130,38,'固守 · +15馒',()=>chooseRefugee(false),{size:12,bg:'#7250b8'});
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
