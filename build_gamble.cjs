/* One-shot build: port legacy/ayakashi-standalone.html into a scoped module.
   Produces: css/gamble.css  and  js/screens/gamble.js
   Run with: node build_gamble.cjs   (dev tool; safe to keep or delete) */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const legacy = fs.readFileSync(path.join(ROOT, "legacy/ayakashi-standalone.html"), "utf8");

/* ---- extract sections ---- */
const css = slice(legacy, "<style>", "</style>");
let markup = slice(legacy, "<body>", "<script>");
let js     = slice(legacy, "<script>", "</script>");

function slice(s, a, b) {
  const i = s.indexOf(a) + a.length;
  const j = s.indexOf(b, i);
  return s.slice(i, j).trim();
}

/* ============================================================
   CSS: scope everything under .gamble-root
   ============================================================ */
function scopeCss(src, scope) {
  let out = "", i = 0;
  while (i < src.length) {
    if (src.startsWith("/*", i)) { const e = src.indexOf("*/", i + 2); const end = e < 0 ? src.length : e + 2; out += src.slice(i, end); i = end; continue; }
    if (/\s/.test(src[i])) { out += src[i]; i++; continue; }
    if (src[i] === "@") {
      let j = i; while (j < src.length && src[j] !== "{" && src[j] !== ";") j++;
      const head = src.slice(i, j);
      if (src[j] === ";") { out += src.slice(i, j + 1); i = j + 1; continue; }
      const blk = readBlock(src, j);
      if (/^@(-\w+-)?keyframes/i.test(head) || /^@font-face/i.test(head)) {
        out += head + "{" + blk.body + "}";                 // leave inner untouched
      } else if (/^@media/i.test(head) || /^@supports/i.test(head)) {
        out += head + "{" + scopeCss(blk.body, scope) + "}"; // recurse to scope inner selectors
      } else {
        out += head + "{" + blk.body + "}";
      }
      i = blk.end; continue;
    }
    let j = i; while (j < src.length && src[j] !== "{") j++;
    const sel = src.slice(i, j);
    const blk = readBlock(src, j);
    out += prefixSel(sel, scope) + "{" + blk.body + "}";
    i = blk.end;
  }
  return out;
}
function readBlock(src, bracePos) {
  let depth = 0, i = bracePos;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return { body: src.slice(bracePos + 1, i), end: i + 1 }; }
  }
  return { body: src.slice(bracePos + 1), end: src.length };
}
function prefixSel(sel, scope) {
  return sel.split(",").map(s => {
    s = s.trim();
    if (!s) return s;
    if (s === ":root" || s === "html" || s === "body") return scope;
    if (s === "*") return scope + " *";
    if (s.startsWith(scope)) return s;
    return scope + " " + s;
  }).join(", ");
}
const scopedCss =
  "/* gamble.css — 旧妖賭場の CSS を .gamble-root にスコープ（自動生成: build_gamble.cjs）*/\n" +
  scopeCss(css, ".gamble-root");
fs.writeFileSync(path.join(ROOT, "css/gamble.css"), scopedCss);

/* ============================================================
   MARKUP: titlescreen 除去 / id 改名 / 退場ボタン / over文言 / ラベル
   ============================================================ */
markup = markup
  .replace(/<!-- ===== タイトル画面 ===== -->\s*/, "")
  .replace(/<div class="titlescreen"[\s\S]*?<\/div>\s*<\/div>\s*/, "")
  .replace('class="app" id="app"', 'class="app" id="gambleApp"')
  .replace('<div class="label">所持金</div>', '<div class="label">場内資金</div>')
  .replace('<button class="ghost-btn" id="openInvBtn">お守り整理</button>',
           '<button class="ghost-btn" id="openInvBtn">お守り整理</button>\n      <button class="ghost-btn" id="exitBtn">退場（持ち帰る）</button>')
  .replace('<h2>無一文</h2>', '<h2>身ぐるみ剥がされた</h2>')
  .replace('<p>妖どもに、すべて吸われた。</p>', '<p>持ち込みは妖に呑まれた。財布の残りは無事だ。</p>')
  .replace('>もう一度<', '>退場（ホームへ）<');
const venueHtml = '<div class="gamble-root">\n' + markup + '\n</div>';

/* ============================================================
   JS: 中央セーブ連携・bankroll・teardown へ surgical 改修
   ============================================================ */
// 1) #app -> #gambleApp
js = js.replace(/document\.getElementById\('app'\)/g, "document.getElementById('gambleApp')");

// 2) Save 一式（localStorage 版）を中央連携アダプタへ置換
{
  const start = js.indexOf("const Save = {");
  const endMarker = "state.coins = state.save.coins;   // 保存された所持金を復元";
  const end = js.indexOf(endMarker) + endMarker.length;
  if (start < 0 || end < endMarker.length) throw new Error("Save block not found");
  const adapter =
`const Save = { persist(){ persistGamble(state.save); } };
state.save = hydrateGamble();
state.coins = OPTS.bankroll;            // 賭け資金は持ち込み額（中央 coin とは別）
{ // 装備お守りの健全化（中央セーブ由来の不正IDを丸める）
  const __ids = CONFIG.charms.map(c=>c.id);
  state.save.owned = (state.save.owned||[]).filter(id=>__ids.includes(id));
  state.save.equipped = (state.save.equipped||[]).filter(id=>__ids.includes(id) && state.save.owned.includes(id)).slice(0, CONFIG.slots);
}`;
  js = js.slice(0, start) + adapter + js.slice(end);
}

// 3) 初期賭場を持ち込み画面の選択に
js = js.replace('activeCasino: "kitsune",', 'activeCasino: (typeof OPTS!=="undefined" && OPTS.venueId) || "kitsune",');

// 4) tsDaily（タイトル内要素・除去済み）への代入をガード
js = js.replace("el.tsDaily.innerHTML =", "if(el.tsDaily) el.tsDaily.innerHTML =");

// 5) ゲームオーバーの「もう一度」を退場へ（旧 restart は使わない）
js = js.replace("el.restartBtn.addEventListener('click', restart);",
                "el.restartBtn.addEventListener('click', exitVenue);");

// 6) タイトルの「賭場へ」リスナーを除去
js = js.replace(/\/\/ タイトル画面[\s\S]*?\}\);\n/, "");

// 7) 溜め setTimeout を追跡（teardown でクリア）
js = js.replace("setTimeout(resolveDive, CONFIG.fx.diveDelay);",
                "__timers.push(setTimeout(resolveDive, CONFIG.fx.diveDelay));");

// 8) countUp の RAF を teardown 後に止める
js = js.replace("  function step(now){\n    const t = Math.min(1, (now - start) / dur);",
                "  function step(now){\n    if(!__alive) return;\n    const t = Math.min(1, (now - start) / dur);");

/* ============================================================
   gamble.js を組み立てる
   ============================================================ */
const header = `/* ============================================================
   screens/gamble.js — 妖賭場を「稼ぐ」画面として統合（Phase B）
   ・入場画面（持ち込み額＋賭場選択＋妖の煽り）
   ・賭場本体は legacy を移植（CSS は .gamble-root にスコープ、css/gamble.css）
   ・賭け資金 bankroll は局所変数。退場/離脱時に純損益を中央 coin へ反映。
   ・charms/venues/titles/achievements/daily は save.gamble に保存。
   このファイルの venue ロジックは build_gamble.cjs による自動移植です。
   ============================================================ */
import { getState, saveSave, addCoin, getCoin } from "../state.js";
import { GAMBLE, GAMBLE_VENUES, ENTRY_TAUNTS } from "../config/index.js";

/* ---- 中央セーブ <-> 旧セーブ形 の橋渡し ---- */
function hydrateGamble(){
  const st = getState(), g = st.gamble, s = st.stats;
  return {
    deepest: s.deepestDepth|0,
    bestPot: g.bestPot|0,
    totalRounds: s.gambleRuns|0,
    lifetime: g.lifetime|0,
    unlocked: (g.unlockedVenues||["kitsune"]).slice(),
    owned: (g.charmsOwned||[]).slice(),
    equipped: (g.charmsEquipped||[]).slice(),
    titlesSeen: ((g.titles&&g.titles.seen)||[]).slice(),
    achievements: ((g.achievements&&g.achievements.unlocked)||[]).slice(),
    daily: {
      date: g.daily.date,
      attemptsUsed: g.daily.attemptsUsed|0,
      bestDepth: (g.daily.best&&g.daily.best.depth)|0,
      bestPot: (g.daily.best&&g.daily.best.pot)|0,
    },
    streak: { count: g.daily.streak|0, lastDate: g.daily.lastDate||"" },
    stats: {
      flees: g.flags.flees|0, depth1Flees: g.flags.depth1Flees|0,
      cursedFlee: !!g.flags.cursedFlee, tripleResonance: !!g.flags.tripleResonance,
    },
  };
}
function persistGamble(gv){
  const st = getState();
  st.stats.deepestDepth = Math.max(st.stats.deepestDepth|0, gv.deepest|0);
  st.stats.gambleRuns = gv.totalRounds|0;
  st.gamble.bestPot = gv.bestPot|0;
  st.gamble.lifetime = gv.lifetime|0;
  st.gamble.unlockedVenues = (gv.unlocked||[]).slice();
  st.gamble.charmsOwned = (gv.owned||[]).slice();
  st.gamble.charmsEquipped = (gv.equipped||[]).slice();
  st.gamble.titles.seen = (gv.titlesSeen||[]).slice();
  st.gamble.achievements.unlocked = (gv.achievements||[]).slice();
  st.gamble.daily = {
    date: gv.daily.date, attemptsUsed: gv.daily.attemptsUsed|0,
    best: { depth: gv.daily.bestDepth|0, pot: gv.daily.bestPot|0 },
    streak: gv.streak.count|0, lastDate: gv.streak.lastDate||"",
  };
  st.gamble.flags = {
    flees: gv.stats.flees|0, depth1Flees: gv.stats.depth1Flees|0,
    cursedFlee: !!gv.stats.cursedFlee, tripleResonance: !!gv.stats.tripleResonance,
  };
  saveSave();
}

const VENUE_HTML = ${JSON.stringify(venueHtml)};

/* ============================================================
   入場画面（財布から持ち込み額を選ぶ）
   ============================================================ */
let _session = null;   // { teardown, getBankroll, bringIn, committed }

function taunt(venueId, bringIn, wallet){
  const t = ENTRY_TAUNTS[venueId] || ENTRY_TAUNTS.kitsune;
  if (wallet > 0 && bringIn >= wallet) return t.allIn;
  if (bringIn <= GAMBLE.minBring || (wallet > 0 && bringIn < wallet * 0.25)) return t.small;
  return t.high;
}

function renderEntry(root, ctx){
  const st = getState();
  const wallet = getCoin();
  const unlocked = st.gamble.unlockedVenues || ["kitsune"];
  const venues = GAMBLE_VENUES;
  let venueId = unlocked.includes("kitsune") ? "kitsune" : (unlocked[0] || "kitsune");

  const free = wallet < GAMBLE.minBring;            // 財布が空ならご祝儀
  const maxBring = free ? GAMBLE.starterStake : wallet;
  let amount = free ? GAMBLE.starterStake : Math.min(GAMBLE.presets[0], wallet);

  function paint(){
    const presetBtns = GAMBLE.presets
      .filter(p => p <= wallet)
      .map(p => \`<button class="ent-preset" data-amt="\${p}">\${p.toLocaleString("ja-JP")}</button>\`)
      .join("");
    root.innerHTML = \`
      <section class="screen gamble-entry">
        <h2 class="ent-title">妖賭場 — 入場</h2>
        <div class="ent-wallet">財布 <b>\${wallet.toLocaleString("ja-JP")}</b> 枚</div>

        <div class="ent-block">
          <div class="ent-label">賭場を選ぶ</div>
          <div class="ent-venues">
            \${venues.map(v => {
              const lock = !unlocked.includes(v.id);
              return \`<button class="ent-venue\${v.id===venueId?" sel":""}\${lock?" lock":""}" data-venue="\${v.id}" \${lock?"disabled":""}>
                <span class="ev-ico">\${v.icon}</span><span class="ev-name">\${v.name}</span>
                <span class="ev-note">\${lock? "🔒 "+v.note : v.note}</span>
              </button>\`;
            }).join("")}
          </div>
        </div>

        <div class="ent-block">
          <div class="ent-label">持ち込み額 \${free?'<span class="ent-free">ご祝儀（無償）</span>':''}</div>
          <div class="ent-amount" id="entAmount">\${amount.toLocaleString("ja-JP")} 枚</div>
          \${free ? "" : \`
            <input type="range" id="entSlider" min="\${GAMBLE.minBring}" max="\${maxBring}" step="100" value="\${amount}" class="ent-slider">
            <div class="ent-presets">\${presetBtns}<button class="ent-preset" data-amt="all">全額</button></div>
          \`}
        </div>

        <div class="ent-taunt" id="entTaunt"></div>

        <div class="ent-foot">
          <button class="btn-ghost" id="entBack">← 戻る</button>
          <button class="ent-enter" id="entEnter">\${free? "ご祝儀をもらって入場" : "入場する"}</button>
        </div>
      </section>\`;

    // taunt
    root.querySelector("#entTaunt").textContent = "「" + taunt(venueId, amount, wallet) + "」";

    // venue select
    root.querySelectorAll("[data-venue]").forEach(b => b.addEventListener("click", () => {
      if (b.disabled) return;
      venueId = b.dataset.venue; paint();
    }));
    // slider
    const sl = root.querySelector("#entSlider");
    if (sl) sl.addEventListener("input", () => {
      amount = Math.max(GAMBLE.minBring, Math.min(maxBring, Number(sl.value)));
      root.querySelector("#entAmount").textContent = amount.toLocaleString("ja-JP") + " 枚";
      root.querySelector("#entTaunt").textContent = "「" + taunt(venueId, amount, wallet) + "」";
    });
    // presets
    root.querySelectorAll(".ent-preset").forEach(b => b.addEventListener("click", () => {
      amount = b.dataset.amt === "all" ? wallet : Number(b.dataset.amt);
      amount = Math.max(GAMBLE.minBring, Math.min(maxBring, amount));
      paint();
    }));
    // back / enter
    root.querySelector("#entBack").addEventListener("click", () => ctx.go("home"));
    root.querySelector("#entEnter").addEventListener("click", () => {
      const bringIn = free ? 0 : amount;          // ご祝儀は会計上 0（純益＝全額）
      enterVenue(root, ctx, { bankroll: amount, bringIn, venueId, taunt: taunt(venueId, amount, wallet) });
    });
  }
  paint();
}

/* ============================================================
   退場/離脱: 純損益(残bankroll - 持ち込み)を中央 coin へ反映（1回だけ）
   ============================================================ */
function commitSession(){
  if (!_session || _session.committed) return;
  _session.committed = true;
  const net = _session.getBankroll() - _session.bringIn;   // + 勝ち越し / − 負け越し
  if (net !== 0) addCoin(net);                              // ヘッダ coin がカウントアップ
}

function teardownSession(){
  if (_session && _session.teardown) { try { _session.teardown(); } catch (e) {} }
}

function enterVenue(root, ctx, opts){
  const onExit = () => { commitSession(); teardownSession(); _session = null; ctx.go("home"); };
  const handle = initVenue(root, { ...opts, onExit });
  _session = { teardown: handle.teardown, getBankroll: handle.getBankroll, bringIn: opts.bringIn, committed: false };
}

/* ============================================================
   賭場本体（legacy 移植）。initVenue(root, OPTS) -> { teardown, getBankroll }
   ============================================================ */
function initVenue(root, OPTS){
  root.innerHTML = VENUE_HTML;
  let __alive = true;
  const __timers = [];
  function exitVenue(){ OPTS.onExit(); }

  /* ===================== BEGIN ported venue logic ===================== */
${indent(js, "  ")}
  /* ====================== END ported venue logic ====================== */

  // 追加配線（移植元には無い：退場ボタン・入場時の煽り）
  const __exitBtn = document.getElementById("exitBtn");
  if (__exitBtn) __exitBtn.addEventListener("click", exitVenue);
  if (OPTS.taunt) setMessage(OPTS.taunt, "win");

  return {
    teardown(){
      __alive = false;
      try { Heart.stop(); } catch (e) {}
      __timers.forEach(t => clearTimeout(t));
      try { if (Sound.ctx) Sound.ctx.close(); } catch (e) {}
      Sound.ctx = null;
    },
    getBankroll(){ return Math.max(0, Math.floor(state.coins)); },
  };
}

/* ============================================================
   画面モジュール: { mount, unmount }
   ============================================================ */
export const gambleScreen = {
  mount(root, ctx){ _session = null; renderEntry(root, ctx); },
  unmount(){
    // ホームボタン等で離脱した場合も、未確定なら純損益を確定して片付ける
    commitSession();
    teardownSession();
    _session = null;
  },
};
export default gambleScreen;
`;

function indent(s, pad) { return s.split("\n").map(l => l.length ? pad + l : l).join("\n"); }

fs.writeFileSync(path.join(ROOT, "js/screens/gamble.js"), header);
console.log("wrote css/gamble.css (" + scopedCss.length + " bytes) and js/screens/gamble.js (" + header.length + " bytes)");
