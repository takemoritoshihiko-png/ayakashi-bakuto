/* ============================================================
   game/zukan.js — 図鑑コンプ（蒐集率・コンプ報酬・愛情で深まる記述）
   ============================================================ */
import { getState, saveSave, addCoin, addShard, uid as genUid } from "../state.js";
import {
  YOKAI_SPECIES, MASTER, FURNITURE, GAMBLE_VENUES, ZUKAN_TITLES,
  ZUKAN_CATEGORIES, ZUKAN_REWARDS, RARITY, GAME,
} from "../config/index.js";
import { speciesById, buildYokaiArt, unlockedLore, affectionStage, elementColor } from "./yokai.js";

export const CATEGORIES = ZUKAN_CATEGORIES;

/* ---- エントリ列挙（カテゴリ別） ---- */
export function entriesOf(catId) {
  const s = getState();
  if (catId === "yokai") {
    return YOKAI_SPECIES.map((sp) => {
      const discovered = !!s.zukan.yokai[sp.speciesId];
      const insts = s.yokai.filter((y) => y.speciesId === sp.speciesId);
      const aff = insts.reduce((m, y) => Math.max(m, y.affection || 0), 0);
      return {
        id: sp.speciesId, name: sp.name, discovered, rarity: sp.rarity, element: sp.element,
        color: elementColor(sp.element),
        artHtml: discovered ? buildYokaiArt({ speciesId: sp.speciesId, level: 1, affection: 0, equip: {} }) : null,
        lore: discovered ? unlockedLore({ speciesId: sp.speciesId, affection: aff }) : [],
        affStage: affectionStage(aff), affection: aff, desc: sp.desc,
      };
    });
  }
  if (catId === "weapon" || catId === "costume") {
    return MASTER.filter((m) => m.type === catId).map((m) => ({
      id: m.id, name: m.name, discovered: !!s.zukan.items[m.id], rarity: m.rarity,
      color: RARITY[m.rarity].color, emoji: catId === "weapon" ? "⚔️" : "👘",
      desc: modStr(m.statMods) + (m.affectionBonus ? `　♥+${m.affectionBonus}` : ""),
    }));
  }
  if (catId === "furniture") {
    return FURNITURE.map((f) => ({
      id: f.id, name: f.name, discovered: !!s.zukan.furniture[f.id], rarity: "common",
      color: "#7fb6ff", emoji: f.art, desc: `${f.category}・心地+${f.comfort}`,
    }));
  }
  if (catId === "venue") {
    const unlocked = s.gamble.unlockedVenues || [];
    return GAMBLE_VENUES.map((v) => ({
      id: v.id, name: v.name, discovered: unlocked.includes(v.id), rarity: "epic",
      color: "#e8c372", emoji: v.icon, desc: v.note,
    }));
  }
  if (catId === "title") {
    const deepest = s.stats.deepestDepth | 0;
    return ZUKAN_TITLES.map((t) => ({
      id: t.id, name: t.name, discovered: deepest >= t.min, rarity: "rare",
      color: "#3b7dd8", emoji: "🏵️", desc: t.desc + `（最深${t.min}）`,
    }));
  }
  return [];
}
function modStr(mods) {
  if (!mods) return "";
  return Object.entries(mods).map(([k, v]) => `${({ hp: "HP", atk: "攻", def: "防", spd: "速" })[k]}+${v}`).join(" ");
}

/* ---- 蒐集率 ---- */
export function categoryStats(catId) {
  const es = entriesOf(catId);
  const have = es.filter((e) => e.discovered).length;
  const total = es.length;
  return { have, total, pct: total ? have / total : 0 };
}
export function overallStats() {
  let have = 0, total = 0;
  for (const c of CATEGORIES) { const st = categoryStats(c.id); have += st.have; total += st.total; }
  return { have, total, pct: total ? have / total : 0 };
}

/* ---- コンプ報酬 ---- */
export function rewardDefs() {
  const defs = [];
  for (const cat of CATEGORIES) {
    for (const r of ZUKAN_REWARDS.perCategory) {
      defs.push({ id: `c:${cat.id}:${r.pct}`, scope: "cat", catId: cat.id, catName: cat.name, pct: r.pct, payload: r });
    }
  }
  for (const r of ZUKAN_REWARDS.overall) {
    defs.push({ id: `o:${r.pct}`, scope: "overall", pct: r.pct, payload: r });
  }
  return defs;
}
function statFor(def) { return def.scope === "cat" ? categoryStats(def.catId) : overallStats(); }
export function isMet(def) { return statFor(def).pct >= def.pct; }
export function isClaimed(def) { return getState().zukan.rewardsClaimed.includes(def.id); }
export function claimable() { return rewardDefs().filter((d) => isMet(d) && !isClaimed(d)); }

export function rewardLabel(def) {
  const p = def.payload;
  const bits = [];
  if (p.coin) bits.push(`◉${p.coin}`);
  if (p.shard) bits.push(`◈${p.shard}`);
  if (p.captureSpeciesId) bits.push(`${speciesById(p.captureSpeciesId).name}`);
  const where = def.scope === "cat" ? def.catName : "全体";
  return `${where} ${Math.round(def.pct * 100)}% → ${bits.join(" ")}`;
}

/** 次に狙えるコンプ報酬（未達のうち最も近いもの）。 */
export function nextRewardPreview() {
  const pend = rewardDefs().filter((d) => !isClaimed(d) && !isMet(d));
  if (!pend.length) return null;
  pend.sort((a, b) => (a.pct - statFor(a).pct) - (b.pct - statFor(b).pct));
  const d = pend[0];
  const st = statFor(d);
  const need = Math.max(1, Math.ceil((d.pct - st.pct) * st.total));
  return { def: d, label: rewardLabel(d), need };
}

export function claim(id) {
  const def = rewardDefs().find((d) => d.id === id);
  if (!def || isClaimed(def) || !isMet(def)) return { ok: false };
  const s = getState();
  const p = def.payload;
  if (p.coin) addCoin(p.coin);
  if (p.shard) addShard(p.shard);
  if (p.captureSpeciesId) {
    s.yokai.push({ uid: genUid("yk"), speciesId: p.captureSpeciesId, level: 1, exp: 0, affection: 0, maxLevel: GAME.baseMaxLevel, equip: { weaponUid: null, costumeUid: null } });
    s.zukan.yokai[p.captureSpeciesId] = true;
  }
  s.zukan.rewardsClaimed.push(def.id);
  saveSave();
  return { ok: true, def, special: !!p.special };
}
