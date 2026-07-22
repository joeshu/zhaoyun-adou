// 事件总线：命名全正确、可监听可发射
'use strict';
var ctx = {}, src = require('fs').readFileSync(__dirname + '/../js/events.js', 'utf8');
new Function('global', src + '; global.evOn=evOn; global.evEmit=evEmit; global.evKill=evKill; global.evWin=evWin;')(ctx);
var evOn = ctx.evOn, evEmit = ctx.evEmit;
var calls = {};
evOn('test', function(d) { calls.test = d; });
evEmit('test', 42);
if (calls.test !== 42) throw new Error('事件发射/监听失败');
// smoke 已连带验证 evKill/evMerge/evWin 等调用不崩
console.log('事件总线 OK');
