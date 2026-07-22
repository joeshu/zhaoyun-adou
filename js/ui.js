/* v2 UI 骨架：绘制助手 / 菜单 / 商店 / 锻造 / 装备 / 输入 / 启动（战场绘制在 ui_battle.js） */
'use strict';

let scr = 'menu';                 // menu | shop | forge | equip | game | help | save | wish | ach | daily | ghost | stats
let btns = [], drag = null, selStage = 1, selMap = 0, forgeMsg = '';
let ghostList = [], ghostMsg = '';   // P1-4 录像列表 / 反馈
let saveConfirm = false, saveMsg = '';   // 存档页：清除二次确认 / 保存反馈
let canvas, ctx, scaleF = 1;
const DT60 = 1 / 60;

function txt(s, x, y, size, col, align = 'left', bold = false) {
  ctx.fillStyle = col;
  ctx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
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
  txt('赵云与阿斗', W / 2, 96, 38, SAVE.eggs.all ? '#e8a005' : '#343a40', 'center', true);
  txt('文字合成塔防 · 全量复刻版', W / 2, 124, 12, '#868e96', 'center');
  txt('金 ' + SAVE.gold + '   材料 ' + SAVE.mat, W / 2, 158, 15, '#b0801f', 'center', true);
  selStage = clamp(selStage, 1, SAVE.stage);
  rr(48, 175, 279, 50, 10); ctx.fillStyle = '#f1f3f5'; ctx.fill();   // 关卡选择底卡
  const ch = CHAPTERS[Math.min(3, ((selStage - 1) / 10) | 0)];
  btn(58, 190, 40, 40, '◀', () => selStage--, { disabled: selStage <= 1, bg: '#868e96', size: 16 });
  btn(277, 190, 40, 40, '▶', () => selStage++, { disabled: selStage >= SAVE.stage, bg: '#868e96', size: 16 });
  txt('第 ' + selStage + ' 关 · ' + ch + (selStage % 10 === 0 ? ' · BOSS关' : ''), W / 2, 215, 16, '#495057', 'center', true);
  // 战场选择（多套地图可选）
  txt('战场', 60, 240, 12, '#868e96', 'center');
  MAPS.forEach((m, i) => {
    btn(96 + i * 96, 228, 88, 24, m.name, () => { selMap = i; },
      { size: 12, bg: selMap === i ? '#c0392b' : '#495057' });
  });
  btn(88, 258, 200, 44, '开 战', () => { startBattle(selStage, false, selMap); scr = 'game'; }, { size: 20, bg: '#c0392b' });
  btn(88, 306, 200, 34, SAVE.endless ? '无尽模式 · 最高' + SAVE.bestWave + '波' : '无尽模式（通关30关解锁）',
    () => { startBattle(STAGE_MAX, true, selMap); scr = 'game'; }, { size: 13, bg: '#5f3dc4', disabled: !(SAVE.endless || SAVE.endlessOn) });
  // 难度选择（循环：简单→普通→困难）
  const DIFF_NAMES = { easy: '简单', normal: '普通', hard: '困难' };
  btn(30, 345, 98, 28, '难度·' + (DIFF_NAMES[SAVE.difficulty] || '普通'),
    () => { const c = ['easy', 'normal', 'hard']; SAVE.difficulty = c[(c.indexOf(SAVE.difficulty) + 1) % 3]; saveSave(); },
    { size: 10, bg: '#2b8a3e' });
  btn(132, 345, 98, 28, 'AI·' + (DIFF_NAMES[SAVE.aiLevel] || '普通'),
    () => { const c = ['easy', 'normal', 'hard']; SAVE.aiLevel = c[(c.indexOf(SAVE.aiLevel) + 1) % 3]; saveSave(); },
    { size: 10, bg: '#5f3dc4' });
  btn(234, 345, 70, 28, '说明', () => { scr = 'help'; }, { size: 11, bg: '#495057' });
  // 静音切换（P1-3）：开灰关绿
  btn(308, 345, 62, 28, SAVE.mute ? '🔇静音' : '🔊有声',
    () => { SAVE.mute = !SAVE.mute; saveSave(); sfx('click'); },
    { size: 10, bg: SAVE.mute ? '#495057' : '#2f9e44' });
  // 功能开关：2行×3列，统一配色（关灰 / 开绿）
  const sw = (x, y, label, on, fn) =>
    btn(x, y, 110, 28, label + (on ? '：开 ✓' : '：关'), fn, { size: 12, bg: on ? '#2f9e44' : '#495057' });
  sw(30, 378, '兵种无敌', SAVE.invincible, () => { SAVE.invincible = !SAVE.invincible; saveSave(); });
  sw(145, 378, '动态路径', SAVE.dynPath, () => { SAVE.dynPath = !SAVE.dynPath; saveSave(); });
  sw(260, 378, 'BOSS阶段', SAVE.bossPhase, () => { SAVE.bossPhase = !SAVE.bossPhase; saveSave(); });
  sw(30, 410, '无尽快捷', SAVE.endlessOn, () => { SAVE.endlessOn = !SAVE.endlessOn; saveSave(); });
  sw(145, 410, '新橙将', SAVE.newHeros, () => { SAVE.newHeros = !SAVE.newHeros; saveSave(); });
  sw(260, 410, '武将觉醒', SAVE.awaken, () => { SAVE.awaken = !SAVE.awaken; saveSave(); });
  btn(30, 442, 225, 28, SAVE.gearOn ? '装备扩展：开 ✓' : '装备扩展：关',
    () => { SAVE.gearOn = !SAVE.gearOn; saveSave(); }, { size: 12, bg: SAVE.gearOn ? '#2f9e44' : '#495057' });
  btn(260, 442, 110, 28, '一键全开(重型)', () => {
    SAVE.dynPath = SAVE.bossPhase = SAVE.endlessOn = SAVE.newHeros = SAVE.awaken = SAVE.gearOn = true;
    saveSave();
  }, { size: 12, bg: '#2f9e44' });
  // 装备轮换（仅在装备扩展开启时显示，避免常驻杂乱）
  if (SAVE.gearOn) {
    btn(30, 474, 170, 28, '防具：' + (SAVE.equipArmor ? ARMORS[SAVE.equipArmor].name : '无'),
      () => { const ks = Object.keys(ARMORS); SAVE.equipArmor = SAVE.equipArmor ? ks[(ks.indexOf(SAVE.equipArmor) + 1) % ks.length] : ks[0]; saveSave(); }, { size: 12, bg: '#495057' });
    btn(205, 474, 170, 28, '饰品：' + (SAVE.equipAcc ? ACCESSORIES[SAVE.equipAcc].name : '无'),
      () => { const ks = Object.keys(ACCESSORIES); SAVE.equipAcc = SAVE.equipAcc ? ks[(ks.indexOf(SAVE.equipAcc) + 1) % ks.length] : ks[0]; saveSave(); }, { size: 12, bg: '#495057' });
  }
  // 入口工具栏（统一灰底）
  btn(30, 506, 98, 34, '道具商店', () => { scr = 'shop'; }, { bg: '#495057', size: 13 });
  btn(138, 506, 98, 34, '锻造装备', () => { scr = 'forge'; forgeMsg = ''; }, { bg: '#495057', size: 13 });
  btn(246, 506, 98, 34, '武将装备', () => { scr = 'equip'; }, { bg: '#495057', size: 13 });
  // 签到入口：可签到时高亮（红色提示）
  const canSign = canDaily();
  btn(30, 540, 225, 24, (canSign ? '【!】' : '') + '每日签到' + (canSign ? '（可签到）' : '（已签到）'),
    () => { scr = 'daily'; dailyMsg = ''; },
    { size: 11, bg: canSign ? '#2f9e44' : '#495057' });
  const lo = SAVE.loadout.map(id => ITEMS[id].name).join(' · ');
  txt('携带道具：' + (lo || '无（商店购买后点选携带）'), W / 2, 562, 11, '#868e96', 'center');
  const e = SAVE.eggs, en = (e.flag ? 1 : 0) + (e.vine ? 1 : 0) + (e.acc ? 1 : 0);
  txt('隐藏彩蛋 ' + en + '/3' + (e.all ? ' · 限定皮肤已解锁' : ''), W / 2, 580, 11, '#adb5bd', 'center');
  // 核心提示（精简3行，其余见玩法说明）
  const tips = [
    '· 抽卡得将字→按序拖合成将；碎片集齐成道具',
    '· 拖上棋盘才参战；铲子/荒地开荒；回收站换馒头',
    '· 桃园/五虎/父子羁绊；专武锻造穿戴；BOSS掉材料',
  ];
  tips.forEach((t, i) => txt(t, 26, 600 + i * 18, 11, '#999'));
  btn(30, 632, 100, 28, '心愿单', () => scr = 'wish', { size: 11, bg: '#495057' });   // 1.2.4 心愿单入口（仅玩家侧生效）
  btn(138, 632, 100, 28, '成就', () => { scr = 'ach'; }, { size: 11, bg: '#495057' });   // P1-1 成就入口
  btn(246, 632, 100, 28, '存档管理', () => { scr = 'save'; saveMsg = ''; }, { size: 11, bg: '#495057' });
  btn(30, 666, 100, 28, '录像', () => { scr = 'ghost'; ghostMsg = ''; loadGhostList(); }, { size: 11, bg: '#5f3dc4' });   // P1-4 录像入口
  btn(138, 666, 100, 28, '统计', () => { scr = 'stats'; }, { size: 11, bg: '#1c7ed6' });   // P2-2 统计入口
  btn(246, 666, 100, 28, '玩法说明', () => { scr = 'help'; }, { size: 11, bg: '#495057' });   // 玩法说明下移
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
    // 拉取 token 后再写盘（同源信任）
    fetch('/api/token').then(r => r.json()).then(tj =>
      fetch('/api/save?slot=' + curSlot + '&token=' + encodeURIComponent(tj.token || ''), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: s
      }).then(r => r.json()).then(j => { saveMsg = j.ok ? '已存到项目目录 ✓' : '保存失败：' + (j.error || ''); })
    ).catch(() => { saveMsg = '保存失败：服务未连接'; });
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
  fetch('/api/token').then(r => r.json()).then(tj =>
    fetch('/api/ghost?token=' + encodeURIComponent(tj.token || ''), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec)
    }).then(r => r.json()).then(j => { ghostMsg = j.ok ? '已上传到共享池 ✓' : '上传失败：' + (j.error || ''); })
  ).catch(() => { ghostMsg = '上传失败：服务未连接'; });
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
  // 列表
  if (!ghostList.length) txt('暂无录像（胜利后自动保存）', W / 2, 160, 12, '#adb5bd', 'center');
  const DIFF_NAMES = { easy: '简单', normal: '普通', hard: '困难' };
  ghostList.slice(0, 13).forEach((g, i) => {
    const y = 130 + i * 30;
    const isLocal = g.src === 'local';
    rr(14, y, 347, 26, 5); ctx.fillStyle = isLocal ? '#f8f9fa' : '#f1f8ff'; ctx.fill();
    ctx.strokeStyle = '#dee2e6'; ctx.stroke();
    txt((isLocal ? '本' : '享') + '·第' + g.stage + '关', 22, y + 17, 11, isLocal ? '#343a40' : '#1c7ed6', 'left', true);
    txt((DIFF_NAMES[g.diff] || '普') + '/' + (DIFF_NAMES[g.ai] || '普'), 100, y + 17, 10, '#868e96');
    txt(g.ops + '步', 160, y + 17, 10, '#495057');
    txt(g.result === 'win' ? '胜' : '—', 195, y + 17, 11, '#2f9e44', 'center', true);
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
  if (forgeMsg) txt(forgeMsg, W / 2, 148, 13, '#e8a005', 'center', true);
  txt('武器仓（' + SAVE.weapons.length + '/' + Object.keys(WEAPONS).length + '）：', 20, 176, 12, '#495057', 'left', true);
  SAVE.weapons.forEach((id, i) => {
    const w = WEAPONS[id], y = 192 + i * 26;
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

/* ---------- 主绘制 ---------- */
function draw() {
  const dpr = (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  ctx.setTransform(scaleF * dpr, 0, 0, scaleF * dpr, 0, 0);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, W, H);
  btns = [];
  if (scr === 'menu') drawMenu();
  else if (scr === 'shop') drawShop();
  else if (scr === 'forge') drawForge();
  else if (scr === 'equip') drawEquip();
  else if (scr === 'help') drawHelp();
  else if (scr === 'save') drawSave();
  else if (scr === 'wish') drawWish();
  else if (scr === 'ach') drawAch();
  else if (scr === 'daily') drawDaily();
  else if (scr === 'ghost') drawGhost();
  else if (scr === 'stats') drawStats();
  else drawGame();
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
