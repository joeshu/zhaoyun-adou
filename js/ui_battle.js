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

/* ========== 战场环境氛围动效（#8，可选） ==========
   每地图主题一套轻量氛围粒子：≤20 颗、按时间驱动、绘制于棋盘之下（drawGame 早期），
   复用既有 MAP_THEMES 配色；数组预分配、逐帧只做位移与 alpha，避免每帧 heavy 分配（保 iOS 侧载性能）。 */
var _amb = null, _ambMap = -1, _ambT = 0;
function ensureAmbient(mapIdx) {
  if (_amb && _ambMap === mapIdx) return;
  _ambMap = mapIdx; _amb = [];
  var mt = MAP_THEMES[mapIdx] || MAP_THEMES[0];
  var n = 16;                                       // ≤20，严格限制
  for (var i = 0; i < n; i++) {
    _amb.push({
      x: Math.random() * W, y: TOP + Math.random() * (H - TOP),
      r: 1 + Math.random() * 2,
      spd: 6 + Math.random() * 16,
      ph: Math.random() * Math.PI * 2,
      ax: 3 + Math.random() * 7,
      col: mt.accent,
      mode: mapIdx,                                 // 0 落沙 / 1 水影 / 2 浮岚 / 3 微光
    });
  }
}
function drawAmbient(mapIdx) {
  ensureAmbient(mapIdx);
  _ambT += DT60;
  ctx.save();
  for (var i = 0; i < _amb.length; i++) {
    var a = _amb[i];
    if (a.mode === 0) {                              // 长坂坡：黄沙缓缓下落
      a.y += a.spd * DT60; a.x += Math.sin(_ambT + a.ph) * a.ax * DT60;
      if (a.y > H + 4) { a.y = TOP - 4; a.x = Math.random() * W; }
    } else if (a.mode === 1) {                       // 赤壁：江风水影横向微漾
      a.x += Math.sin(_ambT * 0.8 + a.ph) * a.ax * DT60 * 1.4; a.y += 2 * DT60;
      if (a.x > W + 4) a.x = -4; else if (a.x < -4) a.x = W + 4;
      if (a.y > H) a.y = TOP;
    } else if (a.mode === 2) {                       // 街亭：山岚缓慢上浮
      a.y -= a.spd * 0.5 * DT60; a.x += Math.sin(_ambT + a.ph) * a.ax * DT60 * 0.6;
      if (a.y < TOP - 4) { a.y = H + 4; a.x = Math.random() * W; }
    } else {                                         // 函谷关：崖壁微光呼吸（位移极小）
      a.x += Math.sin(_ambT * 0.5 + a.ph) * a.ax * DT60 * 0.3;
    }
    var al = 0.10 + 0.07 * Math.sin(_ambT * 2 + a.ph);
    ctx.globalAlpha = Math.max(0.03, al);
    ctx.fillStyle = a.col;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 7); ctx.fill();
  }
  ctx.restore();
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

  /* 群雄演武地形：隘口(pass)锁定不可部署；高地(high)在普通开放格基础上加射程高亮 */
  if (S && S.side > 0 && G && G.mode === 'puzzle' && c.terrain === 'pass') {
    ctx.fillStyle = 'rgba(80,70,60,.20)'; ctx.fill();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = '#8a7e6c'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    txt('隘', c.x, c.y - 1, 13, '#6f6556', 'center', true);
    txt('锁', c.x, c.y + 13, 8, '#8a7e6c', 'center');
    return;
  }

  /* Resolve per-map cell style from MAP_THEMES */
  var mi = (G && G.mapIdx !== undefined) ? G.mapIdx : 0;
  var mt = MAP_THEMES[mi] || MAP_THEMES[0];
  var bold = SAVE.mapSkin === 1;
  var cFill = bold ? mt.cellFillBold : mt.cellFill;
  var cBord = bold ? mt.cellBorderBold : mt.cellBorder;

  if (!c.open) {
    /* 反向攻城：战场格渲染为中性（无"荒"字、无开荒费），镜像 puzzle pass 分支写法 */
    if (S && S.side > 0 && G && G.mode === 'siege') {
      ctx.fillStyle = 'rgba(70,60,50,.12)'; ctx.fill();
      ctx.setLineDash([3, 3]); ctx.strokeStyle = '#8a7e6c'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      return;
    }
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

  /* No hard ink border — player wants the celadon surface only,
     the rectangular frame on top of each tile is removed (feedback).
     Keep the soft bottom-right shadow for celadon depth. */
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.07)'; ctx.shadowBlur = 3; ctx.shadowOffsetX = 1.5; ctx.shadowOffsetY = 1.5;
  rr(x + 2, y + 2, CELL - 4, CELL - 4, 4);
  ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.restore();

  if (c.unit && !hide) drawUnitAt(c.unit, c.x, c.y, S);
  if (S && S.side > 0 && G && G.mode === 'puzzle' && c.terrain === 'high') {
    ctx.strokeStyle = '#e8a005'; ctx.lineWidth = 2; ctx.setLineDash([4, 2]);
    ctx.strokeRect(x - 3, y - 3, CELL + 6, CELL + 6); ctx.setLineDash([]);
    txt('高', c.x + 17, c.y - 15, 9, '#e8a005', 'center', true);
  }
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

  /* Always celadon fill (empty AND occupied) — player wants all celadon kept.
     No hard ink border frame on top (removed per feedback). */
  var cg = ctx.createLinearGradient(x, y, x, y + CELL);
  cg.addColorStop(0, cFill); cg.addColorStop(1, shade(cFill, 0.94));
  ctx.fillStyle = cg; ctx.fill();
  ctx.save();
  var hl = ctx.createLinearGradient(x, y, x, y + CELL * 0.45);
  hl.addColorStop(0, 'rgba(255,255,255,.28)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  rr(x + 1, y + 1, CELL - 2, (CELL - 2) * 0.45, 5); ctx.fillStyle = hl; ctx.fill();
  ctx.restore();
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
  if (m.rogueLead || m.rogueTroop) { drawRogueMob(m); return; }   // 试炼纵队单位走专属绘制（非 MOBS）
  if (m.siegeAssault) { drawSiegeMob(m); return; }   // 反向攻城：突击队走专属绘制（蓝描边，非 MOBS）
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
  if (m.intercept) { ctx.strokeStyle = '#e03131'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, size * 0.9, 0, 7); ctx.stroke(); }
}

// 试炼纵队单位绘制（hero=蓝 / troop=紫）：圆牌 + 兵种/将名首字 + 血条（绕过 MOBS[m.type]）
function drawRogueMob(m) {
  const size = 18;
  const col = m.flash > 0 ? '#f59f00' : m.rogueLead ? '#1c7ed6' : '#9c36b5';
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(m.x, m.y, size * 0.62, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, size * 0.62, 0, 7); ctx.stroke();
  txt(m.glyph || (m.rogueLead ? '主' : '兵'), m.x, m.y + 5, m.rogueLead ? 14 : 12, col, 'center', true);
  ctx.restore();
  hpBar(m.x - 11, m.y + size * 0.62 + 3, 22, m.hp / m.maxhp, m.rogueLead ? '#1c7ed6' : '#9c36b5');
  if (m.stun > 0) txt('✦', m.x + size * 0.6, m.y - size * 0.5, 10, '#e8a005', 'center');
}

// 反向攻城：突击队绘制（hero=蓝 / troop=蓝），圆牌 + 兵种/将名首字 + 血条（绕过 MOBS[m.type]）；突进/集火激活时底色微亮
function drawSiegeMob(m) {
  const size = 18;
  const col = m.flash > 0 ? '#f59f00' : '#1c7ed6';
  ctx.save();
  if (G.siege && (G.siege.rushT > 0 || G.siege.focusT > 0)) {
    ctx.fillStyle = 'rgba(28,126,214,0.18)';
    ctx.beginPath(); ctx.arc(m.x, m.y, size * 0.8, 0, 7); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(m.x, m.y, size * 0.62, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, size * 0.62, 0, 7); ctx.stroke();
  txt(m.glyph || (m.kind === 'hero' ? '主' : '兵'), m.x, m.y + 5, m.kind === 'hero' ? 15 : 12, col, 'center', true);
  hpBar(m.x - 11, m.y + size * 0.62 + 3, 22, m.hp / m.maxhp, '#1c7ed6');
  if (m.stun > 0) txt('✦', m.x + size * 0.6, m.y - size * 0.5, 10, '#e8a005', 'center');
  ctx.restore();
}

/* ========== Adou plaque (bug fix: faction plaque + seal + label) ========== */
function drawAdou(S) {
  const mine = S.side > 0;
  const y = S.adou.y;
  // 阿斗牌布局：标签在上(h=10)，主体椭圆(30px)，血条在下(h=6)，护盾最后(h=12)
  // 总高约：-12..+38，上下留空区（敌方 y 距顶至少 40，玩家 y 距底至少 44）
  // 长坂独胆：赵云贴附阿斗左侧（护送），随阿斗移动，提供推拒保护光环
  if (G.mode === 'escort' && G.escort && mine) {
    ctx.save();
    const hasZhao = G.P.cells.some(c => c.unit && c.unit.name === '赵云');
    ctx.fillStyle = hasZhao ? 'rgba(28,126,214,0.30)' : 'rgba(28,126,214,0.10)';
    ctx.beginPath(); ctx.arc(S.adou.x - 26, S.adou.y, 16, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1c7ed6'; ctx.lineWidth = hasZhao ? 2.5 : 1; ctx.stroke();
    txt(hasZhao ? '云' : '赵', S.adou.x - 26, S.adou.y + 4, 15, hasZhao ? '#1c7ed6' : '#74828e', 'center', true);
    if (hasZhao) {
      const zhaoCell = G.P.cells.find(c => c.unit && c.unit.name === '赵云');
      if (zhaoCell) {
        ctx.strokeStyle = 'rgba(28,126,214,0.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(zhaoCell.x, zhaoCell.y); ctx.lineTo(S.adou.x - 26, S.adou.y); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  var plaqueCol = mine ? '#2f9e44' : '#e03131';
  var textCol = mine ? '#343a40' : '#c0392b';
  var labelCol = mine ? '#2f9e44' : '#e03131';

  ctx.save();
  // 主体椭圆板
  var pw = 58, ph = 26, pr = 13;
  rr(S.adou.x - pw / 2, y - 4, pw, ph, pr);
  ctx.fillStyle = mine ? 'rgba(47,158,68,.12)' : 'rgba(224,49,49,.12)';
  ctx.fill();
  ctx.strokeStyle = plaqueCol; ctx.lineWidth = 1.5; ctx.stroke();

  // 标签在椭圆上方
  seal(S.adou.x - 18, y + 6, 6, mine ? '友' : '敌', plaqueCol);
  txt(mine ? '我方' : '敌军', S.adou.x, y - 12, 8, labelCol, 'center', true);

  // 阿斗名 + HP
  const _hp = (G.mode === 'escort' && G.escort) ? G.escort.hp : S.hp;
  const _baseHp = G.mode === 'escort' ? ESCORT_ADOU_HP : ADOU_HP;
  txt('阿斗', S.adou.x + 2, y + 5, 16, textCol, 'center', true);
  txt('♥' + Math.max(0, _hp), S.adou.x + 28, y + 3, 11, '#e03131', 'left', true);
  ctx.restore();

  // 血条在椭圆下方，减小高度
  var hpPct = Math.max(0, _hp) / _baseHp;
  if (hpPct < 1) {
    var hw = 36, hh = 4;
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(S.adou.x - hw / 2, y + 18, hw, hh);
    ctx.fillStyle = '#e03131'; ctx.fillRect(S.adou.x - hw / 2, y + 18, hw * hpPct, hh);
  }

  // 护盾别在椭圆正下方，血条再往下一点点
  for (var i = 0; i < (S.shield || 0); i++) {
    var sx = S.adou.x - 14 + i * 12;
    ctx.fillStyle = '#1c7ed6';
    ctx.beginPath();
    ctx.moveTo(sx, y + 24); ctx.lineTo(sx + 8, y + 24);
    ctx.lineTo(sx + 8, y + 30); ctx.lineTo(sx + 4, y + 34);
    ctx.lineTo(sx, y + 30); ctx.closePath();
    ctx.fill();
  }
}


/* 长坂独胆：走廊带 + 长坂桥 + 威胁绘制（全部以 G.mode==='escort' 门控，不影响其它模式） */
function drawEscort() {
  const e = G.escort, S = G.P;
  ctx.save();
  // 中央走廊带（走位提示）：run 阶段略亮
  ctx.fillStyle = e.run ? 'rgba(47,127,157,0.05)' : 'rgba(47,127,157,0.10)';
  ctx.fillRect(ESCORT_CORRIDOR_X0, 32, ESCORT_CORRIDOR_X1 - ESCORT_CORRIDOR_X0, H - 32);
  ctx.strokeStyle = 'rgba(47,127,157,0.35)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ESCORT_CORRIDOR_X0, 32); ctx.lineTo(ESCORT_CORRIDOR_X0, H - 32);
  ctx.moveTo(ESCORT_CORRIDOR_X1, 32); ctx.lineTo(ESCORT_CORRIDOR_X1, H - 32);
  ctx.stroke(); ctx.setLineDash([]);
  // 长坂桥（终点）
  ctx.fillStyle = '#6b4f2a'; ctx.fillRect(0, ESCORT_BRIDGE_Y - 6, W, 12);
  ctx.fillStyle = '#8b6b3a';
  for (let x = 8; x < W; x += 22) ctx.fillRect(x, ESCORT_BRIDGE_Y - 6, 14, 12);
  txt('长坂桥', W / 2, ESCORT_BRIDGE_Y - 12, 11, '#6b4f2a', 'center', true);
  ctx.restore();
  // 威胁 telegraph / 实体
  for (const t of e.threats) drawEscortThreat(t, e, S);
}

function drawEscortThreat(t, e, S) {
  if (t.kind === 'arrow') {
    if (t.phase === 'warn') {
      const a = 0.25 + 0.45 * (1 - t.t / t.t0);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#e03131';
      ctx.fillRect(ESCORT_CORRIDOR_X0, t.yTrig - 3, ESCORT_CORRIDOR_X1 - ESCORT_CORRIDOR_X0, 6);
      ctx.globalAlpha = Math.min(1, a + 0.2); ctx.strokeStyle = '#e03131'; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(t.xCenter, t.yTrig - 18); ctx.lineTo(t.xCenter, t.yTrig + 18); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha = clamp(t.t / t.t0, 0, 1) * 0.5;
      ctx.fillStyle = '#e03131'; ctx.fillRect(ESCORT_CORRIDOR_X0, t.yTrig - 3, ESCORT_CORRIDOR_X1 - ESCORT_CORRIDOR_X0, 6);
      ctx.restore();
    }
  } else if (t.kind === 'rock') {
    if (t.phase === 'warn') {
      const a = 0.2 + 0.5 * (1 - t.t / t.t0);
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#e8590c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.xRock, clamp(S.adou.y, ESCORT_BRIDGE_Y + 20, ESCORT_START_Y), t.R, 0, 7); ctx.stroke();
      ctx.restore();
    } else if (t.phase === 'fall') {
      ctx.save(); ctx.fillStyle = '#6b4f2a'; ctx.strokeStyle = '#3b2a14'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(t.xRock, t.y, t.R * 0.7, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

/* 反向攻城：敌垒(末端隘口) + 静止工事(按 glyph/col 圆牌 + 射程圈虚线) + 突进/集火激活光带（全部以 G.mode==='siege' 门控） */
function drawSiege() {
  const sg = G.siege; if (!sg) return;
  ctx.save();
  // 敌垒（末端隘口）：城垛 + 血条
  const f = sg.fort;
  ctx.fillStyle = '#8b6b3a';
  for (let x = f.x - 24; x < f.x + 24; x += 12) ctx.fillRect(x, f.y - 20, 8, 8);
  ctx.fillStyle = '#6b4f2a'; ctx.fillRect(f.x - 26, f.y - 12, 52, 18);
  txt('敌垒', f.x, f.y - 26, 10, '#8a6d3b', 'center', true);
  ctx.fillStyle = '#3a2a14'; ctx.fillRect(f.x - 26, f.y + 6, 52, 5);
  ctx.fillStyle = '#c0392b'; ctx.fillRect(f.x - 26, f.y + 6, 52 * clamp(f.hp / f.maxhp, 0, 1), 5);
  // 工事（静止防御塔）：圆牌 + 射程圈虚线
  for (const t of sg.towers) {
    ctx.strokeStyle = 'rgba(192,57,43,.26)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(t.x, t.y, t.range, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = t.col; ctx.beginPath(); ctx.arc(t.x, t.y, 11, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(t.x, t.y, 11, 0, 7); ctx.stroke();
    txt(t.glyph, t.x, t.y + 5, 12, '#fff', 'center', true);
  }
  // 突进/集火激活光带
  if (sg.rushT > 0 || sg.focusT > 0) {
    ctx.fillStyle = sg.rushT > 0 ? 'rgba(28,126,214,.10)' : 'rgba(232,168,5,.10)';
    ctx.fillRect(0, 32, W, H - 32);
  }
  ctx.restore();
}

/* ========== Main game renderer (drawGame) ==========
   Key upgrades over baseline:
   - Background from cached getMapBg() instead of flat fills
   - 备战 banner → 朱砂/墨色 capsule (bug fix #3, was blue)
   - 羁绊 banners → central safe zone at y=288 as 朱砂 capsule #bf3b2d (bug fix #2)
   - All other rendering preserved. */
function drawGame() {
  if (G.mode === 'autochess' && typeof drawAutoChess === 'function') { drawAutoChess(); return; }
  var sh = G.shake || 0;
  ctx.save();
  if (sh > 0) ctx.translate((Math.random() * 2 - 1) * sh, (Math.random() * 2 - 1) * sh);

  /* ---- Cached map background (replaces old skins array) ---- */
  var intensity = SAVE.mapSkin || 0;
  var mapCanvas = getMapBg(G.mapIdx, intensity);
  ctx.drawImage(mapCanvas, 0, 0);

  /* ---- 战场环境氛围（#8）：绘制于路径/单位之下，≤20 粒子、时间驱动、无每帧分配 ---- */
  drawAmbient(G.mapIdx);

  /* ---- Path (double-line, bug #1 fixed) ---- */
  if (G.mode !== 'raid' && G.mode !== 'puzzle' && G.mode !== 'escort' && G.mode !== 'siege') { drawPath(G.E); drawPath(G.P); }
  if (G.mode === 'siege' && G.siege) drawPath(G.P);   // 突击队沿 SIEGE_PATH 上行

  /* ---- 渲染分层：路径基底 → enemy格子 → player格子 → enemy兵 → player兵 → enemy阿斗 → player阿斗(最上层) ---- */
  if (G.mode !== 'raid' && G.mode !== 'puzzle' && G.mode !== 'escort' && G.mode !== 'siege') { G.E.cells.forEach(c => drawCell(c, G.E, false)); }
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

  // 士兵在上，阿斗在最顶层（先敌后己）：敌方兵和己方兵都在格子之上、阿斗之下
  if (G.mode !== 'raid' && G.mode !== 'puzzle' && G.mode !== 'escort') for (const m of G.E.mobs) if (m.hp > 0) drawMob(m);
  for (const m of G.P.mobs) if (m.hp > 0) drawMob(m);

  // 敌方阿斗
  if (G.mode !== 'raid' && G.mode !== 'puzzle' && G.mode !== 'escort' && G.mode !== 'siege') drawAdou(G.E);

  // 队伍状态 / 特殊标记（兵下层已经画了，这里只画阿斗扩展）

  /* 黄巾讨伐：当前暴露弱点侧高亮带，提示玩家须在该区域部署/移动单位 */
  if (G.mode === 'raid' && G.raid) {
    const b = G.raid.bounds, ex = G.raid.exposed, span = (b.maxX - b.minX) || 1;
    let x0, x1;
    if (ex === 'left') { x0 = b.minX - 26; x1 = b.minX + span / 3; }
    else if (ex === 'right') { x0 = b.minX + span * 2 / 3; x1 = b.maxX + 26; }
    else { x0 = b.minX + span / 3; x1 = b.minX + span * 2 / 3; }
    ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#e8590c';
    ctx.fillRect(x0, 318, x1 - x0, 218); ctx.restore();
  }

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
  if (G.mode !== 'raid' && G.mode !== 'puzzle') for (const sn of G.E.snakes) txt('蛇', sn.x, sn.y + 5, 15, '#2f9e44', 'center', true);

  /* Mobs */
  if (G.mode !== 'raid' && G.mode !== 'puzzle' && G.mode !== 'escort') for (const m of G.E.mobs) drawMob(m);
  for (const m of G.P.mobs) drawMob(m);

  /* 长坂独胆：走廊 / 长坂桥 / 威胁 telegraph 绘制（在守军与拦截兵之上） */
  if (G.mode === 'escort' && G.escort) drawEscort();

  /* 反向攻城：敌垒 / 工事 / 激活光带 绘制（在突击队之上） */
  if (G.mode === 'siege' && G.siege) drawSiege();

  /* 群雄演武：布阵阶段预览敌阵落点（开战后才真正生成） */
  if (G.mode === 'puzzle' && G.puzzle && G.puzzle.prep && G.puzzle.cur) {
    for (const e of G.puzzle.cur.enemyFormation) {
      ctx.globalAlpha = 0.5;
      txt(e.mobId, e.x, e.y + 5, 16, '#c0392b', 'center', true);
      hpBar(e.x - 11, e.y + 13, 22, 1, '#fa5252');
      ctx.globalAlpha = 1;
    }
  }

  /* 单位死亡溶解层（#5）：hp<=0 移除时由 dealDmg 推入 G.deaths；此处逐帧淡出+轻微放大，
     配合 dealDmg 内 fxDissolve 的溶解环/粒子，替代原"瞬间消失"，零模拟逻辑改动、零回归风险 */
  if (G.deaths && G.deaths.length) {
    for (const d of G.deaths) {
      const a = clamp(d.t / d.t0, 0, 1);
      ctx.globalAlpha = a * 0.9;
      const s = (d.boss ? 28 : 16) * (1 + (1 - a) * 0.35);
      txt(d.type, d.x, d.y + s * 0.35, s, d.col, 'center', true);
      ctx.globalAlpha = 1;
      d.t -= DT60;
    }
    G.deaths = G.deaths.filter(d => d.t > 0);
  }

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

  /* 统一上浮飘字（#3）：按各自 t0/size/vy 淡出与位移；数组封顶已在 popFloat 内处理（≤80） */
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.t / (f.t0 || 0.8), 0, 1);
    txt(f.txt, f.x, f.y, f.size || 10, f.col, 'center', true);
    f.y -= (f.vy || 26) * DT60; f.t -= DT60;
  }
  ctx.globalAlpha = 1;
  G.floats = G.floats.filter(f => f.t > 0);

  /* ---- Top bar (not affected by screen shake) ---- */
  if (G.shake > 0) G.shake = Math.max(0, G.shake - 0.6);
  ctx.restore();

  ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = '#e4d9c8'; ctx.fillRect(0, TOP - 3, W, 3);

  /* Resource chips */
  if (G.mode !== 'puzzle') resChip('馒 ' + G.P.mantou, 6, 7, '#8b5e3c');
  resChip('金 ' + SAVE.gold, 76, 7, '#b0801f');

  /* Stage/wave info */
  txt((G.mode ? G.modeLabel : (G.endless ? '无尽' : '第' + G.stage + '关')) + (G.mode ? '' : '·第' + G.wave + '波') + (SAVE.invincible ? ' ·无敌' : ''), 232, 20, 12, '#495057', 'right', true);

  /* Next wave preview */
  if (G.previewQ && G.previewQ.pool && G.previewQ.pool.length) {
    const p = G.previewQ;
    const parts = p.pool.map(x => x[0] + '×' + Math.round(p.per * x[1] / 100)).filter(s => !s.endsWith('×0'));
    let s = '下波 ▸ ' + parts.join(' ') + (p.boss ? '  ☠BOSS' : '');
    txt(s, 8, 44, 10, '#8a7e6c', 'left');
  }

  /* Mode status bars */
  if (G.mode === 'fire') {
    txt('🔥 风：' + (G.wind === '东南风' ? '东南' : '西北') + ' · 水寨♥' + Math.ceil(Math.max(0, G.fire.stronghold)) + ' · 控火油×' + Math.floor(G.fire.oil), W / 2, 48, 11, '#bd4a31', 'center', true);
    drawFire();
  } else if (G.mode === 'escort') {
    const e = G.escort;
    if (!e.run) {
      txt('🐎 布阵备战 ' + Math.ceil(Math.max(0, G.betweenT)) + 's · 拖守军入左右两翼', W / 2, 48, 11, '#2f7f9d', 'center', true);
    } else {
      txt('🐎 护送进度 ' + Math.floor(e.progress) + '%', W / 2, 48, 11, '#2f7f9d', 'center', true);
      ctx.fillStyle = '#d9e8ec'; ctx.fillRect(112, 53, 151, 4); ctx.fillStyle = '#2f7f9d'; ctx.fillRect(112, 53, 151 * e.progress / 100, 4);
      for (let i = 0; i < e.maxhp; i++) txt(i < e.hp ? '♥' : '♡', 152 + i * 11, 84, 11, i < e.hp ? '#e03131' : '#ced4da', 'center', true);
      // 拦截警示（在阿斗正下方而非顶部 HUD，避免与进度条/血心重叠）
      if (e.blockWarn && e.blockTimer > 0) {
        const warnP = clamp(e.blockTimer / ESCORT_BLOCK_FAIL, 0, 1);
        const ax = G.P.adou.x, ay = G.P.adou.y;
        ctx.fillStyle = warnP > 0.6 ? '#e03131' : '#f59f00';
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 180);
        ctx.fillRect(ax - 30, ay + 20, 60 * warnP, 5);
        ctx.strokeStyle = '#495057'; ctx.lineWidth = 0.5; ctx.strokeRect(ax - 30, ay + 20, 60, 5);
        ctx.globalAlpha = 1;
        // 拦截图标和倒计时在阿斗下方更远处，不挡住标签牌
        const icon = warnP > 0.7 ? '🚨' : warnP > 0.4 ? '⚠' : '⚡';
        txt(icon + '拦截 ' + e.blockTimer.toFixed(1) + 's', ax, ay + 36, 10, warnP > 0.6 ? '#e03131' : '#f59f00', 'center', true);
      }
    }
  } else if (G.mode === 'puzzle') {
    const pz = G.puzzle;
    txt('♟ ' + (pz.cur ? pz.cur.name : '群雄演武') + ' · 第 ' + pz.attempt + '/' + pz.maxAttempts + ' 次', W / 2, 48, 11, '#b78324', 'center', true);
  } else if (G.mode === 'raid') {
    txt('👑 讨伐剩余 ' + Math.ceil(Math.max(0, G.raid.limit)) + ' 秒', W / 2, 48, 11, '#8d3543', 'center', true);
    drawRaidHud();
  } else if (G.mode === 'rogue') {
    txt('⚔ 五虎试炼 · 第 ' + G.rogue.floor + '/' + G.rogue.maxFloor + ' 战 · 军略 ' + G.rogue.picks, W / 2, 48, 11, '#7250b8', 'center', true);
  } else if (G.mode === 'siege') {
    const sg = G.siege, prog = Math.round((1 - sg.fort.hp / sg.fort.maxhp) * 100);
    txt('🏯 突破 ' + prog + '% · 敌垒♥' + Math.ceil(Math.max(0, sg.fort.hp))
      + ' · 剩 ' + Math.ceil(Math.max(0, G.modeTime)) + 's', W / 2, 48, 11, '#8a6d3b', 'center', true);
  }

  /* Right-side control buttons */
  btn(240, 4, 32, 24, '×' + G.speed, () => { G.speed = G.speed >= 4 ? 1 : G.speed + 1; }, { bg: '#495057', size: 11 });
  btn(273, 4, 32, 24, G.paused ? '▶' : 'Ⅱ', () => { G.paused = !G.paused; }, { bg: '#495057', size: 11 });
  btn(306, 4, 32, 24, SAVE.mute ? '🔇' : '🔊', () => { SAVE.mute = !SAVE.mute; saveSave(); sfx('click'); if (typeof stopBgm === 'function') stopBgm(); },
    { bg: SAVE.mute ? '#e03131' : '#2f9e44', size: 12 });
  btn(339, 4, 32, 24, '菜单', () => { goTo('menu'); }, { bg: '#868e96', size: 9 });

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
  if (SAVE.manualUlt && G.mode !== 'puzzle' && G.mode !== 'siege') {
    let _ready = 0;
    for (const _c of G.P.cells) if (_c.unit && _c.unit.t === 'hero' && HEROES[_c.unit.name].skill && _c.unit.cd <= 0) _ready++;
    btn(196, ay, 54, ah, '大招×' + _ready, () => manualUlt(G.P), { size: 10, bg: '#e8a005', disabled: !_ready });
  }
  if (G.mode !== 'siege') btn(254, ay, 32, ah, '撤销', () => undoAction(),
    { size: 9, bg: '#8e98a3', disabled: G.ghostMode || !G.undoStack || !G.undoStack.length });
  if (G.mode !== 'puzzle' && G.mode !== 'siege') {
    btn(8, ay, 62, ah, '抽卡 馒' + DRAW.cost, () => doSummon(G.P),
      { size: 11, bg: '#c0392b', disabled: G.P.mantou < DRAW.cost || barFree(G.P) < 0 });
    const tenCostNow = SAVE.firstTen ? (DRAW.tenCost / 2 | 0) : DRAW.tenCost;
    btn(74, ay, 62, ah, '十连 ' + tenCostNow, () => drawTen(G.P),
      { size: 11, bg: '#a61e4e', disabled: G.P.mantou < tenCostNow || barFree(G.P) < 0 });
  }

  /* 反向攻城：3 指令按钮（突进/集火/鼓舞），CD 中禁用（复用大招按钮范式，siegeCmd 派发） */
  if (G.mode === 'siege' && G.siege) {
    const sg = G.siege, ay2 = ay, ah2 = ah;
    const cmd = (x, w, label, key, col, cd) => {
      const ready = cd <= 0;
      btn(x, ay2, w, ah2, label + ' ' + (ready ? '✓' : Math.ceil(cd) + 's'), () => siegeCmd(key),
        { size: 10, bg: ready ? col : '#868e96', disabled: !ready });
    };
    cmd(8, 116, '突进', 'rush', '#1c7ed6', sg.cmds.rush);
    cmd(130, 116, '集火', 'focus', '#e8a005', sg.cmds.focus);
    cmd(252, 116, '鼓舞', 'heal', '#2f9e44', sg.cmds.heal);
  }

  /* Active items — 单独一行（合成栏下方、操作栏上方 y=ay-ah），
     显示全部已装备/持有 uses 的主动道具，去掉 slice(0,2) 限制，确保觉醒丹（ITEMS 第 6 位）等也可点。 */
  const acts = Object.keys(ITEMS).filter(id => ITEMS[id].act && (G.itemUses[id] || SAVE.loadout.includes(id)));
  if (acts.length && G.mode !== 'puzzle') {
    const AY2 = ay - ah;                                  // 与操作栏同高、上移一行，避免遮挡抽卡/十连/大招/撤销/回收槽
    const AM = 4, AG = 4;                                 // 左右边距 / 按钮间距
    const AW2 = Math.min(54, Math.floor((W - AM * 2 - (acts.length - 1) * AG) / acts.length));
    acts.forEach((id, i) => {
      const n = G.itemUses[id] || 0;
      const ax = AM + i * (AW2 + AG);
      btn(ax, AY2, AW2, ah, ITEMS[id].name + '×' + n, () => useActive(id),
        { size: 9, bg: G.targeting === id ? '#e8a005' : '#5f3dc4', disabled: !n });
    });
  }

  /* Recycle slot */
  const rc = RECYCLE;
  rr(rc.x, rc.y, rc.w, rc.h, 6);
  ctx.fillStyle = '#e9ecef'; ctx.fill();
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#868e96'; ctx.stroke(); ctx.setLineDash([]);
  txt('回收♻', rc.x + rc.w / 2, rc.y + rc.h / 2 + 4, 11, '#868e96', 'center', true);
  txt('拖单位回收', rc.x + rc.w / 2, rc.y + rc.h - 3, 8, '#adb5bd', 'center');

  /* 群雄演武：布阵阶段给出「开战 / 选关」；自动战斗阶段仅观战，无额外按钮 */
  if (G.mode === 'puzzle' && G.puzzle && G.puzzle.prep) {
    btn(40, 556, 140, 38, '开 战 ▶', () => puzzleStartAttempt(), { size: 16, bg: '#318c4a' });
    btn(196, 556, 140, 38, '选 关', () => { G.puzzle.choosing = true; G.puzzle.cur = null; }, { size: 15, bg: '#7250b8' });
  }

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
  /* 反向攻城·战前编成面板（复用 rogueChoices overlay 范式）：3 预设选择（§7.2） */
  if (G.siege && G.siege.build) {
    ctx.fillStyle = 'rgba(26,24,35,.72)'; ctx.fillRect(0, 0, W, H);
    panel(24, 150, 327, 332, { bg: '#fffdf9', stroke: '#d9c8a0', r: 14 });
    txt('反向攻城 · 战前编成', W / 2, 184, 21, '#8a6d3b', 'center', true);
    txt('选 1 套突击编成，决定领队与主战兵种', W / 2, 206, 10, '#868e96', 'center');
    SIEGE_PRESETS.forEach((p, i) => {
      const cy = 224 + i * 92;
      panel(44, cy, 287, 80, { bg: '#fff8e8', stroke: '#e8a005', r: 10 });
      txt(p.n, 60, cy + 26, 16, '#8a6d3b', 'left', true);
      txt(p.tip, 60, cy + 46, 10, '#656d76', 'left');
      txt('领队 ' + p.lead + ' · 队列 ' + p.queue.join(''), 60, cy + 63, 9, '#a0483a', 'left');
      btn(252, cy + 22, 70, 36, '选用', () => chooseSiegePreset(i), { size: 12, bg: '#8a6d3b' });
    });
  }
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
  /* 群雄演武：关卡选择 overlay（choosing=true 时显示，覆盖在战场之上） */
  if (G.mode === 'puzzle' && G.puzzle && G.puzzle.choosing) {
    ctx.fillStyle = 'rgba(26,24,35,.72)'; ctx.fillRect(0, 0, W, H);
    btns = [];   // 清掉战场/操作栏按钮，避免覆盖层之下仍可点击
    panel(24, 110, 327, 452, { bg: '#fffdf9', stroke: '#d9c8a0', r: 14 });
    txt('群雄演武 · 选关', W / 2, 146, 21, '#b78324', 'center', true);
    txt('禁抽卡/禁合成 · 仅布阵 · 歼灭敌阵', W / 2, 168, 10, '#868e96', 'center');
    // 10 关 → 两列网格（2×5），保证 375×667 竖屏内完整显示、不溢出/不重叠（原单列 96px 间距会超屏）
    const _cols = 2, _gapX = 10, _gapY = 9, _cw = 142, _ch = 64;
    const _gx0 = 40, _gy0 = 180, _pitchY = _ch + _gapY;
    PUZZLE_LEVELS.forEach((lv, i) => {
      const c = i % _cols, r = (i / _cols) | 0;
      const cx = _gx0 + c * (_cw + _gapX), cy = _gy0 + r * _pitchY;
      const on = i === G.puzzle.levelIdx;
      panel(cx, cy, _cw, _ch, { bg: on ? '#fff8e8' : '#fffdf9', stroke: on ? '#e8a005' : '#e7dccb', r: 10 });
      txtFit(lv.name, cx + 10, cy + 20, 13, '#343a40', 'left', true, _cw - 56);
      btn(cx + _cw - 44, cy + 8, 38, 22, '进入', () => puzzleLoadLevel(i), { size: 10, bg: '#318c4a' });
      txtFit(lv.playerPreset.map(p => p.troopId + p.count).join(' '), cx + 10, cy + 39, 8, '#868e96', 'left', false, _cw - 20);
      txtFit('地形 ' + lv.terrain.map(t => (t.mod === 'high' ? '高地' : '隘口')).join('/') + ' · 尝试' + lv.par + '次', cx + 10, cy + 54, 8, '#a0483a', 'left', false, _cw - 20);
    });
    btn(W - 30 - 99, H - 63, 99, 34, '返回', () => { goTo('menu'); }, { grad: THEME.slate });
  } else if (G.state === 'win') {
    if (G.mode === 'puzzle') {
      overlay('演武破阵', G.rewardTxt, [
        ['再来一局', () => puzzleLoadLevel(G.puzzle.levelIdx)],
        ['关卡选择', () => { G.puzzle.choosing = true; G.puzzle.cur = null; }],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else if (G.mode === 'raid') {
      overlay('讨伐成功', G.rewardTxt, [
        ['再来一局', () => startSpecialMode('raid')],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else if (G.mode === 'fire') {
      overlay('火攻成功', G.rewardTxt, [
        ['再来一局', () => startSpecialMode('fire')],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else if (G.mode === 'rogue') {
      overlay('试炼完成', G.rewardTxt, [
        ['再来一局', () => startSpecialMode('rogue')],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else if (G.mode === 'siege') {
      overlay('敌垒已破', G.rewardTxt, [
        ['再来一局', () => startSpecialMode('siege')],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else {
      const acts2 = [];
      if (!G.endless && G.stage < STAGE_MAX) acts2.push(['下一关', () => { startBattle(G.stage + 1, false, G.mapIdx); }]);
      acts2.push(['再来一局', () => { startBattle(G.stage, G.endless, G.mapIdx); }]);
      acts2.push(['返回菜单', () => { goTo('menu'); selStage = SAVE.stage; }, '#868e96']);
      let desc = G.rewardTxt;
      if (G.stage === 30 && !SAVE.eggs.acc) desc += '  (停留' + Math.max(0, Math.ceil(10 - G.resultT)) + 's…)';
      overlay('胜 利', desc, acts2);
    }
  } else if (G.state === 'lose') {
    if (G.mode === 'puzzle') {
      overlay('残局未破', G.rewardTxt, [
        ['重试本关', () => puzzleLoadLevel(G.puzzle.levelIdx)],
        ['关卡选择', () => { G.puzzle.choosing = true; G.puzzle.cur = null; }],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else if (G.mode === 'raid') {
      overlay('讨伐失败', G.rewardTxt, [
        ['再来一局', () => startSpecialMode('raid')],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else if (G.mode === 'fire') {
      overlay('水寨失守', G.rewardTxt, [
        ['再来一局', () => startSpecialMode('fire')],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else if (G.mode === 'rogue') {
      overlay('试炼失败', G.rewardTxt, [
        ['再来一局', () => startSpecialMode('rogue')],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else if (G.mode === 'siege') {
      overlay('攻城失败', G.rewardTxt, [
        ['再来一局', () => startSpecialMode('siege')],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    } else {
      overlay('失 败', '阿斗被掳走 · ' + G.rewardTxt, [
        ['再来一局', () => { startBattle(G.stage, G.endless, G.mapIdx); }],
        ['返回菜单', () => { goTo('menu'); }, '#868e96'],
      ]);
    }
  } else if (G.paused) {
    overlay('已暂停', '', [
      ['继续', () => { G.paused = false; }],
      ['退出对局', () => { goTo('menu'); }, '#868e96'],
    ]);
  }

  /* 手动大招专属全屏演出（#7）：金色闪光 + 中央扩散环 + 暗角 + 横幅；
     与觉醒（fxRing+boomRadial+shake+banner）区分但同调，仅作用于手动大招释放瞬间 */
  if (G.ultFx) {
    var up = 1 - G.ultFx.t / G.ultFx.t0;                 // 0→1 进度
    ctx.save();
    ctx.globalAlpha = clamp(G.ultFx.t * 0.45, 0, 0.6);
    ctx.fillStyle = '#e8a005'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    var ucx = W / 2, ucy = H / 2, uR = up * 360, uA = 1 - up;
    ctx.globalAlpha = clamp(uA, 0, 1) * 0.85;
    ctx.strokeStyle = '#e8a005'; ctx.lineWidth = 4 + 5 * uA;
    ctx.beginPath(); ctx.arc(ucx, ucy, uR, 0, 7); ctx.stroke();
    ctx.globalAlpha = clamp(uA, 0, 1) * 0.35;           // 轻量暗角（粗描边框，避免每帧大渐变分配）
    ctx.strokeStyle = 'rgba(40,28,10,.9)'; ctx.lineWidth = 26;
    ctx.strokeRect(13, 13, W - 26, H - 26);
    ctx.globalAlpha = clamp(G.ultFx.t * 1.4, 0, 1);
    ctx.font = 'bold 30px "PingFang SC","Microsoft YaHei",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff7e0'; ctx.fillText((G.ultFx.hero || '') + '·大招!', ucx, ucy + 10);
    ctx.globalAlpha = 1;
    ctx.restore();
    G.ultFx.t -= DT60; if (G.ultFx.t <= 0) G.ultFx = null;
  }
}

/* 黄巾讨伐 Boss HUD：血条 + 左/中/右 弱点指示珠 + 当前暴露侧文案 */
function drawRaidHud() {
  if (!G.raid) return;
  const boss = G.P.mobs.find(m => m.raidBoss && m.hp > 0);
  const bw = 280, bx = (W - bw) / 2, by = 62;
  if (boss) {
    txt('张角 · 黄巾之乱', W / 2, by - 4, 10, '#8d3543', 'center', true);
    ctx.fillStyle = '#3a2a2a'; ctx.fillRect(bx, by, bw, 7);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxhp, 0, 1), 7);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, 7);
  } else {
    txt(G.raid.bossSpawned ? '张角已伏诛!' : '张角将至…', W / 2, by + 6, 11, '#8d3543', 'center', true);
  }
  const regions = ['left', 'mid', 'right'], labels = ['左', '中', '右'];
  const py = 86, pw = 32, gap = 16, total = regions.length * pw + (regions.length - 1) * gap;
  const px0 = (W - total) / 2;
  regions.forEach((rg, i) => {
    const cx = px0 + i * (pw + gap) + pw / 2;
    const on = rg === G.raid.exposed;
    ctx.beginPath(); ctx.arc(cx, py, 12, 0, 7);
    ctx.fillStyle = on ? '#e8590c' : 'rgba(120,110,100,.22)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = on ? '#e8590c' : 'rgba(120,110,100,.5)'; ctx.stroke();
    txt(labels[i], cx, py + 4, 12, on ? '#fff' : '#6f6556', 'center', true);
  });
  txt('弱点：' + RAID_SIDE_NAME[G.raid.exposed] + ' 侧 · 其余 -90% 减伤', W / 2, py + 22, 9, '#a0483a', 'center');
}

function overlay(title, desc, actions) {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  btns = [];
  rr(50, 230, 275, 190 + actions.length * 12, 14); ctx.fillStyle = '#fff'; ctx.fill();
  txt(title, W / 2, 282, 28, '#343a40', 'center', true);
  txt(desc, W / 2, 312, 11, '#868e96', 'center');
  actions.forEach((a, i) => btn(87, 332 + i * 38, 200, 31, a[0], a[1], { size: 13, bg: a[2] }));
}
