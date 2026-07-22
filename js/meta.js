/* V3-A：战前军师与局内军令。 */
'use strict';
const ADVISERS = {
  zhuge: { name: '诸葛亮', tip: '首轮备战 +5 秒；将字出现率略升', col: '#4b72a8' },
  pang: { name: '庞统', tip: '火攻/陨石伤害 +25%', col: '#bd4a31' },
  fazheng: { name: '法正', tip: '每完成一条军令，额外获得 8 馒头', col: '#7250b8' },
};
const ORDERS = [
  { id:'merge', name:'整军', desc:'完成 3 次合成', need:3, reward:12, key:'merges' },
  { id:'kill', name:'破阵', desc:'击杀 18 名敌军', need:18, reward:15, key:'kills' },
  { id:'hero', name:'募将', desc:'合成 1 名武将', need:1, reward:18, key:'heroes' },
];
function initBattleMeta() {
  const pool = ORDERS.slice().sort(() => Math.random() - .5).slice(0, 2);
  G.orders = pool.map(o => ({ ...o, value:0, done:false }));
  G.adviser = SAVE.adviser || 'zhuge';
  if (G.adviser === 'zhuge') G.betweenT += 5;
  if (G.adviser === 'fazheng') G.P.mantou += 5;
}
function orderProgress(key, n=1) {
  if (!G || !G.orders) return;
  for (const o of G.orders) {
    if (o.done || o.key !== key) continue;
    o.value = Math.min(o.need, o.value + n);
    if (o.value >= o.need) {
      o.done = true; const extra = G.adviser === 'fazheng' ? 8 : 0;
      G.P.mantou += o.reward + extra;
      fl(190, 520, '军令达成 +' + (o.reward + extra) + '馒', '#b78324');
      G.banner = { txt:'军令·' + o.name + '达成！', t:1.5 };
    }
  }
}
function adviserDamageMul(kind) { return G && G.adviser === 'pang' && (kind === 'fire' || kind === 'meteor') ? 1.25 : 1; }
