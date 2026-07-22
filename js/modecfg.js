/* 特殊玩法统一规则配置：fire/rogue/escort/puzzle/raid 均只在此处声明差异。 */
'use strict';
const MODE_RULES = {
  fire: { mirrorAI: true, permanentHero: true, objective: 'survive', timeLimit: 150, mobCap: 10, betweenDelay: 4, spawnTurn: 5 },
  rogue: { mirrorAI: true, permanentHero: true, objective: 'rogue', floors: 8, mobCap: 14, betweenDelay: 5, spawnTurn: 6 },
  escort: { mirrorAI: true, permanentHero: true, objective: 'escort', mobCap: 12, betweenDelay: 5, spawnTurn: 5 },
  puzzle: { mirrorAI: true, permanentHero: false, objective: 'kill_target', timeLimit: 75, mobCap: 12, target: 18, betweenDelay: 5, spawnTurn: 6 },
  raid: { mirrorAI: true, permanentHero: true, objective: 'raid_boss', timeLimit: 90, mobCap: 10, betweenDelay: 5, spawnTurn: 6 },
};
function modeRule(key, def) { if (!G || !G.mode || !MODE_RULES[G.mode]) return def; const v = MODE_RULES[G.mode][key]; return v === undefined ? def : v; }
function modeObjective() { return modeRule('objective', 'clear_waves'); }
