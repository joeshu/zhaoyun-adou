'use strict';
const path = require('path');
const { chromium } = require('C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8384/';

(async () => {
  const errors = [];
  const logs = [];
  const browser = await chromium.launch({ executablePath: EDGE, channel: 'msedge', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e && e.stack ? e.stack : e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push('[' + m.type() + '] ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 点击「开战」：btn(195,290,150,26) 中心 ≈ (270, 303)
  await page.mouse.click(270, 303);
  let lastTime = -1, frozenAt = -1;
  for (let i = 0; i < 36; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      try { return { scr: typeof scr !== 'undefined' ? scr : '?', G: typeof G !== 'undefined' && G ? { state: G.state, wave: G.wave, mobsP: G.P.mobs.length, mobsE: G.E.mobs.length, betweenT: Math.round(G.betweenT * 10) / 10, time: Math.round(G.time * 10) / 10, spawnQ: G.spawnQ.length, parts: G.parts.length, floats: G.floats.length } : null }; }
      catch (e) { return { evalErr: String(e) }; }
    });
    console.log('t=' + (i + 1) + 's', JSON.stringify(st));
    if (st.G && typeof st.G.time === 'number') {
      if (lastTime >= 0 && st.G.time === lastTime && st.G.state === 'play') {
        if (frozenAt < 0) frozenAt = i + 1;
      } else frozenAt = -1;
      lastTime = st.G.time;
    }
  }
  if (frozenAt > 0) console.log('>>> SUSPECTED FREEZE at ~' + frozenAt + 's (G.time stopped advancing)');

  console.log('=== PAGEERRORS (' + errors.length + ') ===');
  errors.forEach(e => console.log(e));
  console.log('=== CONSOLE ERR/WARN (' + logs.length + ') ===');
  logs.slice(0, 30).forEach(l => console.log(l));
  await browser.close();
})().catch(e => { console.error('SCRIPT FAIL', e); process.exit(1); });
