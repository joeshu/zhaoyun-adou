'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8384/';
const OUT = path.resolve(__dirname, 'shots_inspect');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 440, height: 760 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cv');
  await page.evaluate(() => { try { SAVE.tutorial = 0; } catch (e) {} });
  await page.waitForTimeout(300);
  const canvas = page.locator('#cv');
  await page.evaluate(() => {
    SAVE.ownedHeroes = Object.assign({}, SAVE.ownedHeroes, { 赵云: true, 关羽: true, 张飞: true, 黄忠: true, 马超: true });
    SAVE.leadHero = '赵云';
    SAVE.skins = { 赵云: 'gold', 关羽: 'gold', 张飞: 'dark', 黄忠: 'eagle', 马超: 'silver' };
    SAVE.mapSkin = 0;
  });
  for (let mi = 0; mi <= 3; mi++) {
    await page.evaluate((mapIdx) => {
      startBattle(1, false, mapIdx); scr = 'game'; G.P.mantou = 999;
      const open = G.P.cells.map((c, i) => (c.open ? i : -1)).filter(i => i >= 0);
      let placed = 0;
      if (G.P.bar[0] && G.P.bar[0].unit) { dropUnit(G.P, 'bar', 0, 'board', open[placed]); placed++; }
      const heroes = [['关羽','gold'],['张飞','dark'],['黄忠','eagle'],['马超','silver']];
      for (const [n, sid] of heroes) {
        if (placed >= open.length) break;
        if (!SAVE.ownedHeroes[n]) SAVE.ownedHeroes[n] = true;
        SAVE.skins[n] = sid;
        G.P.cells[open[placed]].unit = mkHero(n, G.P); placed++;
      }
      for (let k = 0; k < 6 && placed < open.length; k++) {
        doSummon(G.P);
        for (let b = 0; b < G.P.bar.length && placed < open.length; b++)
          if (G.P.bar[b] && G.P.bar[b].unit) { dropUnit(G.P, 'bar', b, 'board', open[placed]); placed++; }
      }
      // 强制触发五虎羁绊横幅，定位“破阵”徽标落点（t>10 保持可见）
      G.banner = { txt: '五虎破阵：全线冲锋', t: 100 };
      try { draw(); } catch (e) { return { err: 'draw:' + e.message }; }
      return { ok: true };
    }, mi);
    await page.waitForTimeout(350);
    await canvas.screenshot({ path: path.join(OUT, 'insp' + mi + '.png') });
  }
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
