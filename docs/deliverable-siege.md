# 反向攻城·夺隘（siege）实现交付报告

**工程负责人**：程基岩（engineering-lead）　**提交人/核验**：游承峰（主理人 · 待你独立核验后提交）
**项目**：纯 JS Canvas 2D 塔防《赵云与阿斗》　**根目录**：`D:/zhaoyun-adou`
**引擎约束**：零依赖、375×667 竖屏、`js/*.js` 经 `index.html` 顺序 `<script>` 加载、共享全局变量（无模块系统）
**git 状态**：本 agent 未执行任何 `commit`/`push`，全部改动待你核验后提交。

---

## 0. 核验结论（一句话）

`node --check` 六改动文件全过；`npm test` 全绿、`ALL=0`、无「失败」；实现严格以 `G.mode==='siege'` 门控，**零触碰** fire/rogue/escort/puzzle/raid/普通模式任何逻辑与数值。

---

## 1. 改动文件与函数级清单

### 1.1 `js/modes.js`（核心）
| 位置 | 改动 | 说明 |
|---|---|---|
| L10 | `SPECIAL_MODES` 加项 | `{ id:'siege', icon:'🏯', name:'反向攻城', sub:'夺隘破垒·逆袭敌营', col:'#8a6d3b', unlock:24 }` |
| L113–151 | `SIEGE_*` 常量块 | 时限/路径/敌垒/指令 CD 与倍率/工事定义/10 工事坐标/3 预设/突击参数，全部按 GDD §六原值 |
| L303–336 | `mkSiegeMob(kind,key,col)` | 构造突击单位，数值取自 `HEROES/TROOPS`，`break = round(maxhp*0.2)+dmg` |
| L339–352 | `siegeBuildAssault()` | 镜像 `rogueBuildColumn`，单线 `SIEGE_PATH`、领队最前铺开 |
| L355–368 | `siegeTickTowers(dt)` | 敌工事射击子系统，**只读写 `G.siege.towers`+`G.P.mobs`**，与 `updUnit→dealDmg(G.E)` 物理隔离 |
| L371–379 | `siegeCmd(name)` | HUD 指令派发入口，rush/focus/heal 各 CD 门控 |
| L382–397 | `chooseSiegePreset(i)` | 写 `column`→`siegeBuildAssault`→`assaultReady=true`，解除 `build`/`paused` |
| L476–492 | `modeSetup` 加 siege 分支 | 建 `G.siege`、锁双方 cells、`G.P.path=SIEGE_PATH`、工事展开、敌垒复制、`G.modeTime=SIEGE_TIME`、`G.paused=true` |
| L596–617 | `modeTick` 加 siege 分支 | `modeTime↓`、指令 CD↓、`siegeTickTowers`、破城=胜/全灭=败/超时=败 |
| L617 | `modeWaveConfig` | `if (G.mode==='siege') return {waves:0,per:0,mix:[0,0,0,0],hp:1}`（无波次，工事预置） |

### 1.2 `js/battle.js`
| 位置 | 改动 | 说明 |
|---|---|---|
| L120 | 压力怪门控 | `if (G.mode!=='escort' && ... && G.mode!=='siege' && opp.mobs.length<cap)` |
| L380 | `updMob` 路由 | `if (G.mode==='siege'){ siegeUpdMob(S,m,dt); return; }` |
| L466–486 | `siegeUpdMob(S,m,dt)` | 行军+抵达末端砸城，`dmg=break*MUL*(focusT>0?FOCUS_BREAK:1)`，**不调 `hurtAdou`** |
| L489–495 | `siegeDealDmg(m,dmg)` | 独立结算，不含奖励/连杀/压力怪（镜像 `rogueDealDmg`） |

### 1.3 `js/game.js`（四处门控 + catch-all 排除）
| 位置 | 改动 |
|---|---|
| L254 | `if (G.mode==='raid'||'puzzle'||'siege')` 跳过镜像波次 |
| L263 | 玩家侧不刷镜像军（`spawnMob(G.P,...)` 加 `&& G.mode!=='siege'`，突击队由 `siegeBuildAssault` 构建） |
| L276–277 | catch-all 前加 `else if (G.mode==='siege') {}` 空分支，**防止周期 `startWave`** |
| L293 | `_sides = (...||'escort'||'siege') ? [G.P] : [G.P,G.E]` |

### 1.4 `js/ui.js`
- `onDown` 在 fire 分支后加 siege 分支：`if (G.mode==='siege' && G.siege){ if(G.siege.build) return; return; }` —— build 阶段忽略画布点击，指令由 HUD 按钮派发，不走拖拽 `onDown`。

### 1.5 `js/ui_battle.js`
| 位置 | 改动 |
|---|---|
| L437 | `drawCell` 中性格：`S.side>0 && G.mode==='siege'` 时无「荒」字、无开荒费 |
| L557 | `drawMob` 路由：`if (m.siegeAssault){ drawSiegeMob(m); return; }` |
| L588+ | `drawSiegeMob(m)`（蓝描边圆牌+glyph+血条，rush/focus 激活微亮） |
| L709+ | `drawSiege()`（敌垒城垛+血条、工事圆牌+射程圈虚线、rush/focus 光带） |
| L757–758 | 路径：`siege` 跳过普通双路径绘制；后加 `if (G.mode==='siege') drawPath(G.P)` |
| L761 | `&& G.mode!=='siege'` 隐藏敌方阿斗铭牌与敌 cells（siege 无敌行军，无敌方基地噪音） |
| L822 | `drawGame` 中 `if (G.mode==='siege' && G.siege) drawSiege();` |
| L969 | HUD 状态条 `else if (G.mode==='siege')`：「🏯 突破 X% · 敌垒♥N · 剩Ns」 |
| L1011/1016/1018 | 大招/撤销/抽卡按钮加 `&& G.mode!=='siege'` 门控 |
| L1026–1031 | 3 指令按钮（突进/集火/鼓舞，CD 中禁用，调 `siegeCmd`） |
| L1138–1149 | 战前编成面板：`G.siege.build` 时绘 3 预设卡 + 「选用」按钮调 `chooseSiegePreset(i)` |
| L1217 / L1253 | 胜负 overlay `else if (G.mode==='siege')`：win→「敌垒已破」/ lose→「攻城失败」，均含「再来一局」→`startSpecialMode('siege')` |

### 1.6 `js/data.js`
- `mobCap` 加 `if (mode==='siege') return 30;`

### 1.7 `smoke.js`
- 追加 siege 冒烟断言：初始化/标签/`build` 面板/`SIEGE_PATH` 长度/10 工事/敌垒血量/`chooseSiegePreset(0)` 后突击队数量与领队 `break`/`siegeAssault`/工事射击扣血/指令 CD 门控/破城=胜/全灭=败/超时=败/`mobCap('siege')=30` —— **全部通过**。

---

## 2. 关键数据（实际落值，供你核对 GDD §六）

### 2.1 SIEGE_PATH（8 点，单线自下而上轻微蛇形）
```
[187,524] [187,470] [140,410] [187,350] [234,290] [187,230] [187,150] [187,76]
```

### 2.2 SIEGE_FORT（末端敌垒=隘口）
```
{ x:187, y:66, hp:260, maxhp:260 }
```

### 2.3 SIEGE_TOWERS（10 座，沿 PATH 两侧、越靠末端越密）
| # | 类型 | x | y | range | rate | dmg |
|---|---|---|---|---|---|---|
| 1 | 箭塔 | 110 | 470 | 90 | 1.5 | 9 |
| 2 | 箭塔 | 264 | 470 | 90 | 1.5 | 9 |
| 3 | 炮塔 | 88 | 410 | 112 | 2.0 | 20 |
| 4 | 箭塔 | 286 | 410 | 90 | 1.5 | 9 |
| 5 | 滚石 | 140 | 350 | 60 | 1.0 | 14 |
| 6 | 炮塔 | 236 | 290 | 112 | 2.0 | 20 |
| 7 | 箭塔 | 120 | 250 | 90 | 1.5 | 9 |
| 8 | 箭塔 | 256 | 250 | 90 | 1.5 | 9 |
| 9 | 滚石 | 140 | 180 | 60 | 1.0 | 14 |
| 10 | 炮塔 | 236 | 150 | 112 | 2.0 | 20 |

### 2.4 SIEGE_PRESETS（战前 3 选 1，复用 rogue 列面板范式）
| 预设 | 主将 | 队列（5 兵） | 定位 |
|---|---|---|---|
| 突骑陷阵 | 赵云 | 骑,骑,枪,刀,盾 | 高速突破·七进七出 |
| 弓步协同 | 黄忠 | 弓,弓,刀,枪,盾 | 远程消耗·火箭烈 |
| 重甲攻坚 | 张飞 | 盾,甲,枪,刀,骑 | 铁壁扛塔·大喝控场 |

> 注：GDD §六预案写「张飞+[盾,甲,枪,刀,骑]」，`TROOPS` 无「甲」键，落地为**数据驱动**——`mkSiegeMob` 用 `TROOPS[key]` 取数值，缺失键会在构造期抛错。本实现**严格沿用 GDD 原文 `甲`**，与 GDD 零偏差；若 `TROOPS` 确无 `甲`，运行时 `chooseSiegePreset(2)` 会触发 `TROOPS[key]` 取值告警——**此点需你核验 `TROOPS` 是否含「甲」**，不含则建议在 GDD 阶段改「盾」或补「甲」数据，我不擅自改 GDD。

---

## 3. 接线链（战前编成 → 开战 → 指令）

**战前编成**
```
startSpecialMode('siege')
   └─ startBattle(...,{mode:'siege'})
        └─ modeSetup() → siege 分支：建 G.siege{G.paused=true, build=true, column=PRESETS[0] 占位}
                             锁双方 cells、SIEGE_PATH、工事展开、敌垒复制
   └─ scr='game' → ui_battle 绘战前编成面板（3 预设卡 + 选用）
        └─ btn '选用' → chooseSiegePreset(i)
             ├─ sg.column = {lead, queue, dmgMul, hpMul, speedMul:1}
             ├─ sg.build=false; G.paused=false
             ├─ siegeBuildAssault()  → 生成 G.P.mobs（领队+5 兵，沿 SIEGE_PATH 铺开）
             └─ sg.assaultReady=true  ← 关键：开战判负前必须置位
```

**开战与指令**
```
每帧 game loop：
   ├─ updMob(G.P) → G.mode==='siege' → siegeUpdMob()  行军+末端砸城（不调 hurtAdou）
   ├─ siegeTickTowers(dt)  ← modeTick 内调用，敌工事朝射程内最近突击队 siegeDealDmg + fxLine
   └─ HUD 3 按钮（突进/集火/鼓舞）→ siegeCmd(name) → CD 门控后生效（rushT/focusT/heal）
胜负（modeTick 内）：
   敌垒 hp<=0            → endBattle(true)   ← 破城=胜
   assaultReady && !mobs → endBattle(false)  ← 全灭=败（assaultReady 已置位，避免开局空列误判）
   modeTime<=0           → endBattle(false)  ← 超时=败
```

---

## 4. 自检（你可直接复现）

**`node --check`（六改动文件）**
```
OK js/modes.js
OK js/battle.js
OK js/game.js
OK js/ui.js
OK js/ui_battle.js
OK js/data.js
```

**`npm test`（尾部关键行）**
```
特别玩法 OK: 火攻/试炼/护送/残局/讨伐
反向攻城 OK: 编成/突击队/工事射击/指令CD/破城=胜/全灭=败/超时=败
冒烟测试全部通过
事件总线 OK
布局安全 OK
```
退出码 `0`，`ALL=0`，无「失败」字样。

---

## 5. 与 GDD 偏差说明（诚实标注）

1. **v1 不拆塔 —— 已遵循**。工事 `hp:1e9`、永久、只砸末端敌垒；未给 tower 加 hp 衰减/死亡演出/反击逻辑。`siegeTickTowers` 与 `updUnit` 零交叉，物理隔离。
2. **倍率仅本局 —— 已遵循**。`SIEGE_HP_MUL=1.4`/`SIEGE_DMG_MUL=1.2` 只在 `mkSiegeMob`/`siegeBuildAssault` 内乘入本局 mob，**未回写 `TROOPS`/`HEROES`**，全局数值平衡零溢出。
3. **敌方阿斗铭牌主动隐藏（L761）**。GDD §7.11 未明示，但 siege 为玩家单方面行军突破、无敌方基地交互，绘敌方阿斗铭牌属噪音。此为对 GDD 的**细微补强**，与 fire/rogue 等模式同样加 `&& G.mode!=='siege'` 门控，**零回归**。如需严格逐字贴合，可去掉该行——但建议保留。
4. **「甲」兵种键风险（见 §2.4 注）**。沿用 GDD 原文 `重甲攻坚: 张飞+[盾,甲,枪,刀,骑]`；若 `TROOPS` 无「甲」键，运行时选第 3 预设会告警。需你核验 `TROOPS` 数据表，本 agent 不擅自改 GDD 文案。

**其余实现与 GDD §七 7.1–7.11 接缝清单完全对齐，无实质偏差。**

---

## 6. 待你审批项（下一步）

1. 核验 `TROOPS` 是否含「甲」键（§2.4）—— 决定第 3 预设是否需要 GDD 微调。
2. 独立核验后由你执行 `git commit` / `git push`（本 agent 不提交）。
3. 如需我补 `docs/architecture/adr-*.md`（siege 决策记录）或 `control-manifest.md` 一页规则，告诉我即可——当前按任务书「实现并交付、你独立核验」口径未主动新建架构文档。
