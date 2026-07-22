/* 赵云与阿斗 v2 -- 全量静态数据表（无 DOM） */
'use strict';

/* ---------- 布局 ---------- */
const W = 375, H = 667, TOP = 32, CELL = 48;
// 全局 UI 安全区：战斗界面不得绕开这些区域直接硬编码坐标。
const UI_LAYOUT = {
  topBar: { y: 0, h: 32 }, enemyField: { y: 32, h: 264 }, messageBand: { y: 296, h: 28 }, playerField: { y: 324, h: 204 },
  heroStatus: { y: 498, h: 24 }, handRows: [538, 584], actionBar: { y: 636, h: 28 },
  recycle: { x: 288, y: 636, w: 80, h: 28 }, tempDrawer: { x: 8, y: 504, w: 272, h: 66 },
};
// 底部合成栏 2×5 + 操作行（不随战场变）
const BAR_ROWS = UI_LAYOUT.handRows, BAR_COLS = [45, 113, 181, 249, 317], BAR_N = 10;
const RECYCLE = UI_LAYOUT.recycle;

function pathCum(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++)
    c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return c;
}

/* ---------- 战场地图（多套可选，路径/布阵格/列可不同） ---------- */
// 敌方战区 32..296（阿斗在顶），我方战区 300..532（阿斗在底）
const MAPS = [
  {   // 0 长坂坡：原布局
    name: '长坂坡', effect: { name: '百姓补给', tip: '每18秒双方获得馒头补给', iv: 18 },
    PATH_P: [[8, 324], [367, 324], [367, 380], [8, 380], [8, 436], [367, 436], [367, 492], [187, 492], [187, 524]],
    PATH_E: [[8, 258], [367, 258], [367, 202], [8, 202], [8, 146], [367, 146], [367, 90], [187, 90], [187, 66]],
    ROWS_P: [352, 408, 464], ROWS_E: [230, 174, 118],   // 行0=前排(近出怪口)
    COLS: [51, 119, 187, 255, 323],
    ADOU_P: { x: 187, y: 536 }, ADOU_E: { x: 187, y: 58 },
    open: [1, 2, 3, 6, 7, 8],   // 原开放格索引（3行×5列）
  },
  {   // 1 赤壁：折返更短、我方4行布阵（更密），列位不同
    name: '赤壁', effect: { name: '江风水势', tip: '每18秒水势减缓双方敌军', iv: 18 },
    PATH_P: [[8, 332], [367, 332], [367, 392], [8, 392], [8, 452], [367, 452], [367, 512], [187, 512], [187, 528]],
    PATH_E: [[8, 250], [367, 250], [367, 190], [8, 190], [8, 130], [367, 130], [367, 70], [187, 70], [187, 54]],
    ROWS_P: [340, 396, 452, 500], ROWS_E: [242, 186, 130, 82],
    COLS: [40, 108, 187, 266, 334],
    ADOU_P: { x: 187, y: 536 }, ADOU_E: { x: 187, y: 58 },
    openRows: 2,   // 前2行全开（4行×5列=20格，开10格）
  },
];
// 旧常量保留作兼容引用（不删，避免隐式依赖）
const ADOU_P = MAPS[0].ADOU_P, ADOU_E = MAPS[0].ADOU_E;
const PATH_P = MAPS[0].PATH_P, PATH_E = MAPS[0].PATH_E;
const ROWS_P = MAPS[0].ROWS_P, ROWS_E = MAPS[0].ROWS_E;
const COLS = MAPS[0].COLS;
const CUM_P = pathCum(PATH_P), CUM_E = pathCum(PATH_E);
function pathPos(pts, cum, d) {
  const len = cum[cum.length - 1];
  d = Math.max(0, Math.min(len, d));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t };
}

/* ---------- 工具 ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
function wpick(pairs) {
  let s = 0; for (const p of pairs) s += p[1];
  let r = Math.random() * s;
  for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
  return pairs[0][0];
}

/* ---------- 兵种（7 种）×品级（白绿蓝紫橙） ---------- */
const TIER_MUL = [1, 2, 4, 8, 16];
const TIER_NAME = ['白', '绿', '蓝', '紫', '橙'];
const TIER_COL = ['#868e96', '#2f9e44', '#1c7ed6', '#9c36b5', '#e8a005'];
const TROOPS = {
  卒: { rng: 36,  rate: 1.4, dmg: 5,  hp: 45,  kind: 'single', w: 18, tip: '廉价填线' },
  刀: { rng: 40,  rate: 1.5, dmg: 8,  hp: 70,  kind: 'single', w: 13, tip: '前排快攻' },
  枪: { rng: 46,  rate: 1.0, dmg: 12, hp: 60,  kind: 'pierce', pierceN: 2, w: 13, tip: '克骑破甲' },
  弓: { rng: 120, rate: 1.1, dmg: 9,  hp: 34,  kind: 'single', w: 13, tip: '后排远程' },
  骑: { rng: 60,  rate: 0.9, dmg: 13, hp: 80,  kind: 'splash', splash: 26, w: 10, tip: '突击克弩' },
  盾: { rng: 34,  rate: 0.8, dmg: 4,  hp: 240, kind: 'single', taunt: true, w: 8, tip: '嘲讽堵路' },
  甲: { rng: 34,  rate: 0.7, dmg: 6,  hp: 170, kind: 'single', armor: 0.5, w: 6, tip: '减伤抗BOSS' },
};

/* ---------- 武将（橙6 + 紫6） ---------- */
// 橙将 ATK/攻速按抽卡文档 6.1；HP 保留引擎量级（文档 HP 40-80 扛不住围殴节奏）
const HEROES = {
  赵云: { wq: '枪', grade: 4, rng: 999, rate: 1.2, dmg: 25, hp: 130, kind: 'lane', skill: { id: 'qjqc', cd: 9 },  tip: '贯穿横道·七进七出' },
  张飞: { wq: '刀', grade: 4, rng: 90,  rate: 0.9, dmg: 18, hp: 260, kind: 'splash', splash: 40, skill: { id: 'dahe', cd: 10, r: 110, stun: 2 }, tip: '范围·大喝眩晕' },
  关羽: { wq: '刀', grade: 4, rng: 70,  rate: 1.0, dmg: 30, hp: 180, kind: 'single', skill: { id: 'tiaopi', cd: 9, n: 3, splash: 35 }, tip: '单体斩·跳劈击退' },
  刘备: { wq: '剑', grade: 4, rng: 85,  rate: 1.0, dmg: 12, hp: 150, kind: 'splash', splash: 30, skill: { id: 'shengjian', cd: 8, r: 95, stun: 0.8 }, aura: 0.15, tip: '圣剑击倒·全队增伤15%' },
  黄忠: { wq: '弓', grade: 4, rng: 150, rate: 0.9, dmg: 22, hp: 85,  kind: 'single', skill: { id: 'huojian', cd: 11, stun: 0.5 }, tip: '远程·火箭烈全屏' },
  马超: { wq: '枪', grade: 4, rng: 62,  rate: 1.3, dmg: 20, hp: 160, kind: 'single', stunP: 0.2, vs骑: 2, tip: '突刺·概率眩晕克骑' },
  张辽: { wq: '枪', grade: 4, rng: 70,  rate: 1.2, dmg: 22, hp: 150, kind: 'lane', skill: { id: 'qjqc', cd: 9 }, vs骑: 1.5, tip: '突袭·贯穿横道克骑' },
  太史慈: { wq: '弓', grade: 4, rng: 145, rate: 0.9, dmg: 21, hp: 90,  kind: 'single', skill: { id: 'huojian', cd: 11, stun: 0.5 }, tip: '远程·火箭烈全屏' },
  典韦: { wq: '刀', grade: 4, rng: 88,  rate: 0.9, dmg: 16, hp: 280, kind: 'splash', splash: 40, skill: { id: 'dahe', cd: 10, r: 110, stun: 2 }, tip: '范围·大喝眩晕肉盾' },
  甘宁: { wq: '刀', grade: 4, rng: 72,  rate: 1.0, dmg: 24, hp: 170, kind: 'single', skill: { id: 'tiaopi', cd: 9, n: 3, splash: 35 }, tip: '跳劈击退溅射' },
  吕布: { wq: '枪', grade: 4, rng: 66,  rate: 1.4, dmg: 28, hp: 200, kind: 'lane', skill: { id: 'qjqc', cd: 8 }, vs骑: 2, tip: '无双·贯穿横道超模' },
  许褚: { wq: '剑', grade: 4, rng: 60,  rate: 0.8, dmg: 14, hp: 320, kind: 'splash', splash: 30, skill: { id: 'shengjian', cd: 8, r: 95, stun: 0.8 }, aura: 0.12, tip: '圣剑击倒·全队增伤12%' },
  关平: { wq: '刀', grade: 3, rng: 80,  rate: 0.8, dmg: 12, hp: 200, kind: 'splash', splash: 32, skill: { id: 'dahe', cd: 12, r: 90, stun: 2 }, tip: '大喝眩晕（张飞下位）' },
  关兴: { wq: '枪', grade: 3, rng: 58,  rate: 1.0, dmg: 12, hp: 130, kind: 'single', stunP: 0.15, tip: '概率眩晕' },
  张苞: { wq: '枪', grade: 3, rng: 58,  rate: 1.0, dmg: 12, hp: 130, kind: 'single', stunP: 0.15, tip: '概率眩晕' },
  张翼: { wq: '刀', grade: 3, rng: 66,  rate: 0.9, dmg: 20, hp: 140, kind: 'single', skill: { id: 'tiaopi', cd: 11, n: 2, splash: 30 }, tip: '跳斩溅射（关羽下位）' },
  黄祖: { wq: '弓', grade: 3, rng: 130, rate: 1.1, dmg: 10, hp: 70,  kind: 'single', skill: { id: 'jianyu', cd: 12, n: 12 }, tip: '箭雨AOE' },
  黄盖: { wq: '剑', grade: 3, rng: 60,  rate: 0.8, dmg: 8,  hp: 300, kind: 'splash', splash: 26, tip: '纯肉盾' },
};
const HERO_LIST = Object.keys(HEROES);
const CHAR_POOL = [...new Set(HERO_LIST.join(''))];      // 18 个碎片字（毛笔化字用）
const HERO_ORANGE = HERO_LIST.filter(n => HEROES[n].grade === 4);
const POOL_CHARS = [...HERO_ORANGE.join('')];            // 卡池 12 橙将碎片字（文档 2.2，各 1.25%）
const HERO_LVL_DMG = l => Math.pow(1.5, l - 1);          // 文档 6.2：×1.5^(N-1)
const HERO_LVL_HP = l => Math.pow(1.5, l - 1);
const HERO_LVL_RATE = l => 1 + 0.1 * (l - 1);            // 攻速每级 +10%
const HERO_KILLS_UP = l => 6 * l;                        // 击杀升级门槛

/* ---------- 羁绊 ---------- */
const FATES = [
  { id: 'taoyuan', name: '桃园羁绊', need: ['刘备', '关羽', '张飞'], dmg: 1.3, def: 0.7 },
  { id: 'wuhu', name: '五虎羁绊', need: ['赵云', '关羽', '张飞', '马超', '黄忠'], dmg: 1.15, rate: 1.2 },
  { id: 'fuzi', name: '父子羁绊', pairs: [['关羽', '关平'], ['张飞', '张苞']], dmg: 1.1, def: 0.9 },
];

/* ---------- 装备扩展：防具/饰品（q9 简化版，默认关，菜单开） ---------- */
const ARMORS = {
  tengpai: { name: '藤牌', def: 0.15, tip: '阿斗减伤15%' },
  jinjia:  { name: '金甲', def: 0.30, tip: '阿斗减伤30%' },
};
const ACCESSORIES = {
  yugui:   { name: '玉圭', spd: 1.15, tip: '英雄攻速+15%' },
  zhanpei: { name: '战佩', spd: 1.30, tip: '英雄攻速+30%' },
};

/* ---------- 装备（蓝/紫/橙专属） ---------- */
const WEAPONS = {
  b_dao:  { name: '铁刀',   wq: '刀', q: 2, tip: '伤害+12%' },
  b_qng:  { name: '精铁枪', wq: '枪', q: 2, tip: '伤害+12%' },
  b_gong: { name: '硬木弓', wq: '弓', q: 2, tip: '伤害+12%' },
  b_jian: { name: '青铜剑', wq: '剑', q: 2, tip: '伤害+12%' },
  guding: { name: '古锭刀', wq: '刀', q: 3, tip: '25%概率双倍伤害' },
  hutou:  { name: '虎头湛金枪', wq: '枪', q: 3, tip: '伤害+40%' },
  tietai: { name: '铁胎弓', wq: '弓', q: 3, tip: '伤害+25%' },
  diangang: { name: '点钢枪', wq: '枪', q: 3, tip: '穿透+1' },
  goulian: { name: '钩镰枪', wq: '枪', q: 3, tip: '20%概率减速' },
  bawang: { name: '霸王弓', wq: '弓', q: 3, tip: '射程+30%' },
  longdan: { name: '龙胆亮银枪', wq: '枪', q: 4, lock: '赵云', tip: '10%召唤飞枪全场打击' },
  shemao: { name: '丈八蛇矛', wq: '刀', q: 4, lock: '张飞', tip: '灵蛇拦路·升级+1条·大喝翻倍攻速' },
  luori:  { name: '落日弓', wq: '弓', q: 4, lock: '黄忠', tip: '射程翻倍·越远伤害越高' },
  qinglong: { name: '青龙偃月刀', wq: '刀', q: 4, lock: '关羽', tip: '跳劈范围+50%·伤害+20%' },
  yitian: { name: '倚天剑', wq: '剑', q: 4, lock: '刘备', tip: '技能冷却-30%' },
};
const Q_COL = { 2: '#1c7ed6', 3: '#9c36b5', 4: '#e8a005' };
const Q_NAME = { 2: '蓝', 3: '紫', 4: '橙' };
const FORGE_COST = { gold: 50, mat: 2 };

/* ---------- 道具（主动6 + 被动6，携带6格主动≤2） ---------- */
const ITEMS = {
  yunshi:   { name: '陨石',   act: true, uses: 2, price: 120, tip: '全屏轰炸 150 伤害' },
  shenbing: { name: '神兵符', act: true, uses: 2, price: 120, tip: '点武将：等级+1' },
  gongsu:   { name: '攻速符', act: true, uses: 2, price: 120, tip: '点武将：攻速+100%' },
  maobi:    { name: '毛笔',   act: true, uses: 1, price: 120, tip: '点将字：改成配对字' },
  xiangyao: { name: '降妖符', act: true, uses: 2, price: 120, tip: 'BOSS眩晕3秒+重伤' },
  yuni:     { name: '淤泥',   act: true, uses: 2, price: 100, tip: '全场怪减速5秒' },
  nongmin:  { name: '农民',   act: false, price: 150, tip: '馒头产出2/秒' },
  zhaoxian: { name: '招贤令', act: false, price: 150, tip: '武将字概率+60%' },
  luoyang:  { name: '洛阳铲', act: false, price: 100, tip: '每45秒送一把铲子' },
  lajitong: { name: '垃圾桶', act: false, price: 80,  tip: '回收返还×1.5' },
  dabuwan:  { name: '大补丸', act: false, price: 120, tip: '阿斗血量上限+2' },
  xuming:   { name: '续命丹', act: false, price: 100, tip: '阿斗濒死回3血(每局一次)' },
  juexing:  { name: '觉醒丹', act: true, uses: 3, price: 200, tip: '点武将：觉醒+1级(全属性×1.3，上限3)' },
};
const LOADOUT_MAX = 6, LOADOUT_ACT_MAX = 2;

/* ---------- 怪物与 BOSS（击杀馒头按文档 7.1：步3 弓4 骑6 甲8 BOSS30） ---------- */
const MOBS = {
  兵: { hp: 32,  spd: 30, atk: 6,  dmg: 1, gold: 3 },
  卒: { hp: 22,  spd: 52, atk: 5,  dmg: 1, gold: 3 },
  骑: { hp: 70,  spd: 62, atk: 10, dmg: 1, gold: 6, vs弓: 2 },
  弩: { hp: 48,  spd: 36, atk: 8,  dmg: 1, gold: 4, archer: true, tip: '远程消耗阿斗' },
  斧: { hp: 180, spd: 22, atk: 14, dmg: 2, gold: 8, armor: 0.6, tip: '持斧重甲' },
  狂: { hp: 42,  spd: 88, atk: 6,  dmg: 1, gold: 4, tip: '高速突进' },
  粮: { hp: 65, spd: 26, atk: 0, dmg: 0, gold: 10, supply: true, tip: '补给车：击毁获得额外馒头' },
  // 5 BOSS 按文档 5.3：HP/技能对齐，速度按 0.15-0.5 相对值 ×80 映射
  梁: { hp: 200,  spd: 32, atk: 12, dmg: 3, gold: 30, boss: true, castIv: 8, cast: 'shehun', stunT: 3, name: '张梁', tip: '摄魂:每8秒全军瘫痪3秒' },
  铁: { hp: 400,  spd: 24, atk: 14, dmg: 3, gold: 30, boss: true, charge: true, castIv: 9, cast: 'summon', name: '重甲骑兵', tip: '冲锋:半血速度翻倍·召唤斧手' },
  统: { hp: 600,  spd: 16, atk: 16, dmg: 3, gold: 30, boss: true, castIv: 5, cast: 'volley', name: '弓箭统领', tip: '箭雨:每5秒射3格' },
  帅: { hp: 800,  spd: 40, atk: 18, dmg: 3, gold: 30, boss: true, rush: true, castIv: 8, cast: 'summon', name: '骑兵统帅', tip: '疾驰:无视嘲讽直冲·召唤骑兵' },
  兽: { hp: 1200, spd: 12, atk: 20, dmg: 3, gold: 30, boss: true, armor: 0.5, castIv: 11, cast: 'summon', name: '铁甲巨兽', tip: '铁壁:减伤50%·召唤卒众' },
  曹: { hp: 2000, spd: 16, atk: 24, dmg: 3, gold: 30, boss: true, castIv: 10, cast: 'summon', rage: true, name: '曹操', tip: '召唤小兵·低血狂暴' },
  懿: { hp: 2600, spd: 14, atk: 26, dmg: 3, gold: 40, boss: true, castIv: 9, cast: 'summon', rage: true, name: '司马懿', tip: '召唤死士·低血狂暴' },
};
// 克制：枪 vs 甲怪(armor)×2；骑 vs 弩×2；怪骑 打 弓兵×2；马超 vs 骑×2
const ADOU_HP = 3;
const INCOME_IV = 5, INCOME_N = 3;                 // 基础每5秒+3馒头；农民=2馒头/秒（文档7.1）

/* ---------- 抽卡（文档一/二/三章） ---------- */
const DRAW = {
  cost: 10,                                        // 10 馒头一抽
  counts: [[5, 40], [6, 45], [7, 15]],             // 出 5/6/7 张概率
  pityN: 3,                                        // 连续 3 次无将字 → 下次必出
  tenCost: 90,                                     // 十连保底 1 完整武将（文档：降价至90）
};
// 单张概率（%）：兵种65 铲10 将字15(12字×1.25) 道具碎片10
const POOL_TROOP = [['刀', 13], ['枪', 12], ['弓', 12], ['骑', 10], ['盾', 10], ['卒', 8]];
const IFRAGS = {                                   // 特殊道具碎片：集 need 个合成整件
  速: { item: 'gongsu',   need: 3, w: 3 },
  神: { item: 'shenbing', need: 3, w: 3 },
  陨: { item: 'yunshi',   need: 2, w: 2.5 },
  贤: { item: 'zhaoxian', need: 2, w: 1.5 },
};

/* ---------- 30 关逐关配置（文档 5.2）：[波次数, 每波敌数, [步,弓,骑,甲]%, BOSS, HP加成, ATK档] ---------- */
const STAGES = [
  [3, 3,  [100, 0, 0, 0],   null, 0,   1],
  [3, 4,  [80, 20, 0, 0],   null, 5,   1],
  [4, 4,  [70, 30, 0, 0],   null, 10,  1],
  [4, 5,  [60, 30, 10, 0],  null, 15,  1],
  [5, 5,  [50, 30, 20, 0],  '梁', 20,  2],
  [5, 6,  [40, 30, 25, 5],  null, 25,  2],
  [5, 6,  [35, 30, 25, 10], null, 30,  2],
  [6, 6,  [30, 30, 25, 15], null, 35,  2],
  [6, 7,  [25, 30, 25, 20], null, 40,  2],
  [6, 7,  [20, 30, 25, 25], '铁', 50,  3],
  [6, 8,  [15, 30, 30, 25], null, 55,  3],
  [7, 8,  [10, 30, 30, 30], null, 60,  3],
  [7, 8,  [10, 25, 30, 35], null, 65,  3],
  [7, 9,  [5, 25, 30, 40],  null, 70,  3],
  [7, 9,  [5, 25, 30, 40],  '统', 80,  4],
  [8, 9,  [5, 25, 30, 40],  null, 85,  4],
  [8, 10, [5, 25, 30, 40],  null, 90,  4],
  [8, 10, [5, 20, 30, 45],  null, 95,  4],
  [8, 10, [5, 20, 30, 45],  null, 100, 4],
  [8, 11, [5, 20, 30, 45],  '帅', 120, 5],
  [9, 11, [5, 20, 25, 50],  null, 125, 5],
  [9, 11, [5, 20, 25, 50],  null, 130, 5],
  [9, 12, [5, 15, 25, 55],  null, 135, 5],
  [9, 12, [5, 15, 25, 55],  null, 140, 5],
  [9, 12, [5, 15, 25, 55],  '兽', 160, 6],
  [10, 12, [5, 15, 20, 60], null, 165, 6],
  [10, 13, [5, 15, 20, 60], null, 170, 6],
  [10, 13, [5, 10, 20, 65], null, 175, 6],
  [10, 13, [5, 10, 20, 65], null, 180, 6],
  [10, 15, [5, 10, 20, 65], '曹', 200, 8],
  // 第四章 三分归晋（31-37）：难度平滑爬升，终关司马懿
  [10, 15, [5, 10, 20, 65], null, 210, 8],
  [11, 15, [5, 10, 18, 67], null, 220, 8],
  [11, 16, [5, 8, 18, 69],  null, 230, 8],
  [11, 16, [5, 8, 15, 72],  null, 245, 8],
  [12, 16, [5, 8, 15, 72],  null, 260, 9],
  [12, 17, [5, 5, 15, 75],  null, 280, 9],
  [12, 18, [5, 5, 12, 78],  '懿', 320, 10],
];
// 压力怪阈值：随关卡进度降低（玩家越强越易施压），难度档微调；整数运算无浮点偏差
function pressureKills(stage, diff) {
  const base = Math.max(4, 10 - Math.floor((stage - 1) / 5));   // 10→4 平滑下降
  const dm = { easy: 1.2, normal: 1, hard: 0.85 }[diff] || 1;
  return Math.max(3, Math.round(base * dm));
}
const STAGE_MAX = 37;
const CHAPTERS = ['黄巾之乱', '群雄逐鹿', '赤壁鏖兵', '三分归晋'];
const EGGS = { flag: { stage: 15, ch: '旗', x: 340, y: 470 }, vine: { stage: 28, ch: '藤', x: 356, y: 396 } };

/* ---------- 成就系统（P1-1） ----------
   id → { name, desc, reward{gold,mat}, check(SAVE,G?) → bool } */
const ACHIEVEMENTS = [
  { id: 'first_summon', name: '初出茅庐', desc: '完成第一次抽卡', reward: { gold: 30 },
    check: () => (SAVE.stats && SAVE.stats.summons > 0) || (G && G.P && G.P.summons > 0) || SAVE.tutorial >= 99 },
  { id: 'first_hero', name: '得良将', desc: '合成首位武将', reward: { gold: 50, mat: 1 },
    check: () => SAVE.weapons !== undefined && Object.keys(SAVE.equips || {}).length >= 0 },
  { id: 'first_win', name: '首战告捷', desc: '通关第1关', reward: { gold: 50 },
    check: () => SAVE.stage >= 2 },
  { id: 'stage10', name: '十连斩', desc: '通关第10关', reward: { gold: 100, mat: 2 },
    check: () => SAVE.stage >= 11 },
  { id: 'stage20', name: '老练将领', desc: '通关第20关', reward: { gold: 200, mat: 3 },
    check: () => SAVE.stage >= 21 },
  { id: 'stage30', name: '一统中原', desc: '通关第30关', reward: { gold: 500, mat: 5 },
    check: () => SAVE.endless || SAVE.stage >= 31 },
  { id: 'stage37', name: '三分归晋', desc: '通关全部37关', reward: { gold: 1000, mat: 10 },
    check: () => SAVE.stage >= 37 },
  { id: 'forge5', name: '匠师', desc: '拥有5把武器', reward: { gold: 80 },
    check: () => SAVE.weapons.length >= 5 },
  { id: 'forge_all', name: '神兵尽揽', desc: '收集全部15把武器', reward: { gold: 500, mat: 5 },
    check: () => SAVE.weapons.length >= Object.keys(WEAPONS).length },
  { id: 'egg_one', name: '藏宝图', desc: '收集任意1个彩蛋', reward: { gold: 50 },
    check: () => SAVE.eggs.flag || SAVE.eggs.vine || SAVE.eggs.acc },
  { id: 'egg_all', name: '集齐彩蛋', desc: '收集全部3个彩蛋', reward: { gold: 200, mat: 3 },
    check: () => SAVE.eggs.flag && SAVE.eggs.vine && SAVE.eggs.acc },
  { id: 'wish_set', name: '心有所属', desc: '设置心愿单', reward: { gold: 30 },
    check: () => !!SAVE.wish },
  { id: 'endless10', name: '无尽探索者', desc: '无尽模式突破10波', reward: { gold: 100, mat: 2 },
    check: () => SAVE.bestWave >= 10 },
  { id: 'endless30', name: '无尽征服者', desc: '无尽模式突破30波', reward: { gold: 300, mat: 5 },
    check: () => SAVE.bestWave >= 30 },
  { id: 'hard_clear', name: '硬核玩家', desc: '困难难度通关任意关卡', reward: { gold: 150 },
    check: () => SAVE.difficulty === 'hard' && SAVE.stage >= 2 },
];
function checkAchievements() {
  let unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (SAVE.ach[a.id]) continue;
    try {
      if (a.check()) {
        SAVE.ach[a.id] = true;
        SAVE.gold += a.reward.gold || 0;
        SAVE.mat += a.reward.mat || 0;
        unlocked.push(a);
      }
    } catch (e) { /* 单条成就检查失败不影响其他 */ }
  }
  return unlocked;
}

/* ---------- P2-1 皮肤系统 ----------
   每位武将 2-3 套皮肤，纯视觉（颜色/装饰），不影响数值
   解锁条件类型：
     'default'           默认
     'eggs_all'          全彩蛋达成
     'stage_10/20/30/37' 通关对应关卡
     'endless_30/100'    无尽波数
     'kills_500/2000'    累计击杀
     'ach:<id>'          解锁对应成就
     'wish_<name>'       心愿单设为该武将 */
const SKIN_DECOR = { none: '', star: '★', diamond: '◈', flame: '✦', gold: '✦' };
const SKINS = {
  '赵云': [
    { id: 'default', name: '常山', col: null, decor: 'none',     cond: 'default' },
    { id: 'flag',    name: '旗将军', col: '#f59f00', decor: 'star',  cond: 'eggs.flag' },
    { id: 'gold',    name: '金甲', col: '#fab005', decor: 'gold',   cond: 'eggs_all' },
    { id: 'fire',    name: '常胜', col: '#e03131', decor: 'flame',  cond: 'stage_30' },
  ],
  '关羽': [
    { id: 'default', name: '汉寿', col: null, decor: 'none',    cond: 'default' },
    { id: 'red',     name: '武圣', col: '#a61e4e', decor: 'star', cond: 'stage_20' },
    { id: 'gold',    name: '帝君', col: '#fab005', decor: 'gold', cond: 'eggs_all' },
  ],
  '张飞': [
    { id: 'default', name: '燕人', col: null, decor: 'none',    cond: 'default' },
    { id: 'dark',    name: '黑骑', col: '#212529', decor: 'star', cond: 'stage_10' },
    { id: 'gold',    name: '万人敌', col: '#fab005', decor: 'gold', cond: 'eggs_all' },
  ],
  '刘备': [
    { id: 'default', name: '皇叔', col: null, decor: 'none',    cond: 'default' },
    { id: 'royal',   name: '昭烈', col: '#1c7ed6', decor: 'star', cond: 'stage_37' },
    { id: 'gold',    name: '仁君', col: '#fab005', decor: 'gold', cond: 'eggs_all' },
  ],
  '马超': [
    { id: 'default', name: '西凉', col: null, decor: 'none',    cond: 'default' },
    { id: 'silver',  name: '锦马', col: '#868e96', decor: 'star', cond: 'stage_15' },
    { id: 'gold',    name: '神威', col: '#fab005', decor: 'gold', cond: 'eggs_all' },
  ],
  '黄忠': [
    { id: 'default', name: '老将', col: null, decor: 'none',    cond: 'default' },
    { id: 'eagle',   name: '神射', col: '#2f9e44', decor: 'star', cond: 'kills_500' },
    { id: 'gold',    name: '烈弓', col: '#fab005', decor: 'gold', cond: 'eggs_all' },
  ],
};
// 默认皮肤：未在 SKINS 表中的武将使用此通用皮肤组
const SKIN_DEFAULT = [
  { id: 'default', name: '常服', col: null, decor: 'none', cond: 'default' },
  { id: 'gold',    name: '金装', col: '#fab005', decor: 'gold', cond: 'eggs_all' },
];
function heroSkins(name) {
  return SKINS[name] || SKIN_DEFAULT;
}
// 检查皮肤解锁条件：返回 true/false
function checkSkinUnlock(name, cond) {
  if (!cond || cond === 'default') return true;
  try {
    if (cond === 'eggs_all') return !!(SAVE.eggs && SAVE.eggs.all);
    if (cond === 'stage_10') return SAVE.stage >= 11;
    if (cond === 'stage_15') return SAVE.stage >= 16;
    if (cond === 'stage_20') return SAVE.stage >= 21;
    if (cond === 'stage_30') return SAVE.endless || SAVE.stage >= 31;
    if (cond === 'stage_37') return SAVE.stage >= 37;
    if (cond === 'endless_30') return (SAVE.bestWave || 0) >= 30;
    if (cond === 'endless_100') return (SAVE.bestWave || 0) >= 100;
    if (cond === 'kills_500') return ((SAVE.stats && SAVE.stats.kills) || 0) >= 500;
    if (cond === 'kills_2000') return ((SAVE.stats && SAVE.stats.kills) || 0) >= 2000;
    if (cond.startsWith('eggs.')) {
      const k = cond.slice(5);
      return !!(SAVE.eggs && SAVE.eggs[k]);
    }
    if (cond.startsWith('ach:')) return !!SAVE.ach[cond.slice(4)];
    if (cond.startsWith('wish_')) return SAVE.wish === cond.slice(5);
  } catch (e) { /* 防御 */ }
  return false;
}
// 当前选中皮肤：未设置则取 default
function currentSkin(name) {
  const skins = heroSkins(name);
  const id = (SAVE.skins && SAVE.skins[name]) || 'default';
  return skins.find(s => s.id === id) || skins[0];
}
// 切换皮肤：循环到下一已解锁皮肤
function cycleSkin(name) {
  const skins = heroSkins(name);
  const cur = currentSkin(name).id;
  const idx = skins.findIndex(s => s.id === cur);
  for (let i = 1; i <= skins.length; i++) {
    const next = skins[(idx + i) % skins.length];
    if (checkSkinUnlock(name, next.cond)) {
      if (!SAVE.skins) SAVE.skins = {};
      if (next.id === 'default') delete SAVE.skins[name];
      else SAVE.skins[name] = next.id;
      saveSave();
      return next;
    }
  }
  return null;
}
