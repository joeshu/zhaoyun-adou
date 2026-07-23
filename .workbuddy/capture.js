'use strict';
// 用 playwright-core 驱动系统 MS Edge，渲染 Canvas 游戏并逐屏截图。
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/35002/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:8384/';
const OUT = path.resolve(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const screens = [
  ['menu', 'menu'],
  ['lab', 'lab'],
  ['modes', 'modes'],
  ['camp', 'camp'],
  ['forge', 'forge'],
  ['shop', 'shop'],
  ['wish', 'wish'],
  ['command', 'command'],
  ['ach', 'ach'],
  ['ghost', 'ghost'],
  ['save', 'save'],
  ['daily', 'daily'],
  ['help', 'help'],
  ['stats', 'stats'],
  ['equip', 'equip'],
  ['roster', 'roster'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 440, height: 760 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cv', { timeout: 10000 });
  // 关闭新手引导覆盖层，便于看清各界面
  await page.evaluate(() => { try { SAVE.tutorial = 0; if (typeof G !== 'undefined' && G) G.tutorial = 0; } catch (e) {} });
  await page.waitForTimeout(300);

  const canvas = page.locator('#cv');

  // 主菜单及各个二级界面
  for (const [name, scr] of screens) {
    try {
      await page.evaluate((s) => { scr = s; }, scr);
      await page.waitForTimeout(280);
      await canvas.screenshot({ path: path.join(OUT, name + '.png') });
      console.log('shot OK:', name);
    } catch (e) {
      console.log('shot FAIL:', name, e.message);
    }
  }

  // 战斗初始（空棋盘）：验证 顶栏 / 荒格 / 资源图标 / 双阿斗
  try {
    const diag = await page.evaluate(() => {
      startBattle(1);
      scr = 'game';                        // startBattle 不设置 scr；菜单按钮自己设
      try { draw(); } catch (e) { return { err: 'draw:' + e.message, scr, Gexists: !!G }; }
      return { scr, Gexists: !!G, Gshake: G && G.shake, stage: G && G.stage, wave: G && G.wave };
    });
    console.log('battle diag:', JSON.stringify(diag));
    await page.waitForTimeout(500);
    await canvas.screenshot({ path: path.join(OUT, 'battle_initial.png') });
    console.log('shot OK: battle_initial');
  } catch (e) { console.log('shot FAIL: battle_initial', e.message); }

  // 战斗 + 部署单位：验证单位渲染 / 顶栏按钮组 / 战斗 HUD
  try {
    await page.evaluate(() => {
      startBattle(1);
      scr = 'game';
      G.P.mantou = 999;
      doSummon(G.P);
      if (G.P.bar[0] && G.P.bar[0].unit) dropUnit(G.P, 'bar', 0, 'board', 1);
      if (G.P.bar[1] && G.P.bar[1].unit) dropUnit(G.P, 'bar', 1, 'board', 2);
      try { draw(); } catch (e) {}
    });
    await page.waitForTimeout(600);
    await canvas.screenshot({ path: path.join(OUT, 'battle_units.png') });
    console.log('shot OK: battle_units');
  } catch (e) { console.log('shot FAIL: battle_units', e.message); }

  console.log('--- page errors ---');
  console.log(errors.length ? errors.join('\n') : 'none');
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
