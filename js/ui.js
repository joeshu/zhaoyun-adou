/* v2 UI 骨架：绘制助手 / 菜单 / 商店 / 锻造 / 装备 / 输入 / 启动（战场绘制在 ui_battle.js） */
'use strict';

let scr = 'menu';                 // menu | shop | forge | equip | game | help | save | wish | ach | daily | ghost | stats
let btns = [], drag = null, selStage = 1, selMap = 0, selMapTouched = false, forgeMsg = '';
let ghostList = [], ghostMsg = '';   // P1-4 录像列表 / 反馈
let saveConfirm = false, saveMsg = '';   // 存档页：清除二次确认 / 保存反馈
let canvas, ctx, scaleF = 1;
// 轻量滚动（列表超屏时启用，如 equip 18 武将）：btn 记录的 y 减去 g_scrollY 以贴合屏幕坐标
let g_scrollY = 0, listScroll = 0, listScrollMax = 0, LIST_AREA = null, scrollDrag = null;
let _lastScr = '', _wipe = 0, _pendingScr = null, _wipeOut = 0;   // 过场：_wipe 进场淡入；_wipeOut 出场淡出（goTo 触发）
let g_ptrDown = false, g_ptrHit = null;            // 全局"指针按下"标记，驱动 btn 按下态（不改命中区）
const DT60 = 1 / 60;

// 字体字符串缓存：txt() 每帧被调用上百次，避免重复拼接与重复设置 ctx.font
const _fontCache = new Map();
function txt(s, x, y, size, col, align = 'left', bold = false) {
  const key = size + (bold ? 'b' : '');
  let f = _fontCache.get(key);
  if (!f) { f = `${bold ? 'bold ' : ''}${size}px "PingFang SC","Microsoft YaHei",sans-serif`; _fontCache.set(key, f); }
  ctx.font = f;        // 始终设置：避免与 ctx.save/restore 之间 _lastFont 状态泄漏（旧实现下 ghost 第二颗按钮偶发叠字）
  ctx.fillStyle = col;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}
// 字符级换行：中文按字符、英文按词；返回总占用高度
function wrapText(s, x, y, size, col, maxW, bold = false) {
  const key = size + (bold ? 'b' : '');
  let f = _fontCache.get(key);
  if (!f) { f = `${bold ? 'bold ' : ''}${size}px "PingFang SC","Microsoft YaHei",sans-serif`; _fontCache.set(key, f); }
  ctx.font = f; ctx.fillStyle = col; ctx.textAlign = 'left';
  const lh = size + 5, chars = Array.from(s);
  let line = '', yOff = 0;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + yOff);
      line = ch; yOff += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y + yOff);
  return yOff + lh;
}
// 小屏信息密度兜底（#9）：文本溢出容器或字号过小时动态缩字号（下限 8px），不换行、不越界。
function txtFit(s, x, y, size, col, align, bold, maxW) {
  const m = maxW || W;
  let sz = size;
  while (sz > 8) {
    const key = sz + (bold ? 'b' : '');
    let f = _fontCache.get(key);
    if (!f) { f = `${bold ? 'bold ' : ''}${sz}px "PingFang SC","Microsoft YaHei",sans-serif`; _fontCache.set(key, f); }
    ctx.font = f;
    if (ctx.measureText(s).width <= m) break;
    sz -= 1;
  }
  txt(s, x, y, sz, col, align, bold);
}
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// 颜色加深（把纯色升级为瓷面渐变的下沿）；非十六进制（如 rgba）原样返回
function shade(c, f) {
  if (typeof c !== 'string' || c[0] !== '#') return c;
  let n = c.slice(1);
  if (n.length === 3) n = n.split('').map(ch => ch + ch).join('');
  const num = parseInt(n, 16);
  const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((num & 255) * f)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function panel(x, y, w, h, opt = {}) {
  const r = opt.r !== undefined ? opt.r : 12;
  ctx.save();
  // 更柔和的投影：多层阴影营造悬浮感
  ctx.shadowColor = opt.shadow || 'rgba(60,40,15,.12)';
  ctx.shadowBlur = opt.blur === undefined ? 12 : opt.blur;
  ctx.shadowOffsetY = opt.offsetY === undefined ? 4 : opt.offsetY;
  rr(x, y, w, h, r); ctx.fillStyle = opt.bg || THEME.cardTop; ctx.fill();
  ctx.restore();
  // 纯色背景升级为羊皮纸纵向渐变；rgba 覆盖层保持半透明平铺（battle 提示框等）
  if (typeof opt.bg === 'string' && opt.bg[0] === '#') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, opt.bg); g.addColorStop(1, shade(opt.bg, 0.93));
    rr(x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  }
  // 顶部瓷面高光条：增加质感
  if (!opt.noHighlight) {
    ctx.save();
    const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.4);
    hl.addColorStop(0, 'rgba(255,255,255,.35)');
    hl.addColorStop(0.5, 'rgba(255,255,255,.12)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    rr(x + 1, y + 1, w - 2, Math.min(h * 0.45, r + 12), Math.max(1, r - 1));
    ctx.fillStyle = hl; ctx.fill();
    ctx.restore();
  }
  // 描边
  if (opt.stroke !== null) {
    rr(x, y, w, h, r);
    ctx.strokeStyle = opt.stroke || THEME.cardBorder;
    ctx.lineWidth = opt.strokeWidth || 1.5;
    ctx.stroke();
    // 金边（高品质卡片 opt.gold=true 时使用）
    if (opt.gold) {
      ctx.save();
      rr(x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 2));
      ctx.strokeStyle = 'rgba(212,168,40,.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }
  // 边角纹饰（opt.corner 时在四角加小三角装饰，增加古典韵味）
  if (opt.corner) {
    const cs = opt.cornerSize || 6;
    const ccol = opt.cornerCol || 'rgba(180,140,60,.25)';
    ctx.fillStyle = ccol;
    // 左上
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + r + cs, y); ctx.lineTo(x + r, y + cs); ctx.closePath(); ctx.fill();
    // 右上
    ctx.beginPath(); ctx.moveTo(x + w - r - cs, y); ctx.lineTo(x + w - r, y); ctx.lineTo(x + w - r, y + cs); ctx.closePath(); ctx.fill();
    // 左下
    ctx.beginPath(); ctx.moveTo(x + r, y + h); ctx.lineTo(x + r + cs, y + h); ctx.lineTo(x + r, y + h - cs); ctx.closePath(); ctx.fill();
    // 右下
    ctx.beginPath(); ctx.moveTo(x + w - r - cs, y + h); ctx.lineTo(x + w - r, y + h); ctx.lineTo(x + w - r, y + h - cs); ctx.closePath(); ctx.fill();
  }
  // 卡片底部压边，模拟原版纸牌的轻微厚度。
  if (h > 18 && opt.depth !== false) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    rr(x + 5, y + h - 4, w - 10, 2, 1);
    ctx.fillStyle = 'rgba(90,65,35,.32)'; ctx.fill();
    ctx.restore();
  }
}
function sectionLabel(label, x, y) {
  txt(label.toUpperCase(), x, y, 9, '#a48b63', 'left', true);
}
function hpBar(x, y, w, p, col) {
  ctx.fillStyle = '#e9ecef'; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = col || (p > 0.5 ? '#2f9e44' : p > 0.25 ? '#f59f00' : '#e03131');
  ctx.fillRect(x, y, w * clamp(p, 0, 1), 3);
}
// 瓷面按钮 v3：更深邃渐变 + 顶部高光 + 底部反光 + 描边 + 光晕；opt.grad 显式双色 或 opt.bg 自动加深
function btn(x, y, w, h, label, fn, opt = {}) {
  btns.push({ x, y: y - g_scrollY, w, h, fn, disabled: opt.disabled, label: String(label) });   // label 仅用于调试/自动化检测（如重叠扫描），不影响点击
  const r = opt.r !== undefined ? opt.r : 9;
  // 按下态：命中且指针按下的按钮整体下沉/缩放（命中区由 btns[] 几何决定，此处仅改绘制，不缩放命中区）
  const pressed = g_ptrDown && g_ptrHit && !opt.disabled &&
    g_ptrHit.x === x && g_ptrHit.y === y - g_scrollY && g_ptrHit.w === w && g_ptrHit.h === h;
  ctx.save();
  if (pressed) { const cx = x + w / 2, cy = y + h / 2; ctx.translate(cx, cy); ctx.scale(0.96, 0.96); ctx.translate(-cx, -cy); }
  const grad = opt.grad || [opt.bg || '#5a6472', shade(opt.bg || '#5a6472', 0.76)];
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (opt.disabled) { g.addColorStop(0, '#e8e2d5'); g.addColorStop(1, '#ccc4b4'); }
  else {
    g.addColorStop(0, grad[0]);
    g.addColorStop(0.5, shade(grad[0], 0.96));
    g.addColorStop(1, grad[1]);
  }
  // 按钮投影（非disabled且非按下时）
  if (!opt.disabled && !pressed) {
    ctx.save();
    ctx.shadowColor = 'rgba(40,25,10,.20)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    rr(x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  } else {
    rr(x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  }
  if (!opt.disabled) {
    // 顶部高光（更通透）
    const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,.32)');
    hl.addColorStop(0.6, 'rgba(255,255,255,.10)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    rr(x + 1, y + 1, w - 2, h * 0.48, Math.max(1, r - 1)); ctx.fillStyle = hl; ctx.fill();
    // 底部微光带
    const bl = ctx.createLinearGradient(0, y + h * 0.7, 0, y + h);
    bl.addColorStop(0, 'rgba(0,0,0,0)');
    bl.addColorStop(1, 'rgba(0,0,0,.12)');
    rr(x + 1, y + h * 0.6, w - 2, h * 0.4 - 1, Math.max(1, r - 1)); ctx.fillStyle = bl; ctx.fill();
    // 主按钮（朱砂红/鎏金）外发光效果
    if (opt.glow) {
      ctx.save();
      ctx.shadowColor = opt.glowCol || grad[0];
      ctx.shadowBlur = 8;
      rr(x, y, w, h, r); ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }
  rr(x, y, w, h, r); ctx.strokeStyle = opt.disabled ? '#b0a898' : 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.stroke();
  // 内层细描边（营造精致感）
  if (!opt.disabled) {
    rr(x + 0.5, y + 0.5, w - 1, h - 1, Math.max(1, r - 0.5));
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  if (pressed) {   // 按下态：内阴影/下沉描边
    rr(x + 1, y + 1, w - 2, h - 2, Math.max(1, r - 1));
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.save();
  const size = opt.size || 14, lines = String(label).split('\n');
  const prevBaseline = ctx.textBaseline; ctx.textBaseline = 'middle';
  // 文字阴影（增加可读性和立体感）
  ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 1; ctx.shadowOffsetY = 1;
  lines.forEach((ln, i) =>
    txt(ln, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * (size + 3), size, opt.col || '#fff', 'center', true));
  ctx.textBaseline = prevBaseline;
  ctx.restore();
  ctx.restore();
}
// 资源小药丸 v3（更精致的胶囊：渐变+色点阴影+细描边）
function resChip(label, x, y, dot) {
  const cw = 64, ch = 18;
  // 投影
  ctx.save();
  ctx.shadowColor = 'rgba(60,40,15,.08)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  rr(x, y, cw, ch, 9); ctx.fillStyle = '#fffdf7'; ctx.fill();
  ctx.restore();
  // 渐变底色
  const cg = ctx.createLinearGradient(0, y, 0, y + ch);
  cg.addColorStop(0, '#fffdf7'); cg.addColorStop(1, '#f5efe0');
  rr(x, y, cw, ch, 9); ctx.fillStyle = cg; ctx.fill();
  // 细描边
  rr(x, y, cw, ch, 9); ctx.strokeStyle = 'rgba(180,150,100,.25)'; ctx.lineWidth = 0.8; ctx.stroke();
  // 资源图标：用极简 Canvas 符号替代纯文字色点，提升扫读速度。
  ctx.save();
  ctx.shadowColor = dot; ctx.shadowBlur = 3;
  ctx.fillStyle = dot;
  const icon = String(label).trim().charAt(0);
  if (icon === '金') {
    ctx.beginPath(); ctx.arc(x + 11, y + 9, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 1; ctx.stroke();
  } else if (icon === '馒') {
    rr(x + 6, y + 5, 10, 8, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x + 8, y + 6, 5, 1);
  } else if (icon === '材') {
    ctx.save(); ctx.translate(x + 11, y + 9); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8); ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(x + 11, y + 9, 4.5, 0, 7); ctx.fill();
  }
  ctx.restore();
  // 图标高光
  ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.beginPath(); ctx.arc(x + 10, y + 7.5, 1.5, 0, 7); ctx.fill();
  // 文字
  txt(label, x + 22, y + 13, 11, '#4a3f30', 'left', true);
}

/* ---------- 切屏过场：goTo 统一进场/出场 ---------- */
// 所有 scr 切换经 goTo：先播放旧屏"出场"淡出，完成后再切屏触发新屏"进场"淡入（draw() 内处理）。
// 防止重复触发：动画进行中或目标即当前屏时忽略。不触碰任何游戏逻辑，仅控制视觉过场。
function goTo(s) {
  if (s === scr || _wipeOut > 0) return;
  _pendingScr = s; _wipeOut = 0.22;
}

/* ---------- 统一子屏返回键（#1 根治遮挡） ---------- */
// 右下对齐、尺寸一致、风格统一；底部预留不压列表末项。所有子屏均经此返回主菜单。
function backBtn() {
  btn(W - 30 - 99, H - 63, 99, 34, '返回', () => { goTo('menu'); }, { grad: THEME.slate });
}

// 子页面统一标题栏：标题、印章、金线和副标题使用同一视觉锚点。
function screenHeader(label, sub = '', opt = {}) {
  inkTop(58);
  const col = opt.col || THEME.ink;
  title(label, W / 2, 42, opt.size || 22, { col, seal: opt.seal || label.slice(0, 1) });
  if (sub) txtFit(sub, W / 2, 66, 10, THEME.inkSub, 'center', false, 330);
  ctx.save();
  const line = ctx.createLinearGradient(28, 0, W - 28, 0);
  line.addColorStop(0, 'rgba(180,140,60,0)'); line.addColorStop(.5, 'rgba(180,140,60,.48)'); line.addColorStop(1, 'rgba(180,140,60,0)');
  ctx.fillStyle = line; ctx.fillRect(28, 78, W - 56, 1);
  ctx.restore();
}

// 列表滚动容器：裁剪绘制区 + 应用 g_scrollY 偏移 + 右侧滚动条；contentH 为内容总高
function clipList(x, y, w, h, contentH) {
  listScrollMax = Math.max(0, contentH - h);
  listScroll = clamp(listScroll, 0, listScrollMax);
  LIST_AREA = { x, y, w, h };
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  g_scrollY = listScroll;
  ctx.translate(0, -listScroll);
  if (listScrollMax > 0) {
    const barH = Math.max(18, h * h / contentH);
    const barY = y + (listScroll / listScrollMax) * (h - barH);
    rr(x + w - 5, barY, 3, barH, 2); ctx.fillStyle = 'rgba(60,50,35,.25)'; ctx.fill();
  }
}
function unclip() { g_scrollY = 0; ctx.restore(); }

/* ========== 「墨绿·朱砂」三国羊皮纸主题 v3 ==========
   零依赖纯 Canvas 组件库：更精致的色板 + 渐变 + 光晕 + 纹饰 + 印章。
   所有函数不改布局，只替换绘制，可逐步替换旧 panel/btn。 */
const THEME = {
  bg: '#f2e8d3',              // 羊皮纸背景（略深，增加对比）
  bgWarm: '#f7efe0',          // 暖白背景区
  cardTop: '#fefbf4', cardBot: '#ede0c4',   // 卡片渐变（更通透）
  cardBorder: '#c9b48f',      // 暖棕描边（略深，增加轮廓感）
  cardGold: '#d4b76e',        // 金边（高品质卡片描边）
  ink: '#2a1f12',             // 墨棕主文字（更深沉）
  inkSub: '#8a7a62',          // 辅助文字
  gold: '#b4830a',            // 描金强调
  goldLight: '#d4a828',       // 亮金
  vermilion: ['#c94a3d', '#8b2620'],   // 朱砂红（主按钮，略鲜亮）
  pine: ['#4d7256', '#2c4834'],        // 墨绿（次按钮）
  indigo: ['#3d6284', '#283e56'],      // 玄青（特殊）
  slate: ['#6d7683', '#47505d'],       // 石灰（次要）
  purple: ['#7562a8', '#463670'],      // 紫檀（装备/皮肤）
  gold2: ['#d49a12', '#94700a'],       // 鎏金（招募/心愿）
  jade: ['#5a8a6e', '#3a5e4a'],        // 翡翠绿
  // 品级色（对应白绿蓝紫橙）
  tierWhite: '#b8b0a0', tierGreen: '#3a9a52', tierBlue: '#2a7cc8',
  tierPurple: '#8a4cb8', tierOrange: '#d49010',
};

// 注：渐变按钮/羊皮纸卡片已合并进上方统一的 btn()/panel()，menu 直接用 btn(...{grad})/panel(...)。

// 印章装饰 v3（更精致的朱砂印章：双层描边+内文+立体感）
function seal(x, y, r, char, col) {
  const c = col || '#a03028';
  ctx.save();
  // 外层光晕
  ctx.shadowColor = c; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = c; ctx.fill();
  ctx.restore();
  // 白色外描边
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  // 内层细白线
  ctx.beginPath(); ctx.arc(x, y, r - 3, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.8; ctx.stroke();
  // 内填渐变（增加立体感）
  const sg = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  sg.addColorStop(0, shade(c, 1.25)); sg.addColorStop(1, c);
  ctx.beginPath(); ctx.arc(x, y, r - 1, 0, 7); ctx.fillStyle = sg; ctx.fill();
  // 重绘白描边覆盖渐变
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r - 3, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.8; ctx.stroke();
  // 文字
  ctx.save(); ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 1;
  txt(char, x, y + 1, r * 0.9, '#fff', 'center', true);
  ctx.restore();
}

// 大标题 v3（更深阴影+可选金色描边+左侧印章）
function title(s, x, y, size, opt = {}) {
  ctx.save();
  // 外阴影
  ctx.shadowColor = opt.shadow || 'rgba(60,40,15,.30)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
  // 金色描边效果（解锁彩蛋时）
  if (opt.gold) {
    ctx.strokeStyle = 'rgba(212,168,40,.4)'; ctx.lineWidth = 3;
    ctx.strokeText(s, x, y);
  }
  txt(s, x, y, size, opt.col || THEME.ink, 'center', true);
  ctx.restore();
  if (opt.seal) {
    const key = size + 'b'; let f = _fontCache.get(key);
    if (!f) { f = `bold ${size}px "PingFang SC","Microsoft YaHei",sans-serif`; _fontCache.set(key, f); }
    ctx.font = f;
    const w = ctx.measureText(s).width;
    seal(x - w / 2 - size * 0.85, y - size * 0.05, size * 0.62, opt.seal, opt.sealCol);
  }
}

// 墨边 v3（页面顶部柔和深色渐变条，增加层次+顶部金线）
function inkTop(h = 46) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(60,40,15,.12)'); g.addColorStop(1, 'rgba(60,40,15,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
  // 顶部金线装饰
  ctx.fillStyle = 'rgba(180,140,60,.25)'; ctx.fillRect(0, 0, W, 2);
}

// 分组标题 v3（小字 + 右侧墨线 + 左侧金点）
function groupLabel(label, x, y, w) {
  // 左侧金点
  ctx.fillStyle = 'rgba(180,140,60,.6)';
  ctx.beginPath(); ctx.arc(x - 6, y - 3, 3, 0, 7); ctx.fill();
  txt(label, x, y, 11, THEME.gold, 'left', true);
  const lw = ctx.measureText(label).width;
  // 墨线：渐变+金线双效果
  const lineX = x + lw + 10, lineW = (w || 335) - lw - 10;
  const lg = ctx.createLinearGradient(lineX, 0, lineX + lineW, 0);
  lg.addColorStop(0, 'rgba(180,140,60,.45)'); lg.addColorStop(1, 'rgba(180,140,60,.08)');
  rr(lineX, y - 4, lineW, 1, 0.5); ctx.fillStyle = lg; ctx.fill();
}

/* ---------- 菜单（古典雅致版） ---------- */
function drawMenu() {
  const animT = Date.now() / 1000;
  // 羊皮纸底色
  ctx.fillStyle = THEME.bg; ctx.fillRect(0, 0, W, H);

  // 四角古典云纹装饰（淡雅）
  ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#b08040'; ctx.lineWidth = 1.5;
  // 左上
  ctx.beginPath(); ctx.arc(10, 10, 25, 0, Math.PI/2); ctx.stroke();
  ctx.beginPath(); ctx.arc(10, 10, 18, 0, Math.PI/2); ctx.stroke();
  // 右上
  ctx.beginPath(); ctx.arc(W-10, 10, 25, Math.PI/2, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(W-10, 10, 18, Math.PI/2, Math.PI); ctx.stroke();
  // 左下
  ctx.beginPath(); ctx.arc(10, H-10, 25, -Math.PI/2, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(10, H-10, 18, -Math.PI/2, 0); ctx.stroke();
  // 右下
  ctx.beginPath(); ctx.arc(W-10, H-10, 25, Math.PI, Math.PI*1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(W-10, H-10, 18, Math.PI, Math.PI*1.5); ctx.stroke();
  ctx.restore();

  // 顶部装饰金线
  ctx.fillStyle = 'rgba(180,131,10,.35)'; ctx.fillRect(0, 0, W, 3);
  ctx.fillStyle = 'rgba(212,168,40,.2)'; ctx.fillRect(0, 3, W, 1);
  inkTop(52);

  // 标题区域装饰框
  const titleBoxW = 260, titleBoxH = 72;
  ctx.save();
  ctx.shadowColor = 'rgba(60,40,15,.1)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  rr(W/2 - titleBoxW/2, 30, titleBoxW, titleBoxH, 14);
  const titleG = ctx.createLinearGradient(0, 30, 0, 30 + titleBoxH);
  titleG.addColorStop(0, '#fefbf4'); titleG.addColorStop(1, '#f5ead5');
  ctx.fillStyle = titleG; ctx.fill();
  ctx.restore();
  rr(W/2 - titleBoxW/2, 30, titleBoxW, titleBoxH, 14);
  ctx.strokeStyle = 'rgba(201,180,143,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  // 内描金细线
  rr(W/2 - titleBoxW/2 + 3, 33, titleBoxW - 6, titleBoxH - 6, 12);
  ctx.strokeStyle = 'rgba(212,168,40,.25)'; ctx.lineWidth = 0.8; ctx.stroke();
  // 四角装饰点
  [[40,40],[W-40,40],[40,95],[W-40,95]].forEach(([dx,dy]) => {
    ctx.fillStyle = 'rgba(212,168,40,.4)'; ctx.beginPath(); ctx.arc(dx, dy, 2, 0, 7); ctx.fill();
  });

  // 主标题
  title('赵云与阿斗', W / 2, 68, 34, { col: SAVE.eggs.all ? '#d29a22' : THEME.ink, seal: '赵' });
  txt('文字合成塔防 · 三国古风版', W / 2, 94, 11, THEME.inkSub, 'center');

  // 资源面板（升级：金边+玻璃质感）
  const resW = 260, resH = 38;
  ctx.save();
  ctx.shadowColor = 'rgba(60,40,15,.08)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  rr(W/2 - resW/2, 112, resW, resH, 19);
  const resG = ctx.createLinearGradient(0, 112, 0, 112 + resH);
  resG.addColorStop(0, '#fffdf7'); resG.addColorStop(1, '#f7efe0');
  ctx.fillStyle = resG; ctx.fill();
  ctx.restore();
  rr(W/2 - resW/2, 112, resW, resH, 19);
  ctx.strokeStyle = 'rgba(201,180,143,.65)'; ctx.lineWidth = 1.2; ctx.stroke();
  resChip('金 ' + SAVE.gold, W/2 - resW/2 + 8, 120, '#b0801f');
  resChip('材 ' + SAVE.mat, W/2 + 18, 120, '#1c7ed6');

  // 第一层：开始战斗（主按钮加光晕）
  selStage = clamp(selStage, 1, SAVE.stage);
  // 每日轮换地图（官方版）：进菜单未手动选图时，默认今日地图并高亮
  if (!selMapTouched) selMap = todayMapIdx();
  const ch = CHAPTERS[Math.min(3, ((selStage - 1) / 10) | 0)];
  groupLabel('— 开始战斗 —', 30, 175, 335); panel(20, 183, 335, 145, { corner: true });
  btn(34, 199, 42, 42, '◀', () => selStage--, { disabled: selStage <= 1, grad: THEME.slate, size: 15, r: 12 });
  btn(299, 199, 42, 42, '▶', () => selStage++, { disabled: selStage >= SAVE.stage, grad: THEME.slate, size: 15, r: 12 });
  txt('第 ' + selStage + ' 关 · ' + ch + (selStage % 10 === 0 ? ' · BOSS' : ''), W / 2, 224, 16, THEME.ink, 'center', true);
  MAPS.forEach((m, i) => {
    const isToday = i === todayMapIdx();
    btn(24 + i * 82, 251, 80, 27, m.name + (isToday ? '·今' : ''), () => { selMap = i; selMapTouched = true; }, { size: 11, grad: selMap === i ? THEME.vermilion : THEME.slate, r: 8, glow: selMap === i });
    if (isToday && selMap !== i) { ctx.fillStyle = '#e8a005'; ctx.beginPath(); ctx.arc(30 + i * 82, 255, 2.5, 0, 7); ctx.fill(); }
  });
  const mapEffect = MAPS[selMap].effect;
  if (mapEffect) {
    const today = selMap === todayMapIdx();
    rr(32, 278, 311, 18, 9); ctx.fillStyle = today ? 'rgba(232,160,5,.12)' : 'rgba(90,100,110,.08)'; ctx.fill();
    txtFit((today ? '今日推荐 · ' : '战场机制 · ') + mapEffect.name + ' · ' + mapEffect.tip, W / 2, 291, 8, today ? '#a56f08' : THEME.inkSub, 'center', true, 292);
  }
  btn(30, 298, 150, 26, '画面:' + (SAVE.mapSkin ? '浓墨' : '标准'), () => { SAVE.mapSkin = SAVE.mapSkin ? 0 : 1; saveSave(); }, { size: 10, grad: SAVE.mapSkin ? THEME.vermilion : THEME.slate, r: 8 });
  // 开战主按钮（呼吸光晕）
  const fightGlow = 0.7 + Math.sin(animT * 2.5) * 0.3;
  ctx.save();
  ctx.shadowColor = '#c94a3d'; ctx.shadowBlur = 10 * fightGlow;
  btn(195, 296, 150, 30, '开 战  ▶', () => { startBattle(selStage, false, selMap); goTo('game'); }, { size: 18, grad: THEME.vermilion, r: 9, glow: true });
  ctx.restore();
  btn(30, 348, 154, 30, '特别玩法', () => { goTo('modes'); }, { size: 11, grad: THEME.vermilion, r: 9 });
  btn(191, 348, 154, 30, SAVE.endless ? '无尽挑战 · ' + SAVE.bestWave + '波' : '无尽挑战（30关解锁）', () => { startBattle(STAGE_MAX, true, selMap); goTo('game'); }, { size: 10, grad: THEME.indigo, disabled: !(SAVE.endless || SAVE.endlessOn), r: 9 });

  // 第二层：养成
  groupLabel('— 三国养成 —', 30, 410, 335);
  btn(30, 418, 100, 34, '武将营', () => { goTo('camp'); }, { grad: THEME.purple, size: 12, r: 9 });
  btn(138, 418, 100, 34, '锻造装备', () => { goTo('forge'); forgeMsg = ''; }, { grad: THEME.jade, size: 12, r: 9 });
  btn(246, 418, 99, 34, '道具商店', () => { goTo('shop'); }, { grad: THEME.slate, size: 12, r: 9 });
  btn(30, 458, 154, 30, '军师 · 军令', () => { goTo('command'); }, { size: 11, grad: THEME.purple, r: 9 });
  btn(191, 458, 154, 30, '心愿招募', () => { goTo('wish'); }, { size: 11, grad: THEME.gold2, r: 9, glow: true });

  // 第三层：记录
  groupLabel('— 回忆录 —', 30, 518, 335);
  btn(30, 526, 100, 32, '成就', () => { goTo('ach'); }, { grad: THEME.slate, size: 11, r: 9 });
  btn(138, 526, 100, 32, '录像', () => { goTo('ghost'); ghostMsg = ''; loadGhostList(); }, { grad: THEME.indigo, size: 11, r: 9 });
  btn(246, 526, 99, 32, '存档管理', () => { goTo('save'); saveMsg = ''; }, { grad: THEME.slate, size: 11, r: 9 });
  const canSign = canDaily();
  btn(30, 564, 154, 28, (canSign ? '✓ ' : '') + '每日签到', () => { goTo('daily'); dailyMsg = ''; }, { size: 11, grad: canSign ? THEME.pine : THEME.slate, r: 8, glow: canSign });
  btn(191, 564, 154, 28, '玩法说明', () => { goTo('help'); }, { size: 11, grad: THEME.slate, r: 8 });

  // 底部装饰
  ctx.save(); ctx.globalAlpha = 0.15; ctx.strokeStyle = '#b08040'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, 608); ctx.lineTo(W-30, 608); ctx.stroke();
  ctx.restore();

  // 非核心规则与实验性功能收进实验室
  btn(30, 616, 210, 30, '设置 · 实验室', () => { goTo('lab'); }, { size: 11, grad: THEME.slate, r: 8 });
  btn(246, 616, 99, 30, SAVE.mute ? '🔇 静音' : '🔊 有声', () => { SAVE.mute = !SAVE.mute; saveSave(); }, { size: 10, grad: SAVE.mute ? THEME.slate : THEME.pine, r: 8 });
}


/* ---------- 设置与实验室 ---------- */
function drawLab() {
  screenHeader('设置 · 实验室', '难度与实验规则 · 默认关闭，不影响主线体验', { seal: '设' });
  const DIFF_NAMES = { easy: '简单', normal: '普通', hard: '困难' };
  btn(30, 92, 150, 34, '难度 · ' + (DIFF_NAMES[SAVE.difficulty] || '普通'), () => { const c=['easy','normal','hard']; SAVE.difficulty=c[(c.indexOf(SAVE.difficulty)+1)%3]; saveSave(); }, { size: 12, bg: '#318c4a' });
  btn(195, 92, 150, 34, 'AI · ' + (DIFF_NAMES[SAVE.aiLevel] || '普通'), () => { const c=['easy','normal','hard']; SAVE.aiLevel=c[(c.indexOf(SAVE.aiLevel)+1)%3]; saveSave(); }, { size: 12, bg: '#7250b8' });
  txt('实验规则', 30, 154, 12, '#a48b63', 'left', true);
  const sw=(x,y,label,on,fn)=>btn(x,y,150,32,label+(on?' · 开':' · 关'),fn,{size:11,bg:on?'#318c4a':'#4b5563'});
  sw(30,166,'兵种无敌',SAVE.invincible,()=>{SAVE.invincible=!SAVE.invincible;saveSave();});
  sw(195,166,'动态路径',SAVE.dynPath,()=>{SAVE.dynPath=!SAVE.dynPath;saveSave();});
  sw(30,206,'BOSS阶段',SAVE.bossPhase,()=>{SAVE.bossPhase=!SAVE.bossPhase;saveSave();});
  sw(195,206,'无尽快捷',SAVE.endlessOn,()=>{SAVE.endlessOn=!SAVE.endlessOn;saveSave();});
  sw(30,246,'新橙将',SAVE.newHeros,()=>{SAVE.newHeros=!SAVE.newHeros;saveSave();});
  sw(195,246,'武将觉醒',SAVE.awaken,()=>{SAVE.awaken=!SAVE.awaken;saveSave();});
  sw(30,286,'装备扩展',SAVE.gearOn,()=>{SAVE.gearOn=!SAVE.gearOn;saveSave();});
  sw(195,286,'色弱模式',SAVE.colorblind,()=>{SAVE.colorblind=!SAVE.colorblind;saveSave();});
  sw(30,326,'遗物系统',SAVE.relicsOn,()=>{SAVE.relicsOn=!SAVE.relicsOn;saveSave();});
  sw(30,366,'音乐 BGM',SAVE.music,()=>{SAVE.music=!SAVE.music;saveSave();if(typeof toggleMusic==='function')toggleMusic(SAVE.music);});
  sw(195,366,'手动大招',SAVE.manualUlt,()=>{SAVE.manualUlt=!SAVE.manualUlt;saveSave();if(G&&G.banner)G.banner={txt:'手动大招 '+(SAVE.manualUlt?'开启 · 点「大招」释放武将技能':'关闭 · 技能自动释放'),t:1.6};});
  backBtn();
}

/* ---------- 玩法说明 ---------- */
function drawHelp() {
  screenHeader('玩法说明', '抽卡、合成、布阵与兵种克制', { seal: '策' });
  // 分组：每组首行为标题（带【】），其余为正文；空行/分组线作为视觉间距
  const groups = [
    ['🎯【核心目标】守住阿斗（♥3），打完全部波次即通关；阿斗掉血归零则失败。'],
    ['🎴【抽卡合成】',
     '· 抽卡消耗馒头，得「将字」碎片；将字按正确顺序拖合成武将（赵+云=赵云）。',
     '· 碎片集齐可合成道具；十连有保底。'],
    ['⚔️【布阵作战】',
     '· 把武将/兵种从底部栏拖到棋盘才参战；点荒地花馒头开荒扩格。',
     '· 拖到回收站可换回馒头。',
     '· 兵种相克：盾嘲讽、甲减伤、枪破甲、骑克弩。'],
    ['🔗【羁绊与装备】',
     '· 桃园/五虎/父子等羁绊触发增益；专武在锻造页打造、武将装备页穿戴。',
     '· BOSS 关与章末关掉落材料，用于锻造。'],
    ['⚙️【功能开关】',
     '· 菜单「兵种无敌」可开启（仅玩家作战单位免伤，阿斗仍会掉血）。',
     '· 通关 30 关解锁无尽模式，每 10 波轮换一名历史名将 BOSS。'],
  ];
  let y = 90;
  const leftX = 20, maxW = 335;
  groups.forEach((g, gi) => {
    if (gi > 0) {
      rr(20, y, 335, 1, 1); ctx.fillStyle = '#dee2e6'; ctx.fill();  // 分组线
      y += 8;
    }
    g.forEach((t, ti) => {
      if (ti === 0) y += wrapText(t, leftX, y, 13, '#343a40', maxW, true) + 1;
      else          y += wrapText(t, leftX, y, 12, '#495057', maxW, false);
    });
    y += 4;
  });
  backBtn();
}

/* ---------- 存档管理（多槽 / 手动保存 / 导出导入 / 继续游戏） ---------- */
/* ---------- 心愿单面板（1.2.4，直接生效，仅玩家侧） ---------- */
function drawWish() {
  screenHeader('心愿单', '选择一名橙将，抽卡时该将字出现概率 ×1.5', { seal: '愿' });
  // 状态行：未设置时给红色引导，已设置时显示当前+取消提示（旧实现「全空无引导」问题修复）
  if (!SAVE.wish) {
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#bf3b2d';
    ctx.fillText('👇 点下方任一橙将设为心愿（仅可设1名）', W / 2, 120);
  } else {
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#b8860b';
    ctx.fillText('当前心愿：' + SAVE.wish + '（再点一次可取消）', W / 2, 120);
  }
  const cols = 3, bw = 104, bh = 40, gap = 8, x0 = (W - (cols * bw + (cols - 1) * gap)) / 2, y0 = 150;
  HERO_ORANGE.forEach((id, i) => {
    const cx = x0 + (i % cols) * (bw + gap), cy = y0 + ((i / cols) | 0) * (bh + gap);
    const on = SAVE.wish === id;
    btn(cx, cy, bw, bh, id, () => {
      SAVE.wish = on ? '' : id;          // 再次点击取消
      saveSave();
    }, { bg: on ? '#ffe3a3' : '#fff', fg: on ? '#b8860b' : '#333' });
  });
  backBtn();
}
function drawSave() {
  screenHeader('存档管理', '当前进度：' + fmtSaved(), { seal: '档' });
  // 资源条：4 个 resChip 一行（与战斗顶栏统一风格）
  resChip('金 ' + SAVE.gold, 18, 94, '#b0801f');
  resChip('关 ' + SAVE.stage, 102, 94, '#1c7ed6');
  resChip('武 ' + SAVE.weapons.length, 186, 94, '#5f3dc4');
  resChip('材 ' + SAVE.mat, 270, 94, '#8b5e3c');
  // 三槽切换
  for (let n = 0; n < 3; n++) {
    const x = 30 + n * 112;
    btn(x, 116, 100, 30, (n + 1) + '号槽' + (n === curSlot ? ' ✓' : ''),
      () => { switchSlot(n); selStage = SAVE.stage; saveMsg = ''; saveConfirm = false; },
      { size: 12, bg: n === curSlot ? '#2f9e44' : '#868e96' });
    txt(slotMeta(n), x + 50, 158, 9, '#adb5bd', 'center');
  }
  // 手动保存 / 清除
  btn(30, 176, 150, 34, '手动保存', () => { manualSave(); selStage = SAVE.stage; saveMsg = '已保存 ✓'; saveConfirm = false; }, { bg: '#2f9e44', size: 13 });
  if (!saveConfirm) {
    btn(195, 176, 150, 34, '清除本槽', () => { saveConfirm = true; saveMsg = ''; }, { bg: '#e03131', size: 13 });
  } else {
    txt('确定清除当前槽？不可撤销', W / 2, 232, 12, '#e03131', 'center');
    btn(80, 244, 90, 32, '取消', () => { saveConfirm = false; }, { bg: '#868e96', size: 12 });
    btn(205, 244, 90, 32, '确认清除', () => { clearSave(); G = null; selStage = 1; saveConfirm = false; saveMsg = '已清除并重置'; goTo('menu'); }, { bg: '#e03131', size: 12 });
  }
  // 继续游戏 / 导出 / 导入
  btn(30, 300, 150, 34, '继续游戏', () => { startBattle(SAVE.stage, SAVE.endless, selMap); goTo('game'); }, { bg: '#1c7ed6', size: 13 });
  btn(195, 300, 150, 34, '存到目录', () => {
    const s = exportSave();
    // 服务仅绑定 127.0.0.1，本机直连即可写盘（已去掉一次性 token 机制）
    fetch('/api/save?slot=' + curSlot, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: s
    }).then(r => r.json()).then(j => { saveMsg = j.ok ? '已存到项目目录 ✓' : '保存失败：' + (j.error || ''); })
      .catch(() => { saveMsg = '保存失败：服务未连接'; });
  }, { bg: '#495057', size: 13 });
  btn(30, 344, 150, 34, '导入存档', () => {
    fetch('/api/load?slot=' + curSlot).then(r => r.json()).then(j => {
      if (j && j.empty) { saveMsg = '目录无该槽存档'; return; }
      if (j && importSave(JSON.stringify(j))) { saveMsg = '已从目录导入 ✓'; }
      else saveMsg = '导入失败：格式错误';
    }).catch(() => {
      const s = (typeof prompt === 'function') ? prompt('粘贴存档 JSON：') : null;
      if (s != null) saveMsg = importSave(s) ? '导入成功 ✓' : '导入失败：格式错误';
    });
  }, { bg: '#495057', size: 13 });
  if (saveMsg) txt(saveMsg, W / 2, 408, 13, saveMsg.includes('失败') ? '#e03131' : '#2f9e44', 'center', true);
  backBtn();
}

/* ---------- P1-4 录像管理：本地列表 + 共享上传/下载 + 回放挑战 ---------- */
function loadGhostList() {
  // 本地：SAVE.ghosts；远程：GET /api/ghost（可能失败，失败时静默）
  ghostList = (Array.isArray(SAVE.ghosts) ? SAVE.ghosts : []).map((g, i) =>
    ({ src: 'local', idx: i, stage: g.stage, diff: g.diff, ai: g.ai, ops: (g.ops || []).length, result: g.result }));
  fetch('/api/ghost').then(r => r.json()).then(j => {
    if (j && Array.isArray(j.list)) {
      j.list.forEach(g => ghostList.push({ src: 'remote', id: g.id, stage: g.stage, diff: g.diff, ai: g.ai, ops: g.ops, result: g.result }));
    }
  }).catch(() => { /* 离线/服务未起 */ });
}
function startGhostPlayback(rec) {
  if (!rec || !rec.ops || !rec.ops.length) { ghostMsg = '录像为空'; return; }
  startBattle(rec.stage || 1, false, 0, rec);
  goTo('game');
}
function uploadGhost(rec) {
  // 服务仅绑定 127.0.0.1，本机直连即可上传（已去掉一次性 token 机制）
  fetch('/api/ghost', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec)
  }).then(r => r.json()).then(j => { ghostMsg = j.ok ? '已上传到共享池 ✓' : '上传失败：' + (j.error || ''); })
    .catch(() => { ghostMsg = '上传失败：服务未连接'; });
}
function downloadGhost(id) {
  fetch('/api/ghost?id=' + encodeURIComponent(id)).then(r => r.json()).then(rec => {
    if (!rec || !rec.ops) { ghostMsg = '下载失败：格式错误'; return; }
    if (!Array.isArray(SAVE.ghosts)) SAVE.ghosts = [];
    SAVE.ghosts.push(rec); saveSave();
    ghostMsg = '已下载到本地录像 ✓'; loadGhostList();
  }).catch(() => { ghostMsg = '下载失败：服务未连接'; });
}
function drawGhost() {
  screenHeader('对战录像', '本地 ' + (Array.isArray(SAVE.ghosts) ? SAVE.ghosts.length : 0) + ' 条 / 共享 ' + ghostList.filter(g => g.src === 'remote').length + ' 条', { seal: '录' });
  txt('点击录像进入回放（自动重现玩家操作）', W / 2, 92, 10, '#adb5bd', 'center');
  // 上传按钮：上传本地最新一条到共享池
  btn(20, 96, 162, 28, '上传最新到共享', () => {
    const arr = Array.isArray(SAVE.ghosts) ? SAVE.ghosts : [];
    if (!arr.length) { ghostMsg = '本地暂无录像'; return; }
    uploadGhost(arr[0]);
  }, { size: 12, bg: '#2f9e44' });
  // 刷新列表
  btn(195, 96, 162, 28, '刷新共享列表', () => { loadGhostList(); ghostMsg = '已刷新'; }, { size: 12, bg: '#495057' });
  // 列表（按关卡降序、步数升序排名，命令行首显示名次）
  if (!ghostList.length) txt('暂无录像（胜利后自动保存）', W / 2, 160, 12, '#adb5bd', 'center');
  const DIFF_NAMES = { easy: '简单', normal: '普通', hard: '困难' };
  const ranked = ghostList.slice().sort((a, b) => (b.stage - a.stage) || (a.ops - b.ops) || ((b.result === 'win') - (a.result === 'win')));
  // 复用 clipList 滚动与截断（与 equip/roster 一致），列表过长可滚动、底部预留不压返回键
  clipList(14, 120, 347, 456, 130 + ranked.length * 30);
  ranked.forEach((g, i) => {
    const y = 130 + i * 30;
    const isLocal = g.src === 'local';
    rr(14, y, 347, 26, 5); ctx.fillStyle = isLocal ? '#f8f9fa' : '#f1f8ff'; ctx.fill();
    ctx.strokeStyle = '#dee2e6'; ctx.stroke();
    txt('#' + (i + 1), 20, y + 17, 11, '#b78324', 'left', true);
    txt((isLocal ? '本' : '享') + '·第' + g.stage + '关', 40, y + 17, 11, isLocal ? '#343a40' : '#1c7ed6', 'left', true);
    txt((DIFF_NAMES[g.diff] || '普') + '/' + (DIFF_NAMES[g.ai] || '普'), 118, y + 17, 10, '#868e96');
    txt(g.ops + '步', 175, y + 17, 10, '#495057');
    txt(g.result === 'win' ? '胜' : '—', 205, y + 17, 11, '#2f9e44', 'center', true);
    if (isLocal) btn(220, y + 3, 60, 20, '回放', () => startGhostPlayback(SAVE.ghosts[g.idx]), { size: 10, bg: '#1c7ed6' });
    else btn(220, y + 3, 60, 20, '下载', () => downloadGhost(g.id), { size: 10, bg: '#5f3dc4' });
    if (isLocal) btn(285, y + 3, 70, 20, '上传共享', () => uploadGhost(SAVE.ghosts[g.idx]), { size: 10, bg: '#2f9e44' });
  });
  unclip();
  if (ghostMsg) txt(ghostMsg, W / 2, 580, 12, ghostMsg.includes('失败') ? '#e03131' : '#2f9e44', 'center', true);
  backBtn();
}

/* ---------- P2-2 数据统计面板 + P2-1 皮肤总览 ---------- */
function fmtTime(s) {
  s = Math.floor(s || 0);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm' + (s % 60 ? ' ' + (s % 60) + 's' : '');
  return Math.floor(s / 3600) + 'h' + Math.floor((s % 3600) / 60) + 'm';
}
function drawStats() {
  screenHeader('战绩档案', '胜负、击杀、合成与皮肤收集进度', { seal: '战' });
  const st = SAVE.stats || {};
  // 上半：核心数据 2 列
  const rows = [
    ['胜场', st.wins || 0, '#2f9e44'],
    ['败场', st.losses || 0, '#e03131'],
    ['胜率', (st.wins + st.losses > 0) ? Math.round(st.wins / (st.wins + st.losses) * 100) + '%' : '—', '#495057'],
    ['累计击杀', st.kills || 0, '#c0392b'],
    ['累计抽卡', st.summons || 0, '#8b5e3c'],
    ['累计合成', st.merges || 0, '#1c7ed6'],
    ['合成武将', st.heroes || 0, '#9c36b5'],
    ['累计金币', (st.goldEarned || 0), '#b0801f'],
    ['游戏时长', fmtTime(st.playTime), '#495057'],
    ['最高关卡', '第 ' + (st.maxStage || 1) + ' 关', '#1c7ed6'],
    ['最高无尽', (st.maxEndlessWave || 0) + ' 波', '#5f3dc4'],
    ['最高连签', (st.dailyStreakMax || 0) + ' 天', '#2f9e44'],
  ];
  rows.forEach((r, i) => {
    const col = i % 2, row = (i / 2) | 0;
    const x = 20 + col * 175, y = 96 + row * 32;
    rr(x, y, 168, 28, 5); ctx.fillStyle = '#f8f9fa'; ctx.fill();
    ctx.strokeStyle = '#dee2e6'; ctx.lineWidth = 1; ctx.stroke();
    txt(r[0], x + 8, y + 18, 11, '#868e96', 'left');
    txt(String(r[1]), x + 160, y + 18, 13, r[2], 'right', true);
  });
  // 下半：皮肤解锁总览
  txt('皮肤图鉴', W / 2, 312, 16, '#343a40', 'center', true);
  let unlocked = 0, total = 0;
  HERO_LIST.forEach((name) => {
    if (typeof heroSkins !== 'function') return;
    const skins = heroSkins(name);
    total += skins.length;
    unlocked += skins.filter(s => checkSkinUnlock(name, s.cond)).length;
  });
  txt('已解锁 ' + unlocked + '/' + total + ' (' + Math.round(unlocked / total * 100) + '%)', W / 2, 332, 12, '#2f9e44', 'center', true);
  // 各武将当前皮肤快速预览
  HERO_LIST.forEach((name, i) => {
    const col = i % 3, row = (i / 3) | 0;
    const x = 20 + col * 115, y = 348 + row * 32;
    rr(x, y, 110, 28, 5); ctx.fillStyle = '#f8f9fa'; ctx.fill();
    const sk = (typeof currentSkin === 'function') ? currentSkin(name) : null;
    const col2 = (sk && sk.col) ? sk.col : (HEROES[name].grade === 4 ? '#e8a005' : '#9c36b5');
    txt(name, x + 8, y + 18, 12, col2, 'left', true);
    txt(sk ? sk.name : '常服', x + 102, y + 18, 10, '#868e96', 'right');
  });
  backBtn();
}

/* ---------- 商店（购买 + 携带 ≤6，主动 ≤2） ---------- */
function drawShop() {
  screenHeader('道具商店', '', { seal: '商' });
  // 资源条：与战斗顶栏 resChip 风格统一
  resChip('金 ' + SAVE.gold, 60, 58, '#b0801f');
  resChip('携 ' + SAVE.loadout.length + '/' + LOADOUT_MAX, 220, 58, '#5f3dc4');
  txt('主动道具上限 ' + LOADOUT_ACT_MAX + ' · 被动不限', W / 2, 82, 9, '#8a7e6c', 'center');
  Object.keys(ITEMS).forEach((id, i) => {
    const it = ITEMS[id], y = 88 + i * 38;
    const owned = SAVE.itemsOwned[id], on = SAVE.loadout.includes(id);
    rr(14, y, 347, 36, 6); ctx.fillStyle = on ? '#fff9db' : '#f8f9fa'; ctx.fill();
    ctx.strokeStyle = on ? '#e8a005' : '#dee2e6'; ctx.lineWidth = 1; ctx.stroke();
    txt(it.name, 24, y + 16, 14, it.act ? '#c0392b' : '#2f9e44', 'left', true);
    txt(it.act ? '主动×' + it.uses : '被动', 24, y + 30, 9, '#adb5bd');
    txtFit(it.tip, 92, y + 23, 11, '#495057', 'left', false, 190);   // 小屏密度兜底（#9）：超宽自动缩字号至 8px
    btn(288, y + 5, 64, 26, owned ? (on ? '携带中' : '携带') : it.price + '金',
      () => { owned ? toggleLoadout(id) : buyItem(id); },
      { size: 11, bg: owned ? (on ? '#e8a005' : '#868e96') : '#8b5e3c', disabled: !owned && SAVE.gold < it.price });
  });
  backBtn();
}

/* ---------- 锻造 ---------- */
function drawForge() {
  screenHeader('锻造装备', '', { seal: '铸' });
  // 资源条：与战斗顶栏 resChip 风格统一（Phase 0 #32 资源图标化）
  resChip('金 ' + SAVE.gold, 60, 58, '#b0801f');
  resChip('材 ' + SAVE.mat, 220, 58, '#1c7ed6');
  txt('BOSS与章末关掉落材料', W / 2, 80, 9, '#8a7e6c', 'center');
  btn(88, 86, 200, 40, '锻造  ' + FORGE_COST.gold + '金 + ' + FORGE_COST.mat + '材料', () => {
    const r = forge();
    forgeMsg = !r ? '资源不足!' : (r.dup ? '重复·' + WEAPONS[r.id].name + ' 转 30 金' : '获得 ' + Q_NAME[WEAPONS[r.id].q] + '·' + WEAPONS[r.id].name + '!');
  }, { size: 15, bg: '#1c7ed6', disabled: SAVE.gold < FORGE_COST.gold || SAVE.mat < FORGE_COST.mat });
  if (forgeMsg) txt(forgeMsg, W / 2, 134, 13, '#e8a005', 'center', true);
  // 锻造选系：定向该武器系，降低随机挫败（再点已选系可取消回到随机）
  const _fs = ['', '枪', '刀', '弓', '剑'], _fl = ['随机', '枪系', '刀系', '弓系', '剑系'];
  _fs.forEach((s, i) => btn(14 + i * 70, 142, 66, 26, _fl[i], () => { SAVE.forgeSeries = (SAVE.forgeSeries === s ? '' : s); saveSave(); },
    { size: 10, bg: SAVE.forgeSeries === s ? '#e8a005' : '#868e96' }));
  if (SAVE.forgeDupStreak >= 3) txt('保底进度 ' + SAVE.forgeDupStreak + '/5：连续重复将必出新武器', W / 2, 182, 9, '#bd4a31', 'center');
  txt('武器仓（' + SAVE.weapons.length + '/' + Object.keys(WEAPONS).length + '）：', 20, 200, 12, '#495057', 'left', true);
  SAVE.weapons.forEach((id, i) => {
    const w = WEAPONS[id], y = 216 + i * 24;
    txt(Q_NAME[w.q] + '·' + w.name + (w.lock ? '〔' + w.lock + '专属〕' : '〔' + w.wq + '系〕'), 24, y + 14, 12, Q_COL[w.q], 'left', true);
    txtFit(w.tip, 200, y + 14, 10, '#868e96', 'left', false, 118);   // 小屏密度兜底（#9）
    const sp = WEAPON_SELL[w.q];                        // 官方版：蓝/紫可出售（橙与专属不可）
    if (sp) btn(326, y - 2, 36, 20, '售' + sp, () => {
      const got = sellWeapon(id);
      forgeMsg = got ? '出售 ' + w.name + ' +' + got + ' 金' : '不可出售';
    }, { size: 8, bg: '#8e98a3' });
  });
  txt('武器给对应「系」武将穿戴：加攻击/射程，专武带特效；蓝/紫可出售', W / 2, 588, 10, '#8a7e6c', 'center');
  btn(30, 604, 210, 34, '→ 去武将装备穿戴', () => { goTo('equip'); }, { grad: THEME.purple, size: 12 });
  backBtn();
}

/* ---------- 武将装备（点武将轮换武器 + P2-1 皮肤切换） ---------- */
function drawEquip() {
  screenHeader('武将装备', '点击武将切换武器 · 右侧切换皮肤', { seal: '武' });
  const rowH = 42, top = 82, listH = 512;
  clipList(14, top, 347, listH, top + HERO_LIST.length * rowH);
  HERO_LIST.forEach((name, i) => {
    const h = HEROES[name], y = top + i * rowH;
    const eq = SAVE.equips[name];
    // 左侧：武器切换（14-258）
    btn(14, y, 244, 36, '', () => cycleEquip(name), { bg: '#f8f9fa' });
    rr(14, y, 244, 36, 6); ctx.fillStyle = '#f8f9fa'; ctx.fill();
    ctx.strokeStyle = '#dee2e6'; ctx.stroke();
    // 武将名颜色按皮肤显示
    const sk = (typeof currentSkin === 'function') ? currentSkin(name) : null;
    const nameCol = (sk && sk.col) ? sk.col : (h.grade === 4 ? '#e8a005' : '#9c36b5');
    txt(name + (sk && sk.decor && sk.decor !== 'none' ? ' ' + ((typeof SKIN_DECOR !== 'undefined' && SKIN_DECOR[sk.decor]) || '★') : ''),
      24, y + 23, 15, nameCol, 'left', true);
    txtFit(h.wq + '系 · ' + h.tip, 80, y + 15, 10, '#868e96', 'left', false, 176);   // 小屏密度兜底（#9）
    txt(eq ? Q_NAME[WEAPONS[eq].q] + '·' + WEAPONS[eq].name : (weaponsFor(name).length ? '未装备(点击穿戴)' : '无' + h.wq + '系武器·去锻造'),
      80, y + 30, 11, eq ? Q_COL[WEAPONS[eq].q] : '#adb5bd', 'left', !!eq);
    txt('⇄', 246, y + 18, 14, '#c0c6cc', 'center');   // 可点循环换装的手势提示（旧版行是隐形按钮，玩家想不到点）
    // 右侧：皮肤按钮（262-360）
    const skinBtn = (typeof currentSkin === 'function') ? currentSkin(name) : null;
    const skinLabel = skinBtn ? skinBtn.name : '皮肤';
    btn(262, y, 99, 36, '肤·' + skinLabel, () => {
      if (typeof cycleSkin !== 'function') return;
      const next = cycleSkin(name);
      if (next && typeof sfx === 'function') sfx('click');
    }, { size: 10, bg: (skinBtn && skinBtn.col) ? skinBtn.col : '#5f3dc4' });
  });
  unclip();
  btn(30, 604, 154, 34, '← 去锻造', () => { goTo('forge'); forgeMsg = ''; }, { grad: THEME.indigo });
  backBtn();
}

/* ---------- 武将营：永久招募、心愿与主将选择 ---------- */
let campMsg = '';
function drawCamp() {
  screenHeader('武将营', '碎片招募 · 20 碎片解锁 · 每局携带 1 名主将', { seal: '将', size: 24 });
  const lead = SAVE.leadHero || '未选择';
  panel(20, 84, 335, 42, { bg: '#fff9ed', stroke: '#ead7ad', r: 10, blur: 4 });
  txt('当前主将：' + lead + (SAVE.ownedHeroes[lead] ? '  ★' + heroStar(lead) : ''), 32, 109, 14, '#b78324', 'left', true);
  txt('心愿：' + (SAVE.heroWish || '未设置'), 340, 109, 11, '#8a7e6c', 'right');
  HERO_LIST.forEach((name, i) => {
    const col = i % 2, row = (i / 2) | 0;
    const x = 18 + col * 171, y = 136 + row * 48;
    const own = !!SAVE.ownedHeroes[name], star = heroStar(name), n = shardCount(name);
    rr(x, y, 168, 42, 8); ctx.fillStyle = own ? '#fffdf9' : '#f0ece4'; ctx.fill(); ctx.strokeStyle = own ? '#dfc98d' : '#ded8ce'; ctx.stroke();
    const c = HEROES[name].grade === 4 ? '#b78324' : '#8050a0';
    txt(name, x + 10, y + 18, 14, own ? c : '#8f969c', 'left', true);
    txt(own ? '★'.repeat(star) : n + '/' + HERO_UNLOCK_SHARDS + '碎片', x + 10, y + 33, 9, own ? '#b78324' : '#8f969c');
    if (own) {
      btn(x + 88, y + 7, 34, 27, SAVE.leadHero === name ? '出战' : '携带', () => { setLeadHero(name); campMsg = '已选择 ' + name + ' 为主将'; }, { size: 9, bg: SAVE.leadHero === name ? '#318c4a' : '#7250b8' });
      const need = HERO_STAR_COST[star + 1];
      btn(x + 126, y + 7, 34, 27, need ? '升星' : '满星', () => { campMsg = upgradeHeroStar(name) ? name + ' 升至 ★' + heroStar(name) : '碎片不足（需要 ' + (need || 0) + '）'; }, { size: 8, bg: need ? '#b78324' : '#9099a1', disabled: !need });
    } else btn(x + 110, y + 7, 48, 27, SAVE.heroWish === name ? '心愿中' : '设心愿', () => { SAVE.heroWish = SAVE.heroWish === name ? '' : name; saveSave(); campMsg = SAVE.heroWish ? '已设定心愿：' + name : '已取消心愿'; }, { size: 9, bg: SAVE.heroWish === name ? '#bd4a31' : '#7c8792' });
  });
  if (campMsg) txt(campMsg, W / 2, 578, 11, campMsg.includes('不足') ? '#bd4a31' : '#318c4a', 'center', true);
  backBtn();
}


function drawCommand() {
  screenHeader('军师与军令', '选择军师后，下局战斗立即生效', { seal: '令' });
  Object.entries(ADVISERS).forEach(([id, a], i) => {
    const y = 96 + i * 70, on = SAVE.adviser === id;
    panel(20, y, 335, 58, { bg: on ? '#fff8e8' : '#fffdf9', stroke: on ? a.col : '#e5ddd0', r: 10, blur: 3 });
    txt(a.name, 34, y + 24, 16, a.col, 'left', true); txt(a.tip, 34, y + 43, 10, '#656d76', 'left');
    btn(282, y + 15, 58, 28, on ? '已选择' : '选择', () => { SAVE.adviser = id; saveSave(); }, { size: 10, bg: on ? '#318c4a' : a.col });
  });
  panel(20, 326, 335, 126, { bg: '#f8f5ef', stroke: '#e5ddd0', r: 10, blur: 2 });
  txt('局内军令', 34, 352, 15, '#2f3540', 'left', true);
  txt('每局随机两条军令；达成后即时获得馒头奖励。', 34, 374, 10, '#656d76', 'left');
  ORDERS.forEach((o, i) => txt('· ' + o.name + '：' + o.desc + '（+' + o.reward + '馒）', 36, 398 + i * 18, 11, '#7250b8', 'left'));
  backBtn();
}

function drawRoster() {
  screenHeader('群英谱', '征战记录 · 英雄挑战 · 皮肤图鉴', { seal: '谱', size: 24 });
  txt('前6位英雄有4套专属皮肤，其余2套通用', W / 2, 88, 9, '#90949a', 'center');
  var rowH = 44, top = 100, listH = 488;   // 18 英雄超屏→可滚动（与 equip 同款 clipList），否则末行皮肤钮撞返回键
  clipList(20, top, 335, listH, top + HERO_LIST.length * rowH);
  HERO_LIST.forEach(function(name, i) {
    var rec = typeof heroRecord === 'function' ? heroRecord(name) : { kills: 0, deployments: 0, wins: 0 };
    var y = top + i * rowH, own = SAVE.ownedHeroes[name], star = heroStar ? heroStar(name) : 0;
    panel(20, y, 335, 38, { bg: own ? '#fffdf9' : '#f0ece4', stroke: own ? '#dfc98d' : '#ded8ce', r: 8, blur: 2 });
    var c = HEROES[name].grade === 4 ? '#b78324' : '#8050a0';
    txt(name, 32, y + 17, 14, own ? c : '#8f969c', 'left', true);
    txt('杀 ' + rec.kills + '  出 ' + rec.deployments + '  ' + (own ? '★' + star : '未拥有'), 32, y + 32, 9, '#656d76');
    var ch = typeof heroChallenges === 'function' ? heroChallenges().find(function(x) { return x.hero === name; }) : null;
    // 皮肤切换按钮：群英谱内直接预览、切换已解锁皮肤
    if (typeof heroSkins === 'function' && typeof currentSkin === 'function') {
      var curSkin = currentSkin(name);
      var skiName = curSkin ? curSkin.name : '未知';
      btn(185, y + 9, 48, 26, '肤', function() {
        if (typeof cycleSkin !== 'function') return;
        var next = cycleSkin(name);
        if (next && typeof sfx === 'function') sfx('click');
      }, { size: 10, bg: curSkin && curSkin.col ? curSkin.col : '#7c8792' });
      // 有挑战的英雄右侧让给挑战文字（避免与肤按钮重叠）；无挑战的显示当前皮肤名
      if (!ch) txt('当前:' + skiName, 240, y + 26, 9, curSkin && curSkin.col ? curSkin.col : '#8a7e6c');
    }
    if (ch) {
      // 挑战文字移到肤按钮右侧（旧版在 x=185 与肤按钮同位，文字压在按钮上）
      txt(ch.desc, 240, y + 14, 8, SAVE.heroChallenges[name] ? '#318c4a' : '#868e96');
      txt(SAVE.heroChallenges[name] ? '✓ 已完成' : '未完成', 240, y + 30, 9, SAVE.heroChallenges[name] ? '#318c4a' : '#a48b63', 'left', true);
    }
  });
  unclip();
  backBtn();
}

function drawModes() {
  screenHeader('特别玩法', '改变胜利目标 · 每种玩法都有独特战术', { seal: '战', size: 25 });
  // 列表独立裁剪并预留底部返回键区域，避免最后一项与返回按钮重叠
  const top = 90, listH = Math.max(260, H - 180);
  clipList(20, top, 335, listH, top + SPECIAL_MODES.length * 86);
  SPECIAL_MODES.forEach((m, i) => {
    const y = top + i * 86, open = modeUnlocked(m);
    panel(20, y, 335, 78, { bg: open ? '#fffdf9' : '#eee9df', stroke: open ? '#e7dccb' : '#ddd5c7', r: 11, blur: 5 });
    txt(m.icon, 45, y + 48, 25, m.col, 'center', true);
    txt(m.name, 72, y + 30, 16, open ? '#2f3540' : '#9ca3aa', 'left', true);
    txt(m.sub, 72, y + 51, 11, open ? '#777d84' : '#a6a9ac', 'left');
    btn(268, y + 22, 70, 33, open ? '进入' : '第' + m.unlock + '关解锁', () => { if (open) startSpecialMode(m.id); }, { size: open ? 12 : 9, bg: open ? m.col : '#aab0b6', disabled: !open });
  });
  unclip();
  backBtn();
}


function draw() {
  const dpr = (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  ctx.setTransform(scaleF * dpr, 0, 0, scaleF * dpr, 0, 0);
  const paper = ctx.createLinearGradient(0, 0, 0, H);
  paper.addColorStop(0, '#f7f0e3'); paper.addColorStop(0.52, '#f2e8d3'); paper.addColorStop(1, '#e9dcc4');
  ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.055; ctx.strokeStyle = '#9b7b4d'; ctx.lineWidth = 1;
  for (let y = 12; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 3); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#c7a96b'; ctx.fillRect(0, 0, W, 3);
  btns = [];
  if (scr !== _lastScr) {                       // 切屏：进场淡入 + 滚动复位 + 清除残留按压态
    _lastScr = scr; _wipe = 0.3; listScroll = 0; scrollDrag = null;
    g_ptrDown = false; g_ptrHit = null;
  }
  if (scr === 'menu') drawMenu();
  else if (scr === 'shop') drawShop();
  else if (scr === 'forge') drawForge();
  else if (scr === 'equip') drawEquip();
  else if (scr === 'camp') drawCamp();
  else if (scr === 'help') drawHelp();
  else if (scr === 'save') drawSave();
  else if (scr === 'wish') drawWish();
  else if (scr === 'ach') drawAch();
  else if (scr === 'daily') drawDaily();
  else if (scr === 'ghost') drawGhost();
  else if (scr === 'stats') drawStats();
  else if (scr === 'command') drawCommand();
  else if (scr === 'lab') drawLab();
  else if (scr === 'roster') drawRoster();
  else if (scr === 'modes') drawModes();
  else drawGame();
  // 出场淡出（goTo 触发）：在当前屏之上叠一层遮罩，透明→不透明，完成后再切屏触发进场
  if (_wipeOut > 0) {
    const p = _wipeOut / 0.22;                     // 1→0
    ctx.globalAlpha = 1 - p;                       // 0→1 覆盖度
    ctx.fillStyle = '#f3eee3'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    _wipeOut = Math.max(0, _wipeOut - DT60);
    if (_wipeOut === 0 && _pendingScr) { scr = _pendingScr; _pendingScr = null; _lastScr = ''; }  // 强制下一帧进场
    return;                                        // 本帧只渲染旧屏 + 出场遮罩
  }
  // 过场淡入：新画面从背景色渐显（不抖 UI）
  if (_wipe > 0) {
    _wipe = Math.max(0, _wipe - DT60);
    ctx.globalAlpha = (_wipe / 0.3) * 0.85; ctx.fillStyle = '#f3eee3'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
}

/* ---------- 成就面板（P1-1） ---------- */
let achMsg = '';
let achMsgT = 0;
function drawAch() {
  screenHeader('成就', '完成挑战，领取金钱与材料奖励', { seal: '成' });
  // 检查一次成就（玩家进入页面时实时同步）
  const newly = checkAchievements();
  if (newly.length > 0) {
    achMsg = '解锁 ' + newly.length + ' 个成就！奖励已发放';
    achMsgT = 3;
  }
  if (achMsgT > 0) {
    achMsgT -= DT60;
    txt(achMsg, W / 2, 88, 12, '#e8a005', 'center', true);
  } else {
    const done = ACHIEVEMENTS.filter(a => SAVE.ach[a.id]).length;
    txt('已解锁 ' + done + '/' + ACHIEVEMENTS.length, W / 2, 88, 12, '#868e96', 'center');
  }
  const startY = 102, rowH = 33, listH = 498;
  clipList(14, startY, 347, listH, startY + ACHIEVEMENTS.length * rowH);  // 长列表滚动，底部预留不压返回键
  ACHIEVEMENTS.forEach((a, i) => {
    const y = startY + i * rowH, on = !!SAVE.ach[a.id];
    rr(14, y, 347, 30, 6);
    ctx.fillStyle = on ? '#fff9db' : '#f8f9fa'; ctx.fill();
    ctx.strokeStyle = on ? '#e8a005' : '#dee2e6'; ctx.lineWidth = 1; ctx.stroke();
    txt(on ? '✓' : '·', 24, y + 20, 16, on ? '#2f9e44' : '#adb5bd', 'center', true);
    txt(a.name, 42, y + 14, 13, on ? '#e8a005' : '#495057', 'left', true);
    txt(a.desc, 42, y + 26, 9, '#868e96', 'left');
    const r = (a.reward.gold ? '+' + a.reward.gold + '金' : '') + (a.reward.mat ? ' +' + a.reward.mat + '材' : '');
    txt(r, 355, y + 20, 10, '#b0801f', 'right', true);
  });
  unclip();
  backBtn();
}

/* ---------- 每日签到面板（P1-2） ---------- */
let dailyMsg = '';
function drawDaily() {
  screenHeader('每日签到', '连续签到 ' + SAVE.dailyStreak + ' 天 · 今日：' + todayStr(), { seal: '签' });
  // 7 格签到条
  const bw = 44, gap = 6, total = 7 * bw + 6 * gap;
  const x0 = (W - total) / 2, y0 = 120;
  for (let i = 0; i < 7; i++) {
    const x = x0 + i * (bw + gap), day = i + 1;
    const cur = (SAVE.dailyStreak - 1) % 7 + 1;
    const totalSigned = SAVE.lastDaily === todayStr() ? SAVE.dailyStreak : (SAVE.dailyStreak > 0 && SAVE.lastDaily === yestStr() ? SAVE.dailyStreak : 0);
    const showSigned = Math.min(totalSigned, 7);
    const signed = i < showSigned;
    rr(x, y0, bw, 64, 6);
    ctx.fillStyle = signed ? '#fff9db' : '#f8f9fa'; ctx.fill();
    ctx.strokeStyle = i === 6 ? '#e8a005' : '#dee2e6'; ctx.lineWidth = i === 6 ? 2 : 1; ctx.stroke();
    txt('D' + day, x + bw / 2, y0 + 14, 11, i === 6 ? '#e8a005' : '#868e96', 'center', true);
    const r = DAILY_REWARDS[i];
    txt(r.gold + '金', x + bw / 2, y0 + 30, 10, '#b0801f', 'center');
    if (r.mat) txt('+' + r.mat + '材', x + bw / 2, y0 + 44, 9, '#1c7ed6', 'center');
    if (i === 6) txt('大奖', x + bw / 2, y0 + 56, 8, '#e03131', 'center', true);
    if (signed) { ctx.globalAlpha = 0.5; txt('✓', x + bw / 2, y0 + 38, 22, '#2f9e44', 'center', true); ctx.globalAlpha = 1; }
  }
  // 签到按钮
  const can = canDaily();
  btn(88, 220, 200, 44, can ? '今日签到' : '今日已签到', () => {
    if (!can) { dailyMsg = '今日已签到，明日再来'; return; }
    const r = doDaily();
    dailyMsg = '签到成功 D' + r.idx + ' · ' + r.label + (r.weapon ? ' + 武器 ' + WEAPONS[r.weapon].name + '!' : '');
    checkAchievements();
  }, { size: 16, bg: can ? '#2f9e44' : '#868e96', disabled: !can });
  if (dailyMsg) txt(dailyMsg, W / 2, 282, 12, dailyMsg.includes('成功') ? '#2f9e44' : '#e03131', 'center', true);
  txt('提示：连续签到 7 日可获得额外武器奖励', W / 2, 308, 11, '#868e96', 'center');
  backBtn();
}

/* ---------- 输入 ---------- */
function boardAt(p) {
  for (let i = 0; i < G.P.cells.length; i++) {
    const c = G.P.cells[i];
    if (Math.abs(p.x - c.x) <= CELL / 2 && Math.abs(p.y - c.y) <= CELL / 2) return i;
  }
  return -1;
}
function barAt(p) {
  for (let i = 0; i < G.P.bar.length; i++) {
    const s = G.P.bar[i];
    if (Math.abs(p.x - s.x) <= CELL / 2 && Math.abs(p.y - s.y) <= CELL / 2) return i;
  }
  return -1;
}
function onDown(p) {
  g_ptrDown = true; g_ptrHit = null;                       // 每帧按下都重置命中，滚动拖拽/棋盘点按不触发布局按压
  for (let i = btns.length - 1; i >= 0; i--) {
    const b = btns[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      g_ptrHit = { x: b.x, y: b.y, w: b.w, h: b.h };        // 记录命中按钮几何，btn() 绘制按下态时比对（不改命中区）
      if (!b.disabled) b.fn();
      return;
    }
  }
  // 列表触屏滚动：点在裁剪区内且没命中按钮时，启动拖动滚动（仅菜单类屏幕，game 走单位拖拽）
  if (listScrollMax > 0 && LIST_AREA && p.x >= LIST_AREA.x && p.x <= LIST_AREA.x + LIST_AREA.w && p.y >= LIST_AREA.y && p.y <= LIST_AREA.y + LIST_AREA.h) {
    scrollDrag = { y0: p.y, s0: listScroll };
    return;
  }
  if (scr !== 'game' || !G || G.state !== 'play') return;
  if (G.mode === 'rogue') return;   // 试炼无部署/走位，仅保留顶栏与军略弹窗按钮
  // P1-4 ghost 回放模式：禁止玩家手动操作（仅允许 UI 按钮）
  if (G.ghostMode) return;
  if (G.egg && Math.hypot(p.x - G.egg.x, p.y - G.egg.y) < 22) { collectEgg(); return; }
  const bi = barAt(p), ci = boardAt(p);
  // 先锁定单位拖动，再处理暂停、火油和其它模式点击，确保特殊玩法不拦截编成操作。
  if (bi >= 0 && G.P.bar[bi].unit) {
    drag = { area: 'bar', from: bi, x: p.x, y: p.y, hint: '', hintType: '' };
    return;
  }
  if (ci >= 0 && G.P.cells[ci].open && G.P.cells[ci].unit) {
    drag = { area: 'board', from: ci, x: p.x, y: p.y, hint: '', hintType: '' };
    return;
  }
  // 暂停时仍允许把卡牌拖入阵位；暂停只冻结战斗计时，不应冻结编成操作。
  if (G.paused) {
    return;
  }
  if (G.targeting) {                      // 神兵符/攻速符/毛笔 选目标
    if (bi >= 0) applyTarget(G.targeting, 'bar', bi);
    else if (ci >= 0) applyTarget(G.targeting, 'board', ci);
    else G.targeting = null;
    return;
  }
  // 长坂独胆·走位操控（仅 run 阶段）：走廊带内点/按=暂停前进，左右拖拽=横向微移；run 阶段禁重新部署
  if (G.mode === 'escort' && G.escort && G.escort.run) {
    if (p.x >= ESCORT_CORRIDOR_X0 && p.x <= ESCORT_CORRIDOR_X1) {
      G.escort.paused = true;
      G.escort.walkActive = true;
      G.escort.dragX = clamp(p.x, ESCORT_X_MIN, ESCORT_X_MAX);
    }
    return;   // run 阶段守军固定，忽略其它点击（按钮已在上方处理）
  }
  // 赤壁火攻：点击空闲火油格点火；点击合成栏或棋盘单位继续走通用拖动流程。
  if (G.mode === 'fire' && G.fire) {
    // 火攻模式单独优先锁定单位拖动，避免油区命中半径抢走 pointerdown。
    let best = null, bd = 34;
    for (const c of G.fire.cells) {
      if (c.state !== 'idle') continue;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { fireIgnite(best); return; }
  }
  if (G.mode === 'siege' && G.siege) {
    if (G.siege.build) return;          // 战前编成面板开启时，战场点击忽略（面板按钮已在 btns 处理）
    return;                              // v1 指令由 HUD 按钮 siegeCmd 派发，不走拖拽/点选
  }
  if (bi >= 0 && G.P.bar[bi].unit) drag = { area: 'bar', from: bi, x: p.x, y: p.y };
  else if (ci >= 0 && G.P.cells[ci].open && G.P.cells[ci].unit) drag = { area: 'board', from: ci, x: p.x, y: p.y };
  else if (ci >= 0 && !G.P.cells[ci].open && G.mode !== 'puzzle') unlockCell(G.P, ci);   // 群雄演武：隘口(pass)地形锁定，不可开荒

}
function onUp(p) {
  g_ptrDown = false; g_ptrHit = null;                      // 抬起即清除按压态
  if (scrollDrag) { scrollDrag = null; return; }
  if (G.mode === 'escort' && G.escort && G.escort.walkActive) {
    G.escort.walkActive = false;
    G.escort.paused = false;   // 松开恢复前进
    return;
  }
  if (!drag) return;
  const d = drag; drag = null;
  if (p.x >= RECYCLE.x && p.x <= RECYCLE.x + RECYCLE.w && p.y >= RECYCLE.y - 8 && p.y <= RECYCLE.y + RECYCLE.h + 8) {
    recycleUnit(G.P, d.area, d.from);
    return;
  }
  const bi = barAt(p), ci = boardAt(p);
  let r = null;
  if (ci >= 0) r = dropUnit(G.P, d.area, d.from, 'board', ci);
  else if (bi >= 0) r = dropUnit(G.P, d.area, d.from, 'bar', bi);
  if (r === 'upgrade' || r === 'open') {
    const t = ci >= 0 ? G.P.cells[ci] : G.P.bar[bi];
    boom(t.x, t.y, '#adb5bd');
  }
}

/* ---------- 启动 ---------- */
let lastT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  // 帧级容错：单帧异常不再中断 rAF 链，避免整局冻结
  try { if (scr === 'game' && G) { if (G.state === 'play' && !G.paused) for (let i = 0; i < G.speed; i++) update(dt); else if (G.state === 'win') eggAccTick(dt); } } catch (e) { console.error('loop frame error', e); }
  try { draw(); } catch (e) { console.error('loop frame error', e); }
  requestAnimationFrame(loop);
}
function fit() {
  const dpr = devicePixelRatio || 1;
  scaleF = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = W * scaleF + 'px';
  canvas.style.height = H * scaleF + 'px';
  canvas.width = W * scaleF * dpr;
  canvas.height = H * scaleF * dpr;
}
function pt(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / scaleF, y: (ev.clientY - r.top) / scaleF };
}
function boot() {
  canvas = document.getElementById('cv');
  ctx = canvas.getContext('2d');
  loadSave();
  selStage = SAVE.stage;
  addEventListener('resize', fit);
  fit();
  // 首次用户交互后启用音频上下文（浏览器策略）
  const resumeOnce = () => { resumeAudio(); canvas.removeEventListener('pointerdown', resumeOnce); };
  canvas.addEventListener('pointerdown', resumeOnce);
  canvas.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    if (canvas.setPointerCapture && ev.pointerId !== undefined) canvas.setPointerCapture(ev.pointerId);
    onDown(pt(ev));
  });
  addEventListener('pointermove', ev => {
    const p = pt(ev);
    if (scrollDrag) { listScroll = clamp(scrollDrag.s0 + (scrollDrag.y0 - p.y), 0, listScrollMax); return; }
    if (G.mode === 'escort' && G.escort && G.escort.walkActive) {
      G.escort.dragX = clamp(p.x, ESCORT_X_MIN, ESCORT_X_MAX);
      G.escort.paused = true;
      return;
    }
    if (drag) { drag.x = p.x; drag.y = p.y;
    const tu = (drag.area === 'bar' ? G.P.bar : G.P.cells)[drag.from].unit;
    let hint = '', hintType = '';
    const bi = barAt(p), ci = boardAt(p);
    const tCell = ci >= 0 ? G.P.cells[ci] : null, tBar = bi >= 0 ? G.P.bar[bi] : null;
    let preview = null;     // 拖拽预览产物（半透明绘制）
    if (tCell && tCell.open && tCell.unit && tCell !== (drag.area === 'board' ? G.P.cells[drag.from] : null)) {
      const m = mergeUnit(tCell.unit, tu);
      hint = m.type === 'upgrade' ? '升阶' : m.type === 'hero' ? '合成' + m.name : m.type === 'item' ? '合成道具' : '互换';
      hintType = m.type;
      if (m.unit) preview = m.unit;        // upgrade → 新升阶兵
      else if (m.type === 'hero') preview = mkHero(m.name, G.P);    // hero → 武将
    } else if (tBar && tBar.unit && tBar !== (drag.area === 'bar' ? G.P.bar[drag.from] : null)) {
      const m = mergeUnit(tBar.unit, tu);
      hint = m.type === 'upgrade' ? '升阶' : m.type === 'hero' ? '合成' + m.name : m.type === 'item' ? '合成道具' : '互换';
      hintType = m.type;
      if (m.unit) preview = m.unit;
      else if (m.type === 'hero') preview = mkHero(m.name, G.P);
    } else if (tCell && tCell.open && !tCell.unit && !noDeploy(tu)) {
      hint = '部署'; hintType = 'deploy';
    } else if (tBar && !tBar.unit) {
      hint = '移动'; hintType = 'move';
    } else if (ci >= 0 && !tCell.open && tu.t === 'shovel') {
      hint = '开荒'; hintType = 'open';
    } else if (p.x >= RECYCLE.x && p.x <= RECYCLE.x + RECYCLE.w && p.y >= RECYCLE.y - 8 && p.y <= RECYCLE.y + RECYCLE.h + 8) {
      hint = '回收 +' + refundValue(tu, G.P) + '馒'; hintType = 'recycle';
    }
    drag.hint = hint; drag.hintType = hintType; drag.preview = preview;
  } });
  addEventListener('pointerup', ev => {
    onUp(pt(ev));
    if (canvas.releasePointerCapture && ev.pointerId !== undefined && canvas.hasPointerCapture && canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
  });
  canvas.addEventListener('wheel', ev => {
    if (listScrollMax > 0) { ev.preventDefault(); listScroll = clamp(listScroll + ev.deltaY, 0, listScrollMax); }
  }, { passive: false });
  requestAnimationFrame(loop);
}
if (typeof document !== 'undefined') boot();
