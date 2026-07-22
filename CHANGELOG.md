# CHANGELOG — 赵云与阿斗（文字合成塔防·全量复刻版）

## 2026-07-08 存档系统优化 + 界面美工 + 逻辑修复

### 一、存档系统（本次重点）
**现状梳理**：游戏原本已有静默自动存档（`js/save.js` → `localStorage['zyad2']`），每次购买/锻造/穿戴/通关即写盘，启动时 `loadSave()` 还原。用户感知"缺少存档"实为**界面无可见存档入口**。

**逻辑整理与优化**（`js/save.js`）：
- 新增 `savedAt` 字段：记录上次手动保存时间戳（0=从未手动保存）。
- 新增 `manualSave()`：更新时间戳后写盘，供界面手动保存调用。
- 新增 `clearSave()`：重置为 `defaultSave()` 并 `localStorage.removeItem`，清档不残留内存态。
- 新增 `fmtSaved()`：时间戳→友好文本（刚刚/分钟前/日期时间），无记录时提示"进度自动存档中"。

**界面存档管理入口**（`js/ui.js`）：
- 主菜单底部新增「存档管理」按钮（y=630，底边 658 < 画布 667，安全）。
- 新增 `drawSave()` 存档页：显示当前进度（金币/关卡/武器数/材料 + 保存时间）、「手动保存」、「清除本槽」（二次确认防误触，清完回菜单）、返回。
- `draw()` 补 `save` 分支，避免点入白屏。
- 确认清除时防御性 `G = null; selStage = 1`，防极端路由残留。
- 设计原则：自动存为底，手动保存仅记录时间点。

**可选增强（后续补充）**：
- 三槽存档：槽0兼容旧 key `zyad2`，槽1/2 用 `zyad2_slotN`；`switchSlot(n)` 先存当前槽再载目标槽，`slotMeta(n)` 显示槽摘要（关卡/武器数/保存时间）。
- 导出/导入存档：`exportSave()` 返回当前槽 JSON 字符串，`importSave(str)` 解析写盘（浏览器用 `prompt` 复制/粘贴，无头环境降级显示）。
- 存档页「继续游戏」按钮：直接读当前槽 `startBattle(SAVE.stage, SAVE.endless)` 进入战斗（修正早期 hardcode 丢失无尽模式的 bug）。

### 二、逻辑修复（早期）
- `js/game.js`：删除死代码 `G.slow`（无任何减速逻辑引用）。
- `js/merge.js`：补全 6 把武器加成（原被静默跳过）；`mkHero` 补 `stun:0`。
- `js/battle.js`：修复摄魂后 `stun` 永久瘫痪（减帧钳零）；新增兵种无敌拦截（仅玩家侧作战单位，阿斗照常掉血）；兵种相克文案与 `data.js` 一致。
- `js/waves.js`：无尽模式 BOSS 每 10 波轮换历史名将（梁/铁/统/帅/兽/曹…），非无尽不变。

### 三、新增功能
- 兵种无敌开关（菜单「兵种无敌：开/关」，默认关，可选开启；仅玩家作战单位免伤，阿斗仍掉血可输）。

### 四、界面与美工（8 项纯视觉）
1. 阿斗血条（掉血时显示红条）。
2. 顶栏底分隔条。
3. 回收圈提示「拖单位到此回收」。
4. 单位受击红描边（全局坐标，修复初版局部坐标 bug）。
5. 菜单关卡选择底卡。
6. 兵种图标（🗡️🏹🐴🛡️⚔️💂，无 emoji 字体回退汉字）。
7. 玩法说明页美化（emoji 分段标题 + 分段线）。
8. 血条渐变 fallback（无参时按血量着色，现有调用语义不变）。

### 五、工程
- 删除根目录 v1 死代码（`core.js`/`game.js`/`ui.js`），备 `.bak_v1/`。
- 冒烟脚本 `smoke.js` 全绿（数据表/合成/商店/抽卡/羁绊/整局通关）。
- 备份：`.bak_v1/`（v1）、`.bak_v2/`（v2 全量最终态）、`.bak_pretty/`（美工前快照）、`.bak_save/`（存档优化前快照）。

### 六、存档落盘到项目目录（2026-07-08 补充）
**需求**：把存档保存到项目目录（浏览器 JS 不能直接写文件，需本地后端服务承接写盘）。

**实现**（`server.js`）：
- 本地静态服务 + 存档 API，端口 `8384`。
- `POST /api/save?slot=N`：校验 `slot∈[0,2]` 后写盘 `saves/slotN.json`（固定文件名防目录穿越）。
- `GET /api/load?slot=N`：读回该槽 JSON；无存档返回 `{empty:true}`。

**界面改动**（`js/ui.js` 存档页）：
- 「导出存档」按钮改为「存到目录」：将当前槽 JSON `fetch` POST 到服务落盘，成功提示「已存到项目目录 ✓」。
- 「导入存档」按钮：优先 `fetch GET` 从目录读回，服务不可用时降级为手粘 JSON（兼容 `file://` 直接打开）。
- 自动存档仍走 `localStorage`（不破坏启动流与 `smoke.js`）；项目目录存档为**手动显式操作**，精准匹配"存档保存到项目目录"。

**工程**：
- 新增 `.gitignore` 忽略 `saves/` 与 `.bak_*/`。
- 备份刷新 `.bak_v2/`（含 `server.js` 及 `saves/`）。
- 自测：开 `http://localhost:8384/` → 存档管理 → 存到目录 → 检查 `D:\zhaoyun-adou\saves\slotN.json`；切槽再存验证 `slot1/2.json`。

### 七、撤销兵种图标改动（2026-07-08 补充）
**用户要求**：不要兵种图标（emoji）的改动，恢复为汉字兵种名。

**回退内容**（`js/ui_battle.js`）：
- 删除 `TROOP_ICON` 常量（🗡️🏹🐴🛡️⚔️💂 映射）。
- `unitGlyph` 兵种分支改回直接返回 `u.type`（枪/弓/骑/盾/刀/卒 汉字）。
- `drawUnitAt` 的 troop 分支改回 `txt(u.type, 0, 6, 22, col, 'center', true)`，不再叠加 emoji 图标。

**说明**：上一轮误报"已还原"但实际未改源文件，本轮已真改并验证（`grep TROOP_ICON` 0 match、`node smoke.js` 全绿）。其余 7 项美工（阿斗血条、顶栏底条、受击描边、回收提示、玩法说明页 emoji 分段、血条渐变 fallback、菜单关卡底卡）均保留。玩法说明页的 🎯🎴⚔️🔗⚙️ 与 ✓/♻/✦/♥ 符号不属于兵种图标，不在撤销范围。

### 八、玩法与优化清单实施（2026-07-08~09）

用户从玩法/优化建议清单中选定 6 项（地图多套布局、第四章三分归晋、全局难度档、压力怪随战力缩放、BOSS 专属技能、战场实时信息+拖拽合成预览），全部低侵入落地于 v2（`js/` 全量版），不破坏现有 30 关手感与平衡，新增项均为用户触发（战场选择/难度/无敌），非强制开启。`node smoke.js` 每步回归全绿（数据表/合成/整局通关）。

**③ 地图参数化（多套布局）**
- `js/data.js`：原硬编码布局抽为 `MAPS` 数组（含 `COLS`/`path`/`cells`/`open`），保留原长坂坡布局为 `MAPS[0]`；新增赤壁布局 `MAPS[1]`（路径/格子不同，视觉先共用）。
- `js/game.js`：`mkSide(side, mapIdx)` / `startBattle(stage, endless, mapIdx)` 接 `MAPS[mapIdx]`；旧常量保留作兼容引用不删。
- `js/ui.js`：菜单加「战场」选择（长坂坡/赤壁），`selMap` 透传；`startBattle` 调用带 `mapIdx`。
- 决策：地图按「战场选择」而非按 stage 自动映射，避免破坏现有 30 关手感。

**③ 第四章·三分归晋**
- `js/data.js`：`STAGES` 扩至 37 关（31–37 为第四章，37=司马懿），`STAGE_MAX` 30→37；`CHAPTERS` 加「第四章·三分归晋」；司马懿复用曹操 `summon`+`rage` 机制（`dmg:3`），不新增 `bossCast` 分支、不改 dmg 破坏平衡。
- `js/waves.js`：无尽 BOSS 轮转加司马懿。
- `js/ui.js`：章节名 `Math.min(3, …)` 适配四章。

**⑤ 全局难度档（简单/普通/困难）**
- `js/save.js`：`defaultSave` 加 `difficulty:'normal'`。
- `js/waves.js`：`startWave` 内查 `DM` 表（easy:[0.8,0.85] normal:[1,1] hard:[1.25,1.15] = [hpMul,atkMul]），`G.hpMul *= DM[0]`、`G.atkMul *= DM[1]`。
- `js/ui.js`：菜单加难度循环按钮（简单→普通→困难），切换即 `saveSave()` 持久化。
- 语义：作用于所有战斗（含无尽），非新增无尽模式。

**④ 压力怪随战力缩放**
- `js/data.js`：删硬编码 `PRESSURE_KILLS=10`，改纯函数 `pressureKills(stage,diff)`：`base=max(4,10-floor((stage-1)/5))`，难度系数 easy×1.2/normal×1/hard×0.85，`return max(3,round(base*dm))`。
- `js/battle.js`：压力怪判定改 `const pk=pressureKills(G.stage||1, SAVE.difficulty||'normal'); if(S.killCnt>=pk)`。
- 验证：stage1 normal=10、stage37 normal=4、hard=3、easy=5；阈值随关卡降、难度微调，整数运算无浮点偏差。

**① BOSS 专属技能**
- `js/data.js`：铁甲巨兽/骑兵统帅/重甲骑兵 补 `castIv`+`cast:'summon'`（复用现有 summon 分支，低侵入）；tip 加召唤兵种说明。
- `js/battle.js`：`bossCast` 的 summon 分支按 BOSS 名映射兵种（重甲骑兵→斧、骑兵统帅→骑、铁甲巨兽→卒、曹操/司马懿→卒），不新增系统、不破坏平衡。

**② 战场实时信息 + 拖拽合成预览**
- `js/ui_battle.js`：drawGame 顶栏后加右下实时信息面板（248,468,124,88，底 556 安全避让合成栏 y560/612 与回收圈 y636）：阿斗血量、击杀数、馒头、难度、关卡/波次。
- `js/ui.js`：`pointermove` 拖拽中按落点调用纯函数 `mergeUnit` 计算预览，设 `drag.hint`（升阶/合成XX/合成道具/互换，排除自身槽位）；`js/ui_battle.js` 拖拽浮层在跟随单位上方画橙色 `hint` 标签。
- 依赖：`barAt`/`boardAt`（ui.js 全局函数）、`mergeUnit`（merge.js 纯函数）均确认存在、无副作用。

**工程**
- 冒烟脚本 `smoke.js` 断言 `STAGES.length===37`，整局通关全绿。
- 备份刷新 `.bak_v2/`（含最终态全量 js + saves/）。
- 前端改动热生效：浏览器刷新 `http://localhost:8384/` 即取新 js，无需重启后端。

## 2026-07-09 文档三大系统优化前5项落地（p6去重已取消）

基于《赵云与阿斗_抽卡战斗武将_三大系统优化全量文档.md》未实现功能排查，用户要求前5全做（p6碎片去重明确"不要"，todo 已 cancelled）。全部低侵入落地于 v2（`js/`），不破坏现有手感与平衡，新增项均为玩家侧触发。`node smoke.js` 每步回归全绿（数据表/合成/整局通关）。

### ① 十连降价90 + 首十连半价50（p1）
- `js/data.js`：`DRAW.tenCost` 100→90。
- `js/save.js`：`defaultSave` 加 `firstTen:true`（首十连半价标记）。
- `js/actions.js`：`drawTen` 守卫 `S.side>0 && SAVE.firstTen` 时半价（`tenCost/2|0`），扣费后置 `firstTen=false` 并 `saveSave`。
- `js/ui_battle.js`：十连按钮动态显示半价/原价（`tenCostNow`），首抽后恢复原价。

### ② 阿斗护盾（p2）
- `js/game.js`：`mkSide` 加 `shield:0, noHit:true`。
- `js/waves.js`：`startWave` 每波+1、本波无伤+1（上限2），首波只给基础1盾不触发无伤+1。
- `js/battle.js`：`hurtAdou` 护盾吸收优先于续命丹（吸收后 `return` 不扣血），仅玩家侧 `S.shield>0`。

### ③ 临时背包（p3）
- `js/game.js`：`mkSide` 加 `tempBag: side>0 ? [] : null`（AI侧为null不渲染）。
- `js/actions.js`：`placeCards` 栏满→`S.side>0 && S.tempBag && S.tempBag.length<3` 暂存，再满才折现2/张（`over++`）。
- `js/ui_battle.js`：合成栏上方画3格虚线区（x=8/56/104, y=512, 44×44），点击移入合成栏空位；「清」按钮（152,512）折现所有背包卡（2馒头/张）。

### ④ 打击反馈（p4）
- `js/battle.js`：`damageUnit` 受击闪白（`u.animT=0.18`，复用 drawUnitAt 红描边）+ 伤害飘字（`fl` 红字 `-dmg`）。
- `js/battle.js`：`dealDmg` 克制翻倍时暴击粒子+「暴击!」飘字（**修复 atkSide 静默失效 bug**：原 `S.side>0` 中 `S` 是防守方怪物侧恒假，改为 `atkSide = byUnit && G.P.cells.some(c=>c.unit===byUnit) ? 1 : -1`）。
- 击杀爆炸/飘字复用已有 `boom`/`fl`，hit 段不重复 `boom` 防粒子翻倍。

### ⑤ 连杀提示（p5）
- `js/game.js`：`mkSide` 加 `combo:0, comboT:0`；`update` 循环内 `comboT` 衰减清零（5秒窗口）。
- `js/battle.js`：`dealDmg` 击杀处 `S.combo++` / `S.comboT=5`，`combo>=3` 触发 banner「连杀! 攻速+20%」+ 飘字（独立计数，不干扰压力怪 `killCnt`）。
- `js/merge.js`：`unitStats` 两处 `rate` 乘 `comboMul`（`S.side>0 && S.combo>=3 ? 1.2 : 1`，攻速+20%）。

### 工程

## 2026-07-09 文档剩余9项落地（q1~q9，简化可玩版 b）
### ⑩ 心愿单系统（q1 / 1.2.4，直接生效，仅玩家侧）
- save.js defaultSave 加 `wish: ''`；game.js mkSide 按 `side > 0` 注入 `S.wish = SAVE.wish || ''`（AI 侧恒空，防误加权）。
- actions.js `rollChar(S)` 改为带参：若 `S.wish` 存在，50% 概率直接返回心愿将碎片字并标 `{wish:true}`，否则原随机池；`rollCard`/`drawTen` 调用点同步传 `S`。
- ui.js 主菜单加「心愿单」按钮（30,500）→ `scr='wish'`；新增 `drawWish()` 面板：12 橙将网格点选（再点取消），`saveSave()` 落盘；`draw()` 补 `wish` 分支。
- ui_battle.js ifrag 绘制加金色星标 + 金色字（心愿碎片视觉反馈）。
- 守卫：`S.side > 0` 才生效，AI 侧静默跳过；无头 smoke 不依赖 DOM/raf。
- `node smoke.js` EXIT=0 全绿。

### ⑪ 抽卡动画（q2 / 1.2.5，直接生效，仅玩家侧）
- 十连沿用基线 `G.summonFx`（将名横幅）+ `G.flash`（全屏闪）canvas 近似动画（ui_battle.js 消费）。
- 单抽 `doSummon` 补轻量反馈：`S.side>0 && typeof G!=='undefined' && G` 时 `G.flash=0.35`。
- 三处 `G` 访问（`drawTen:73`、`gainItem:130`、单抽）统一加 `typeof G!=='undefined'` 守卫，防无头 smoke 崩溃（原裸 `&& G` 在 G 未定义时 ReferenceError）。
- 守卫：`S.side>0` 才触发，AI 侧静默跳过；无头 smoke 不依赖 DOM/raf。
- `node smoke.js` EXIT=0 全绿。

### ⑮ 无尽纪元（q6 / 2.2.5，默认关，菜单开）
- `save.js` 加 `endlessOn:false` 开关（重型，默认关）。
- `ui.js` 菜单 (210,440) 加「无尽快捷：开/关」钮，toggle `SAVE.endlessOn` 并 `saveSave()`。
- 原生无尽按钮 disabled 条件放宽为 `!(SAVE.endless || SAVE.endlessOn)`，绕过30关门槛直接进无尽（不破坏原通关解锁流程）。
- 无尽波次生成逻辑复用现有 `G.endless` 分支（waves.js 第38波后递增难度 + 每10波名将BOSS），无需重写。
- 守卫：仅菜单开关控制，无头 smoke 不依赖 DOM/raf。
- `node smoke.js` EXIT=0 全绿。

### ⑯ 新增6橙将（q7 / 3.2.1，默认关，菜单开）
- data.js HEROES 加 张辽/太史慈/典韦/甘宁/吕布/许褚（grade:4，技能复用 qjqc/dahe/tiaopi/huojian/shengjian，无新增技能分支，避免静默失效）。
- actions.js rollChar 抽卡池改为运行时条件：`SAVE.newHeros` 开时取全量 grade4（18将），关时仅原12将；避开顶层 SAVE 的 TDZ 崩溃（早期在 data.js 顶层引用 SAVE 已回滚）。
- save.js 加 `newHeros:false`；ui.js 菜单(210,470)加「新橙将：开/关」钮（saveSave 持久化）；顺带清掉 q6 时期残留的游离对象字面量语法垃圾。
- smoke 探针断言校正：HERO_LIST 18、POOL_CHARS 25；`node smoke.js` EXIT=0（22s win）。

---

### ⑰ 武将觉醒（q8 / 3.2.2，默认关，菜单开）
- 简化版：新增觉醒丹道具（data.js ITEMS.juexing，act 主动，uses:3，price:200），点武将觉醒+1级（上限3），全属性×1.3^awaken（dmg/rng/rate/maxhp，仅英雄，不影响小兵）。
- 开关：save.js 加 awaken:false；ui.js 菜单(210,500)「武将觉醒：开/关」按钮（重型默认关，菜单开）。
- 逻辑：merge.js mkHero 加 awaken:0 字段；unitStats 英雄分支乘 awMul=Math.pow(1.3,aw)；actions.js useItem 纳 juexing 进 targeting、applyTarget 加觉醒分支（守卫 !SAVE.awaken / u.t!=='hero' / u.awaken>=3）。
- 验证：node smoke.js EXIT=0（ITEMS 断言 12→13 通过）；备份 .bak_v2 已刷。

---

### ⑱ 装备扩展（q9 / 3.2.3，默认关，菜单开）
- 简化版：新增防具（data.js ARMORS：藤牌减伤15% / 金甲减伤30%，作用于阿斗受袭）、饰品（ACCESSORIES：玉圭攻速+15% / 战佩攻速+30%，作用于英雄 rate）；套装/全装备树后续。
- 开关：save.js 加 gearOn:false、equipArmor:null、equipAcc:null（重型，默认关，菜单开）。
- 逻辑：battle.js hurtAdou 扣血前按 ARMORS[SAVE.equipArmor].def 减伤（守卫 gearOn + S.side>0）；merge.js unitStats 英雄 rate 乘 ACCESSORIES[SAVE.equipAcc].spd（守卫 gearOn，仅英雄不影响小兵）。
- UI：菜单(210,530)总开关 + (30,530)防具轮换 + (138,530)饰品轮换，均 saveSave 持久化；坐标与既有钮无重叠。
- 验证：node smoke.js EXIT=0（ARMORS/ACCESSORIES 各2项断言通过）；备份 .bak_v2 已刷。

### ⑲ 菜单「一键全开(重型)」快捷钮
- 位置：菜单 (210,562) 绿色钮；点击批量置 `dynPath/bossPhase/endlessOn/newHeros/awaken/gearOn = true` 并 `saveSave()` 持久化。
- 设计：仅开重型总开关，不预设 `equipArmor/equipAcc`（防具/饰品仍手动轮换），避免无装备时凭空增益、保持平衡；各独立开关钮保留可手动回关。
- 验证：node smoke.js EXIT=0；ui.js 语法修复后 lint ok；备份 .bak_v2 已刷（grep 强验"一键全开"=1）。

### ⑳ 项目目录一键启动快捷方式
- 交付物：`D:\zhaoyun-adou\start_game.bat`（纯 ASCII 文件名与内容）。双击即 `cd` 到项目目录 → 检查 node → 端口 8384 去重（已占用则跳过启动）→ `node server.js` 后台拉起 → 自动开 `http://localhost:8384/`。
- 命名/编码：Windows 控制台默认 GBK，UTF-8 无 BOM 中文 bat 会乱码失效（首版中文 `启动游戏.bat` 已实测炸掉并删除），故改用纯 ASCII 文件名与英文提示，避免编码坑。
- 验证：实跑 `start_game.bat` 输出 `Server already running on port 8384, opening browser...`、BAT_EXIT=0，浏览器拉起并连 8384（ESTABLISHED）。bat 非 js，不进 `.bak_v2`。

### ㉑ 首页菜单布局整理（视觉去乱）
- 触发：用户反馈首页太乱。贴图分析因 403 权限不可用，改用坐标论证定位：心愿单(y500)与提示(y498)重叠、右侧开关单列纵排到 y562 过长、入口钮配色棕/蓝/紫/灰混用。
- 改动（仅 `drawMenu()`，回调 fn 与 SAVE 字段名全不动）：
  - 功能开关由单列纵排改为 **2行×3列网格**（兵种无敌/动态路径/BOSS阶段/无尽快捷/新橙将/武将觉醒），统一配色（关灰 `#495057` / 开绿 `#2f9e44`）。
  - 装备扩展、一键全开单独一行；防具/饰品轮换钮改为 **仅 `gearOn` 开启时显示**，关时自动隐藏避免常驻杂乱。
  - 入口钮（道具商店/锻造装备/武将装备）统一灰底，去掉棕/蓝/紫混色。
  - 提示精简为 3 行（去重已在玩法说明中的条目）；心愿单/存档管理移出提示区、并排底部，消除重叠。
- 验证：`node --check js/ui.js` → UI_SYNTAX_OK；`node smoke.js` → EXIT=0 全绿；画布 H=667，新布局最大 y+h=660 未越界；已先备份 `.bak_v2/ui.js`。静态脚本，浏览器刷新即生效（建议 Ctrl+F5 硬刷）。

---

### ⑭ BOSS阶段技能（q5 / 2.2.2，默认关，菜单开）
- `save.js` 加 `bossPhase:false` 开关（重型，默认关）。
- `battle.js spawnMob`：boss 对象加 `phase:1, phaseDone:{2:false,3:false}` 字段。
- `battle.js updateMob`：`SAVE.bossPhase && m.boss` 时按 `m.hp/m.maxhp` 切阈值——≤0.6 且未触发→阶段2 `m.spd*=1.2`（疾行，横幅）；≤0.3 且未触发→阶段3 `m.atk*=1.3`（狂暴，横幅）；`phaseDone` 保证每阶段只触发一次。
- `ui.js` 菜单 (210,410) 加「BOSS阶段：开/关」钮，toggle `SAVE.bossPhase` 并 `saveSave()`。
- 守卫：`typeof G!=='undefined' && G` 横幅；无头 smoke 不依赖 DOM/raf。
- `node smoke.js` EXIT=0 全绿。

### ⑬ 动态路径（q4 / 2.2.1，默认关，菜单开）
- `save.js` 加 `dynPath:false` 开关（重型，默认关）。
- `waves.js startWave`：`SAVE.dynPath` 时按 `G.wave%3` 算 `G.colOff`（-28 左 / 0 中 / +28 右）循环偏移敌侧出兵口；否则 `colOff=0`。
- `battle.js` 敌侧 mob 渲染：`if (S.side < 0) m.x += (G.colOff||0)`（仅敌侧，不碰分岔寻路）。
- `ui.js` 菜单 (210,378) 加「动态路径：开/关」钮，toggle `SAVE.dynPath` 并 `saveSave()`。
- 守卫：仅敌侧生效，玩家侧路径不变；无头 smoke 不依赖 DOM/raf。
- `node smoke.js` EXIT=0 全绿。

### ⑫ 招贤纳士（q3 / 1.2.6，直接生效）
- 基线已含完整"招贤令"机制：`data.js:141` 道具定义（price:150，tip 武将字概率+60%）、`actions.js:21` 抽卡加权 `charW×1.6`、`actions.js:79/82` 获得即 `S.zhaoxian=true` 并横幅提示、`game.js:30` 状态位。商店购买→入 loadout→对局内 `rollCard` 直接生效，满足简化可玩版核心可玩性（无需独立面板）。
- 本次补强：`save.js toggleLoadout` 加 `if (SAVE.loadout.includes(id)) return;` 去重守卫，防重复 push 同一道具。
- 守卫：仅玩家侧 `S.side>0` 生效；无头 smoke 不依赖 DOM/raf。
- `node smoke.js` EXIT=0 全绿。

- 冒烟脚本 `smoke.js` 整局通关全绿（p1–p5 各阶段增量验证 + 收尾回归）。
- 额外修复（人工核对发现、smoke 抓不到）：攻速倍率方向反（误写×0.8降速→×1.2）、克制粒子 `S.side`→`atkSide` 静默失效、p3清空钮与道具钮重叠（140,634→152,512）、AI侧 `tempBag` null 防御。
- 服务 `http://localhost:8384/` 在线（node TCP 探活 `UP_8384`）；前端改动热生效，浏览器强制刷新即取新 js。
- 备份刷新 `.bak_v2/`（含最终态全量 js + saves/）。
