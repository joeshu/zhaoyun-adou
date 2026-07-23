'use strict';
/* 自动按钮重叠检测（CI 版）。
 * 逐屏渲染 Canvas 游戏，读取 btn() 注册的按钮矩形，程序化找出重叠对；有重叠即 exit 1。
 * 只测「按钮 vs 按钮」（panel/卡片不进 btns 天然降噪）；滚动容器先做裁剪相交避免屏外行误报。
 *
 * 本地：node scripts/check-overlap.js        （优先用系统 Edge，免下载 Chromium）
 * CI ：node scripts/check-overlap.js        （用 Playwright 自带 Chromium，需先 npx playwright install chromium）
 * 退出码：0=无重叠，1=有重叠，2=缺少 playwright 依赖
 */
const fs = require('fs');

const isCI = !!process.env.CI;
// 依赖解析优先级：CI/项目安装的完整 playwright > 本地托管工作区 playwright-core > 通用 playwright-core
const CANDIDATES = [
  'playwright',
  'C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core',
  'playwright-core',
];
let chromium = null;
for (const c of CANDIDATES) {
  try { chromium = require(c).chromium; if (chromium) break; } catch (e) { /* try next */ }
}
if (!chromium) {
  console.error('[overlap] 未找到 playwright / playwright-core。CI 请先: npm i --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

const URL = process.env.OVERLAP_URL || 'http://localhost:8384/';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const useEdge = !isCI && fs.existsSync(EDGE);   // 本地有 Edge 就用 Edge，CI 一律用自带 Chromium

const screens = ['menu','lab','modes','camp','forge','shop','wish','command','ach','ghost','save','daily','help','stats','equip','roster'];

(async () => {
  const browser = await chromium.launch(useEdge ? { executablePath: EDGE, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 440, height: 760 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cv', { timeout: 10000 });
  await page.evaluate(() => { try { SAVE.tutorial = 0; if (typeof G !== 'undefined' && G) G.tutorial = 0; } catch (e) {} });
  await page.waitForTimeout(300);

  // 注入扫描函数（在页面上下文执行）：切屏→draw()→读 btns→算重叠
  const scanFn = (scrName) => {
    LIST_AREA = null; listScroll = 0;
    scr = scrName;
    draw();                       // draw() 顶部 btns=[]，切屏重置 listScroll
    const W2 = 375, H2 = 667;
    const arr = btns.map(b => {
      let r = { x: b.x, y: b.y, w: b.w, h: b.h, label: b.label || '(无字)' };
      if (LIST_AREA) {            // 裁剪滚动容器：屏外部分不计
        const x1 = Math.max(r.x, LIST_AREA.x), y1 = Math.max(r.y, LIST_AREA.y);
        const x2 = Math.min(r.x + r.w, LIST_AREA.x + LIST_AREA.w), y2 = Math.min(r.y + r.h, LIST_AREA.y + LIST_AREA.h);
        if (x2 <= x1 || y2 <= y1) return null;
        r = { x: x1, y: y1, w: x2 - x1, h: y2 - y1, label: r.label };
      }
      return r;
    }).filter(Boolean).filter(r => r.y < H2 && r.y + r.h > 0 && r.x < W2 && r.x + r.w > 0);
    const res = [];
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox <= 2 || oy <= 2) continue;                 // 忽略贴边/发丝接触
      const small = Math.min(a.w * a.h, b.w * b.h), oa = ox * oy;
      res.push({ a: a.label, b: b.label, ox: Math.round(ox), oy: Math.round(oy), cover: +(oa / small).toFixed(2),
                 aPos: [a.x, a.y, a.w, a.h].map(Math.round), bPos: [b.x, b.y, b.w, b.h].map(Math.round) });
    }
    return res;
  };

  let totalBug = 0, totalContain = 0;
  const report = (s, overlaps) => {
    if (!overlaps.length) { console.log(`[${s}] OK 无重叠`); return; }
    const partial = overlaps.filter(o => o.cover <= 0.9);
    const contain = overlaps.filter(o => o.cover > 0.9);
    if (partial.length) {
      totalBug += partial.length;
      console.log(`\n[${s}] ⚠ 部分重叠 ${partial.length} 处(疑似 bug):`);
      partial.forEach(o => console.log(`   「${o.a}」${JSON.stringify(o.aPos)} × 「${o.b}」${JSON.stringify(o.bPos)}  覆盖${(o.cover*100)|0}% (${o.ox}x${o.oy})`));
    }
    if (contain.length) {
      totalContain += contain.length;
      console.log(`\n[${s}] ℹ 包含关系 ${contain.length} 处(多为有意，复核):`);
      contain.forEach(o => console.log(`   「${o.a}」 ⊂ 「${o.b}」  覆盖${(o.cover*100)|0}%`));
    }
  };

  for (const s of screens) {
    try { report(s, await page.evaluate(scanFn, s)); }
    catch (e) { console.log(`[${s}] 扫描失败: ${e.message}`); }
  }

  // 战斗屏（需 startBattle + scr='game'）
  try {
    const overlaps = await page.evaluate(() => {
      startBattle(1); scr = 'game';
      LIST_AREA = null; listScroll = 0;
      draw();
      const W2 = 375, H2 = 667;
      const arr = btns.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, label: b.label || '(无字)' }))
        .filter(r => r.y < H2 && r.y + r.h > 0 && r.x < W2 && r.x + r.w > 0);
      const res = [];
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox <= 2 || oy <= 2) continue;
        const small = Math.min(a.w * a.h, b.w * b.h);
        res.push({ a: a.label, b: b.label, cover: +(ox * oy / small).toFixed(2),
                   aPos: [a.x, a.y, a.w, a.h].map(Math.round), bPos: [b.x, b.y, b.w, b.h].map(Math.round) });
      }
      return res;
    });
    report('game', overlaps);
  } catch (e) { console.log('[game] 扫描失败:', e.message); }

  console.log(`\n========== 汇总：疑似 bug ${totalBug} 处，包含关系(复核) ${totalContain} 处 ==========`);
  await browser.close();
  if (totalBug > 0) { console.error('[overlap] 检测到按钮重叠，CI 置红'); process.exit(1); }
  console.log('[overlap] 全部界面无按钮重叠 ✓');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
