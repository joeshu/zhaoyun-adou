// v2.1 无头冒烟测试：node smoke.js（仅逻辑模拟，无渲染）
'use strict';
const fs = require('fs');
const FILES = ['data', 'save', 'audio', 'merge', 'battle', 'chapter', 'waves', 'modes', 'meta', 'actions', 'game'];
const src = FILES.map(f => fs.readFileSync(__dirname + '/js/' + f + '.js', 'utf8')).join('\n;\n');
eval(src + `
;(function () {
  const A = (c, m) => { if (!c) throw new Error('失败: ' + m); };

  // —— 数据表 ——
  A(HERO_LIST.length === 18, '18 位武将（含q7新增6橙将）');
  A(CHAR_POOL.length >= 16, '碎片字池');
  A(POOL_CHARS.length === 25, '卡池橙将碎片字25（12原将名去重汉字）');
  A(Object.keys(TROOPS).length === 7, '7 兵种');
  A(Object.keys(ITEMS).length === 13, '13 道具（含q8觉醒丹）');
  A(Object.keys(ARMORS).length === 2, '2 防具（q9）');
  A(Object.keys(ACCESSORIES).length === 2, '2 饰品（q9）');
  const pSum = POOL_TROOP.reduce((s, p) => s + p[1], 0) + 10 + 15
    + Object.values(IFRAGS).reduce((s, f) => s + f.w, 0);
  A(Math.abs(pSum - 100) < 1e-9, '卡池概率合计100%');
  A(STAGES.length === 37, '37关配置表');
  A(STAGES[4][3] === '梁' && STAGES[9][3] === '铁' && STAGES[14][3] === '统'
    && STAGES[19][3] === '帅' && STAGES[24][3] === '兽' && STAGES[29][3] === '曹'
    && STAGES[36][3] === '懿', 'BOSS排程 5/10/15/20/25/30/37');
  A(MOBS.梁.hp === 200 && MOBS.曹.hp === 2000 && MOBS.兽.armor === 0.5, 'BOSS数值对齐文档');
  console.log('数据表 OK: 武将18 兵种7 道具13 关卡' + STAGES.length + ' 武器' + Object.keys(WEAPONS).length);

  // —— 合成规则 ——
  const t1 = mkTroop('刀'), t2 = mkTroop('刀');
  let o = mergeUnit(t1, t2);
  A(o.type === 'upgrade' && o.unit.tier === 2, '同型同级升品');
  const t5 = mkTroop('刀'); t5.tier = 5;
  A(mergeUnit(t5, { ...t5 }).type === 'swap', '橙级封顶');
  A(mergeUnit({ t: 'char', ch: '赵' }, { t: 'char', ch: '云' }).name === '赵云', '赵+云=赵云');
  A(mergeUnit({ t: 'char', ch: '云' }, { t: 'char', ch: '赵' }).name === '赵云', '云+赵 反向拖拽也可合成赵云');
  A(mergeUnit({ t: 'char', ch: '布' }, { t: 'char', ch: '吕' }).name === '吕布', '布+吕 反向拖拽可合成吕布');
  o = mergeUnit({ t: 'ifrag', ch: '速', n: 1 }, { t: 'ifrag', ch: '速', n: 1 });
  A(o.type === 'upgrade' && o.unit.n === 2, '速×2 仍是碎片');
  A(mergeUnit({ t: 'ifrag', ch: '速', n: 2 }, { t: 'ifrag', ch: '速', n: 1 }).type === 'item', '速×3 合成攻速符');
  A(mergeUnit({ t: 'ifrag', ch: '陨', n: 1 }, { t: 'ifrag', ch: '陨', n: 1 }).id === 'yunshi', '陨×2 合成陨石');
  console.log('合成规则 OK（含顺序校验与道具碎片）');

  // —— 存档/商店/锻造/穿戴 ——
  SAVE.gold = 2000; SAVE.mat = 40;
  A(buyItem('yunshi') && buyItem('shenbing') && buyItem('gongsu') && buyItem('nongmin'), '购买道具');
  A(toggleLoadout('yunshi') && toggleLoadout('shenbing'), '携带主动×2');
  A(!toggleLoadout('gongsu'), '第3个主动被拒');
  A(toggleLoadout('nongmin'), '携带被动');
  for (let i = 0; i < 15; i++) forge();
  A(SAVE.weapons.length > 0, '锻造出武器');
  console.log('商店/锻造 OK: 武器仓', SAVE.weapons.length, '把, 携带', SAVE.loadout.join(','));

  // —— 抽卡：10馒头出5-7张 ——
  SAVE.tutorial = 99;        // 关闭新手引导，避免影响抽卡测试
  startBattle(1);
  const P = G.P;
  P.mantou = 999;
  const cards = doSummon(P);
  A(cards && cards.length >= 5 && cards.length <= 7, '一次抽5-7张');
  A(P.bar.filter(s => s.unit).length === cards.length + 1, '主将占位后抽卡全部入栏');
  A(P.mantou === 999 - DRAW.cost, '固定10馒头');

  // —— 对局基本操作 ——
  P.bar[0].unit = mkTroop('刀'); P.bar[1].unit = mkTroop('刀');
  A(dropUnit(P, 'bar', 0, 'bar', 1) === 'upgrade' && P.bar[1].unit.tier === 2, '栏内二合一');
  A(dropUnit(P, 'bar', 1, 'board', 1) === 'move', '部署上阵');
  P.bar[0].unit = { t: 'shovel' };
  A(dropUnit(P, 'bar', 0, 'board', 0) === 'open' && P.cells[0].open, '铲子开荒');
  P.bar[0].unit = { t: 'char', ch: '赵' };
  A(dropUnit(P, 'bar', 0, 'board', 5) === null, '将字不可上阵');
  P.bar[1].unit = { t: 'char', ch: '云' };
  A(dropUnit(P, 'bar', 1, 'bar', 0) === 'hero' && P.bar[0].unit.name === '赵云', '拼字成将');
  const m0 = P.mantou;
  P.bar[2].unit = mkTroop('卒');
  recycleUnit(P, 'bar', 2);
  A(P.mantou > m0, '回收返还馒头');
  console.log('抽卡/合成/部署/铲子/回收 OK');

  // —— 保底：连3次无将字后必出 ——
  let miss = 0, maxMiss = 0;
  for (let i = 0; i < 200; i++) {
    P.bar.forEach(s => { s.unit = null; });
    P.mantou = 999;
    const cs = doSummon(P);
    if (cs.some(u => u.t === 'char')) miss = 0;
    else { miss++; maxMiss = Math.max(maxMiss, miss); }
  }
  A(maxMiss <= DRAW.pityN, '保底生效(最长连miss=' + maxMiss + ')');

  // —— 十连保底完整武将 ——
  P.bar.forEach(s => { s.unit = null; });
  P.mantou = 200;
  const heroName = drawTen(P);
  A(typeof heroName === 'string' && HERO_ORANGE.includes(heroName), '十连返回橙将');
  A(P.bar.some(s => s.unit && s.unit.t === 'hero' && s.unit.name === heroName), '保底武将入栏');
  console.log('保底/十连 OK: 保底将', heroName);

  // —— 道具碎片合成 → 本局道具次数 ——
  const y0 = G.itemUses.yunshi || 0;
  P.bar[0].unit = { t: 'ifrag', ch: '陨', n: 1 }; P.bar[1].unit = { t: 'ifrag', ch: '陨', n: 1 };
  A(dropUnit(P, 'bar', 0, 'bar', 1) === 'item' && G.itemUses.yunshi === y0 + 1, '陨×2→陨石次数+1');
  P.bar[0].unit = { t: 'ifrag', ch: '速', n: 2 }; P.bar[1].unit = { t: 'ifrag', ch: '速', n: 1 };
  A(dropUnit(P, 'bar', 1, 'bar', 0) === 'item' && G.itemUses.gongsu === 1, '速×3→攻速符(未携带也可用)');
  P.bar[0].unit = { t: 'ifrag', ch: '贤', n: 1 }; P.bar[1].unit = { t: 'ifrag', ch: '贤', n: 1 };
  A(dropUnit(P, 'bar', 0, 'bar', 1) === 'item' && P.zhaoxian, '贤×2→本局招贤令');
  console.log('道具碎片 OK');

  // —— 馒头开荒 ——
  const cc = P.cells.findIndex(c => !c.open);
  P.mantou = 999;
  A(unlockCell(P, cc) && P.cells[cc].open && P.mantou === 999 - 20, '20馒头解锁格子');
  A(cellCost(P) === 30, '开荒成本递增');

  // —— 羁绊 ——
  P.cells[1].unit = mkHero('刘备', P); P.cells[2].unit = mkHero('关羽', P); P.cells[3].unit = mkHero('张飞', P);
  P.fate = fateBuff(P);
  A(P.fate.list.includes('桃园羁绊'), '桃园羁绊触发');
  P.cells[6].unit = mkHero('赵云', P); P.cells[7].unit = mkHero('马超', P); P.cells[8].unit = mkHero('黄忠', P);
  P.fate = fateBuff(P);
  A(P.fate.list.includes('五虎羁绊'), '五虎羁绊触发');
  console.log('羁绊 OK:', P.fate.list.join('/'));

  // —— 主动道具 ——
  spawnMob(P, '兵', 1); spawnMob(P, '兵', 1); spawnMob(P, '梁', 1);
  A(useActive('yunshi'), '陨石释放');
  A(P.mobs.filter(m => !m.boss).every(m => m.hp <= 0), '陨石清小怪');
  A(P.mobs.find(m => m.boss).hp > 0, '张梁200血扛住150');
  A(useActive('shenbing') && G.targeting === 'shenbing', '神兵符进入选目标');
  A(applyTarget('shenbing', 'board', 6) && P.cells[6].unit.lvl === 2, '神兵符升级赵云');
  G.itemUses.gongsu = 1; G.targeting = 'gongsu';
  A(autoTargetActive() && !G.targeting, '主动道具自动施放并退出选目标');
  console.log('主动道具 OK');

  // —— 彩蛋 ——
  startBattle(15);
  A(G.egg && G.egg.ch === '旗', '15关旗彩蛋出现');
  collectEgg();
  A(SAVE.eggs.flag, '旗彩蛋收集');
  console.log('彩蛋 OK');

  // —— 整局：AI 代打双方，打完全部波次或分出胜负 ——
  SAVE.stage = 1;
  startBattle(1);
  let pT = 0;
  for (let i = 0; i < 60 * 900 && G.state === 'play'; i++) {
    const dt = 1 / 60;
    pT -= dt;
    if (G.chapterChoice) chooseRefugee(false);
    if (pT <= 0) { pT = 1.0; aiAct(G.P); }
    update(dt);
  }
  console.log('整局:', G.state, '| 波', G.wave + '/' + stageCfg(1)[0], '| 我心', G.P.hp, '| 敌心', G.E.hp, '| 用时', Math.round(G.time) + 's');
  A(G.state !== 'play', '900 秒内分出胜负');
  A(G.wave >= 2, '波次推进');
  if (G.state === 'win') A(SAVE.stage === 2, '主线进度推进');

  // —— P1-4 录像录制/回放验证 ——
  A(G.rec && G.rec.ops.length > 0, 'P1-4 玩家操作已录制 (ops=' + (G.rec ? G.rec.ops.length : 0) + ')');
  A(Array.isArray(SAVE.ghosts) && SAVE.ghosts.length > 0, 'P1-4 胜利后录像已保存 (本地 ' + (SAVE.ghosts ? SAVE.ghosts.length : 0) + ' 条)');
  // 录像回放：用同一局 ghost 重放，验证 tickGhost 能推进 ops 索引且 state 能进入 win
  const rec0 = SAVE.ghosts[0];
  A(rec0 && rec0.ops && rec0.ops.length > 0, 'P1-4 录像 ops 非空');
  startBattle(rec0.stage, false, 0, rec0);     // 第4参数 = ghost 对象
  A(G.ghostMode === true && G.ghostIdx === 0, 'P1-4 进入 ghost 回放模式');
  let gT = 0;
  for (let i = 0; i < 60 * 900 && G.state === 'play'; i++) {
    const dt = 1 / 60;
    gT -= dt;
    if (gT <= 0) { gT = 1.0; aiAct(G.E); }    // 仅敌方 AI（玩家由 ghost 回放）
    update(dt);
  }
  console.log('录像回放:', G.state, '| ghostIdx', G.ghostIdx + '/' + rec0.ops.length, '| 用时', Math.round(G.time) + 's');
  A(G.ghostIdx >= rec0.ops.length || G.state !== 'play', 'P1-4 ghost 回放触发完成或对局结束');
  A(G.state === 'win' || G.state === 'lose', 'P1-4 ghost 回放能分出胜负');
  console.log('录像系统 OK: 录制 ' + rec0.ops.length + ' 步，回放结束于 ' + G.state);

  // —— P2-1 皮肤系统验证 ——
  A(typeof SKINS === 'object' && Object.keys(SKINS).length >= 6, 'P2-1 至少6位武将有专属皮肤');
  A(typeof SKIN_DEFAULT === 'object' && SKIN_DEFAULT.length >= 2, 'P2-1 默认皮肤组');
  A(typeof heroSkins === 'function' && typeof checkSkinUnlock === 'function', 'P2-1 函数齐全');
  // 默认皮肤永远解锁
  A(checkSkinUnlock('赵云', 'default') === true, 'P2-1 default 始终解锁');
  // 关卡条件
  SAVE.stage = 21;
  A(checkSkinUnlock('关羽', 'stage_20') === true, 'P2-1 stage_20 解锁');
  A(checkSkinUnlock('张飞', 'stage_10') === true, 'P2-1 stage_10 解锁');
  SAVE.stage = 1;
  A(checkSkinUnlock('关羽', 'stage_20') === false, 'P2-1 stage_20 未达未解锁');
  // 累计击杀条件
  SAVE.stats = SAVE.stats || {};
  SAVE.stats.kills = 0;
  A(checkSkinUnlock('黄忠', 'kills_500') === false, 'P2-1 kills_500 未达');
  SAVE.stats.kills = 600;
  A(checkSkinUnlock('黄忠', 'kills_500') === true, 'P2-1 kills_500 达成');
  // 彩蛋条件
  SAVE.eggs.flag = true;
  A(checkSkinUnlock('赵云', 'eggs.flag') === true, 'P2-1 eggs.flag 解锁');
  SAVE.eggs.all = true;
  A(checkSkinUnlock('赵云', 'eggs_all') === true, 'P2-1 eggs_all 解锁');
  // currentSkin：未设置取 default
  delete SAVE.skins.赵云;
  const defSk = currentSkin('赵云');
  A(defSk && defSk.id === 'default', 'P2-1 默认皮肤');
  // cycleSkin 循环到下一已解锁皮肤（赵云此时已解锁 default/flag/gold）
  const next = cycleSkin('赵云');
  A(next && next.id !== 'default', 'P2-1 切换到非默认皮肤 (' + (next ? next.id : 'null') + ')');
  A(SAVE.skins.赵云 === next.id, 'P2-1 切换已写入 SAVE.skins');
  // 再切回 default
  cycleSkin('赵云'); cycleSkin('赵云');
  A((SAVE.skins.赵云 || 'default') === 'default' || !SAVE.skins.赵云, 'P2-1 循环切回 default');
  console.log('皮肤系统 OK: 6+武将专属皮肤，解锁条件生效，切换正常');

  // —— P2-2 数据统计验证 ——
  A(SAVE.stats && typeof SAVE.stats === 'object', 'P2-2 stats 字段存在');
  A(SAVE.stats.wins >= 1, 'P2-2 胜场已累计 (' + SAVE.stats.wins + ')');
  A(SAVE.stats.kills >= 600, 'P2-2 击杀已累计 (' + SAVE.stats.kills + ')');
  A(SAVE.stats.summons > 0, 'P2-2 抽卡已累计 (' + SAVE.stats.summons + ')');
  A(SAVE.stats.merges > 0, 'P2-2 合成已累计 (' + SAVE.stats.merges + ')');
  A(SAVE.stats.heroes > 0, 'P2-2 武将已累计 (' + SAVE.stats.heroes + ')');
  A(SAVE.stats.playTime > 0, 'P2-2 时长已累计 (' + SAVE.stats.playTime.toFixed(1) + 's)');
  A(SAVE.stats.goldEarned > 0, 'P2-2 金币收益已累计 (' + SAVE.stats.goldEarned + ')');
  // 旧档迁移：构造 v3 存档验证迁移到最新版
  const v3 = { ver: 3, gold: 100, stage: 1, eggs: { flag: false, vine: false, acc: false, all: false } };
  const v5 = migrateSave(JSON.parse(JSON.stringify(v3)));
  A(v5 && v5.ver === 6, '军师系统 v3→v6 migrate 升版');
  A(v5.skins && typeof v5.skins === 'object', '迁移补 skins');
  A(v5.stats && v5.stats.kills === 0 && v5.stats.wins === 0, '迁移补 stats 默认值');
  A(v5.ownedHeroes['赵云'] && v5.leadHero === '赵云', '迁移赠送赵云初始主将');
  console.log('统计系统 OK: wins=' + SAVE.stats.wins + ' kills=' + SAVE.stats.kills + ' merges=' + SAVE.stats.merges + ' heroes=' + SAVE.stats.heroes + ' migrate v3→v5 通过');

  // —— 永久主将：20 碎片招募 / 开局携带 / 升星 ——
  SAVE.ownedHeroes = { '赵云': true }; SAVE.heroStars = { '赵云': 1 }; SAVE.heroShards = { '吕布': 19 }; SAVE.leadHero = '赵云';
  const unlock = grantHeroShard('吕布');
  A(unlock.unlocked && SAVE.ownedHeroes['吕布'] && heroStar('吕布') === 1, '20 碎片解锁永久吕布');
  setLeadHero('吕布'); startBattle(1);
  A(G.P.bar.some(s => s.unit && s.unit.permanent && s.unit.name === '吕布'), '主将开局进入合成栏');
  console.log('永久主将 OK: 20碎片招募、主将开局携带');

  // —— 特别玩法：模式状态与独立胜利条件 ——
  SAVE.stage = 37;
  ['fire', 'rogue', 'escort', 'puzzle', 'raid'].forEach(id => {
    startBattle(12, false, id === 'fire' ? 1 : 0, null, { mode: id });
    A(G.mode === id, id + ' 模式初始化');
    A(G.modeLabel === specialMode(id).name, id + ' 模式标签');
  });
  startBattle(12, false, 0, null, { mode: 'puzzle' });
  G.P.totalKills = G.puzzle.target; modeTick(0.1);
  A(G.state === 'win', '残局挑战达到击杀目标结算');
  startBattle(12, false, 1, null, { mode: 'fire' });
  SAVE.invincible = true;
  for (let i = 0; i < 60 * 70 && G.state === 'play'; i++) update(1 / 60);
  A(G.P.mobs.length <= 10 && G.E.mobs.length <= 10, '火攻模式保留镜像战场且双方敌军上限10');
  SAVE.invincible = false;
  console.log('特别玩法 OK: 火攻/试炼/护送/残局/讨伐');

  console.log('冒烟测试全部通过');
})();
`);
