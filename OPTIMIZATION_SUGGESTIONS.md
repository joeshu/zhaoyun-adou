# 《赵云与阿斗》优化建议（基于代码通读）

> 审计范围：`js/*`、`server.js`、`smoke.js`、`tests/*`、构建脚本、`ios-no-codesign.yml`、`package.json`、`DESIGN.md`。
> 结论：功能完整、数据表严谨、冒烟测试扎实，是一份成熟度很高的个人项目。以下按"收益/风险"排序，给出可落地的优化点。

---

## 一、性能与渲染（影响移动端帧率，优先级最高）

### 1. 每帧大量数组分配 → GC 压力
战斗循环里多个热路径每帧都 `Array.filter()` / `.sort()`，在 iOS WebView 上会频繁触发垃圾回收、掉帧。
- `js/battle.js:115` `inRangeMobs`：`.filter().sort()`，单位每次攻击都调用
- `js/battle.js:119` `heroHits`：`S.mobs.filter()`，每发随机打击一次
- `js/battle.js:103` `updSnake`：`S.mobs.filter()`，每条灵蛇每帧
- `js/battle.js:325/340` 弩兵 `S.cells.find()`、近战 `findBlocker` 每帧遍历 cells
- `js/game.js:285-294` `update` 中对 `S.cells` / `S.mobs` 再用 `.filter()` 做副作用清理（每帧两次新数组）

**建议**：
- 把"筛选活着且进入范围的怪"改为计数 `for` 循环 + 复用预分配的临时数组（对象池），避免每帧 new 数组。
- 在 `update` 顶层对每侧只算一次 `aliveMobs` 快照，作为 `updUnit`/`heroHits`/`updSnake` 的入参，而不是各处各自 filter。
- 副作用清理（`S.mobs = S.mobs.filter(...)`）改为原地双指针压缩（in-place compaction），零分配。

### 2. `unitStats` 每帧重复计算光环
`js/merge.js:88-90`：每次算单位数值都遍历 `S.cells` 累加刘备类光环，而同一 side 所有单位共享同一组光环来源，等于 O(单位数 × 格子数) 重复计算。

**建议**：每帧每侧只计算一次 `auraTotal`（或按武将缓存），`unitStats` 直接读取；`unitStats` 本身结果也可针对静止单位做帧缓存（仅在升级/穿戴/羁绊变化时失效）。

### 3. Canvas 阴影与字体每帧重算（菜单/战场 HUD）
- `js/ui.js:33` `panel()` 给每个面板设置 `shadowBlur`/`shadowOffsetY`，阴影是 Canvas 最贵的操作之一。菜单页一次绘制尚可，但**战场 HUD 每帧重绘带阴影的面板会明显掉帧**。
- `js/ui.js:13` `txt()` 每帧拼接 `ctx.font` 字符串。

**建议**：
- 把静态界面（菜单、商店、锻造等）离屏渲染到 `OffscreenCanvas`/缓存位图，仅在状态变化时重绘；战场层只画动态元素。
- 字体字符串加 Map 缓存（`fontCache[size+bold]`）。
- 战场 HUD 面板改用纯填充 + 1px 描边替代阴影，或只对关键浮层用阴影。

### 4. 主循环缺固定步长保护
未发现明确 `requestAnimationFrame` 实现（在 `ui.js` 后半段），但需确认：`update(dt)` 若直接用 rAF 的 `dt` 且未 clamp，**切后台/卡顿会导致大 dt 跳变**，战斗瞬间加速或穿模。

**建议**：`dt = Math.min(dt, 0.05)` 钳制 + 固定步长累加器（accumulator）跑逻辑（如 1/60），渲染插值可选。

---

## 二、架构与工程化

### 5. 18 个 JS 全靠 `<script>` 顺序加载、共享全局 —— 无打包/无模块
`index.html` 顺序引入 18 个文件，全部挂在全局。优点：`smoke.js` 用 `eval` 拼接即可无头测试；缺点：命名污染风险、无法 tree-shake、移动端 18 次请求 + 18 次解析。

**建议**：
- 开发期保持多文件（便于调试 + 兼容 smoke 测试）。
- 生产构建用 **esbuild** 打包为单个 `bundle.js`（一条命令、零配置、支持 `--minify`），Capacitor 打包时引用 `bundle.js`。收益：请求数 18→1、首次加载更快、包体更小。
- （进阶）迁移到 ES Module + 一个 `Game` 命名空间对象，彻底消除全局污染，但需同步改造 `smoke.js` 的 eval 拼接方式。

### 6. `npm test` 缺失（明确缺口）
`tests/events.test.js`、`tests/layout.test.js` 已存在，但 `package.json` **没有 `test` 脚本**，CI 也不跑测试 → 测试形同虚设。

**建议**：
```json
"scripts": {
  "test": "node smoke.js && node tests/events.test.js && node tests/layout.test.js",
  "lint": "eslint js/**/*.js"
}
```

### 7. 无 `package-lock.json`，依赖不可复现
CI 用 `npm install --no-package-lock` 现装（`ios-no-codesign.yml:39`）。Capacitor 6 对 CLI/核心版本有兼容窗口，现装可能拉到不兼容版本导致构建漂移。

**建议**：提交 `package-lock.json`（已在 `.gitignore`？未忽略，需确认），CI 改为 `npm ci`。

### 8. 无 ESLint / Prettier
代码风格靠手感，已出现混用：`var`/`let`/`const` 并存（`battle.js:211/214/215`，`game.js` 多处），单双引号不一致。

**建议**：加 `eslint --ext .js`（推荐 `standard` 或 `airbnb-base`）+ `prettier`，CI 跑 lint。统一为 `let/const`，删除 `var`。

---

## 三、代码质量与明确缺陷（建议顺手修）

### 9. `castSkill` 重复的存活判断（复制粘贴 bug）
`js/battle.js:158-159`：
```js
if (!S.mobs.some(m => m.hp > 0)) return false;
if (!S.mobs.some(m => m.hp > 0)) return false;   // 完全重复，应删除
```

### 10. 成就 `first_hero` 判定永远为真
`js/save.js:285`：
```js
check: () => SAVE.weapons !== undefined && Object.keys(SAVE.equips || {}).length >= 0
```
`>= 0` 恒为真，等于"只要 weapons 字段存在就解锁"，与"合成首位武将"语义不符。应改为检查已合将记录（如 `SAVE.stats.heroes > 0`）或 `SAVE.weapons.length >= 1` 配合语义。

### 11. Mob 上限判定重复 3 次
`mode` 对应的怪物上限 `fire?10 : (escort||puzzle)?12 : 999` 在 `game.js:255`、`game.js:267`、`battle.js:57` 各写一遍，易改漏。

**建议**：抽成 `function mobCap(mode){...}` 统一引用。

### 12. 死常量 `CELL`
`js/data.js:5` `const CELL = 48` 似乎未被使用（格子坐标由 `ROWS/COLS` 决定）。删除或加注释说明用途。

### 13. `prepare-www.js` 会把本地存档打进 iOS 包
`scripts/prepare-www.js:34-41` 把本地 `saves/` 内容复制到 `www/saves/`，随后 `cap copy` 会整目录带入 App。若本地有真实存档/录像，会随 IPA 分发（增大包体 + 隐私残留）。

**建议**：只 `mkdirSync(www/saves)` 创建空目录占位，不复制内容。

### 14. `package-ipa.js` 冗余/会报错的 ditto
`scripts/package-ipa.js:37-43`：先执行一次 `ditto`（Payload 不存在会失败），再 `mkdir` 后重新 `ditto`。第一段是无效且会抛错的命令。

**建议**：删掉 37-41 行，仅保留 `mkdir + ditto + zip` 的正确路径。

---

## 四、安全（server.js，单机影响有限但属"伪安全"）

### 15. 存档 token 形同虚设
`server.js:134` `/api/token` 向任意 allowed origin **直接返回一次性 token**，任何人能拿到即可写盘。结合 `null`（file://）也放行，等于无鉴权。

**建议**：纯单机本地服务，可直接去掉 token 机制，仅保留 Origin 白名单 + 防目录穿越即可；若保留，token 应绑定会话、且 `/api/token` 不应无鉴权返回。

### 16. 静态文件用 `fs.readFileSync` 同步读
`server.js:144` 每请求同步读盘，阻塞事件循环。本地开发可接受，可改为 `fs.readFile` 异步 + 简单内存缓存（mtime 命中直接回缓存）。

---

## 五、文档一致性

### 17. `DESIGN.md` 已滞后于实现
- 说默认 `gold:100, mat:2`，实现 `defaultSave()` 是 `gold:10000`（`save.js:12`）——差 100 倍。
- 说"30 关解锁无尽"，数据已扩到 **37 关 + 第4章（三分归晋）**，BOSS 排程到 37 关司马懿。
- 标题仍为"v2 工程设计"，但代码已是 v7 存档、含皮肤/群英谱/英雄挑战/日周常等大量 v3 内容。

**建议**：把 `DESIGN.md` 更新为 v3 现状（或加顶部"文档版本"标注），避免后续维护者被旧文档误导。

---

## 六、发布流程

### 18. iOS 打包完善，但可补强
- 仅支持 iOS（`capacitor.config.json` 只加 ios）。如目标用户有安卓，补 `@capacitor/android` 扩大覆盖。
- CI（`ios-no-codesign.yml`）建议增加：**PR 也跑 `npm test` + lint**，当前仅 push main 才跑 iOS 构建，且无测试关卡。
- 可加 `retention-days` 已设 30 天，OK。

---

## 建议落地顺序（按性价比）

| 优先级 | 项 | 类型 | 风险 |
|---|---|---|---|
| 🔴 高 | #9 castSkill 重复行 | 删代码 | 零 |
| 🔴 高 | #10 成就判定 bug | 1 行修正 | 零 |
| 🔴 高 | #13 prepare-www 不复制存档 | 改脚本 | 零 |
| 🔴 高 | #14 package-ipa 冗余 ditto | 删代码 | 零 |
| 🟠 中 | #6 补 `npm test` 脚本 | 配置 | 零 |
| 🟠 中 | #1/#2 战斗热路径去分配 | 重构 | 中（需 smoke 验证） |
| 🟠 中 | #3 静态层离屏缓存 + 阴影收敛 | 渲染 | 中 |
| 🟠 中 | #5 生产 esbuild 打包 | 构建 | 低 |
| 🟡 低 | #7 提交 lock + `npm ci` | 依赖 | 低 |
| 🟡 低 | #8 ESLint/Prettier | 规范 | 低 |
| 🟡 低 | #11/#12 抽 mobCap / 删死常量 | 清理 | 零 |
| 🟡 低 | #15/#16 server 鉴权与异步读 | 安全 | 低 |
| 🟡 低 | #17 更新 DESIGN.md | 文档 | 零 |
| 🟡 低 | #18 补安卓 + CI 测试关卡 | 发布 | 低 |

> 红色项均为"无争议的明确缺陷"，可立即修且零风险；橙色项是主要体验/工程收益所在；黄色项为打磨。需要我直接落地哪几条，告诉我即可。

> **落实状态**：以上 #1–#18 工程化建议已于 commit `a203c7b` 全部落地（#12 死常量经核实实际在用，跳过），CI run 29970864896 通过。

---

# 附：功能 · 玩法 · 界面 · 画面优化（第二批审计，均已落实 ✅）

> 在工程化 18 条之外，针对**游戏体验层**做的 14 项优化，分 P0 / P1 / 顺手做 三级。全部实现并通过 smoke / events / layout 测试，18 个 js 文件语法检查 ALL_JS_OK。

## P0 — 核心体验

| # | 项 | 落实说明 | 状态 |
|---|---|---|---|
| 15 | 速度四档 | 加速按钮改 1×→2×→3×→4× 循环（`ui_battle.js`） | ✅ 已落实 |
| 16 | 怪物上限 | 普通/无尽 `mobCap` 999 → 60，防后期卡顿（`data.js`） | ✅ 已落实 |
| 17 | 下一波预告 | 顶栏显示「下波 ▸ 兵×N …」（`waves.js` 算 previewQ + `ui_battle.js` 绘制） | ✅ 已落实 |
| 18 | 撤销 | 玩家侧操作前 JSON 快照入栈，一键回退（`actions.js` pushUndo/undoAction） | ✅ 已落实 |
| 19 | 锻造选系 + 保底 | 限定枪/刀/弓/剑系；连重复 ≥5 强制出新武器（`save.js` forgeSeries/forgeDupStreak） | ✅ 已落实 |
| 20 | 棋子底衬 | 按兵种加圆/盾/菱/方底牌 + 描边，汉字居中（`ui_battle.js` drawBase） | ✅ 已落实 |

## P1 — 爽感增强

| # | 项 | 落实说明 | 状态 |
|---|---|---|---|
| 21 | 打击感 | BOSS 击杀/阿斗受袭/武将大招触发屏震 + 径向爆裂粒子（`battle.js` addShake/boomRadial） | ✅ 已落实 |
| 22 | 十连翻牌 | 抽十连逐张弹入的翻牌仪式面板（`actions.js` cardReveal + `ui_battle.js` 绘制） | ✅ 已落实 |
| 23 | 过场动画 | 切屏淡入遮罩（`ui.js` _wipe） | ✅ 已落实 |
| 24 | 护盾标识 | 阿斗头顶画菱形盾数（`ui_battle.js` drawAdou） | ✅ 已落实 |

## 顺手做

| # | 项 | 落实说明 | 状态 |
|---|---|---|---|
| 25 | 色弱模式 | 实验室开关，底牌加黑色高对比描边（`save.js` colorblind + `ui.js` 开关） | ✅ 已落实 |
| 26 | 觉醒视觉 | 数值倍率本已存在，补橙色小圆点 + 实验室展示（`ui_battle.js`/`ui.js`） | ✅ 已落实 |
| 27 | 遗物系统 | 每 5 波弹「本局军略」三选一，复用 rogue 选择 UI（`modes.js` offerRelic，增益经 playerDmgMul/RateMul/HpMul 注入 unitStats） | ✅ 已落实 |
| 28 | 皮肤立绘 | 前 6 武将已自带 SKINS 表，未大改 | ✅ 已有 |
| 29 | 排行榜 | 录像列表按关卡降序 / 步数升序排名显 #名次（`ui.js` drawGhost） | ✅ 已落实 |
