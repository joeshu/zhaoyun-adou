'use strict';
const path = require('path');
const { chromium } = require('C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8384/';

(async () => {
  const errors = [];
  const browser = await chromium.launch({ executablePath: EDGE, channel: 'msedge', args: ['--no-sandbox', '--enable-features=Touch', '--touch-events=enabled'] });
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e && e.stack ? e.stack : e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console.error] ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  async function tap(x, y) { try { await page.touchscreen.tap(x, y); } catch (e) { console.log('tap fail', x, y, e.message); } }
  await tap(270, 303);
  await page.waitForTimeout(400);

  // 仅抽卡 + 部署（不碰顶部暂停/加速）
  const taps = [
    [39, 650], [39, 650], [39, 650], [39, 650],   // 抽卡 x4
    // 尝试把合成栏第1个拖到棋盘开放格（board 大概坐标）
    [39, 622], [120, 300],
    [39, 650], [39, 650],
  ];
  let lastTime = -1, frozenAt = -1;
  for (let i = 0; i < 32; i++) {
    if (i < taps.length) {
      const [x, y] = taps[i];
      // 模拟拖拽：pointerdown -> move -> up
      try {
        await page.evaluate(([x, y]) => {
          const c = document.getElementById('cv');
          const r = c.getBoundingClientRect();
          const cx = r.left + x, cy = r.top + y;
          const opts = (tx, ty, type) => ({ bubbles: true, cancelable: true, clientX: r.left + tx, clientY: r.top + ty, pointerId: 1, pointerType: 'touch', isPrimary: true });
          c.dispatchEvent(new PointerEvent('pointerdown', opts(x, y)));
          c.dispatchEvent(new PointerEvent('pointermove', opts(tx2(x), ty2(y))));
          c.dispatchEvent(new PointerEvent('pointerup', opts(tx2(x), ty2(y))));
          function tx2(a){return a;} function ty2(a){return a-40;}
        }, [x, y]);
      } catch (e) { console.log('drag fail', e.message); }
    }
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      try { return { scr: typeof scr !== 'undefined' ? scr : '?', G: typeof G !== 'undefined' && G ? { state: G.state, wave: G.wave, mobsP: G.P.mobs.length, time: Math.round(G.time * 10) / 10, paused: !!G.paused, bar: G.P.bar.filter(b => b.unit).length, drag: !!window.drag } : null }; }
      catch (e) { return { evalErr: String(e) }; }
    });
    console.log('t=' + (i + 1) + 's', JSON.stringify(st));
    if (st.G && typeof st.G.time === 'number' && !st.G.paused) {
      if (lastTime >= 0 && st.G.time === lastTime && st.G.state === 'play') { if (frozenAt < 0) frozenAt = i + 1; }
      else frozenAt = -1;
      lastTime = st.G.time;
    } else { lastTime = -1; }
  }
  if (frozenAt > 0) console.log('>>> SUSPECTED FREEZE at ~' + frozenAt + 's');
  console.log('=== ERRORS (' + errors.length + ') ===');
  errors.slice(0, 20).forEach(e => console.log(e));
  await browser.close();
})().catch(e => { console.error('SCRIPT FAIL', e); process.exit(1); });
