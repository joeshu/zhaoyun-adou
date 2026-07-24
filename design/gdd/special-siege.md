# 特殊玩法 · 反向攻城·夺隘(siege) 设计规格（GDD）

> 第 6 个特殊模式：**镜像塔防**。普通塔防＝玩家架塔、敌沿 PATH 行军被你打死；siege 反过来＝**你是进攻方，突击队沿 PATH 上行，敌方在格上架静止防御工事（箭塔/炮塔/滚石）朝你射击，你要在部队被打光前突破隘口、砸开末端敌垒**。
> 与 rogue（你的纵队 vs 曹军纵队，军 vs 军）的区别：siege 的敌人是**静止防御塔**，不是行军纵队；siege **没有敌方 mob、没有双侧面模拟、没有 AI 镜像**。
>
> **铁律**：①所有新增逻辑以 `G.mode==='siege'` 门控，严禁改动 fire/rogue/escort/puzzle/raid/普通模式任何逻辑与数值；②严禁改动全局数值平衡（射程/攻速/伤害魔数不动，SIEGE_* 倍率只作用于本局、不溢出全局）；③复用现有合成/布阵/波次/战斗内核，只改胜利目标与交互方式；④常量集中 modes.js 顶部，函数命名 `siegeXxx`；⑤只产设计规格，不动任何 .js。

---

## 一、核心设计

### 1.1 核心支柱 + MDA 一句话
- **美学（MDA）**：Challenge + Sensation ——「我带着一支能动的兵，在敌方箭雨炮火里硬凿出一条血路，把敌垒轰开」。
- **玩家心理（为何爽）**：
  - *逆向掌控感*：平时你是守方、看塔打人；现在你是攻方、真带着兵往上冲，视角翻转的新鲜感。
  - *压强抉择*：工事越靠末端越密，你必须在「突进硬闯」与「集火破垒」之间分配有限指令 CD，每一道关都是读图决策。
- **设计支柱（2 条）**：
  1. **镜像攻城**：你是进攻方，敌方是静止工事朝你射击（普通塔防的镜面）。
  2. **兵将真动**：你的突击队沿 PATH 真实行军、被射、突破、砸城——不是放塔等敌来。

### 1.2 核心循环（每帧/每秒玩家在做什么）
1. **战前编成**（开局一次）：3 选 1 突击编成预设（突骑陷阵 / 弓步协同 / 重甲攻坚）→ 决定领队与主战兵种。
2. **放出突击队**：`siegeBuildAssault()` 生成 `G.P.mobs` 沿 `SIEGE_PATH` 上行。
3. **实时指挥**：看工事火力分布，点 HUD 指令按钮——**突进**（加速穿越火网）/ **集火**（突破力×倍率砸城）/ **鼓舞**（回血续命）。
4. **突破隘口**：部队抵达末端 → 对 `G.siege.fort`（敌垒）结算突破力；敌垒血量归零 → 胜；突击队全灭或超时 → 败。

---

## 二、交互方案（候选 + 推荐）

| 候选 | 形态 | 取舍 |
|---|---|---|
| **A) 战前编成 + 实时指令按钮（推荐）** | 开局 3 选 1 编成（复用 rogue 列面板范式）；战斗中 3 个 HUD 指令按钮（突进/集火/鼓舞）各带 CD，点击即发（复用 `大招` 按钮范式） | **采用**。零新增输入手势；与 escort 点击/rogue 面板/大招按钮完全同源，不冲突；认知负荷不超现有模式 |
| B) 拖拽投放兵种到出击口 | 从合成栏拖兵到 PATH 起点投放 | 与现有 `drag`=部署语义重叠，且 siege 无 cells 部署，拖拽落点语义混乱 |
| C) 纯自动 + 仅放主动技 | 部队自动行军，玩家只点技能 | 「兵将能动」存在但「指挥感」弱，偏离支柱 1 的镜像攻城张力 |

**推荐 A**，理由：最贴合「镜像攻城 + 兵将真动」双支柱；战前编成复用 rogue 已验证的 `G.rogueChoices` 面板范式（此处为一次性选编成，非每层重选），实时指令复用 `manualUlt` 的 `大招×N` 按钮范式——**全部接缝都是已有的点击/按钮原语，不新增手势、不新增输入状态机**。`onDown` 在 siege 下不进入通用拖拽部署分支（cells 已全锁），只由 HUD 按钮派发指令。

---

## 三、敌方防御工事子系统（主要实现风险，重笔墨）

### 3.1 表示与坐标
敌方工事 = `G.siege.towers[]` 轻量数组，**非 mob、非 cell、非 unit**。每条：
`{ type, x, y, range, rate, dmg, col, glyph, atkT:0, hp:∞ }`。
类型属性集中在 `SIEGE_TOWER_DEFS`（数据驱动，镜像玩家塔量级）：

| type | glyph | range | rate(s) | dmg | 镜像对象 |
|---|---|---|---|---|---|
| 箭塔 | 箭 | 90 | 1.5 | 9 | 弩（archer） |
| 炮塔 | 炮 | 112 | 2.0 | 20 | 重炮/高伤慢速 |
| 滚石 | 石 | 60 | 1.0 | 14 | 落石/近身重击 |

`SIEGE_TOWERS`（沿 `SIEGE_PATH` 两侧布防，越靠末端越密；长坂坡坐标系，y∈[150,470] 避开顶栏 y=32 与 actionBar y=636）：
```
{ type:'箭塔', x:110, y:470 }, { type:'箭塔', x:264, y:470 },
{ type:'炮塔', x:88,  y:410 }, { type:'箭塔', x:286, y:410 },
{ type:'滚石', x:140, y:350 }, { type:'炮塔', x:236, y:290 },
{ type:'箭塔', x:120, y:250 }, { type:'箭塔', x:256, y:250 },
{ type:'滚石', x:140, y:180 }, { type:'炮塔', x:236, y:150 },
```
共 10 座，箭塔×5 / 炮塔×3 / 滚石×2，中段蛇形 PATH 使两侧均有交叉火力。

### 3.2 如何朝行军的我方部队射击（新子系统，最小接缝）
- **概念**：这是普通模式"玩家塔打敌军"的**镜像**——普通是 `G.P.cells[].unit`(=塔) 经 `updUnit`→`inRangeMobs`→`dealDmg(G.E,m,...)`；siege 是 `G.siege.towers[]`(=敌塔) 经 `siegeTickTowers`→找最近 `G.P.mob`→`siegeDealDmg(m,...)`。
- **为什么是新子系统而非复用 `updUnit`**：`updUnit` 作用在 `cell.unit` 上、攻击目标是 `S.mobs`（敌方 mob）。siege 的敌塔**不在任何 cell**（cells 全锁），目标是 `G.P.mobs`（玩家 mob）。二者数组与归属都不同，无法复用 `updUnit` 而不污染普通模式。故**新增独立 tick**，但内部逻辑极简（找最近 mob + 周期掉血 + 画线特效），与 `updUnit` 同构。
- **与现有玩家塔系统冲突吗**：**不冲突**。`siege` 下 `G.P.cells` 与 `G.E.cells` 在 `modeSetup` 全部 `open=false`，`updUnit` 对双方都无事可做（无 `cell.unit`）；`siegeTickTowers` 只跑在 `modeTick` 的 siege 分支、只读写 `G.siege.towers` 与 `G.P.mobs`。两套射击系统物理隔离，零交叉。
- **`siegeDealDmg` 必须独立**（不能复用 `dealDmg`）：`dealDmg(S,m,...)` 的 `S.side>0` 分支会在"击杀"时给**玩家**发馒头/金/连杀——若用 `dealDmg(G.P, 玩家mob, ...)` 让敌塔杀玩家兵，会错误给玩家发奖励。故仿 rogue 的 `rogueDealDmg`，`siegeDealDmg` 只做 `m.hp-=dmg; m.flash; if(<=0){m.dead; boom; deaths.push}`，**不含任何奖励/压力怪路径**。

### 3.3 工事是否可被摧毁（建议）
- **v1（推荐，本 GDD 落地范围）：工事永久、不可摧毁；胜利 = 砸开末端敌垒。** 理由：只新增"敌塔射击"这一个子系统，胜负干净（敌垒是唯一致败/致胜实体），完美贴合"只改胜利目标与交互方式、复用战斗内核"的铁律。玩家 offense = 让足够多部队活着抵达末端并砸城。
- **v1.5（可选拓展，非本版必做）**：允许近战/冲锋兵（骑、盾、甲）在工事射程内反击拆塔——在 `siegeUpdMob` 内对射程内 `tower` 结算 `tower.hp-=m.dmg`。需给 tower 加 `hp` 字段与死亡演出，是第二个新子系统，**列为 stretch，不在 v1**。

---

## 四、我方进攻部队

### 4.1 如何沿 PATH 行军（复用 rogueBuildColumn 思路 → siegeBuildAssault）
- `siegeBuildAssault()`：读 `G.siege.column`（战前编成选出的 `lead` + `queue`），在 `SIEGE_PATH` 上自底向上铺开突击队（领队在最前 `d` 最大，队列依次递减），完全镜像 `rogueBuildColumn`/`layoutRogueColumn`。
- 单位数值取自 `TROOPS`/`HEROES`（hp/dmg/rate/rng），按 siege 局部倍率放大；每个 mob 额外带 `break`（突破力 = `round(maxhp*0.2)+dmg`）与 `siegeAssault=true` 标记。
- **PATH 真动不卡死保障**：siege 仅玩家单方沿**单线** `SIEGE_PATH` 上行，敌方工事静止不占路，**不存在 rogue 的双向错身/互挡**问题；mob 顺序沿 `d` 排布，天然不互穿。沿用 `updMob` 的 `m.d += spd*dt` 行军骨架，但走专用 `siegeUpdMob`（见下），绝不会卡死。

### 4.2 部队与敌方工事如何交互
- **被射**：敌塔经 `siegeTickTowers` 对射程内最近我方 mob 结算 `siegeDealDmg`（§3.2）。
- **反击工事**：v1 不反击（工事永久，见 §3.3）；v1.5 可选（§3.3）。
- **抵达末端**：`siegeUpdMob` 中 `m.d >= S.len` → 对 `G.siege.fort` 结算突破力（`m.break * SIEGE_BREAK_MUL *（集火中?×SIEGE_FOCUS_BREAK）`），该 mob 被消耗（`dead=true`），敌垒血量归零即 `endBattle(true)`。

---

## 五、胜负条件与威胁

### 5.1 胜
- 末端敌垒 `G.siege.fort.hp <= 0` → `endBattle(true)`，文案「反向攻城·敌垒已破」。
- 触发点：任意部队抵达末端砸城使 fort.hp 归零（在 `siegeUpdMob` 或 `modeTick` 检测）。

### 5.2 败（单一清晰，避免双失败歧义）
1. **突击队全灭**：`G.siege.assaultReady && !G.P.mobs.length && G.siege.fort.hp>0` → `endBattle(false)`，文案「突击队全灭·攻城失败」。（在 `modeTick` 判定，前置 `assaultReady` 防止开局空列误判）
2. **攻城超时**：`G.modeTime <= 0 && G.siege.fort.hp>0` → `endBattle(false)`，文案「攻城超时」。

> **不沿用「阿斗营破」**：siege 敌方是静止工事、不向阿斗行军，`G.P.hp` 永不被敌方扣（敌塔只打 `G.P.mobs`）；`update()` 的 `G.P.hp<=0` 判负路径在 siege 下不会触发。故败因只有上述两条，无歧义。

### 5.3 威胁来源
- 敌方工事火力：箭塔持续点射、炮塔高伤慢速、滚石近身重击；**越靠末端（y 越小）布防越密、炮塔占比越高**（§3.1 坐标已体现），逼迫玩家用「突进」穿越密集段或用「集火」在残血时强砸。

---

## 六、数据表草案（SIEGE_* 常量初值，modes.js 顶部）

```js
// ========== 反向攻城·夺隘(siege) ==========
// 全部以 G.mode==='siege' 门控；玩家=进攻方沿 SIEGE_PATH 上行突破敌垒；敌方=静止工事(SIEGE_TOWERS)射击。
const SIEGE_TIME = 90;          // 攻城时限秒
const SIEGE_PATH = [            // 玩家突击 PATH（长坂坡坐标系，单线自下而上，中段轻微蛇形便于两侧布防）
  [187,524],[187,470],[140,410],[187,350],[234,290],[187,230],[187,150],[187,76]
];
const SIEGE_FORT = { x:187, y:66, hp:260, maxhp:260 };  // 末端敌垒(=隘口)，血量归零=破城
const SIEGE_BREAK_MUL  = 1.0;   // 突破力倍率（作用于每兵 break）
const SIEGE_RUSH_CD    = 12;    // 突进令 CD 秒
const SIEGE_RUSH_DUR   = 4;     // 突进持续秒
const SIEGE_RUSH_SPD   = 1.6;   // 突进期间突击队移速倍率
const SIEGE_FOCUS_CD   = 16;    // 集火令 CD 秒
const SIEGE_FOCUS_DUR  = 5;     // 集火持续秒
const SIEGE_FOCUS_BREAK= 1.8;   // 集火期间突破力额外倍率（砸城更强）
const SIEGE_HEAL_CD    = 20;    // 鼓舞令 CD 秒
const SIEGE_HEAL_AMT   = 0.35;  // 鼓舞：突击队按最大生命回复比例
const SIEGE_TOWER_DEFS = {      // 工事类型（镜像玩家塔量级，数据驱动）
  箭塔: { glyph:'箭', range:90,  rate:1.5, dmg:9,  col:'#c0392b' },
  炮塔: { glyph:'炮', range:112, rate:2.0, dmg:20, col:'#a61e4e' },
  滚石: { glyph:'石', range:60,  rate:1.0, dmg:14, col:'#8b5e3c' },
};
const SIEGE_TOWERS = [          // 沿 PATH 两侧布防，越靠末端越密
  { type:'箭塔', x:110, y:470 }, { type:'箭塔', x:264, y:470 },
  { type:'炮塔', x:88,  y:410 }, { type:'箭塔', x:286, y:410 },
  { type:'滚石', x:140, y:350 }, { type:'炮塔', x:236, y:290 },
  { type:'箭塔', x:120, y:250 }, { type:'箭塔', x:256, y:250 },
  { type:'滚石', x:140, y:180 }, { type:'炮塔', x:236, y:150 },
];
const SIEGE_PRESETS = [         // 战前 3 选 1 编成（复用 rogue 列面板范式）
  { n:'突骑陷阵', lead:'赵云', queue:['骑','骑','枪','刀','盾'], tip:'高速突破·七进七出' },
  { n:'弓步协同', lead:'黄忠', queue:['弓','弓','刀','枪','盾'], tip:'远程消耗·火箭烈' },
  { n:'重甲攻坚', lead:'张飞', queue:['盾','甲','枪','刀','骑'], tip:'铁壁扛塔·大喝控场' },
];
const SIEGE_ASSAULT_GAP = 34;   // 突击队沿 PATH 队列间隔(px)
const SIEGE_TROOP_SPD   = 30;   // 兵种行军速度(px/s，引擎量级 兵30~骑62 取低段)
const SIEGE_HERO_SPD    = 28;   // 主将行军速度(px/s)
const SIEGE_HP_MUL      = 1.4;  // 突击队局部血量倍率（仅本局，不溢出全局）
const SIEGE_DMG_MUL     = 1.2;  // 突击队局部伤害倍率（仅本局，不溢出全局）
```
- **突破力估算**：满编 ~10 兵，`break=round(maxhp*0.2)+dmg` 后单兵约 14（卒）~51（赵云），全队合计约 250~300；`SIEGE_FORT.hp=260` ⇒ 需约 90% 存活率方能破城；开「集火」×1.8 可显著降低门槛。数值为草案，首测后据实战留存率微调。
- **mobCap**：`mobCap('siege')` 返回 30（攻城无波次、突击队≤12，留护栏）。

---

## 七、与现有 modes.js 的接缝点（函数级）

### 7.1 `SPECIAL_MODES`（modes.js:4）
追加：`{ id:'siege', icon:'🏯', name:'反向攻城', sub:'夺隘破垒 · 逆袭敌营', col:'#8a6d3b', unlock: 24 }`。`startSpecialMode` 无需改（已 `startBattle(stage,false,0,null,{mode:id})`）。

### 7.2 `modeSetup`（modes.js:271）— 新增 siege 分支
```
} else if (G.mode === 'siege') {
  G.siege = {
    column: { lead: SIEGE_PRESETS[0].lead, queue: SIEGE_PRESETS[0].queue.slice(),
              dmgMul: SIEGE_DMG_MUL, hpMul: SIEGE_HP_MUL, speedMul: 1 },
    fort: { ...SIEGE_FORT },
    towers: SIEGE_TOWERS.map(t => ({ ...t, ...SIEGE_TOWER_DEFS[t.type], atkT: 0, hp: 1e9 })),
    rushT: 0, focusT: 0,
    cmds: { rush: 0, focus: 0, heal: 0 },
    assaultReady: false,
    build: true,            // 战前编成面板开启中
  };
  G.P.path = SIEGE_PATH; G.P.cum = pathCum(SIEGE_PATH); G.P.len = G.P.cum[G.P.cum.length-1];
  G.E.path = SIEGE_PATH; // 敌无 mob，仅占位
  G.P.cells.forEach(c => { c.open = false; c.unit = null; });   // 玩家不部署
  G.E.cells.forEach(c => { c.open = false; c.unit = null; });   // 敌方不部署（工事在 towers[]）
  G.modeTime = SIEGE_TIME;
  G.banner = { txt:'【反向攻城】编列突击队，突破敌垒', t: 3 };
  G.paused = true;   // 等战前编成确认
}
```
**战前编成面板**：复用 `G.rogueChoices` 同源 overlay（`drawGame` 中 `if (G.rogueChoices)` 块），新增 `if (G.siege && G.siege.build)` 块——3 个 preset 按钮，`chooseSiegePreset(i)` 写入 `G.siege.column` 并 `G.siege.build=false; G.paused=false; siegeBuildAssault(); G.siege.assaultReady=true;`。

### 7.3 `siegeBuildAssault()`（新增，modes.js）— 何时调
- 战前编成确认后调一次（生成 `G.P.mobs` 突击队）。结构镜像 `rogueBuildColumn`+`layoutRogueColumn`，用 `SIEGE_PATH` 与 `G.siege.column`，数值取自 `TROOPS`/`HEROES`×`SIEGE_*_MUL`，每 mob 带 `break` 与 `siegeAssault=true`。
- 不设"每层重建"（siege 是单次攻城，非 rogue 多 floor）。

### 7.4 `modeTick`（modes.js:342）— 新增 siege 分支
```
} else if (G.mode === 'siege') {
  const sg = G.siege;
  G.modeTime -= dt;
  // 指令 CD 递减
  for (const k of ['rush','focus','heal']) if (sg.cmds[k] > 0) sg.cmds[k] = Math.max(0, sg.cmds[k]-dt);
  if (sg.rushT > 0) sg.rushT -= dt;
  if (sg.focusT > 0) sg.focusT -= dt;
  siegeTickTowers(dt);                       // 敌工事射击玩家突击队
  if (sg.fort.hp <= 0) { sg.fort.hp = 0; endBattle(true); G.rewardTxt='反向攻城·敌垒已破'; return; }
  if (sg.assaultReady && !G.P.mobs.length) { endBattle(false); G.rewardTxt='突击队全灭·攻城失败'; return; }
  if (G.modeTime <= 0) { endBattle(false); G.rewardTxt='攻城超时'; return; }
}
```
- `siegeTickTowers(dt)`（新增，modes.js）：遍历 `sg.towers`，找射程内最近 `G.P.mob`，`atkT>=rate` 时 `siegeDealDmg(m, dmg)` 并 `G.fx.push({type:'line',...col:t.col})`（镜像 `updUnit` 画线）。
- `siegeCmd(name)`（新增，modes.js）：HUD 按钮调用——`rush`：`if(cmds.rush<=0){rushT=SIEGE_RUSH_DUR; cmds.rush=SIEGE_RUSH_CD;}`；`focus`/`heal` 同理（`heal` 对 `G.P.mobs` 各回 `maxhp*SIEGE_HEAL_AMT`）。

### 7.5 `modeWaveConfig`（modes.js:443）— 新增 siege 分支
```
if (G.mode === 'siege') return { waves:0, per:0, mix:[0,0,0,0], hp:1 };  // 无波次，工事由 modeSetup 预置
```

### 7.6 `updMob`（battle.js:378）— 顶部加路由（镜像 rogue）
```
function updMob(S, m, dt) {
  if (G.mode === 'rogue') { rogueUpdMob(S, m, dt); return; }
  if (G.mode === 'siege') { siegeUpdMob(S, m, dt); return; }   // 新增：玩家突击队专用行军+破城
  ...
}
```
- `siegeUpdMob(S,m,dt)`（新增，battle.js）：`flash/stun` 处理 → `spd = m.spd * (G.siege.rushT>0?SIEGE_RUSH_SPD:1)` → `m.d += spd*dt` → `pathPos` 更新坐标 → `if(m.d>=S.len)` 砸城（`G.siege.fort.hp -= m.break*SIEGE_BREAK_MUL*(focusT>0?SIEGE_FOCUS_BREAK:1)`，`m.dead=true`，`boom`+飘字；fort 归零 `endBattle(true)`）。**不调用 `hurtAdou`**（那是敌到玩家基地逻辑，siege 不适用）。

### 7.7 `siegeDealDmg`（新增，battle.js）— 独立于 `dealDmg`
```
function siegeDealDmg(m, dmg) {        // 敌塔杀玩家兵：不含任何玩家奖励/压力怪路径
  if (m.hp <= 0) return;
  m.hp -= dmg; m.flash = 0.12;
  if (m.hp > 0) return;
  m.dead = true; boom(m.x, m.y, '#c0392b');
  if (G.deaths) G.deaths.push({ x:m.x, y:m.y, type:m.glyph||m.type, boss:false, t:0.4, t0:0.4, col:'#c0392b' });
}
```

### 7.8 game.js 门控（4 处 1 行，全 `&& G.mode!=='siege'`）
- **:254** `if (G.mode === 'raid' || G.mode === 'puzzle' || G.mode === 'siege')` —— 跳过镜像波次填充（siege 无 spawnQ）。
- **:263** `if (G.mode !== 'fire' && G.mode !== 'rogue' && G.mode !== 'siege') spawnMob(G.P, ...)` —— siege 不刷玩家镜像军（突击队由 `siegeBuildAssault` 构建）。
- **:289** `if (G.mode !== 'raid' && ... && G.mode !== 'rogue' && G.mode !== 'siege') aiAct(G.E)` —— siege 无 AI 镜像对抗。
- **:291** `const _sides = (G.mode === 'raid' || G.mode === 'puzzle' || G.mode === 'escort' || G.mode === 'siege') ? [G.P] : [G.P, G.E]` —— 只模拟玩家突击队（敌工事在 `modeTick` 内 tick）。

### 7.9 battle.js 压力怪门控（:120）
`if (G.mode !== 'escort' && G.mode !== 'fire' && G.mode !== 'rogue' && G.mode !== 'siege' && opp.mobs.length < cap)` —— siege 不生成压力怪（无波次、无 opp 出怪）。

### 7.10 ui.js `onDown`（:857）— 新增 siege 分支
在 escort/fire 支路之后、通用拖拽之前插入：
```
if (G.mode === 'siege' && G.siege) {
  if (G.siege.build) return;          // 战前编成面板开启时，战场点击忽略（面板按钮已在 btns 处理）
  // v1 指令由 HUD 按钮派发；此处仅作可选：点工事=集火该塔（stretch），点空地=突进标记（stretch）
  return;
}
```
（指令主入口为 HUD 按钮 `siegeCmd`，不走 `onDown` 拖拽，零输入冲突。）

### 7.11 ui_battle.js `drawGame` — 新增 siege 分支
- **:704 路径绘制**：`if (G.mode !== 'raid' && G.mode !== 'puzzle' && G.mode !== 'escort' && G.mode !== 'siege')` 跳过 —— 即 **siege 绘制 `G.P.path`（SIEGE_PATH）**。`drawGame` 现有 `for (const m of G.P.mobs) drawMob(m)`（:762）天然画出突击队（正常 mob 绘制，建议加 `m.siegeAssault` 蓝描边区分）。
- **新增 `drawSiege()`**（镜像 `drawEscort`/`drawFire`）：画敌垒（顶部城垛+血条）、各工事（按 `t.glyph`/`t.col` 圆牌+射程圈虚线）、突进/集火激活时的光带。在 `if (G.mode === 'siege' && G.siege) drawSiege();` 调用（位置同 `drawEscort`）。
- **HUD 状态条（:890 区）**：新增 `else if (G.mode === 'siege')` 显示「🏯 突破 X% · 敌垒♥N · 剩余Ns · 突进/集火/鼓舞 CD」。
- **胜利/失败 overlay（:1106/:1137）**：新增 `else if (G.mode === 'siege')` 分支，按钮「再来一局→startSpecialMode('siege')」「返回菜单」。
- **`drawCell` 中立战场格（可选小改）**：siege 下 cells 全 `open=false` 会显示"荒/馒"噪音；在 `drawCell` 加 `if (G.mode==='siege')` 渲染为中性战场格（无"荒"字、无开荒费），镜像 puzzle pass 分支写法。

---

## 八、已知风险与缓解

| # | 风险 | 缓解 |
|---|---|---|
| R1 | **敌方工事射击是新子系统，怕与"玩家塔"系统冲突** | 物理隔离：`siege` 下 `G.P.cells`/`G.E.cells` 全 `open=false`，`updUnit` 对双方无事可做；`siegeTickTowers` 只读写 `G.siege.towers`+`G.P.mobs`，与 `updUnit`→`dealDmg(G.E,...)` 零交叉（§3.2）。 |
| R2 | **`dealDmg` 玩家奖励路径被误触发**（敌塔杀玩家兵反而给玩家发馒头） | 独立 `siegeDealDmg`，不含 reward/连杀/压力怪（§7.7）；与 rogue 的 `rogueDealDmg` 同构。 |
| R3 | **PATH 真动卡死/互穿** | 仅玩家单方沿单线 SIEGE_PATH 上行，敌工事静止不占路，无双向错身/互挡；mob 沿 `d` 顺序排布天然不互穿（§4.1）。比 rogue 更不易卡。 |
| R4 | **开局空列被误判"突击队全灭"致败** | `modeTick` 败因前置 `G.siege.assaultReady`（编成确认+`siegeBuildAssault` 后才置 true）；战前 `G.paused=true`。 |
| R5 | **胜负闭环歧义/双失败** | 败因仅 2 条（全灭/超时），胜因仅 1 条（敌垒破）；不沿用"阿斗营破"（siege 无敌方行军至阿斗，`G.P.hp` 永不被扣），无双失败（§5.2）。 |
| R6 | **数值溢出全局平衡** | 所有 SIEGE_* 仅作用于本局突击队（`SIEGE_HP_MUL`/`SIEGE_DMG_MUL` 在 `siegeBuildAssault` 内乘入 mob，不回写 `TROOPS`/`HEROES`）；工事 dmg/range 取自 `SIEGE_TOWER_DEFS` 局部表，不碰 `MOBS` 魔数。 |
| R7 | **性能** | 突击队≤12、工事固定 10 座、无波次无压力怪；热路径 `siegeTickTowers` 仅 10×12 距离判定/帧，可控。`mobCap('siege')=30` 护栏。 |
| R8 | **"兵将能动"不足（被质疑换皮）** | 突击队真实行军+被射+突破+砸城，且战前编成（谁领队/何兵种）直接决定行军战力与破城效率，是胜负关键变量，非抽象倍率（§1.1/§4）。 |

---

## 九、设计理论红线自检
- **主导策略**：工事沿 PATH 两侧混合布防（箭/炮/滚石）、越靠末端越密；玩家须据火力分布在「突进穿越」与「集火破城」间分配有限 CD，且 3 套编成预设各有适用场景，**无单一恒优解**。
- **经济失衡**：siege 指令 CD 自闭环（SIEGE_* 计时），不依赖全局馒头/金；突击队倍率仅本局，**未触碰全局数值平衡**。
- **认知过载**：交互 = 战前 3 选 1 面板（复用 rogue 范式）+ 3 个 HUD 指令按钮（复用大招按钮范式），**无新增手势/输入状态机**，不超现有模式认知负荷。
- **支柱漂移**：支柱「镜像攻城（你进攻·敌静止射击）/ 兵将真动」贯穿编成→行军→被射→破城→胜负，**无漂移**。

## 十、落地优先级
1. **核心接缝（必做）**：§7.1–§7.9（SPECIAL_MODES / modeSetup / modeTick / siegeBuildAssault / siegeTickTowers / siegeCmd / modeWaveConfig / updMob 路由 / siegeDealDmg / game.js 4 处 1 行门控 / battle.js 压力怪门控）—— 闭环可玩。
2. **表现层（必做）**：§7.11（drawSiege + HUD + overlay + 路径绘制 + 可选中性格）。
3. **战前编成面板（必做）**：复用 rogueChoices overlay 变体，3 预设选择。
4. **可选拓展（v1.5）**：拆塔（§3.3 v1.5）、点击工事集火（§7.10 stretch）。
