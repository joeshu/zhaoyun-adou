/* 统一缓动框架（Phase 1 表现力地基）
   轻量动画注册表：觉醒放大 / 横幅 / 翻牌 / 高光演出等统一走这里，
   替代散落的硬编码衰减。浏览器外（smoke.js）自动可用、零依赖、无副作用。
   用法： Tween.add({ dur, ease, onUpdate(e,p), onDone() })；主循环每帧 Tween.update(dt)。 */
'use strict';

const _tclamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function lerp(a, b, t) { return a + (b - a) * t; }
const Ease = {
  linear:     t => t,
  outCubic:   t => 1 - Math.pow(1 - t, 3),
  inOutQuad:  t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack:    t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => { const c4 = (2 * Math.PI) / 3; return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },
};

const Tween = {
  list: [],
  update(dt) {
    if (!this.list.length) return;
    for (const a of this.list) {
      a.t += dt;
      const p = _tclamp(a.t / a.dur, 0, 1);
      const e = (a.ease || Ease.linear)(p);
      if (a.onUpdate) a.onUpdate(e, p);
      if (p >= 1) { a.done = true; if (a.onDone) a.onDone(); }
    }
    if (this.list.length) this.list = this.list.filter(a => !a.done);
  },
  add(anim) { anim.t = 0; this.list.push(anim); return anim; },
  clear() { this.list.length = 0; },
};
