'use strict';
// 地图/棋盘/皮肤 视觉升级验证：逐张地图进入战斗并截图（playwright-core + MS Edge）
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8384/';
const OUT = path.resolve(__dirname, 'shots_maps');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 440, height: 760 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cv', { timeout: 10000 });
  await page.evaluate(() => { try { SAVE.tutorial = 0; } catch (e) {} });
  await page.waitForTimeout(300);
  const canvas = page.locator('#cv');

  // 预置：拥有武将 + 强制展示限定皮肤（currentSkin 直接读 SAVE.skins，绕过解锁判定，便于视觉核对）
  await page.evaluate(() => {
    SAVE.ownedHeroes = Object.assign({}, SAVE.ownedHeroes, { 赵云: true, 关羽: true, 张飞: true, 黄忠: true });
    SAVE.leadHero = '赵云';
    SAVE.skins = { 赵云: 'gold', 关羽: 'gold', 张飞: 'dark', 黄忠: 'eagle' };
    SAVE.mapSkin = 0;
  });

  for (let mi = 0; mi <= 3; mi++) {
    try {
      const diag = await page.evaluate((mapIdx) => {
        startBattle(1, false, mapIdx);
        scr = 'game';
        G.P.mantou = 999;
        // 把主将（赵云）与抽到的卡部署到开放格
        const open = G.P.cells.map((c, i) => (c.open ? i : -1)).filter(i => i >= 0);
        // 主将已在 bar[0]
        let placed = 0;
        if (G.P.bar[0] && G.P.bar[0].unit) { dropUnit(G.P, 'bar', 0, 'board', open[placed]); placed++; }
        // 先摆放限定皮肤英雄，确保皮肤可见；再用小兵填满剩余开放格
        const heroes = [['关羽', 'gold'], ['张飞', 'dark'], ['黄忠', 'eagle']];
        for (const [n, sid] of heroes) {
          if (placed >= open.length) break;
          if (!SAVE.ownedHeroes[n]) SAVE.ownedHeroes[n] = true;
          SAVE.skins[n] = sid;
          G.P.cells[open[placed]].unit = mkHero(n, G.P);
          placed++;
        }
        // 补几张：用抽卡填满剩余开放格
        for (let k = 0; k < 8 && placed < open.length; k++) {
          doSummon(G.P);
          for (let b = 0; b < G.P.bar.length && placed < open.length; b++) {
            if (G.P.bar[b] && G.P.bar[b].unit) { dropUnit(G.P, 'bar', b, 'board', open[placed]); placed++; }
          }
        }
        // 敌场放两个怪，验证敌路（红）与敌色怪
        if (G.E.path && G.E.path[4]) { const p = G.E.path[4]; G.E.mobs.push({ type: '兵', x: p[0], y: p[1], hp: 32, maxhp: 32, boss: false }); }
        if (G.E.path && G.E.path[6]) { const p = G.E.path[6]; G.E.mobs.push({ type: '骑', x: p[0], y: p[1], hp: 70, maxhp: 70, boss: false }); }
        try { draw(); } catch (e) { return { err: 'draw:' + e.message }; }
        return { ok: true, map: MAPS[mapIdx].name, placed, cells: G.P.cells.length };
      }, mi);
      console.log('map', mi, JSON.stringify(diag));
      await page.waitForTimeout(450);
      await canvas.screenshot({ path: path.join(OUT, 'map' + mi + '_' + (['changban', 'chibi', 'jieoting', 'hangu'][mi]) + '.png') });
      console.log('shot OK: map' + mi);
    } catch (e) {
      console.log('shot FAIL: map' + mi, e.message);
    }
  }

  // 额外：函谷关带 mapSkin=3（霜夜 finish）验证无崩溃
  try {
    await page.evaluate(() => { SAVE.mapSkin = 3; startBattle(1, false, 3); scr = 'game'; try { draw(); } catch (e) { return { err: e.message }; } return { ok: true }; });
    await page.waitForTimeout(400);
    await canvas.screenshot({ path: path.join(OUT, 'map3_frost.png') });
    console.log('shot OK: map3_frost');
  } catch (e) { console.log('shot FAIL: map3_frost', e.message); }

  console.log('--- page errors ---');
  console.log(errors.length ? errors.join('\n') : 'none');
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
