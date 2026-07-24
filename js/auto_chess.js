/* 群雄争霸·自走棋 Phase 1：单人+AI 原型，隔离主线实时战斗。 */
'use strict';

const AC_HEROES = [
  { id:'关平', cost:1, faction:'蜀', job:'猛将', atk:18, hp:110 }, { id:'周仓', cost:1, faction:'蜀', job:'盾', atk:13, hp:150 },
  { id:'李典', cost:1, faction:'魏', job:'猛将', atk:17, hp:115 }, { id:'潘璋', cost:1, faction:'吴', job:'近战', atk:16, hp:115 },
  { id:'黄盖', cost:2, faction:'吴', job:'盾', atk:24, hp:170 }, { id:'徐晃', cost:2, faction:'魏', job:'猛将', atk:27, hp:145 },
  { id:'魏延', cost:2, faction:'蜀', job:'骑', atk:29, hp:135 }, { id:'韩当', cost:2, faction:'吴', job:'弓', atk:28, hp:105 },
  { id:'赵云', cost:3, faction:'蜀', job:'骑', atk:39, hp:180 }, { id:'张郃', cost:3, faction:'魏', job:'枪', atk:37, hp:155 },
  { id:'马超', cost:4, faction:'蜀', job:'骑', atk:54, hp:220 }, { id:'郭嘉', cost:4, faction:'魏', job:'谋士', atk:51, hp:135 },
];
const AC_PROB = { 2:[70,25,5,0], 4:[50,35,12,3], 6:[35,35,20,10], 8:[20,30,25,25], 10:[15,25,30,30] };
function acPick() { const a=AC_PROB[Math.min(10,Math.max(2,(G.autoChess||{}).pop||2))]||AC_PROB[2]; let r=Math.random()*100, tier=1; for(let i=0;i<a.length;i++){if((r-=a[i])<0){tier=i+1;break;}} const pool=AC_HEROES.filter(x=>x.cost===tier); return {...(pool[(Math.random()*pool.length)|0]||AC_HEROES[0]), star:1}; }
function acShop() { if(G.autoChess.locked && G.autoChess.shop.length)return; G.autoChess.shop=Array.from({length:5},acPick); }
function acUnit(c) { return {...c, star:1, uid:Math.random().toString(36).slice(2)}; }
function acMerge() {
  const cells=G.P.cells, groups={}; cells.forEach((c,i)=>{if(c.unit) (groups[c.unit.id+'@'+c.unit.star]||(groups[c.unit.id+'@'+c.unit.star]=[])).push(i);});
  Object.keys(groups).forEach(k=>{const ids=groups[k], parts=k.split('@'), next=+parts[1]+1;if(ids.length>=3&&next<=3){const keep=cells[ids[0]].unit;keep.star=next;keep.atk=Math.round(keep.atk*(next===2?1.7:1.59));keep.hp=Math.round(keep.hp*(next===2?1.7:1.59));ids.slice(1,3).forEach(i=>cells[i].unit=null);G.autoChess.msg=keep.id+' 升至 '+next+' 星！';}});
}
function acBoardCount(){return G.P.cells.filter(c=>c.unit).length;}
function acPlace(u){ const c=G.P.cells.find(c=>!c.unit); if(!c)return false; c.unit=acUnit(u); acMerge(); return true; }
function acBonds(){ const us=G.P.cells.filter(c=>c.unit).map(c=>c.unit); const f={蜀:0,魏:0,吴:0},j={}; us.forEach(u=>{f[u.faction]=(f[u.faction]||0)+1;j[u.job]=(j[u.job]||0)+1;}); return {f,j}; }
function acBondText(){const b=acBonds(),out=[];[['蜀',12],['魏',10],['吴',10]].forEach(x=>{if((b.f[x[0]]||0)>=2)out.push(x[0]+'羁绊+'+x[1]+'%');});[['猛将',15],['弓',8],['谋士',15]].forEach(x=>{if((b.j[x[0]]||0)>=2)out.push(x[0]+'强化');});return out.join(' · ')||'暂无激活羁绊';}
function acBuy(i){ const a=G.autoChess, u=a.shop[i]; if(!u||a.gold<u.cost||acBoardCount()>=a.pop)return; a.gold-=u.cost; acPlace(u); a.shop[i]=null; a.msg='招募 '+u.id+' · '+u.faction+' '+u.job; }
function acRefresh(){const a=G.autoChess;if(a.gold<2)return;a.gold-=2;acShop();a.msg='商店已刷新';}
function acToggleLock(){G.autoChess.locked=!G.autoChess.locked;G.autoChess.msg=G.autoChess.locked?'商店已锁定':'商店已解锁';}
function acLevel(){const a=G.autoChess;const cost=[0,0,5,10,20,30,40,50,60,70,80][a.pop]||80;if(a.pop>=10||a.gold<cost)return;a.gold-=cost;a.pop++;a.msg='人口提升至 '+a.pop;}
function acStart(){const a=G.autoChess;if(a.phase!=='prep')return;a.phase='fight';a.timer=2.2;a.msg='自动战斗开始';}
function acCombat(){const a=G.autoChess, us=G.P.cells.filter(c=>c.unit).map(c=>c.unit), ai=a.ai[(a.round-1)%a.ai.length]; const enemy=ai.units; let p=us.reduce((n,u)=>n+nAtk(u),0), e=enemy.reduce((n,u)=>n+nAtk(u),0); const b=acBonds(); if((b.f['蜀']||0)>=2)p*=1.12;if((b.f['魏']||0)>=2)p*=1.10;if((b.f['吴']||0)>=2)p*=1.10;if((b.j['弓']||0)>=2)p*=1.08;if((b.j['谋士']||0)>=2)p*=1.15; const win=p*(0.88+Math.random()*.24)>=e; a.lastFight={win,enemy,p:Math.round(p),e:Math.round(e),ai:ai.name}; if(win){a.streak=Math.max(1,a.streak+1);ai.hp=Math.max(0,ai.hp-(15+us.length*2));a.msg='胜利 · 击败'+ai.name+' · 对手-'+(15+us.length*2)+'血';}else{a.streak=Math.min(-1,a.streak-1);a.hp-=10+enemy.length*2;a.msg='失败 · '+ai.name+'击退你 · -'+(10+enemy.length*2)+'血';} const alive=a.ai.filter(x=>x.hp>0).length;if(a.hp<=0||a.round>=20||alive<=0){G.rewardTxt=a.hp<=0?'群雄争霸出局':'群雄争霸完成';endBattle(a.hp>0);}else{a.round++;a.phase='prep';a.timer=15;a.gold+=5+Math.min(5,Math.floor(a.gold/10));if(!a.locked)acShop();a.ai.forEach(x=>{if(x.hp>0){x.units=Array.from({length:Math.min(10,2+Math.floor(a.round/2))},()=>acUnit(acPick()));}});}}
function nAtk(u){return u.atk*(u.star===2?1.7:u.star===3?2.7:1);}
function acMakeAI(){return ['曹魏','东吴','西蜀','河北','荆襄','关中','江东'].map((name,i)=>({name,hp:100,units:Array.from({length:2+(i%2)},()=>acUnit(AC_HEROES[(Math.random()*AC_HEROES.length)|0]))}));}
function acChooseLord(){const a=G.autoChess;a.lord=a.lords[(a.lordIdx+1)%a.lords.length];a.msg=a.lord.name+'：'+a.lord.desc;}
function autoChessSetup(){G.autoChess={round:1,gold:3,hp:100,pop:2,phase:'prep',timer:15,shop:[],locked:false,streak:0,msg:'选择主公并招募武将',lastFight:null,lords:[{name:'刘备·仁德',desc:'每回合开始恢复一名友军10%生命'},{name:'曹操·挟天子',desc:'每回合胜利额外获得1金'},{name:'孙权·制衡',desc:'每回合第一次刷新免费'}],lordIdx:0,lord:null,ai:acMakeAI()};G.P.cells.forEach(c=>{c.open=true;c.unit=null;});G.E.cells.forEach(c=>{c.open=false;c.unit=null;});acShop();G.banner={txt:'【群雄争霸】先选主公，再招募武将',t:3};}
function autoChessTick(dt){const a=G.autoChess;if(!a||G.state!=='play')return;if(a.phase==='prep'){a.timer-=dt;if(a.timer<=0)acStart();}else if(a.phase==='fight'){a.timer-=dt;if(a.timer<=0)acCombat();}}
function autoChessUnitGlyph(u){return u?u.id.slice(0,1):'';}
function drawAutoChess(){
  const a=G.autoChess; ctx.fillStyle='#e9e0cd';ctx.fillRect(0,0,W,H); ctx.fillStyle='#3f5648';ctx.fillRect(0,0,W,32);
  txt('群雄争霸',12,22,16,'#fffdf5','left',true);txt('第'+a.round+'/20回合',W/2,22,12,'#f4d58b','center',true);txt('金 '+a.gold+'  血 '+a.hp+'  人口 '+acBoardCount()+'/'+a.pop,W-8,22,11,'#fffdf5','right',true);
  txt(a.phase==='prep'?'准备阶段 '+Math.ceil(a.timer)+'s':'自动战斗中',W/2,48,12,a.phase==='prep'?'#a61e4e':'#bd4a31','center',true);
  txt(a.lord ? a.lord.name : '主公未选 · 点击下方选择',W/2,68,10,'#6b6256','center',true);
  // 敌我信息卡
  panel(12,82,351,42,{bg:'#f9f4e8',stroke:'#ccb98d',r:8});txt(a.lastFight?(a.lastFight.win?'上一战胜利 · '+a.lastFight.ai:'上一战失败 · '+a.lastFight.ai):'AI 对手：'+(a.ai[(a.round-1)%a.ai.length]||{}).name||'等待匹配',W/2,100,12,a.lastFight?(a.lastFight.win?'#318c4a':'#bd3b2d'):'#6b6256','center',true);
  // 10格棋盘：前排/后排
  for(let i=0;i<10;i++){const x=42+(i%5)*72,y=150+Math.floor(i/5)*76;rr(x-25,y-25,50,50,8);ctx.fillStyle='#f7f4ea';ctx.fill();ctx.strokeStyle=i<5?'#b78324':'#79a2aa';ctx.lineWidth=2;ctx.stroke();const u=G.P.cells[i]&&G.P.cells[i].unit;if(u){txt(autoChessUnitGlyph(u),x,y+7,28,u.faction==='蜀'?'#2f7f9d':u.faction==='魏'?'#555b78':'#bd4a31','center',true);txt(u.id+'★'.repeat(u.star),x,y+35,7,'#6b6256','center');}}
  txt('前排',10,153,9,'#8a6d3b','left',true);txt('后排',10,229,9,'#467d86','left',true);
  txt('商店 · 点击购买',W/2,286,12,'#3f5648','center',true);
  for(let i=0;i<5;i++){const u=a.shop[i],x=8+i*73;panel(x,300,67,83,{bg:u?'#fffdf4':'#e6dfd2',stroke:u?(u.cost>=3?'#9c36b5':'#c8b58a'):'#d2c9ba',r:7});if(u){txt(u.id,x+33,323,14,u.cost>=3?'#9c36b5':'#6b6256','center',true);txt(u.cost+'费 '+u.faction,x+33,342,8,'#777','center');txt(u.job,x+33,357,8,'#777','center');btn(x,300,67,83,' '+u.id+' '+u.cost+'费',()=>acBuy(i),{size:8,bg:'rgba(0,0,0,0)',disabled:a.gold<u.cost||acBoardCount()>=a.pop});}}
  btn(8,400,92,30,'刷新 2金',acRefresh,{size:10,bg:'#7250b8',disabled:a.gold<2});btn(102,400,92,30,'锁店 '+(a.locked?'开':'关'),acToggleLock,{size:10,bg:'#8a6d3b'});btn(196,400,78,30,'升人口',acLevel,{size:9,bg:'#2f7f9d',disabled:a.pop>=10});btn(278,400,89,30,'开始战斗',acStart,{size:9,bg:'#bd3b2d',disabled:a.phase!=='prep'});
  btn(8,440,110,27,'选主公',acChooseLord,{size:10,bg:'#3f5648'});
  const b=acBonds();txt('羁绊：'+acBondText(),W/2,484,9,'#5f574e','center',true);txt('阵容：'+(G.P.cells.filter(c=>c.unit).map(c=>c.unit.id+'★'+c.unit.star).join(' · ')||'暂无'),W/2,502,8,'#777','center');
  btn(12,610,90,28,'退出',()=>{scr='modes';},{size:10,bg:'#777'});
}
