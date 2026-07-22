/* 主线章节机制：每章引入新的局内决策。 */
'use strict';
function chapterId() { return Math.min(3, ((G.stage - 1) / 10) | 0); }
function chapterWaveEvent() {
  const ch = chapterId();
  if (ch === 0 && G.wave % 3 === 0) { G.chapterChoice = true; G.paused = true; G.banner = { txt:'流民求援：选择救援或固守', t:999 }; }
  if (ch === 1 && G.wave % 3 === 0) { G.spawnQ.push({ t:1, type:'粮', hpMul:G.hpMul }); G.banner = { txt:'敌军补给车出现：击毁可获补给', t:1.6 }; }
  if (ch === 2 && G.wave === 1) { G.chapterFire = [{x:80,y:380},{x:295,y:436}]; G.wind='东南风'; G.windT=20; G.banner={txt:'赤壁火油已布置：借风引敌入火',t:2}; }
  if (ch === 3 && G.wave % 3 === 0) { for(let i=0;i<2;i++) G.spawnQ.push({ t:1.2+i*.4,type:'狂',hpMul:G.hpMul*1.1 }); G.banner={txt:'迷雾伏兵：高速敌军突袭！',t:1.6}; }
}
function chooseRefugee(rescue) {
  if (!G || !G.chapterChoice) return;
  G.chapterChoice=false; G.paused=false;
  if (rescue) { G.P.mantou=Math.max(0,G.P.mantou-10); G.P.shield=Math.min(2,G.P.shield+1); SAVE.gold+=12; G.banner={txt:'救援流民：金币+12，阿斗护盾+1',t:1.8}; }
  else { G.P.mantou+=15; G.banner={txt:'固守防线：馒头+15',t:1.8}; }
  saveSave();
}
function tickChapterMechanic(dt) {
  if (!G || G.mode || chapterId() !== 2 || !G.chapterFire) return;
  G.windT-=dt; if(G.windT<=0){G.windT=20;G.wind=G.wind==='东南风'?'西北风':'东南风';G.banner={txt:'赤壁风向变为'+G.wind,t:1.4};}
  const dmg=G.wind==='东南风'?14:8;
  for(const S of [G.P,G.E]) for(const m of S.mobs) for(const f of G.chapterFire) if(Math.hypot(m.x-f.x,m.y-f.y)<68) m.hp-=dmg*dt;
}
