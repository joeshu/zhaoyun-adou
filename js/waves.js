/* v2.1 波次生成：按文档 5.2 的 30 关逐关配置表；无尽用 30 关配置持续增压 */
'use strict';

function stageOf() { return G.endless ? STAGE_MAX : G.stage; }
function stageCfg(st) { return STAGES[clamp(st, 1, STAGE_MAX) - 1]; }

function startWave() {
  G.wave++;
  if (SAVE.dynPath) {
    const ph = G.wave % 3;
    G.colOff = ph === 1 ? -28 : ph === 2 ? 28 : 0;   // 左/中/右 循环偏移（敌侧出兵口）
  } else G.colOff = 0;
  // 阿斗护盾：每波基础+1；若上一波无伤额外+1；上限2；首波(wave=1)只给基础1
  if (G.P) {
    if (G.wave > 1 && G.P.noHit) G.P.shield = Math.min(2, G.P.shield + 1);
    G.P.shield = Math.min(2, G.P.shield + 1);
    G.P.noHit = true;
  }
  const st = stageOf(), modeCfg = typeof modeWaveConfig === 'function' ? modeWaveConfig() : null, cfg = modeCfg || stageCfg(st);
  const waves = cfg.waves === undefined ? cfg[0] : cfg.waves;
  const per = cfg.per === undefined ? cfg[1] : cfg.per;
  const mix = cfg.mix === undefined ? cfg[2] : cfg.mix;
  const boss = cfg.boss === undefined ? cfg[3] : cfg.boss;
  G.hpAdd = cfg.hpAdd === undefined ? (cfg[4] || 0) : cfg.hpAdd;
  G.atkMul = 1 + (cfg.atkTier === undefined ? (cfg[5] || 1) : cfg.atkTier) * 0.12;
  G.goldAdd = (st / 3) | 0;                                  // 击杀奖励 = 基础 + floor(关卡/3)
  const DM = { easy: [0.8, 0.85], normal: [1, 1], hard: [1.25, 1.15] }[SAVE.difficulty] || [1, 1];
  G.hpMul = (modeCfg ? modeCfg.hp : (G.endless ? 1 + (G.wave - 1) * 0.12 : 1 + (G.wave - 1) * 0.05)) * DM[0];
  G.atkMul *= DM[1];
  // 类型映射：步→兵 弓→弩 骑→骑 甲→斧
  const types = ['兵', '弩', '骑', '斧'];
  const pool = mix.map((w, i) => [types[i], w]).filter(p => p[1] > 0);
  if (G.endless) pool.push(['狂', 10]);
  const iv = Math.max(0.4, 0.95 - G.wave * 0.03);
  G.spawnQ = [];
  for (let i = 0; i < per; i++) G.spawnQ.push({ t: i * iv, type: wpick(pool), hpMul: G.hpMul });
  // BOSS：本关末波（无尽每 10 波轮换名将，非无尽用本关配置）
  let bossTxt = '';
  const bossWave = G.endless ? G.wave % 10 === 0 : G.wave === waves;
  if (boss && bossWave) {
    const bossType = G.endless
      ? (['梁', '铁', '统', '帅', '兽', '曹', '懿'])[((G.wave / 10) - 1) % 7]
      : boss;
    G.spawnQ.push({ t: per * iv + 1.5, type: bossType, hpMul: G.hpMul });
    bossTxt = ' · ' + MOBS[bossType].name;
  }
  G.spawnT = 0;
  G.banner = { txt: '第 ' + G.wave + '/' + (G.endless ? '∞' : waves) + ' 波' + bossTxt, t: 1.6 };
  if (G.endless && G.wave > SAVE.bestWave) { SAVE.bestWave = G.wave; saveSave(); }
  if (!G.mode && typeof chapterWaveEvent === 'function') chapterWaveEvent();
}
