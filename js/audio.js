/* v2 音效系统（P1-3）：Web Audio API 合成短音效，零资源依赖
   浏览器无 AudioContext 时静默降级；无头环境（smoke.js）自动跳过 */
'use strict';

let audioCtx = null, masterGain = null, enabled = false;

function initAudio() {
  if (audioCtx) return;
  try {
    const AC = (typeof window !== 'undefined' && window.AudioContext) || (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);
    if (!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;        // 主音量 30%
    masterGain.connect(audioCtx.destination);
    enabled = true;
  } catch (e) { /* 静默降级 */ }
}

function isMuted() {
  return typeof SAVE !== 'undefined' && SAVE.mute;
}

/* 合成单音：oscillator → gain envelope → master
   opts: { type:'sine'|'square'|'triangle'|'sawtooth', freq:440, dur:0.1, vol:0.5, slide?:number(目标频率), delay?:0 } */
function tone(opts) {
  if (!enabled || isMuted() || !audioCtx) return;
  const t0 = audioCtx.currentTime + (opts.delay || 0);
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = opts.type || 'square';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t0 + opts.dur);
  g.gain.setValueAtTime(opts.vol || 0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);   // 衰减包络
  osc.connect(g); g.connect(masterGain);
  osc.start(t0); osc.stop(t0 + opts.dur);
}

/* 命名音效：复用 tone 组合，集中维护 */
const SFX = {
  summon:  () => {                       // 抽卡：上升音
    tone({ type: 'square', freq: 440, dur: 0.08, vol: 0.4 });
    tone({ type: 'square', freq: 660, dur: 0.1, vol: 0.4, delay: 0.08 });
    tone({ type: 'triangle', freq: 880, dur: 0.15, vol: 0.4, delay: 0.18 });
  },
  upgrade: () => {                       // 升阶：双音叠加
    tone({ type: 'triangle', freq: 523, dur: 0.1, vol: 0.4 });
    tone({ type: 'triangle', freq: 784, dur: 0.15, vol: 0.4, delay: 0.08 });
  },
  hero:    () => {                       // 合成武将：闪亮和弦
    tone({ type: 'sawtooth', freq: 523, dur: 0.15, vol: 0.35 });
    tone({ type: 'sawtooth', freq: 659, dur: 0.15, vol: 0.35, delay: 0.05 });
    tone({ type: 'sawtooth', freq: 784, dur: 0.2, vol: 0.35, delay: 0.1 });
  },
  hit:     () => {                       // 命中：短促低频
    tone({ type: 'square', freq: 220, dur: 0.05, vol: 0.3 });
  },
  kill:    () => {                       // 击杀：滑落音
    tone({ type: 'sawtooth', freq: 660, dur: 0.12, vol: 0.4, slide: 220 });
  },
  boss:    () => {                       // BOSS 出现：低沉警告
    tone({ type: 'sawtooth', freq: 110, dur: 0.3, vol: 0.5 });
    tone({ type: 'sawtooth', freq: 82, dur: 0.4, vol: 0.5, delay: 0.15 });
  },
  hurt:    () => {                       // 阿斗受伤：失谐
    tone({ type: 'square', freq: 300, dur: 0.15, vol: 0.4, slide: 150 });
  },
  skill:   () => {                       // 技能释放：扫频
    tone({ type: 'triangle', freq: 440, dur: 0.2, vol: 0.4, slide: 880 });
  },
  egg:     () => {                       // 彩蛋：上行琶音
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.12, vol: 0.4, delay: i * 0.06 }));
  },
  win:     () => {                       // 胜利：和弦
    [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.4, vol: 0.4, delay: i * 0.05 }));
  },
  lose:    () => {                       // 失败：下行
    [440, 330, 220].forEach((f, i) => tone({ type: 'sawtooth', freq: f, dur: 0.25, vol: 0.4, delay: i * 0.15 }));
  },
  click:   () => {                       // 按钮点击：短促
    tone({ type: 'square', freq: 800, dur: 0.03, vol: 0.2 });
  },
};

function playSfx(name) {
  try { if (SFX[name]) SFX[name](); } catch (e) { /* 静默 */ }
}

/* 用户首次交互后才能 resume（浏览器策略） */
function resumeAudio() {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

/* 对外统一入口：防止 node 环境调用报错 */
const sfx = (name) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!audioCtx) initAudio();
  playSfx(name);
};
