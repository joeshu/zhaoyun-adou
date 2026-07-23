'use strict';
// 自动重叠检测：逐屏渲染 Canvas 游戏，读取 btn() 注册的按钮矩形，程序化找出重叠对。
// 只覆盖真正的「按钮 vs 按钮」重叠（panel/卡片不注册进 btns，天然降噪）。
// 滚动容器(clipList)内的按钮先做裁剪相交，避免把屏外列表行误报为重叠。
const { chromium } = require('C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8384/';

const screens = ['menu','lab','modes','camp','forge','shop','wish','command','ach','ghost','save','daily','help','stats','equip','roster'];

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 440, height: 760 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cv', { timeout: 10000 });
  await page.evaluate(() => { try { SAVE.tutorial = 0; if (typeof G !== 'undefined' && G) G.tutorial = 0; } catch (e) {} });
  await page.waitForTimeout(300);

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
      const cover = oa / small;                          // 较小按钮被覆盖比例
      res.push({ a: a.label, b: b.label, ox: Math.round(ox), oy: Math.round(oy), cover: +cover.toFixed(2),
                 aPos: [a.x, a.y, a.w, a.h].map(Math.round), bPos: [b.x, b.y, b.w, b.h].map(Math.round) });
    }
    return res;
  };

  let totalBug = 0, totalContain = 0;
  for (const s of screens) {
    let overlaps;
    try { overlaps = await page.evaluate(scanFn, s); }
    catch (e) { console.log(`[${s}] 扫描失败: ${e.message}`); continue; }
    if (!overlaps.length) { console.log(`[${s}] OK 无重叠`); continue; }
    // 分类：cover>0.9 视为包含(多是有意的图标压卡片)，0.1~0.9 视为部分重叠(疑似 bug)
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
  }

  // 战斗屏
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
    const partial = overlaps.filter(o => o.cover <= 0.9);
    if (partial.length) {
      totalBug += partial.length;
      console.log(`\n[game] ⚠ 部分重叠 ${partial.length} 处(疑似 bug):`);
      partial.forEach(o => console.log(`   「${o.a}」${JSON.stringify(o.aPos)} × 「${o.b}」${JSON.stringify(o.bPos)}  覆盖${(o.cover*100)|0}%`));
    } else console.log('[game] OK 无重叠');
  } catch (e) { console.log('[game] 扫描失败:', e.message); }

  console.log(`\n========== 汇总：疑似 bug ${totalBug} 处，包含关系(复核) ${totalContain} 处 ==========`);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
