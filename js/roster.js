/* 群英谱、英雄挑战与每日循环奖励。 */
'use strict';

function heroRecord(name) { return SAVE.heroRecords[name] || { kills:0, deployments:0, wins:0 }; }
function updateHeroRecord(name, key) {
  var rec = heroRecord(name); rec[key] = (rec[key] || 0) + 1; SAVE.heroRecords[name] = rec; saveSave();
}

function heroChallenges() {
  return [
    { id: 1, hero: '赵云', desc: '以赵云主将无伤通关第10关', check: function() { var r = heroRecord('赵云'); return r.wins >= 1 && r.kills >= 50; } },
    { id: 2, hero: '张飞', desc: '张飞释放大喝眩晕累计15名敌军', check: function() { return heroRecord('张飞').kills >= 80; } },
    { id: 3, hero: '关羽', desc: '关羽发动跳劈累计次数达到20', check: function() { return heroRecord('关羽').deployments >= 10; } },
    { id: 4, hero: '黄忠', desc: '黄忠释放火箭烈累计10次', check: function() { return heroRecord('黄忠').kills >= 60; } },
    { id: 5, hero: '马超', desc: '马超累计击杀20名骑兵', check: function() { return heroRecord('马超').kills >= 40; } },
  ];
}

function checkPendingHeroChallenges() {
  if (typeof heroChallenges !== 'function') return;
  var challenges = heroChallenges();
  for (var i = 0; i < challenges.length; i++) {
    var ch = challenges[i];
    if (SAVE.heroChallenges[ch.hero]) continue;
    try { if (ch.check()) { SAVE.heroChallenges[ch.hero] = true; SAVE.gold += 40; saveSave(); if (typeof G !== 'undefined' && G) G.banner = { txt: ch.hero + '挑战达成！+40金', t: 2 }; } } catch(e) {}
  }
}

function addDailyProgress(n) {
  var d = new Date().toDateString();
  if (typeof SAVE.dailyTask !== 'object' || SAVE.dailyTask.date !== d) SAVE.dailyTask = { date: d, progress: 0, reward: false };
  if (!SAVE.dailyTask.reward) { SAVE.dailyTask.progress = Math.min(5, SAVE.dailyTask.progress + n); if (SAVE.dailyTask.progress >= 5 && !SAVE.dailyTask.reward) { SAVE.dailyTask.reward = true; SAVE.gold += 60; saveSave(); } else saveSave(); }
}
