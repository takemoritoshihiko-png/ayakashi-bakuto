/* ============================================================
   screens/gacha.js — ガチャ（coin → 武器/衣装/妖怪）
   排出ロジック・天井・10連保証・重複→shard・演出・交換所。
   入手は中央セーブ（inventory / yokai / zukan / gachaHistory）へ反映。
   ============================================================ */
import {
  getState, saveSave, addCoin, getCoin, addShard, getShard, uid,
} from "../state.js";
import {
  RARITY, RARITY_ORDER, GACHA, MASTER, GACHA_MIKO, EXCHANGE, DEV_MODE,
} from "../config/index.js";
import Sfx from "../ui/sfx.js";
import { renderArt, itemArt } from "../ui/art.js";
import { buildYokaiArt } from "../game/yokai.js";

/* ===================== 純ロジック ===================== */
const rank = (r) => RARITY[r].rank;
const rarityByRank = (n) => RARITY[RARITY_ORDER[n]];
const masterById = (id) => MASTER.find((m) => m.id === id);
const poolOf = (rarity) => MASTER.filter((m) => m.rarity === rarity);

function rollRarity(forcedMin) {
  let r = Math.random(), acc = 0, chosen = "common";
  for (const k of RARITY_ORDER) { acc += RARITY[k].prob; if (r <= acc) { chosen = k; break; } }
  if (forcedMin && rank(chosen) < rank(forcedMin)) chosen = forcedMin;
  return chosen;
}

/** 1抽選（天井込み・pity 更新）。{rarity,item} を返す。 */
function drawOne(forcedMin) {
  const s = getState();
  s.gacha.pityCount = (s.gacha.pityCount | 0) + 1;
  let rarity;
  if (s.gacha.pityCount >= GACHA.pityCeiling) rarity = "mythic";
  else rarity = rollRarity(forcedMin);
  // dev: レアリティ強制（演出確認用）
  if (DEV_MODE && globalThis.__AYAKASHI_FORCE_RARITY && RARITY[globalThis.__AYAKASHI_FORCE_RARITY]) {
    rarity = globalThis.__AYAKASHI_FORCE_RARITY;
  }
  if (rarity === "mythic") s.gacha.pityCount = 0;      // 神話排出で天井リセット
  const pool = poolOf(rarity);
  const item = pool[Math.floor(Math.random() * pool.length)];
  return { rarity, item };
}

/** 結果を中央セーブへ反映（重複→shard）。表示用に dup/shardGain を付与。 */
function grantResult(res) {
  const s = getState();
  const it = res.item;
  let dup = false, shardGain = 0, instUid = null;
  if (it.type === "yokai") {
    if (s.yokai.some((y) => y.speciesId === it.speciesId)) {
      dup = true; shardGain = RARITY[res.rarity].shard; addShard(shardGain);
    } else {
      instUid = uid("yk");
      s.yokai.push({ uid: instUid, speciesId: it.speciesId, level: 1, exp: 0, equip: { weaponUid: null, costumeUid: null } });
      s.zukan.yokai[it.speciesId] = true;
    }
  } else {
    const bucket = it.type === "weapon" ? s.inventory.weapons : s.inventory.costumes;
    if (bucket.some((x) => x.itemId === it.id)) {
      dup = true; shardGain = RARITY[res.rarity].shard; addShard(shardGain);
    } else {
      instUid = uid("it");
      bucket.push({ uid: instUid, itemId: it.id });
      s.zukan.items[it.id] = true;
    }
  }
  s.gachaHistory.push({ t: Date.now(), id: it.id, type: it.type, rarity: res.rarity, dup });
  if (s.gachaHistory.length > 200) s.gachaHistory.splice(0, s.gachaHistory.length - 200);
  return { ...res, dup, shardGain, instUid };
}

/** 単発/多連を実行。コスト不足なら null。結果配列を返す。 */
function performPull(count, cost, guarantee) {
  if (getCoin() < cost) return null;
  addCoin(-cost);
  const draws = [];
  for (let i = 0; i < count; i++) draws.push(drawOne());
  // 10連保証: 最低1件「guarantee」以上を確定（無ければ最後を差し替え）
  if (guarantee && !draws.some((d) => rank(d.rarity) >= rank(guarantee))) {
    const rarity = rollRarity(guarantee);
    const pool = poolOf(rarity);
    if (rarity === "mythic") getState().gacha.pityCount = 0;
    draws[count - 1] = { rarity, item: pool[Math.floor(Math.random() * pool.length)] };
  }
  const results = draws.map(grantResult);
  saveSave();
  return results;
}

/** 交換所 */
function doExchange(ex) {
  if (getShard() < ex.cost) return { ok: false };
  addShard(-ex.cost);
  let result;
  if (ex.kind === "pull") result = grantResult(drawOne(ex.minRarity));
  else if (ex.kind === "item") { const m = masterById(ex.itemId); result = grantResult({ rarity: m.rarity, item: m }); }
  else if (ex.kind === "yokai") { const m = MASTER.find((x) => x.type === "yokai" && x.speciesId === ex.speciesId); result = grantResult({ rarity: m.rarity, item: m }); }
  saveSave();
  return { ok: true, result };
}

/* ===================== 画面 ===================== */
let _alive = true;
let _timers = [];
let _root = null, _ctx = null;
const pushTimer = (id) => { _timers.push(id); return id; };
const clearTimers = () => { _timers.forEach((t) => clearTimeout(t)); _timers = []; };

export const gachaScreen = {
  mount(root, ctx) {
    _alive = true; _timers = []; _root = root; _ctx = ctx;
    renderGacha();
  },
  unmount() {
    _alive = false;
    clearTimers();
    _root = null;
  },
};
export default gachaScreen;

function fmt(n) { try { return Math.floor(n).toLocaleString("ja-JP"); } catch (e) { return String(n | 0); } }

function renderGacha() {
  if (!_alive || !_root) return;
  const s = getState();
  const coin = getCoin(), shard = getShard();
  const pity = s.gacha.pityCount | 0;
  const remain = Math.max(0, GACHA.pityCeiling - pity);

  const rateRows = RARITY_ORDER.map((k) => {
    const R = RARITY[k];
    return `<span class="rate" style="color:${R.color}">${R.name} ${(R.prob * 100).toFixed(0)}%</span>`;
  }).join("");

  const exRows = EXCHANGE.map((ex) => {
    const can = shard >= ex.cost;
    return `<div class="ex-row">
      <div class="ex-main"><div class="ex-name">${ex.label}</div><div class="ex-desc">${ex.desc}</div></div>
      <button class="ex-buy" data-ex="${ex.id}" ${can ? "" : "disabled"}>◈ ${ex.cost}</button>
    </div>`;
  }).join("");

  _root.innerHTML = `
    <section class="screen gacha">
      <div class="gacha-top">
        <button class="btn-ghost" id="gcBack">← 戻る</button>
        <div class="gacha-wallet">
          <span class="w-coin">◉ ${fmt(coin)}</span>
          <span class="w-shard">◈ ${fmt(shard)}</span>
        </div>
      </div>

      <h2 class="gacha-title">⛩️ 招喚</h2>

      <div class="miko-bubble">
        <span class="mb-ico">${GACHA_MIKO.icon}</span>
        <span class="mb-line">${GACHA_MIKO.name}が札を構えている。</span>
      </div>

      <div class="pity-bar">
        <div class="pity-label">神話確定まで あと <b>${remain}</b> 連</div>
        <div class="pity-track"><div class="pity-fill" style="width:${(pity / GACHA.pityCeiling * 100).toFixed(1)}%"></div></div>
      </div>

      <div class="pull-btns">
        <button class="pull-btn single" id="pull1" ${coin < GACHA.singleCost ? "disabled" : ""}>
          <span class="pb-name">単発</span><span class="pb-cost">◉ ${GACHA.singleCost}</span>
        </button>
        <button class="pull-btn multi" id="pull10" ${coin < GACHA.multiCost ? "disabled" : ""}>
          <span class="pb-name">十連</span><span class="pb-cost">◉ ${GACHA.multiCost}</span>
          <span class="pb-bonus">「上」以上 確定</span>
        </button>
      </div>

      <div class="rates">排出率：${rateRows}　<span class="rate-note">※10連は「上」以上1件確定／${GACHA.pityCeiling}連で神話確定</span></div>

      <details class="exchange">
        <summary>交換所（◈ shard）</summary>
        <div class="ex-list">${exRows}</div>
      </details>
    </section>
  `;

  _root.querySelector("#gcBack").addEventListener("click", () => _ctx.go("home"));
  const p1 = _root.querySelector("#pull1");
  const p10 = _root.querySelector("#pull10");
  if (p1) p1.addEventListener("click", () => onPull(1));
  if (p10) p10.addEventListener("click", () => onPull(10));
  _root.querySelectorAll("[data-ex]").forEach((b) => b.addEventListener("click", () => onExchange(b.dataset.ex)));
}

function onPull(n) {
  Sfx.ensure();
  const isMulti = n === 10;
  const cost = isMulti ? GACHA.multiCost : GACHA.singleCost;
  const results = performPull(n, cost, isMulti ? GACHA.multiGuarantee : null);
  if (!results) return;     // coin 不足（ボタンは disabled だが二重ガード）
  showResults(results, isMulti);
}

function onExchange(exId) {
  Sfx.ensure();
  const ex = EXCHANGE.find((e) => e.id === exId);
  if (!ex) return;
  const out = doExchange(ex);
  if (!out.ok) return;
  showResults([out.result], false);
}

/* ===================== 演出 ===================== */
function mikoLine(rarity) {
  const arr = GACHA_MIKO.react[rarity] || GACHA_MIKO.react.common;
  return arr[Math.floor(Math.random() * arr.length)];
}
function typeLabel(t) { return t === "weapon" ? "武器" : t === "costume" ? "衣装" : "妖怪"; }

function cardArt(res) {
  const it = res.item;
  if (it.type === "yokai") {
    return renderArt({ kind: "yokai", id: it.speciesId, rarity: res.rarity,
      fallback: buildYokaiArt({ speciesId: it.speciesId, level: 1, affection: 0, equip: { weaponUid: null, costumeUid: null } }), alt: it.name });
  }
  return itemArt(it, res.rarity);
}
function cardFace(res) {
  const R = RARITY[res.rarity];
  const sub = res.dup ? `重複 → ◈+${res.shardGain}` : "NEW";
  return `<div class="card-face r-${res.rarity}" style="--rc:${R.color}">
    <div class="cf-art">${cardArt(res)}</div>
    <div class="cf-rar">${R.name}</div>
    <div class="cf-name">${res.item.name}</div>
    <div class="cf-type">${typeLabel(res.item.type)}</div>
    <div class="cf-sub ${res.dup ? "dup" : "new"}">${sub}</div>
  </div>`;
}

function revealSound(rarity) {
  if (rarity === "mythic") Sfx.mythic();
  else if (rarity === "epic") Sfx.fanfare(true);
  else if (rarity === "rare") Sfx.fanfare(false);
  else Sfx.blip(0);
}
function overlayFlash(ov, rarity) {
  const f = document.createElement("div");
  f.className = "gov-flash r-" + rarity;
  ov.appendChild(f);
  pushTimer(setTimeout(() => f.remove(), 700));
}

function showResults(results, isMulti) {
  if (!_alive || !_root) return;
  const sorted = results.slice().sort((a, b) => rank(a.rarity) - rank(b.rarity));
  const best = sorted[sorted.length - 1];

  const ov = document.createElement("div");
  ov.className = "gacha-overlay";
  ov.innerHTML = `<div class="ritual"><div class="orb" id="gOrb"></div><div class="ritual-text">招喚……</div></div>`;
  _root.appendChild(ov);
  Sfx.riser(900);

  const orb = ov.querySelector("#gOrb");
  runRitual(orb, best.rarity, () => {
    if (!_alive) return;
    ov.innerHTML = "";
    if (isMulti) revealMulti(ov, sorted, best);
    else revealSingle(ov, sorted[0], best);
  });
}

/** 儀式の溜め：当たり予告の光＋昇格フェイクアウト（嘘はつかない＝実レア以下から昇格）。 */
function runRitual(orb, rarity, done) {
  const target = RARITY[rarity];
  const fakeout = Math.random() < GACHA.fakeoutChance && target.rank > 0;
  const baseRank = fakeout ? target.rank - 1 : target.rank;
  orb.style.setProperty("--lite", rarityByRank(baseRank).light);
  orb.className = "orb spin";
  if (fakeout) {
    pushTimer(setTimeout(() => {
      if (!_alive) return;
      orb.style.setProperty("--lite", target.light);
      orb.classList.add("promote");
      Sfx.blip(4);
    }, 620));
  }
  pushTimer(setTimeout(done, 960));
}

function revealSingle(ov, res, best) {
  ov.innerHTML = `
    <div class="reveal single">
      ${cardFace(res)}
      <div class="miko">「${mikoLine(best.rarity)}」</div>
      <button class="reveal-close" id="rClose">とじる</button>
    </div>`;
  if (rank(res.rarity) >= 1) overlayFlash(ov, res.rarity);
  revealSound(res.rarity);
  ov.querySelector("#rClose").addEventListener("click", () => closeOverlay(ov));
  ov.addEventListener("click", (e) => { if (e.target === ov) closeOverlay(ov); });
}

function revealMulti(ov, sorted, best) {
  ov.innerHTML = `
    <div class="reveal multi">
      <div class="card-grid" id="cg"></div>
      <div class="miko" id="mk"></div>
      <button class="reveal-close" id="rClose" disabled>とじる</button>
    </div>`;
  const cg = ov.querySelector("#cg");
  sorted.forEach((res) => {
    const c = document.createElement("div");
    c.className = "gcard down";
    c.innerHTML = `<div class="gcard-face">${cardFace(res)}</div>`;
    cg.appendChild(c);
  });
  const cards = [...cg.children];
  let i = 0;
  function flipNext() {
    if (!_alive) return;
    if (i >= cards.length) {
      const mk = ov.querySelector("#mk"); if (mk) mk.textContent = "「" + mikoLine(best.rarity) + "」";
      const rc = ov.querySelector("#rClose"); if (rc) rc.disabled = false;
      return;
    }
    const res = sorted[i];
    cards[i].classList.remove("down");
    cards[i].classList.add("up", "r-" + res.rarity);
    Sfx.blip(i);
    const last = i === cards.length - 1;
    if (last && rank(res.rarity) >= 2) { overlayFlash(ov, res.rarity); revealSound(res.rarity); }
    else if (rank(res.rarity) >= 2 && !last) revealSound(res.rarity);
    i++;
    pushTimer(setTimeout(flipNext, 180));
  }
  pushTimer(setTimeout(flipNext, 220));
  ov.querySelector("#rClose").addEventListener("click", () => closeOverlay(ov));
}

function closeOverlay(ov) {
  ov.remove();
  renderGacha();   // coin/shard/天井/所持の反映を再描画
}

/* dev/テスト用の純ロジック公開（UI からは未使用） */
export const __gachaTest = { performPull, doExchange, drawOne, rollRarity, grantResult };
