/* 战斗事件总线：让军令、成就、统计、录像、UI不用在多处各自硬编码。 */
'use strict';
var _evListeners = {};
function evOn(name, fn) { (_evListeners[name] || (_evListeners[name] = [])).push(fn); }
function evEmit(name, data) { var L = _evListeners[name]; if (L) for (var i = 0; i < L.length; i++) L[i](data); }

// 事件桥接——在战斗引擎关键位置调用这些函数即可。
function evKill(side, mob) {
  evEmit('kill', { side: side, mobType: mob.type, isBoss: !!mob.boss, isSupply: mob.type === '粮', isPress: !!mob.press });
}
function evMerge(type) { evEmit('merge', { type: type }); }
function evHeroCreated(name) { evEmit('hero', { name: name }); }
function evSummon(count) { evEmit('summon', { count: count }); }
function evWin(stage, endless, mode, rewardTxt) { evEmit('win', { stage: stage, endless: endless, mode: mode, rewardTxt: rewardTxt }); }
function evBossWarning(name) { evEmit('boss_warning', { name: name }); }
function evBossSkill(name, skill) { evEmit('boss_skill', { name: name, skill: skill }); }
function evHeroRespawn(name) { evEmit('hero_respawn', { name: name }); }
function evChapterEvent(id) { evEmit('chapter', { id: id }); }
function evFateSkill(name) { evEmit('fate', { name: name }); }
