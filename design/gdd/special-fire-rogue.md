# 特殊玩法重做规格 · 赤壁火攻(fire) & 五虎试炼(rogue)

> 目标：fire / rogue 当前是「普通塔防换皮」（fire=双镜像被动烧；rogue=全局倍率叠加），缺「兵将能动」核心差异。本文档给出可直接交 engineering-lead 实现的重做规格。
> 硬约束（铁律）：①所有新增逻辑以 `G.mode==='fire'` / `G.mode==='rogue'` 门控，不改 escort/puzzle/raid/普通模式；②不改动全局数值平衡（射程/攻速/伤害魔数不动）；③常量集中定义在 `modes.js` 顶部（参照 `ESCORT_*` 常量块），函数命名 `fireXxx` / `rogueXxx`；④「兵将能动」。
> 诊断根因：现有 `update()` 的共享刷怪循环（game.js 257-265 行）对 fire 同时 `spawnMob(G.P,...)` 与 `spawnMob(G.E,...)` 生成双方镜像军；fire 的 `modeTick` 又对 `[G.P,G.E]` 双侧面烧。换皮即源于此。重做核心是**只让敌方(G.E.mobs)生成与行军，玩家侧改用主动交互/构筑**。

---

## 一、赤壁火攻(fire) 重做：实时纵火

### 1.1 核心支柱与玩家心理（MDA）
- **美学**：Challenge + Discovery ——「我借东风，实时布火，烧尽来犯之敌」。
- **玩家心理**：掌控感（风是我手中的武器）+ 紧迫感（火会反噬、敌逼近水寨）。
- **设计支柱（2 条）**：①风是武器，不是背景；②火格有限 = 每一格都是决策。

### 1.2 核心循环（每帧/每秒）
1. **观察**：曹军沿 PATH_E 行军（复用 `G.E.mobs`+`updMob` 默认分支），HUD 显风向、水寨耐久、控火油数。
2. **决策**：点棋盘上「火油格」→点燃（受控火油数限制）。
3. **结算**：火沿风向蔓延、烧路径上敌军；风变 → 调整下次点火位置。
4. **守水寨**：敌抵水寨(=PATH_E 末端 [187,54]) 扣耐久；火若反噬到顶部水寨带也扣耐久。

### 1.3 交互方案（3 候选，推荐 A）
- **A) 点格点燃火油（推荐）**：棋盘预置 N 个「火油格」(`G.fire.cells`)，点 idle 格 → 点燃。
  - 理由：完全复用 `boardAt(p)` 点击框架（escort 走位已验证门控范式），零新增输入原语；火油格=有限资源天然防滥用；最契合「实时放火」。
- **B) 拖拽风向扇**：长按拖出扇面定向喷火。问题：与现有 `drag`=部署语义冲突、需新增手势、移动端误触多。
- **C) 长按蓄力火墙**：蓄力沿直线生火墙。问题：蓄力 vs 部署拖拽易混淆，火墙覆盖过大破坏平衡。
- **结论**：采用 A。

### 1.4 敌方兵将如何移动与受火
- **行军**：复用 `G.E.mobs` + `updMob` 默认分支（**不改 updMob**）。PATH_E（赤壁）走线短、便于火路覆盖。末端 = 水寨。
- **火焰蔓延模型**（`fireXxx`，全部 `G.mode==='fire'` 门控）：
  - 火油格 `G.fire.cells[i]`.state ∈ {`idle`,`burning`}；点燃后 `t=FIRE_BURN_T`，期间每帧对半径 `FIRE_R` 内 `G.E.mobs` 施加 `dealDmg(G.E, m, dps*dt)`（东南风 dps > 西北风）。
  - **蔓延**：每 `FIRE_SPREAD_DT` 秒，`fireSpread()` 对每个 burning 火油格按 `fireWindDir()` 的网格邻接方向传播一次：邻格若为火油格→点燃；否则生成临时「野火」格（短命 `FIRE_WILD_T`，仅烧敌、不持续蔓延）。
  - **反噬（风险即约束）**：燃烧/野火格若落在 `G.P` 已部署单位格 → 对该单位 `FIRE_SELF_DPS*dt`；若落在顶部「水寨带」(`y < FIRE_STRONG_Y`) → 每帧扣水寨耐久 `FIRE_STRONG_DPS*dt`。
- **风向框架深化**（复用 `G.wind`，非 raid 的 `RAID` 体系）：
  - `fireWindDir()`：`'东南风'`→ 网格方向 (dx:+1, dy:-1)（右上，逆敌行军、横扫路径）；`'西北风'`→ (dx:-1, dy:+1)（左下，顺敌行军、纵深纵火）。方向与 PATH_E 走向对齐，使顺风=覆盖敌方纵深。
  - `modeTick` 内 `windT` 倒计时翻转 `G.wind`，周期 `FIRE_WIND_T`。

### 1.5 胜负条件与威胁
- **胜**：`G.modeTime`(=FIRE_TIME) 撑过且 `G.fire.stronghold>0` → `modeTick` 触发 `endBattle(true)`（沿用 150s→120s 紧凑化；战功=击杀数 `G.modeScore` 沿用）。
- **败（单一条件，避免双失败歧义）**：**水寨耐久 ≤ 0**。扣减来源：①敌抵水寨（`tickFire` 检测 `G.E.mobs` 的 `m.d >= G.E.len-4` → 扣 `FIRE_BREACH_HP` 并移除该 mob）；②火反噬到水寨带（连续扣）。
- **不触发通用判负**：`update()` 的 `G.P.hp<=0` 在 fire 下不会由敌触发（`G.E.mobs` 到末端走的是 `hurtAdou(G.E,...)` 扣 `G.E.hp`，非 `G.P.hp`）；`G.E.hp<=0 && !G.mode` 的镜像胜利也被 `!G.mode` 排除。水寨耐久完全由 `G.fire.stronghold` 在 `modeTick` 管理，清晰无歧义。

### 1.6 数据表草案（modes.js `FIRE_*` 常量块）
```js
const FIRE_TIME        = 120;   // 存活目标秒
const FIRE_WIND_T     = 22;    // 风向周期秒
const FIRE_CELLS      = [ /* 赤壁坐标系，沿 PATH_E 走线+两侧，约 10 格，如 {x:40,y:250},{x:120,y:190}… */ ];
const FIRE_BURN_T     = 5.0;   // 单格燃烧持续秒
const FIRE_WILD_T     = 2.5;   // 野火（非火油格）持续秒
const FIRE_SPREAD_DT  = 1.0;   // 蔓延间隔秒
const FIRE_R          = 44;    // 火格伤害半径(px)
const FIRE_DPS_SE     = 24;    // 东南风(顺)每秒伤害
const FIRE_DPS_NW     = 14;    // 西北风(逆)每秒伤害
const FIRE_SELF_DPS   = 8;     // 火噬己方单位每秒
const FIRE_STRONG_Y   = 90;    // 水寨带阈值(y<此值=顶部水寨区)
const FIRE_STRONG_HP  = 24;    // 水寨初始耐久
const FIRE_STRONG_DPS = 6;     // 火噬水寨每秒
const FIRE_BREACH_HP = 3;     // 单敌抵水寨扣耐久
const FIRE_OIL_START  = 6;     // 控火油初值
const FIRE_OIL_MAX    = 10;    // 控火油上限
const FIRE_OIL_CD     = 3.0;   // 控火油回充间隔秒(另每击杀+1)
```
- **控火油回充**：`G.fire.oil = min(max, oil + dt/FIRE_OIL_CD)`；每击杀 `G.E.mob` 经 `dealDmg` 的 fire 分支 +1（battle.js `dealDmg` 加 1 行 `if (G.mode==='fire' && S===G.E) G.fire.oil=Math.min(G.fire.oilMax,G.fire.oil+1)` 门控）。

### 1.7 接缝（函数级职责）
- **modes.js**：
  - `modeSetup`(fire 分支)：`G.fire = { oil:FIRE_OIL_START, oilMax:FIRE_OIL_MAX, stronghold:FIRE_STRONG_HP, windT:FIRE_WIND_T, burnT:0, spreadT:0, cells:FIRE_CELLS.map(c=>({x:c.x,y:c.y,state:'idle',t:0})) }`；**移除**原 `spawnBuilding` 两行与 `G.fireCells`（改由 `G.fire.cells` 承载）；`G.modeTime=FIRE_TIME`。
  - `modeTick`(fire 分支)：`G.modeTime-=dt; tickFire(dt); if(G.modeTime<=0 && G.fire.stronghold>0) endBattle(true);`。
  - `modeWaveConfig`(fire)：`{ waves:99, per:6, mix:[55,20,20,5], hp:1, hpAdd:0, atkTier:1 }`（仍无限刷，但仅 G.E 出怪，见下）。
  - 新增 `fireIgnite(cell)` / `tickFire(dt)` / `fireSpread()` / `fireWindDir()` / `drawFire()`（绘制实现在 ui_battle.js 调用）。
- **ui.js `onDown`**：在 escort 走位门控之后、通用拖拽之前，插入 fire 点火支路——点「已部署单位格」走原 drag 部署；点「空格/火油格」才点火（`fireIgnite` 到最近 idle 火油格）。即把点火插在现有 `onDown` 末尾 `else if (ci>=0 && !open && mode!=='puzzle') unlockCell` 之前，纯新增、不影响 escort/puzzle。
- **ui_battle.js `drawGame`**：现有 `if (G.mode==='fire')` 分支内把 `drawBuildings()` 替换为 `drawFire()`；HUD 文案改为 `🔥 风：东南 · 水寨♥24 · 控火油×6`。
- **game.js `update` 共享刷怪循环（257-265 行）**：保留 `spawnMob(G.E,...)`；`spawnMob(G.P,...)` 改为 `if (G.mode!=='fire') spawnMob(G.P,...)`（1 行门控，仅 fire 不出玩家行进军，复用波次内核）。
- **battle.js `dealDmg`**：fire 击杀分支（现有 `if (S.side>0 && G.mode==='fire') G.modeScore+=1`）旁追加 `else if (G.mode==='fire' && S===G.E) { G.fire.oil=Math.min(G.fire.oilMax,G.fire.oil+1); }`。

### 1.8 已知风险与缓解
| 风险 | 缓解 |
|---|---|
| R1 火油格位置/数量需调参，避免「一点全清」或「点不到」 | 火油格沿 PATH_E 走线均布约 10 格+两侧；首轮 20s 备战可预览 |
| R2 风向翻转致已点火被吹向己方反噬 | 野火短命(2.5s)、蔓延仅 1 格/周期、水寨带 y 阈值高亮警示；HUD 常显风向箭头 |
| R3 控火油耗尽→输出真空 | 击杀回充 + CD 回充双保险；初值 6 够覆盖前 2 波 |
| R4 `G.E.mobs` 到末端 `hurtAdou(G.E)` 扣 `G.E.hp` | 不触发玩家判负；`G.E.hp<=0 && !G.mode` 镜像胜利已被 `!G.mode` 排除，无副作用 |
| R5 性能 | 火油格≤12、mobCap(fire)=10，热路径可控 |

---

## 二、五虎试炼(rogue) 重做：构建军略

### 2.1 核心支柱与玩家心理（MDA）
- **美学**：Sensation + Challenge ——「我编一列能打的兵，带着它八战穿敌营」。
- **玩家心理**：构建成就感（纵队越来越强、越有章法）+ 风险（纵队主将阵亡即败）。
- **设计支柱（2 条）**：①「构建军略」= 胜负关键变量（不是抽象倍率）；②兵将真动（纵队沿关卡真实行军）。

### 2.2 核心循环（每层）
1. **战前编列**（首层 + 每层战后选完军略后）：从将军池/兵种池选将编入纵队（决定领队、队列、羁绊）。
2. **开战**：纵队沿 PATH_P 行军、索敌、放羁绊技；敌沿 PATH_E 迎击。
3. **清层**：纵队存活抵达终点 → 三选一「军略」（结构/数值）→ 改写纵队编成，进下一层。
4. **八层通关**。

### 2.3 「构建军略」形态（3 候选，推荐 A）
- **A) 战前编列行军纵队（推荐）**：纵队(=G.P.mobs) 真实行军，构建(编成/羁绊/路线) 决定其战力，是胜负关键变量。
  - 理由：最契合「兵将能动」+「构建军略是胜负关键变量」——玩家的构筑（谁领队、几队、何羁绊）直接决定行军战斗力，而非抽象的全局倍率；天然复用 `updMob` 行军 + `dealDmg` + `tickFateSkills` 羁绊系统。
- **B) 五虎羁绊组合**：只在羁绊层排列。问题：偏静态被动，未解决「能动」，与现有 `rogueOffer` 差异不大。
- **C) 八节点分支远征**：地图分支选路。问题：偏 meta 选择，战斗内核不变，「能动」不足、实现最重。
- **结论**：采用 A。

### 2.4 兵将如何移动（纵队真动）
- **纵队 = `G.P.mobs`**，复用 `updMob` 默认行军分支（`G.P.path=PATH_P`，向上行军）。交战/索敌/archer/拦截全复用（`findBlocker` 已处理 mob 互挡）。
- **主将**：纵队首位的「将军 mob」——在 `rogueBuildColumn()` 内用 `spawnMob(G.P, kind, hpMul)` 生成，并打 `m.rogueLead=true` + 绑定 hero 技能（在 `updMob`/`tickFateSkills` 加 `G.mode==='rogue'` 门控读取 `G.rogue.column` 的羁绊与技能）。
- **羁绊技**：沿用 `tickFateSkills`，但 bonds 来源由 `S.fate` 改为 `G.rogue.column.bonds`（门控）。

### 2.5 进度与构筑成长
- **`G.rogue.column` 结构**：`{ lead, queue:[troopId...], bonds:[bondId...], route:0|1|2, dmgMul, hpMul, speedMul }`。
- **每条军略 `apply(column)` 改 column**：
  - 编成类：编入新将（赵云/关羽…）、扩列（+2 队列位）、换领队。
  - 羁绊类：解锁某羁绊（凑齐五虎→五虎羁绊常态触发）、强化某兵种线（枪队穿透+）。
  - 行军类：疾行（纵队移速+）、变阵（`route` 改走 PATH_P 不同变体，影响遭遇节奏）。
  - 数值类（2 条保底，兼容 `chooseRogue` 现有弹窗结构）：dmg+/hp+。
- **下一层 `rogueBuildColumn()` 据更新后的 column 重建纵队** → 形成 build 差异（build 直接=行军之师）。
- **敌人曲线**：沿用 `modeWaveConfig` `hp:0.85+floor*0.12, per:5+floor*2`（仅 G.E 出怪；G.P 不出怪→update 共享循环门控 `G.mode!=='rogue'`）。

### 2.6 胜负条件
- **胜**：清完 `maxFloor`(8) 层 → `chooseRogue` 内 `floor>maxFloor` 触发 `endBattle(true)`（沿用现有骨架）。
- **败（单一条件）**：纵队主将阵亡 或 阿斗(`G.P.adou`)被敌突破（`G.P.hp<=0`→`update` 直接 `endBattle(false)`，沿用）。主将阵亡判定：在 `dealDmg` 的 mob 死亡分支加 `if (G.mode==='rogue' && m.rogueLead) { G.rewardTxt='主将阵亡 · 纵队溃散'; endBattle(false); return; }`（门控）。

### 2.7 数据表草案（modes.js `ROGUE_*` 常量块）
```js
const ROGUE_MAX_FLOOR  = 8;
const ROGUE_POOL_HERO = ['赵云','关羽','张飞','马超','黄忠','刘备'];  // 可编入纵队将军
const ROGUE_POOL_TROOP= ['枪','弓','刀','盾','骑'];                   // 可编入纵队兵种
const ROGUE_QUEUE_MAX  = 8;     // 纵队最大队列位
const ROGUE_ROUTES     = 3;     // 可切换行军路线数(=PATH_P 不同变体/偏移)
const ROGUE_WAVE_PER  = f => 5 + f*2;     // 每层敌数(沿用)
const ROGUE_WAVE_HP   = f => 0.85 + f*0.12; // 每层敌 HP 曲线
// 军略池（apply 改写 column；含 2 条数值保底）
const ROGUE_STRATS = [
  { n:'编入赵云', d:'纵队+赵云(领队技:七进七出)', apply:c=>{ c.lead='赵云'; } },
  { n:'扩列',     d:'纵队队列 +2 位',            apply:c=>{ c.queue=[...c.queue,'枪','弓'].slice(0,ROGUE_QUEUE_MAX); } },
  { n:'解锁五虎', d:'常驻五虎羁绊',            apply:c=>{ if(!c.bonds.includes('五虎羁绊')) c.bonds.push('五虎羁绊'); } },
  { n:'疾行',     d:'纵队移速 +20%',           apply:c=>{ c.speedMul*=1.2; } },
  { n:'变阵',     d:'切换行军路线',            apply:c=>{ c.route=(c.route+1)%ROGUE_ROUTES; } },
  { n:'锋锐军略', d:'纵队伤害 +25%',           apply:c=>{ c.dmgMul*=1.25; } },   // 数值保底
  { n:'坚壁军略', d:'纵队血量 +25%',           apply:c=>{ c.hpMul*=1.25; } },   // 数值保底
];
```
- **将军作 mob 属性**：复用 `HEROES[name]` 的 hp/dmg/rate/rng 在 `rogueBuildColumn()` 内映射为 `spawnMob` 的 `hpMul`/`atkMul`（不新增 `MOBS` 条目、不动全局表）。
- **羁绊**：rogue 模式 `tickFateSkills` 读取 `G.rogue.column.bonds` 而非 `S.fate.list`（门控）；羁绊效果(桃园/五虎/父子)数值沿用 `FATES` 表，不改。

### 2.8 接缝（函数级职责）
- **modes.js**：
  - `modeSetup`(rogue 分支)：`G.rogue = { floor:1, maxFloor:ROGUE_MAX_FLOOR, column:{lead:null,queue:[],bonds:[],route:0,dmgMul:1,hpMul:1,speedMul:1}, picks:0 }`；**不再**用原 `dmg/hp/income` 抽象字段（或保留兼容）；banner 改为「编列你的行军纵队」。
  - 新增 `rogueBuildColumn()`：据 `column` 生成 `G.P.mobs`（纵队）+ 主将 mob(`rogueLead`)；在 `startWave`/战前阶段调用。
  - `modeWaveConfig`(rogue)：`{ waves:1, per:ROGUE_WAVE_PER(floor), mix:[45,20,20,15], hp:ROGUE_WAVE_HP(floor) }`（仅 G.E 出怪）。
  - `rogueOffer()`：choices 改为 `ROGUE_STRATS`（apply 改 column）；沿用 `G.rogueChoices` 弹窗。
  - `chooseRogue()`：沿用；胜判定 `floor>maxFloor`。
- **game.js `update` 共享刷怪循环（257-265 行）**：`if (G.mode!=='rogue') spawnMob(G.P,...)`（仅 rogue 不出玩家镜像军，专注纵队）。
- **battle.js**：
  - `updMob` 默认行军分支后追加 `if (G.mode==='rogue' && m.rogueLead) { /* 读 G.rogue.column 技能/羁绊，周期释放范围 dealDmg */ }`（门控，仅 rogue 主将 mob 生效；不依赖 cells）。
  - `tickFateSkills` 入口 `if (G.mode==='rogue') { bonds=G.rogue.column.bonds; ... }`（门控覆盖 bonds 来源）。
  - `dealDmg` mob 死亡分支：`if (G.mode==='rogue' && m.rogueLead) { G.rewardTxt='主将阵亡 · 纵队溃散'; endBattle(false); return; }`（门控）。

### 2.9 已知风险与缓解
| 风险 | 缓解 |
|---|---|
| R1 纵队(G.P.mobs)与敌(G.E.mobs)中段相遇互穿/卡位 | 沿用 `findBlocker` 拦截逻辑；PATH_P/PATH_E 为两条独立折返线，自然错开 |
| R2 主将 mob 复用 hero 技能需从 cells 解耦 | rogue 主将技能在 `updMob` 门控内单独处理（周期范围 `dealDmg` + 羁绊读 column），不依赖 cells |
| R3 结构类军略改 column 后 rebuild 队列超 `ROGUE_QUEUE_MAX` | apply 内 `queue=queue.slice(0,ROGUE_QUEUE_MAX)` |
| R4 纯结构 build 前期过弱 | `ROGUE_STRATS` 保证每轮至少 1 条数值保底（沿用 `chooseRogue`「保底」结构） |
| R5 性能 | 纵队+敌双 mob 流；mobCap(rogue) 沿用 60，实际 `G.P.mobs≤ROGUE_QUEUE_MAX(8)`，可控 |

---

## 三、设计理论红线自检
- **主导策略**：fire 靠风向翻转 + 控火油有限 + 火油格空间约束，强制随局重定位，无单一恒优点火位；rogue 靠军略池多样（编成/羁绊/行军/数值混合）避免单一最优 build。**均未引入主导策略。**
- **经济失衡**：fire 控火油自闭环（击杀/ CD 回充），不依赖全局馒头；rogue 军略为局内构筑、不溢出到主线经济。**未触碰全局数值平衡。**
- **认知过载**：fire 交互 = 单点点火（复用 escort 已验证点击范式），无新增手势；rogue 交互 = 沿用现有三选一弹窗。**未超出现有模式认知负荷。**
- **支柱漂移**：fire 支柱「风是武器 / 火格有限」贯穿交互-蔓延-胜负；rogue 支柱「构筑=胜负变量 / 兵将真动」贯穿编列-行军-军略。**无漂移。**

## 四、落地优先级建议
1. **fire 先行**：改动最小（仅 `modeSetup`/`modeTick`/`modeWaveConfig` + 1 个 `tickFire` + ui 点击门控 + 2 处 1 行门控），且「兵将能动」差异最直观。
2. **rogue 次之**：需新增 `rogueBuildColumn` + 3 处 battle.js 门控（主将 mob 解耦），依赖对 `updMob`/`tickFateSkills` 行为的精确理解，建议与程基岩对齐英雄技能在 mob 侧的落地方式后再动。
