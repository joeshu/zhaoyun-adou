'use strict';
const path = require('path');
const { chromium } = require('C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8384/';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, channel: 'msedge', args: ['--no-sandbox', '--touch-events=enabled'] });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + (e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : e)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const stages = [1, 3, 5, 8, 10, 15, 20, 25, 30];
  const maps = [0, 1, 2, 3];
  for (const stage of stages) {
    for (const m of maps) {
      errs.length = 0;
      await page.evaluate(({ stage, m }) => {
        try { if (typeof startBattle === 'function') { startBattle(stage, false, m); scr = 'game'; } } catch (e) { window.__sbErr = String(e); }
      }, { stage, m });
      let last = -1, frozen = -1, err = '';
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(700);
        const s = await page.evaluate(() => {
          try { return { t: typeof G !== 'undefined' && G ? Math.round(G.time * 10) / 10 : -1, paused: G ? !!G.paused : false, err: window.__sbErr || null }; }
          catch (e) { return { t: -2, err: String(e) }; }
        });
        if (s.err) { err = s.err; break; }
        if (typeof s.t === 'number' && s.t >= 0 && !s.paused) {
          if (last >= 0 && s.t === last) { if (frozen < 0) frozen = i; }
          else frozen = -1;
          last = s.t;
        }
      }
      const status = err ? 'THREW: ' + err : (frozen > 0 ? 'FROZEN@~' + (frozen * 0.7).toFixed(1) + 's' : 'ok');
      console.log(`stage=${stage} map=${m} -> ${status}`);
      if (errs.length) errs.forEach(e => console.log('   ' + e));
    }
  }
  await browser.close();
})().catch(e => { console.error('SCRIPT FAIL', e); process.exit(1); });
