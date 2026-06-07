/* ============================================================
   main.js — 起動・画面ルーター（シンプルSPA）
   各 screen は { mount(root, ctx), unmount() } を export。
   切替時に 前画面 unmount → 次画面 mount。戻る用に履歴を保持。
   ============================================================ */
import { loadSave, touchLastSeen } from "./state.js";
import { buildShell, toast } from "./ui/shell.js";
import { applyIdleAffection } from "./game/room.js";
import { mountDevPanel } from "./ui/devpanel.js";

import { homeScreen } from "./screens/home.js";
import { gambleScreen } from "./screens/gamble.js";
import { gachaScreen } from "./screens/gacha.js";
import { yokaiScreen } from "./screens/yokai.js";
import { battleScreen } from "./screens/battle.js";
import { roomScreen } from "./screens/room.js";
import { zukanScreen } from "./screens/zukan.js";

/* ルート名 → 画面モジュール */
const ROUTES = {
  home:   homeScreen,
  gamble: gambleScreen,
  gacha:  gachaScreen,
  yokai:  yokaiScreen,
  battle: battleScreen,
  room:   roomScreen,
  zukan:  zukanScreen,
};

let _screenRoot = null;
let _current = null;       // 現在の画面モジュール
let _history = [];         // ルート名の履歴（戻る用）
let _lastSeenPrev = 0;     // 起動時の「前回訪問時刻」（留守番の妖が使う）

function boot() {
  loadSave();
  _lastSeenPrev = touchLastSeen();   // 今回の訪問前の lastSeen を取得し更新

  const appRoot = document.getElementById("app");
  const shell = buildShell(appRoot);
  _screenRoot = shell.screenRoot;
  mountDevPanel(appRoot);   // DEV_MODE=false なら何もしない

  shell.homeBtn.addEventListener("click", () => go("home"));

  // ハッシュ連動（リロードで同じ画面・ブラウザ戻るにも対応）
  window.addEventListener("hashchange", () => {
    const r = routeFromHash();
    if (r !== currentRoute()) navigate(r, /*pushHistory*/ true);
  });

  // 放置ボーナス: 前回訪問からの経過 × 快適度 で displayed の愛情度を上げる
  const idle = applyIdleAffection(_lastSeenPrev);
  if (idle && idle.names.length) {
    toast(`留守中、${idle.names.join("・")}の愛情度が +${idle.per}`, "warn");
  }

  const initial = routeFromHash() || "home";
  navigate(initial, false);
}

/* ---- 共有コンテキスト（各画面に渡す） ---- */
function makeCtx(route) {
  return {
    route,
    lastSeenPrev: _lastSeenPrev,
    go,            // 画面遷移
    back,          // 戻る
    toast,         // 通知
  };
}

/** 画面遷移（履歴に積む）。 */
export function go(route) {
  if (!ROUTES[route]) { toast("未定義の画面: " + route, "warn"); return; }
  if (route !== currentRoute()) _history.push(currentRoute());
  navigate(route, true);
}

/** 1つ戻る（無ければホーム）。 */
export function back() {
  const prev = _history.pop() || "home";
  navigate(prev, true);
}

function navigate(route, syncHash) {
  const mod = ROUTES[route] || ROUTES.home;
  // 前画面を片付け
  if (_current && typeof _current.unmount === "function") {
    try { _current.unmount(); } catch (e) { /* 画面側エラーで全体を止めない */ }
  }
  _screenRoot.innerHTML = "";
  _current = mod;
  if (syncHash) setHash(route);
  try {
    mod.mount(_screenRoot, makeCtx(route));
  } catch (e) {
    console.error("[screen mount error]", route, e);
    _screenRoot.innerHTML = `<section class="screen"><p class="ph-note">画面の読み込みに失敗しました（${route}）。</p></section>`;
  }
  window.scrollTo(0, 0);
}

function currentRoute() { return routeFromHash() || "home"; }
function routeFromHash() {
  const h = (location.hash || "").replace(/^#\/?/, "");
  return ROUTES[h] ? h : "";
}
function setHash(route) {
  if (routeFromHash() !== route) {
    try { location.hash = "#/" + route; } catch (e) { /* file:// 等で失敗しても遷移は完了済み */ }
  }
}

/* 起動 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
