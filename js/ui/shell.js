/* ============================================================
   ui/shell.js — 常駐ヘッダ（所持金リアルタイム表示）＋トースト
   通貨変更イベント(EV_CURRENCY)を購読し、カウントアップ＆色フラッシュ。
   ============================================================ */
import { APP } from "../config/index.js";
import { getCoin, EV_CURRENCY } from "../state.js";

let _coinEl = null;
let _displayed = 0;     // 現在画面に出ている数値（カウントアップ補間用）
let _rafId = null;

/** アプリ外枠（ヘッダ＋本体マウント領域）を #app に構築し、本体rootを返す。 */
export function buildShell(appRoot) {
  appRoot.innerHTML = `
    <header class="shell-header">
      <button class="shell-home" id="shellHome" title="ホームへ">${APP.title}</button>
      <div class="shell-coin" id="shellCoin" title="所持金">
        <span class="coin-ico">◉</span><span class="coin-val" id="coinVal">0</span>
      </div>
    </header>
    <main class="shell-body" id="screenRoot"></main>
    <div class="toast-wrap" id="toastWrap"></div>
    <div class="route-fx" id="routeFx"></div>
  `;
  _coinEl = appRoot.querySelector("#coinVal");
  _displayed = getCoin();
  _coinEl.textContent = fmt(_displayed);

  // 通貨変更をリアルタイム反映
  window.addEventListener(EV_CURRENCY, onCurrencyChange);

  return {
    screenRoot: appRoot.querySelector("#screenRoot"),
    homeBtn: appRoot.querySelector("#shellHome"),
    coinBox: appRoot.querySelector("#shellCoin"),
  };
}

function onCurrencyChange(e) {
  if (!_coinEl || !e.detail || e.detail.kind !== "coin") return;
  const target = e.detail.total;
  countUpTo(target);
  // 色フラッシュ（増=金 / 減=赤）
  const box = _coinEl.closest(".shell-coin");
  if (box) {
    const cls = e.detail.delta >= 0 ? "flash-up" : "flash-down";
    box.classList.remove("flash-up", "flash-down");
    void box.offsetWidth;
    box.classList.add(cls);
  }
}

function countUpTo(target) {
  if (_rafId) cancelAnimationFrame(_rafId);
  const from = _displayed;
  const start = performance.now();
  const dur = 420;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    _displayed = Math.round(from + (target - from) * eased);
    if (_coinEl) _coinEl.textContent = fmt(_displayed);
    if (t < 1) _rafId = requestAnimationFrame(step);
    else { _displayed = target; if (_coinEl) _coinEl.textContent = fmt(target); }
  };
  _rafId = requestAnimationFrame(step);
}

/** 画面下に短く出る通知。 */
export function toast(msg, kind = "") {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = "toast" + (kind ? " " + kind : "");
  el.textContent = msg;
  wrap.appendChild(el);
  // 表示→自動消滅
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

function fmt(n) {
  try { return Math.floor(n).toLocaleString("ja-JP"); }
  catch (e) { return String(Math.floor(n)); }
}
