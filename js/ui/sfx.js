/* ============================================================
   ui/sfx.js — 共有の効果音（Web Audio 合成・音声ファイル不使用）
   Phase B の音資産を画面横断で使えるよう小さく切り出したもの。
   settings.muted を尊重。AudioContext は最初のユーザー操作で生成。
   ============================================================ */
import { getState } from "../state.js";

const Sfx = {
  ctx: null,
  master: null,
  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  },
  _muted() { try { return !!getState().settings.muted; } catch (e) { return false; } },
  tone(type, f0, f1, dur, peak, t0) {
    if (!this.ctx || this._muted()) return;
    const t = t0 ?? this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  /** 上昇する溜め音（儀式） */
  riser(ms) {
    this.ensure();
    this.tone("sawtooth", 160, 520, ms / 1000, 0.14);
  },
  /** 短いめくり音 */
  blip(i = 0) {
    this.ensure();
    if (!this.ctx) return;
    const f = 520 * Math.pow(1.05, i);
    this.tone("square", f, f, 0.08, 0.08);
  },
  /** レア排出のファンファーレ（big で豪華に） */
  fanfare(big) {
    this.ensure();
    if (!this.ctx) return;
    const notes = big ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
    const t0 = this.ctx.currentTime;
    notes.forEach((f, i) => {
      this.tone("triangle", f, f, 0.30, 0.18, t0 + i * 0.09);
      this.tone("sine", f * 2, f * 2, 0.22, 0.07, t0 + i * 0.09);
    });
  },
  /** 神話級の特大演出音 */
  mythic() {
    this.ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
      this.tone("triangle", f, f, 0.4, 0.16, t0 + i * 0.08);
      this.tone("sine", f * 2, f * 2, 0.3, 0.06, t0 + i * 0.08);
    });
  },
};

export default Sfx;
