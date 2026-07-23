/* v2 UI 骨架：绘制助手 / 菜单 / 商店 / 锻造 / 装备 / 输入 / 启动（战场绘制在 ui_battle.js） */
'use strict';

let scr = 'menu';                 // menu | shop | forge | equip | game | help | save | wish | ach | daily | ghost | stats
let btns = [], drag = null, selStage = 1, selMap = 0, forgeMsg = '';
let ghostList = [], ghostMsg = '';   // P1-4 录像列表 / 反馈
let saveConfirm = false, saveMsg = '';   // 存档页：清除二次确认 / 保存反馈
let canvas, ctx, scaleF = 1;
let _lastScr = '', _wipe = 0;                 // 过场淡入：切屏时短暂遮罩
const DT60 = 1 / 60;

// 字体字符串缓存：txt() 每帧被调用上百次，避免重复拼接与重复设置 ctx.font
const _fontCache = new Map();
let _lastFont = '';
function txt(s, x, y, size, col, align = 'left', bold = false) {
  const key = size + (bold ? 'b' : '');
  let f = _fontCache.get(key);
  if (!f) { f = `${bold ? 'bold ' : ''}${size}px "PingFang SC","Microsoft YaHei",sans-serif`; _fontCache.set(key, f); }
  if (f !== _lastFont) { ctx.font = f; _lastFont = f; }
  ctx.fillStyle = col;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
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
function panel(x, y, w, h, opt = {}) {
  const r = opt.r || 12;
  ctx.save();
  ctx.shadowColor = opt.shadow || 'rgba(48,39,25,.10)';
  ctx.shadowBlur = opt.blur === undefined ? 10 : opt.blur;
  ctx.shadowOffsetY = opt.offsetY === undefined ? 3 : opt.offsetY;
  rr(x, y, w, h, r); ctx.fillStyle = opt.bg || '#fffdf8'; ctx.fill();
  ctx.restore();
  if (opt.stroke) { rr(x, y, w, h, r); ctx.strokeStyle = opt.stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function sectionLabel(label, x, y) {
  txt(label.toUpperCase(), x, y, 9, '#a48b63', 'left', true);
}
function hpBar(x, y, w, p, col) {
  ctx.fillStyle = '#e9ecef'; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = col || (p > 0.5 ? '#2f9e44' : p > 0.25 ? '#f59f00' : '#e03131');
  ctx.fillRect(x, y, w * clamp(p, 0, 1), 3);
}
function btn(x, y, w, h, label, fn, opt = {}) {
  btns.push({ x, y, w, h, fn, disabled: opt.disabled });
  rr(x, y, w, h, 7);
  ctx.fillStyle = opt.disabled ? '#dee2e6' : (opt.bg || '#343a40');
  ctx.fill();
  const size = opt.size || 14, lines = String(label).split('\n');
  lines.forEach((ln, i) =>
    txt(ln, x + w / 2, y + h / 2 + size * 0.35 + (i - (lines.length - 1) / 2) * (size + 3), size, opt.col || '#fff', 'center', true));
}

/* ---------- 菜单 ---------- */
function drawMenu() {
  const gold = '#b78324', ink = '#2f3540', slate = '#4b5563', red = '#bf3b2d';
  ctx.fillStyle = '#f4efe5'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#eadfcb'; ctx.fillRect(0, 0, W, 6);
  txt('赵云与阿斗', W / 2, 66, 32, SAVE.eggs.all ? '#d29a22' : ink, 'center', true);
  txt('文字合成塔防 · 全量复刻版', W / 2, 90, 12, '#90949a', 'center');
  panel(64, 105, 247, 35, { bg: '#fffaf0', stroke: '#eadfcb', r: 17, blur: 4 });
  txt('金 ' + SAVE.gold + '     材料 ' + SAVE.mat, W / 2, 128, 15, gold, 'center', true);

  // 第一层：开始战斗
  selStage = clamp(selStage, 1, SAVE.stage);
  const ch = CHAPTERS[Math.min(3, ((selStage - 1) / 10) | 0)];
  sectionLabel('开始战斗', 30, 164); panel(20, 174, 335, 114, { bg: '#fffdf9', stroke: '#ebe3d6' });
  btn(34, 190, 42, 42, '◀', () => selStage--, { disabled: selStage <= 1, bg: '#8e98a3', size: 15 });
  btn(299, 190, 42, 42, '▶', () => selStage++, { disabled: selStage >= SAVE.stage, bg: '#8e98a3', size: 15 });
  txt('第 ' + selStage + ' 关 · ' + ch + (selStage % 10 === 0 ? ' · BOSS' : ''), W / 2, 215, 16, ink, 'center', true);
  MAPS.forEach((m, i) => btn(24 + (i % 2) * 166, 243 + ((i / 2) | 0) * 32, 160, 27, m.name, () => { selMap = i; }, { size: 11, bg: selMap === i ? red : slate }));
  const mapEffect = MAPS[selMap].effect; if (mapEffect) txt('战场机制 · ' + mapEffect.name, W / 2, 284, 10, '#8a7e6c', 'center');
  var skinNames = ['羊皮纸','古卷','竹林','霜夜']; var curSkin = SAVE.mapSkin || 0;
  btn(30, 292, 150, 26, '皮肤:' + skinNames[curSkin], () => { SAVE.mapSkin = (curSkin + 1) % 4; saveSave(); }, { size: 10, bg: '#7250b8' });
  btn(195, 292, 150, 26, '开 战', () => { startBattle(selStage, false, selMap); scr = 'game'; }, { size: 18, bg: red });
  btn(30, 344, 154, 30, '特别玩法', () => { scr = 'modes'; }, { size: 11, bg: '#bd4a31' });
  btn(191, 344, 154, 30, SAVE.endless ? '无尽挑战 · ' + SAVE.bestWave + '波' : '无尽挑战（30关解锁）', () => { startBattle(STAGE_MAX, true, selMap); scr = 'game'; }, { size: 10, bg: '#6850ba', disabled: !(SAVE.endless || SAVE.endlessOn) });

  // 第二层：养成
  sectionLabel('养成', 30, 402);
  btn(30, 412, 100, 34, '武将营', () => { scr = 'camp'; }, { bg: '#7250b8', size: 12 });
  btn(138, 412, 100, 34, '锻造装备', () => { scr = 'forge'; forgeMsg = ''; }, { bg: slate, size: 12 });
  btn(246, 412, 99, 34, '道具商店', () => { scr = 'shop'; }, { bg: slate, size: 12 });
  btn(30, 452, 154, 30, '军师 · 军令', () => { scr = 'command'; }, { size: 11, bg: '#7250b8' });
  btn(191, 452, 154, 30, '心愿招募', () => { scr = 'wish'; }, { size: 11, bg: '#b78324' });

  // 第三层：记录
  sectionLabel('记录', 30, 510);
  btn(30, 520, 100, 32, '成就', () => { scr = 'ach'; }, { bg: slate, size: 11 });
  btn(138, 520, 100, 32, '录像', () => { scr = 'ghost'; ghostMsg = ''; loadGhostList(); }, { bg: '#6850ba', size: 11 });
  btn(246, 520, 99, 32, '存档管理', () => { scr = 'save'; saveMsg = ''; }, { bg: slate, size: 11 });
  const canSign = canDaily();
  btn(138, 558, 154, 28, (canSign ? '✓ ' : '') + '每日签到', () => { scr = 'daily'; dailyMsg = ''; }, { size: 11, bg: canSign ? '#318c4a' : slate });
  btn(191, 558, 154, 28, '玩法说明', () => { scr = 'help'; }, { size: 11, bg: slate });

  // 非核心规则与实验性功能收进实验室，避免新人首页被开关淹没。
  btn(30, 612, 210, 30, '设置 · 实验室', () => { scr = 'lab'; }, { size: 11, bg: '#7c8792' });
  btn(246, 612, 99, 30, SAVE.mute ? '🔇 静音' : '🔊 有声', () => { SAVE.mute = !SAVE.mute; saveSave(); }, { size: 10, bg: SAVE.mute ? '#7c8792' : '#318c4a' });
}


/* ---------- 设置与实验室 ---------- */
function drawLab() {
  txt('设置 · 实验室', W / 2, 48, 23, '#2f3540', 'center', true);
  txt('难度与实验规则；默认关闭，不影响正常主线体验', W / 2, 70, 10, '#8a7e6c', 'center');
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
  btn(128,590,120,34,'返回',()=>{scr='menu';},{bg:'#7c8792'});
}

/* ---------- 玩法说明 ---------- */
function drawHelp() {
  txt('玩法说明', W / 2, 46, 22, '#343a40', 'center', true);
  const lines = [
    '🎯【核心目标】守住阿斗（♥3），打完全部波次即通关；阿斗掉血归零则失败。',
    '',
    '🎴【抽卡合成】',
    '· 抽卡消耗馒头，得「将字」碎片；将字按正确顺序拖合成武将（赵+云=赵云）。',
    '· 碎片集齐可合成道具；十连有保底。',
    '',
    '⚔️【布阵作战】',
    '· 把武将/兵种从底部栏拖到棋盘才参战；点荒地花馒头开荒扩格。',
    '· 拖到回收站可换回馒头。',
    '· 兵种相克：盾嘲讽、甲减伤、枪破甲、骑克弩。',
    '',
    '🔗【羁绊与装备】',
    '· 桃园/五虎/父子等羁绊触发增益；专武在锻造页打造、武将装备页穿戴。',
    '· BOSS 关与章末关掉落材料，用于锻造。',
    '',
    '⚙️【功能开关】',
    '· 菜单「兵种无敌」可开启（仅玩家作战单位免伤，阿斗仍会掉血）。',
    '· 通关 30 关解锁无尽模式，每 10 波轮换一名历史名将 BOSS。',
  ];
  lines.forEach((t, i) => {
    const isHead = t.includes('【');
    if (t && !isHead && lines[i - 1] && lines[i - 1].includes('【')) {
      rr(20, 78 + i * 22 - 14, 335, 1, 1); ctx.fillStyle = '#dee2e6'; ctx.fill();   // 分段线
    }
    txt(t, 20, 78 + i * 22, 12, isHead ? '#343a40' : '#495057', 'left', isHead);
  });
  btn(128, 604, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#868e96' });
}

/* ---------- 存档管理（多槽 / 手动保存 / 导出导入 / 继续游戏） ---------- */
/* ---------- 心愿单面板（1.2.4，直接生效，仅玩家侧） ---------- */
function drawWish() {
  ctx.fillStyle = '#3b2f2f'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('心愿单', W / 2, 70);
  ctx.font = '14px sans-serif'; ctx.fillStyle = '#666';
  ctx.fillText('选择一名橙将，抽卡时该将碎片字出现概率提升（50%加权）', W / 2, 96);
  ctx.fillText('当前：' + (SAVE.wish ? SAVE.wish : '未设置'), W / 2, 120);
  const cols = 3, bw = 104, bh = 40, gap = 8, x0 = (W - (cols * bw + (cols - 1) * gap)) / 2, y0 = 150;
  HERO_ORANGE.forEach((id, i) => {
    const cx = x0 + (i % cols) * (bw + gap), cy = y0 + ((i / cols) | 0) * (bh + gap);
    const on = SAVE.wish === id;
    btn(cx, cy, bw, bh, id, () => {
      SAVE.wish = on ? '' : id;          // 再次点击取消
      saveSave();
    }, { bg: on ? '#ffe3a3' : '#fff', fg: on ? '#b8860b' : '#333' });
  });
  btn(W / 2 - 70, 600, 140, 34, '返回', () => scr = 'menu');
}
function drawSave() {
  txt('存档管理', W / 2, 46, 22, '#343a40', 'center', true);
  txt('当前进度：' + fmtSaved(), W / 2, 78, 13, '#868e96', 'center');
  txt('金币 ' + SAVE.gold + ' · 关卡 ' + SAVE.stage + ' · 武器 ' + SAVE.weapons.length + ' 把 · 材料 ' + SAVE.mat, W / 2, 96, 11, '#adb5bd', 'center');
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
    btn(205, 244, 90, 32, '确认清除', () => { clearSave(); G = null; selStage = 1; saveConfirm = false; saveMsg = '已清除并重置'; scr = 'menu'; }, { bg: '#e03131', size: 12 });
  }
  // 继续游戏 / 导出 / 导入
  btn(30, 300, 150, 34, '继续游戏', () => { startBattle(SAVE.stage, SAVE.endless, selMap); scr = 'game'; }, { bg: '#1c7ed6', size: 13 });
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
  btn(128, 600, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#868e96' });
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
  scr = 'game';
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
  txt('对战录像', W / 2, 46, 22, '#343a40', 'center', true);
  txt('本地 ' + (Array.isArray(SAVE.ghosts) ? SAVE.ghosts.length : 0) + ' 条 / 共享 ' + ghostList.filter(g => g.src === 'remote').length + ' 条', W / 2, 70, 11, '#868e96', 'center');
  txt('点击录像进入回放（自动重现玩家操作）', W / 2, 86, 10, '#adb5bd', 'center');
  // 上传按钮：上传本地最新一条到共享池
  btn(20, 96, 165, 28, '↑ 上传最新到共享', () => {
    const arr = Array.isArray(SAVE.ghosts) ? SAVE.ghosts : [];
    if (!arr.length) { ghostMsg = '本地暂无录像'; return; }
    uploadGhost(arr[0]);
  }, { size: 11, bg: '#2f9e44' });
  // 刷新列表
  btn(195, 96, 165, 28, '↻ 刷新共享列表', () => { loadGhostList(); ghostMsg = '已刷新'; }, { size: 11, bg: '#495057' });
  // 列表（按关卡降序、步数升序排名，命令行首显示名次）
  if (!ghostList.length) txt('暂无录像（胜利后自动保存）', W / 2, 160, 12, '#adb5bd', 'center');
  const DIFF_NAMES = { easy: '简单', normal: '普通', hard: '困难' };
  const ranked = ghostList.slice().sort((a, b) => (b.stage - a.stage) || (a.ops - b.ops) || ((b.result === 'win') - (a.result === 'win')));
  ranked.slice(0, 13).forEach((g, i) => {
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
  if (ghostMsg) txt(ghostMsg, W / 2, 580, 12, ghostMsg.includes('失败') ? '#e03131' : '#2f9e44', 'center', true);
  btn(128, 600, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#868e96' });
}

/* ---------- P2-2 数据统计面板 + P2-1 皮肤总览 ---------- */
function fmtTime(s) {
  s = Math.floor(s || 0);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm' + (s % 60 ? ' ' + (s % 60) + 's' : '');
  return Math.floor(s / 3600) + 'h' + Math.floor((s % 3600) / 60) + 'm';
}
function drawStats() {
  txt('战绩档案', W / 2, 46, 22, '#343a40', 'center', true);
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
    const x = 20 + col * 175, y = 80 + row * 32;
    rr(x, y, 168, 28, 5); ctx.fillStyle = '#f8f9fa'; ctx.fill();
    ctx.strokeStyle = '#dee2e6'; ctx.lineWidth = 1; ctx.stroke();
    txt(r[0], x + 8, y + 18, 11, '#868e96', 'left');
    txt(String(r[1]), x + 160, y + 18, 13, r[2], 'right', true);
  });
  // 下半：皮肤解锁总览
  txt('皮肤图鉴', W / 2, 296, 16, '#343a40', 'center', true);
  let unlocked = 0, total = 0;
  HERO_LIST.forEach((name) => {
    if (typeof heroSkins !== 'function') return;
    const skins = heroSkins(name);
    total += skins.length;
    unlocked += skins.filter(s => checkSkinUnlock(name, s.cond)).length;
  });
  txt('已解锁 ' + unlocked + '/' + total + ' (' + Math.round(unlocked / total * 100) + '%)', W / 2, 316, 12, '#2f9e44', 'center', true);
  // 各武将当前皮肤快速预览
  HERO_LIST.forEach((name, i) => {
    const col = i % 3, row = (i / 3) | 0;
    const x = 20 + col * 115, y = 332 + row * 32;
    rr(x, y, 110, 28, 5); ctx.fillStyle = '#f8f9fa'; ctx.fill();
    const sk = (typeof currentSkin === 'function') ? currentSkin(name) : null;
    const col2 = (sk && sk.col) ? sk.col : (HEROES[name].grade === 4 ? '#e8a005' : '#9c36b5');
    txt(name, x + 8, y + 18, 12, col2, 'left', true);
    txt(sk ? sk.name : '常服', x + 102, y + 18, 10, '#868e96', 'right');
  });
  btn(128, 604, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#868e96' });
}

/* ---------- 商店（购买 + 携带 ≤6，主动 ≤2） ---------- */
function drawShop() {
  txt('道具商店', W / 2, 46, 22, '#343a40', 'center', true);
  txt('金 ' + SAVE.gold + ' · 携带 ' + SAVE.loadout.length + '/' + LOADOUT_MAX + '（主动≤' + LOADOUT_ACT_MAX + '）', W / 2, 70, 12, '#b0801f', 'center');
  Object.keys(ITEMS).forEach((id, i) => {
    const it = ITEMS[id], y = 88 + i * 42;
    const owned = SAVE.itemsOwned[id], on = SAVE.loadout.includes(id);
    rr(14, y, 347, 36, 6); ctx.fillStyle = on ? '#fff9db' : '#f8f9fa'; ctx.fill();
    ctx.strokeStyle = on ? '#e8a005' : '#dee2e6'; ctx.lineWidth = 1; ctx.stroke();
    txt(it.name, 24, y + 16, 14, it.act ? '#c0392b' : '#2f9e44', 'left', true);
    txt(it.act ? '主动×' + it.uses : '被动', 24, y + 30, 9, '#adb5bd');
    txt(it.tip, 92, y + 23, 11, '#495057');
    btn(288, y + 5, 64, 26, owned ? (on ? '携带中' : '携带') : it.price + '金',
      () => { owned ? toggleLoadout(id) : buyItem(id); },
      { size: 11, bg: owned ? (on ? '#e8a005' : '#868e96') : '#8b5e3c', disabled: !owned && SAVE.gold < it.price });
  });
  btn(128, 604, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#868e96' });
}

/* ---------- 锻造 ---------- */
function drawForge() {
  txt('锻造装备', W / 2, 46, 22, '#343a40', 'center', true);
  txt('金 ' + SAVE.gold + ' · 材料 ' + SAVE.mat + '（BOSS与章末关掉落）', W / 2, 70, 12, '#b0801f', 'center');
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
    txt(w.tip, 200, y + 14, 10, '#868e96');
  });
  btn(128, 604, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#868e96' });
}

/* ---------- 武将装备（点武将轮换武器 + P2-1 皮肤切换） ---------- */
function drawEquip() {
  txt('武将装备', W / 2, 46, 22, '#343a40', 'center', true);
  txt('点武将行换武器 · 点右侧皮肤按钮换肤', W / 2, 68, 11, '#868e96', 'center');
  HERO_LIST.forEach((name, i) => {
    const h = HEROES[name], y = 82 + i * 42;
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
    txt(h.wq + '系 · ' + h.tip, 80, y + 15, 10, '#868e96');
    txt(eq ? Q_NAME[WEAPONS[eq].q] + '·' + WEAPONS[eq].name : (weaponsFor(name).length ? '未装备(点击穿戴)' : '无可用武器'),
      80, y + 30, 11, eq ? Q_COL[WEAPONS[eq].q] : '#adb5bd', 'left', !!eq);
    // 右侧：皮肤按钮（262-360）
    const skinBtn = (typeof currentSkin === 'function') ? currentSkin(name) : null;
    const skinLabel = skinBtn ? skinBtn.name : '皮肤';
    btn(262, y, 99, 36, '肤·' + skinLabel, () => {
      if (typeof cycleSkin !== 'function') return;
      const next = cycleSkin(name);
      if (next && typeof sfx === 'function') sfx('click');
    }, { size: 10, bg: (skinBtn && skinBtn.col) ? skinBtn.col : '#5f3dc4' });
  });
  btn(128, 604, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#868e96' });
}

/* ---------- 武将营：永久招募、心愿与主将选择 ---------- */
let campMsg = '';
function drawCamp() {
  txt('武将营', W / 2, 44, 24, '#2f3540', 'center', true);
  txt('碎片招募 · 20 碎片解锁 · 每局仅携带 1 名主将', W / 2, 66, 10, '#8a7e6c', 'center');
  const lead = SAVE.leadHero || '未选择';
  panel(20, 76, 335, 42, { bg: '#fff9ed', stroke: '#ead7ad', r: 10, blur: 4 });
  txt('当前主将：' + lead + (SAVE.ownedHeroes[lead] ? '  ★' + heroStar(lead) : ''), 32, 101, 14, '#b78324', 'left', true);
  txt('心愿：' + (SAVE.heroWish || '未设置'), 340, 101, 11, '#8a7e6c', 'right');
  HERO_LIST.forEach((name, i) => {
    const col = i % 2, row = (i / 2) | 0;
    const x = 18 + col * 171, y = 128 + row * 48;
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
  if (campMsg) txt(campMsg, W / 2, 570, 11, campMsg.includes('不足') ? '#bd4a31' : '#318c4a', 'center', true);
  btn(128, 600, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#7c8792' });
}


function drawCommand() {
  txt('军师与军令', W / 2, 48, 23, '#2f3540', 'center', true);
  txt('选择军师后，下局战斗立即生效', W / 2, 70, 11, '#8a7e6c', 'center');
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
  btn(128, 590, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#7c8792' });
}

function drawRoster() {
  txt('群英谱', W / 2, 48, 24, '#2f3540', 'center', true);
  txt('征战记录 · 英雄挑战', W / 2, 70, 10, '#8a7e6c', 'center');
  txt('前6位英雄有4套专属皮肤，其余2套通用', W / 2, 82, 9, '#90949a', 'center');
  HERO_LIST.forEach(function(name, i) {
    var rec = typeof heroRecord === 'function' ? heroRecord(name) : { kills: 0, deployments: 0, wins: 0 };
    var y = 88 + i * 44, own = SAVE.ownedHeroes[name], star = heroStar ? heroStar(name) : 0;
    panel(20, y, 335, 38, { bg: own ? '#fffdf9' : '#f0ece4', stroke: own ? '#dfc98d' : '#ded8ce', r: 8, blur: 2 });
    var c = HEROES[name].grade === 4 ? '#b78324' : '#8050a0';
    txt(name, 32, y + 17, 14, own ? c : '#8f969c', 'left', true);
    txt('杀 ' + rec.kills + '  出 ' + rec.deployments + '  ' + (own ? '★' + star : '未拥有'), 32, y + 32, 9, '#656d76');
    // 皮肤切换按钮：群英谱内直接预览、切换已解锁皮肤
    if (typeof heroSkins === 'function' && typeof currentSkin === 'function') {
      var curSkin = currentSkin(name);
      var skiName = curSkin ? curSkin.name : '未知';
      btn(185, y + 9, 48, 26, '肤', function() {
        if (typeof cycleSkin !== 'function') return;
        var next = cycleSkin(name);
        if (next && typeof sfx === 'function') sfx('click');
      }, { size: 10, bg: curSkin && curSkin.col ? curSkin.col : '#7c8792' });
      txt('当前:' + skiName, 238, y + 26, 9, curSkin && curSkin.col ? curSkin.col : '#8a7e6c');
    }
    var ch = typeof heroChallenges === 'function' ? heroChallenges().find(function(x) { return x.hero === name; }) : null;
    if (ch) {
      txt(ch.desc, 185, y + 24, 9, SAVE.heroChallenges[name] ? '#318c4a' : '#868e96');
      txt(SAVE.heroChallenges[name] ? '✓' : '未完成', 185, y + 17, 10, SAVE.heroChallenges[name] ? '#318c4a' : '#a48b63', 'center');
    }
  });
  btn(128, 596, 120, 34, '返回', function() { scr = 'menu'; }, { bg: '#7c8792' });
}

function drawModes() {
  txt('特别玩法', W / 2, 54, 25, '#2f3540', 'center', true);
  txt('改变胜利目标，而不是单纯增加波次', W / 2, 76, 11, '#90949a', 'center');
  SPECIAL_MODES.forEach((m, i) => {
    const y = 96 + i * 92, open = modeUnlocked(m);
    panel(20, y, 335, 78, { bg: open ? '#fffdf9' : '#eee9df', stroke: open ? '#e7dccb' : '#ddd5c7', r: 11, blur: 5 });
    txt(m.icon, 45, y + 48, 25, m.col, 'center', true);
    txt(m.name, 72, y + 30, 16, open ? '#2f3540' : '#9ca3aa', 'left', true);
    txt(m.sub, 72, y + 51, 11, open ? '#777d84' : '#a6a9ac', 'left');
    btn(268, y + 22, 70, 33, open ? '进入' : '第' + m.unlock + '关解锁', () => { if (open) startSpecialMode(m.id); }, { size: open ? 12 : 9, bg: open ? m.col : '#aab0b6', disabled: !open });
  });
  btn(128, 586, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#7c8792' });
}


function draw() {
  const dpr = (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  ctx.setTransform(scaleF * dpr, 0, 0, scaleF * dpr, 0, 0);
  ctx.fillStyle = '#f3eee3'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e1d4bf'; ctx.fillRect(0, 0, W, 4);
  btns = [];
  if (scr !== _lastScr) { _lastScr = scr; _wipe = 0.25; }   // 切屏触发淡入
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
  // 过场淡入：新画面从背景色渐显（不抖 UI）
  if (_wipe > 0) {
    _wipe = Math.max(0, _wipe - DT60);
    ctx.globalAlpha = (_wipe / 0.25) * 0.8; ctx.fillStyle = '#f3eee3'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
}

/* ---------- 成就面板（P1-1） ---------- */
let achMsg = '';
let achMsgT = 0;
function drawAch() {
  txt('成就', W / 2, 46, 22, '#343a40', 'center', true);
  // 检查一次成就（玩家进入页面时实时同步）
  const newly = checkAchievements();
  if (newly.length > 0) {
    achMsg = '解锁 ' + newly.length + ' 个成就！奖励已发放';
    achMsgT = 3;
  }
  if (achMsgT > 0) {
    achMsgT -= DT60;
    txt(achMsg, W / 2, 70, 12, '#e8a005', 'center', true);
  } else {
    const done = ACHIEVEMENTS.filter(a => SAVE.ach[a.id]).length;
    txt('已解锁 ' + done + '/' + ACHIEVEMENTS.length, W / 2, 70, 12, '#868e96', 'center');
  }
  const startY = 88, rowH = 36;
  ACHIEVEMENTS.forEach((a, i) => {
    const y = startY + i * rowH, on = !!SAVE.ach[a.id];
    rr(14, y, 347, 32, 6);
    ctx.fillStyle = on ? '#fff9db' : '#f8f9fa'; ctx.fill();
    ctx.strokeStyle = on ? '#e8a005' : '#dee2e6'; ctx.lineWidth = 1; ctx.stroke();
    txt(on ? '✓' : '·', 24, y + 21, 16, on ? '#2f9e44' : '#adb5bd', 'center', true);
    txt(a.name, 42, y + 15, 13, on ? '#e8a005' : '#495057', 'left', true);
    txt(a.desc, 42, y + 27, 10, '#868e96', 'left');
    const r = (a.reward.gold ? '+' + a.reward.gold + '金' : '') + (a.reward.mat ? ' +' + a.reward.mat + '材' : '');
    txt(r, 355, y + 21, 10, '#b0801f', 'right', true);
  });
  btn(128, 604, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#868e96' });
}

/* ---------- 每日签到面板（P1-2） ---------- */
let dailyMsg = '';
function drawDaily() {
  txt('每日签到', W / 2, 46, 22, '#343a40', 'center', true);
  txt('连续签到 ' + SAVE.dailyStreak + ' 天', W / 2, 70, 13, '#868e96', 'center');
  txt('今日：' + todayStr(), W / 2, 88, 11, '#adb5bd', 'center');
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
  btn(128, 604, 120, 34, '返回', () => { scr = 'menu'; }, { bg: '#868e96' });
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
  for (let i = btns.length - 1; i >= 0; i--) {
    const b = btns[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      if (!b.disabled) b.fn();
      return;
    }
  }
  if (scr !== 'game' || !G || G.state !== 'play' || G.paused) return;
  // P1-4 ghost 回放模式：禁止玩家手动操作（仅允许 UI 按钮）
  if (G.ghostMode) return;
  if (G.egg && Math.hypot(p.x - G.egg.x, p.y - G.egg.y) < 22) { collectEgg(); return; }
  const bi = barAt(p), ci = boardAt(p);
  if (G.targeting) {                      // 神兵符/攻速符/毛笔 选目标
    if (bi >= 0) applyTarget(G.targeting, 'bar', bi);
    else if (ci >= 0) applyTarget(G.targeting, 'board', ci);
    else G.targeting = null;
    return;
  }
  if (bi >= 0 && G.P.bar[bi].unit) drag = { area: 'bar', from: bi, x: p.x, y: p.y };
  else if (ci >= 0 && G.P.cells[ci].open && G.P.cells[ci].unit) drag = { area: 'board', from: ci, x: p.x, y: p.y };
  else if (ci >= 0 && !G.P.cells[ci].open) unlockCell(G.P, ci);          // 点荒地花馒头开荒

}
function onUp(p) {
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
  if (scr === 'game' && G) {
    if (G.state === 'play' && !G.paused)
      for (let i = 0; i < G.speed; i++) update(dt);
    else if (G.state === 'win') eggAccTick(dt);
  }
  draw();
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
  canvas.addEventListener('pointerdown', ev => { ev.preventDefault(); onDown(pt(ev)); });
  canvas.addEventListener('pointermove', ev => { if (drag) { const p = pt(ev); drag.x = p.x; drag.y = p.y;
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
  addEventListener('pointerup', ev => onUp(pt(ev)));
  requestAnimationFrame(loop);
}
if (typeof document !== 'undefined') boot();
