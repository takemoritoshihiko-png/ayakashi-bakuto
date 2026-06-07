/* ============================================================
   screens/zukan.js — 図鑑（蒐集率・コンプ報酬・愛情で深まる記述）
   ============================================================ */
import { RARITY, ENDING_WORDS, GAME } from "../config/index.js";
import {
  CATEGORIES, entriesOf, categoryStats, overallStats,
  claimable, claim, nextRewardPreview, rewardLabel,
} from "../game/zukan.js";
import { affectionStageName } from "../game/yokai.js";
import { toast } from "../ui/shell.js";
import Sfx from "../ui/sfx.js";
import { renderArt } from "../ui/art.js";

/* 図鑑エントリの絵（画像優先・無ければ既存SVG/絵文字フォールバック・額縁つき） */
function zkArt(cat, e, cls) {
  if (cat === "yokai") return renderArt({ kind: "yokai", id: e.id, rarity: e.rarity, fallback: e.artHtml || "", alt: e.name, cls });
  if (cat === "weapon" || cat === "costume") return renderArt({ kind: cat, id: e.id, rarity: e.rarity, fallback: `<span class="art-emoji">${e.emoji || "❖"}</span>`, alt: e.name, cls });
  if (cat === "furniture") return renderArt({ kind: "furniture", id: e.id, fallback: `<span class="art-emoji">${e.emoji || "❖"}</span>`, alt: e.name, cls });
  return `<div class="art-frame"><span class="art-emoji">${e.emoji || "❖"}</span></div>`;
}

let _root = null, _ctx = null, _cat = "yokai";

export const zukanScreen = {
  mount(root, ctx) { _root = root; _ctx = ctx; _cat = "yokai"; render(); },
  unmount() { _root = null; },
};
export default zukanScreen;

function pctTxt(p) { return Math.floor(p * 100) + "%"; }

function render() {
  if (!_root) return;
  const overall = overallStats();
  const next = nextRewardPreview();
  const claims = claimable();

  const tabs = CATEGORIES.map((c) => {
    const st = categoryStats(c.id);
    return `<button class="zk-tab ${_cat === c.id ? "on" : ""}" data-cat="${c.id}">${c.icon}<small>${st.have}/${st.total}</small></button>`;
  }).join("");

  const st = categoryStats(_cat);
  const entries = entriesOf(_cat).map(entryCard).join("");

  _root.innerHTML = `
    <section class="screen zukan">
      <div class="yk-top">
        <button class="btn-ghost" id="zBack">← 戻る</button>
        <span class="zk-overall">蒐集 ${overall.have}/${overall.total}（${pctTxt(overall.pct)}）</span>
      </div>
      <h2 class="yk-title">📖 図鑑</h2>

      <div class="zk-progress">
        <div class="bar"><div class="bar-fill zk-bar" style="width:${overall.pct * 100}%"></div></div>
        ${next ? `<div class="zk-next">次のコンプ報酬：${next.label}（あと ${next.need}）</div>` : `<div class="zk-next done">全コンプ報酬を受領済み</div>`}
      </div>

      ${claims.length ? `<div class="zk-claims">${claims.map((d) => `<button class="zk-claim" data-claim="${d.id}">受取：${rewardLabel(d)}</button>`).join("")}</div>` : ""}

      <div class="zk-tabs">${tabs}</div>
      <div class="zk-catbar">${CATEGORIES.find((c) => c.id === _cat).name}　${st.have}/${st.total}（${pctTxt(st.pct)}）</div>
      <div class="zk-grid">${entries}</div>

      <div class="zk-overlay hidden" id="zkOverlay"></div>
    </section>`;

  _root.querySelector("#zBack").addEventListener("click", () => _ctx.go("home"));
  _root.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => { _cat = b.dataset.cat; render(); }));
  _root.querySelectorAll("[data-claim]").forEach((b) => b.addEventListener("click", () => onClaim(b.dataset.claim)));
  _root.querySelectorAll("[data-entry]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.entry)));
}

function entryCard(e) {
  if (!e.discovered) {
    return `<div class="zk-card undiscovered"><div class="zk-art">？</div><div class="zk-name">???</div></div>`;
  }
  const art = `<div class="zk-art">${zkArt(_cat, e)}</div>`;
  return `<button class="zk-card" data-entry="${_cat}:${e.id}" style="--rc:${e.color}">
    ${art}<div class="zk-name">${e.name}</div>
    <div class="zk-rar">${RARITY[e.rarity] ? RARITY[e.rarity].name : ""}</div>
  </button>`;
}

function openDetail(key) {
  const [cat, id] = key.split(":");
  const e = entriesOf(cat).find((x) => x.id === id);
  if (!e || !e.discovered) return;
  const ov = _root.querySelector("#zkOverlay");
  const art = `<div class="zd-art">${zkArt(cat, e)}</div>`;
  let body = `<p class="zd-desc">${e.desc || ""}</p>`;
  if (cat === "yokai") {
    body += `<div class="zd-aff">愛情：${e.affection}（${affectionStageName(e.affection)}）— 記述は懐くほど深まる</div>`;
    body += `<div class="zd-lore">${e.lore.map((l) => `<p>${l}</p>`).join("")}</div>`;
    if (e.affStage < GAME.affection.stages.length - 1) body += `<p class="zd-more">…まだ見せていない一面がある。</p>`;
  }
  ov.innerHTML = `<div class="zd-card" style="--rc:${e.color}">
    ${art}<div class="zd-name">${e.name}</div>
    <div class="zd-rar">${RARITY[e.rarity] ? RARITY[e.rarity].name : ""}</div>
    ${body}
    <button class="close" id="zdClose">閉じる</button>
  </div>`;
  ov.classList.remove("hidden");
  ov.querySelector("#zdClose").addEventListener("click", () => ov.classList.add("hidden"));
  ov.addEventListener("click", (ev) => { if (ev.target === ov) ov.classList.add("hidden"); });
}

function onClaim(id) {
  Sfx.ensure();
  const r = claim(id);
  if (!r.ok) { toast("まだ受け取れない", "warn"); return; }
  if (r.special) { Sfx.mythic(); showEnding(r); }
  else { Sfx.fanfare(true); toast("コンプ報酬を受け取った！"); render(); }
}

function showEnding(r) {
  const ov = _root.querySelector("#zkOverlay");
  ov.innerHTML = `<div class="ending-card">
    <div class="ending-seal">満</div>
    <h3>全 蒐 集</h3>
    <div class="ending-words">${ENDING_WORDS.map((w) => `<p>${w}</p>`).join("")}</div>
    ${r.def.payload.captureSpeciesId ? `<div class="ending-grant">特別報酬：八岐大蛇 を仲間にした</div>` : ""}
    <button class="close" id="endClose">…そっと戸を閉じる</button>
  </div>`;
  ov.classList.remove("hidden");
  ov.querySelector("#endClose").addEventListener("click", () => { ov.classList.add("hidden"); render(); });
}
