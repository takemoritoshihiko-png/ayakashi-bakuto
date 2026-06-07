/* ============================================================
   ui/art.js — 画像ローダ部品（Phase J）
   renderArt: 画像があれば <img>（lazy/decoding/フェードイン）、
   無ければ渡された fallback（既存SVG/絵文字）を表示。
   img の onerror でも fallback に自動切替（マニフェスト漏れの安全網）。
   レア度の額縁/オーラは design.css の .art-frame.rar-* で適用。
   ============================================================ */
import { getYokaiImage, getItemImage, getEnemyImage, getFurnitureImage } from "../config/assets.js";

function resolve(kind, id, costumeId) {
  if (kind === "yokai") return getYokaiImage(id, costumeId);
  if (kind === "enemy") return getEnemyImage(id);
  if (kind === "furniture") return getFurnitureImage(id);
  if (kind === "weapon") return getItemImage({ id, type: "weapon" });
  if (kind === "costume") return getItemImage({ id, type: "costume" });
  return null;
}

/**
 * @param {object} o {kind,id,costumeId,rarity,fallback(HTML文字列),alt,cls}
 * @returns {string} HTML
 */
export function renderArt(o) {
  const src = resolve(o.kind, o.id, o.costumeId);
  const rar = o.rarity ? ` rar-${o.rarity}` : "";
  const extra = o.cls ? ` ${o.cls}` : "";
  const fb = o.fallback || "";
  if (src) {
    return `<div class="art-frame${rar}${extra}">` +
      `<img class="art-img" src="${src}" alt="${esc(o.alt)}" loading="lazy" decoding="async" ` +
      `onerror="this.style.display='none';var f=this.parentElement.querySelector('.art-fallback');if(f)f.style.display='flex';">` +
      `<div class="art-fallback" style="display:none">${fb}</div>` +
      `</div>`;
  }
  return `<div class="art-frame${rar}${extra}"><div class="art-fallback">${fb}</div></div>`;
}

/** 装備（武器/衣装）アイコン。fallback はカテゴリ絵文字。 */
export function itemArt(item, rarity) {
  const emoji = item.type === "weapon" ? "⚔️" : "👘";
  return renderArt({ kind: item.type, id: item.id, rarity, fallback: `<span class="art-emoji">${emoji}</span>`, alt: item.name });
}
/** 家具アイコン。fallback は家具の絵文字。 */
export function furnitureArt(f) {
  return renderArt({ kind: "furniture", id: f.id, fallback: `<span class="art-emoji">${f.art}</span>`, alt: f.name });
}

function esc(s) { return (s || "").replace(/"/g, "&quot;"); }
