'use strict';
// 视觉返工验证：4 张地图 × 标准/浓墨 共 8 张截图（viewport 375×667）
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8384/';
const OUT = path.resolve(__dirname, 'shots_maps');
fs.mkdirSync(OUT, { recursive: true });

const mapNames = ['changban', 'chibi', 'jieoting', 'hangu'];

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cv', { timeout: 10000 });
  await page.evaluate(() => { try { SAVE.tutorial = 0; } catch (e) {} });
  await page.waitForTimeout(300);
  const canvas = page.locator('#cv');

  await page.evaluate(() => {
    SAVE.ownedHeroes = Object.assign({}, SAVE.ownedHeroes, { 赵云: true, 关羽: true, 张飞: true, 黄忠: true, 马超: true });
    SAVE.leadHero = '赵云';
    SAVE.skins = { 赵云: 'gold', 关羽: 'gold', 张飞: 'dark', 黄忠: 'eagle', 马超: 'silver' };
  });

  for (let mi = 0; mi <= 3; mi++) {
    for (const bold of [0, 1]) {
      const suffix = bold ? 'bold' : 'std';
      try {
        const diag = await page.evaluate(({ mapIdx, intensity }) => {
          SAVE.mapSkin = intensity;
          startBattle(1, false, mapIdx);
          scr = 'game';
          G.P.mantou = 999;
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
          if (G.E.path && G.E.path[4]) { const p = G.E.path[4]; G.E.mobs.push({ type: '兵', x: p[0], y: p[1], hp: 32, maxhp: 32, boss: false }); }
          if (G.E.path && G.E.path[6]) { const p = G.E.path[6]; G.E.mobs.push({ type: '骑', x: p[0], y: p[1], hp: 70, maxhp: 70, boss: false }); }
          try { draw(); } catch (e) { return { err: 'draw:' + e.message }; }
          return { ok: true, map: MAPS[mapIdx].name, placed, bold: intensity };
        }, { mapIdx: mi, intensity: bold });
        console.log('shot', mi, suffix, JSON.stringify(diag));
        await page.waitForTimeout(400);
        await canvas.screenshot({ path: path.join(OUT, 'map' + mi + '_' + mapNames[mi] + '_' + suffix + '.png') });
      } catch (e) {
        console.log('shot FAIL', mi, suffix, e.message);
      }
    }
  }

  console.log('--- page errors ---');
  console.log(errors.length ? errors.join('\n') : 'none');
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
