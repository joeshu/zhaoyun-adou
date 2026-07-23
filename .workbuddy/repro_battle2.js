'use strict';
const path = require('path');
const { chromium } = require('C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8384/';

(async () => {
  const errors = [];
  const browser = await chromium.launch({ executablePath: EDGE, channel: 'msedge', args: ['--no-sandbox', '--enable-features=Touch', '--touch-events=enabled'] });
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e && e.stack ? e.stack : e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console.error] ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 移动端触摸点击：开战
  async function tap(x, y) { try { await page.touchscreen.tap(x, y); } catch (e) { console.log('tap fail', x, y, e.message); } }
  await tap(270, 303);
  await page.waitForTimeout(500);
  // 备战中模拟玩家操作：抽卡几次、点撤销、点加速
  const clicks = [
    [39, 650],   // 抽卡
    [39, 650],
    [39, 650],
    [273, 16],   // 暂停/播放
    [240, 16],   // 加速 ×2
    [39, 650],
  ];
  let lastTime = -1, frozenAt = -1;
  for (let i = 0; i < 30; i++) {
    if (i < clicks.length) { await tap(clicks[i][0], clicks[i][1]); }
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      try { return { scr: typeof scr !== 'undefined' ? scr : '?', G: typeof G !== 'undefined' && G ? { state: G.state, wave: G.wave, mobsP: G.P.mobs.length, mobsE: G.E.mobs.length, time: Math.round(G.time * 10) / 10, bar: G.P.bar.filter(b => b.unit).length } : null }; }
      catch (e) { return { evalErr: String(e) }; }
    });
    console.log('t=' + (i + 1) + 's', JSON.stringify(st));
    if (st.G && typeof st.G.time === 'number') {
      if (lastTime >= 0 && st.G.time === lastTime && st.G.state === 'play') { if (frozenAt < 0) frozenAt = i + 1; }
      else frozenAt = -1;
      lastTime = st.G.time;
    }
  }
  if (frozenAt > 0) console.log('>>> SUSPECTED FREEZE at ~' + frozenAt + 's');
  console.log('=== ERRORS (' + errors.length + ') ===');
  errors.slice(0, 20).forEach(e => console.log(e));
  await browser.close();
})().catch(e => { console.error('SCRIPT FAIL', e); process.exit(1); });
