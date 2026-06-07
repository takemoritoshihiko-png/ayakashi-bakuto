/* ============================================================
   game/yokai.js — 妖怪ドメインロジック（Phase D / E 共通の真実）
   実効ステータス・育成(exp/level)・装備・愛情度・編成・描画。
   戦闘(Phase E)も表示も必ず getEffectiveStats を使う。
   ============================================================ */
import { getState, saveSave, addCoin, getCoin } from "../state.js";
import { YOKAI_SPECIES, MASTER, GAME, ELEMENTS, RARITY } from "../config/index.js";

/* ---- 参照 ---- */
export function speciesById(id) { return YOKAI_SPECIES.find((s) => s.speciesId === id); }
export function itemMaster(itemId) { return MASTER.find((m) => m.id === itemId); }
export function elementColor(el) { return (ELEMENTS[el] && ELEMENTS[el].color) || "#9b8fa6"; }

/* ---- 成長・経験値 ---- */
export function growthFactor(species, level) { return 1 + species.growth * (level - 1); }
export function expToNext(level) { return Math.floor(GAME.exp.base * Math.pow(level, GAME.exp.pow)); }

/* ---- 装備の statMods / 見た目 を解決 ---- */
export function resolveEquip(inst) {
  const s = getState();
  const mods = { hp: 0, atk: 0, def: 0, spd: 0 };
  let appearance = null;
  const wuid = inst.equip && inst.equip.weaponUid;
  const cuid = inst.equip && inst.equip.costumeUid;
  const w = wuid && s.inventory.weapons.find((x) => x.uid === wuid);
  if (w) { const m = itemMaster(w.itemId); if (m && m.statMods) addInto(mods, m.statMods); }
  const c = cuid && s.inventory.costumes.find((x) => x.uid === cuid);
  if (c) { const m = itemMaster(c.itemId); if (m) { if (m.statMods) addInto(mods, m.statMods); appearance = m.appearance || null; } }
  return { mods, appearance, weaponItem: w ? itemMaster(w.itemId) : null, costumeItem: c ? itemMaster(c.itemId) : null };
}
function addInto(acc, mods) { for (const k in mods) acc[k] = (acc[k] || 0) + mods[k]; }

/* ============================================================
   実効ステータス（単一の真実）
   実効値 = floor(baseStat × growth(level)) + 装備statMods + 愛情度ボーナス
   ============================================================ */
export function getEffectiveStats(inst) {
  const sp = speciesById(inst.speciesId);
  if (!sp) return { hp: 1, atk: 1, def: 1, spd: 1 };
  const g = growthFactor(sp, inst.level || 1);
  const { mods } = resolveEquip(inst);
  const affAdd = Math.floor((inst.affection || 0) * GAME.affection.statPer);
  const out = {};
  for (const k of ["hp", "atk", "def", "spd"]) {
    out[k] = Math.floor(sp.baseStats[k] * g) + (mods[k] || 0) + affAdd;
  }
  return out;
}

/** 戦闘が使う技一覧（species 由来）。 */
export function skillsOf(inst) {
  const sp = speciesById(inst.speciesId);
  return sp ? sp.skills : [];
}

/* ============================================================
   育成（修行）— coin の主要なはけ口
   ============================================================ */
export function trainCost(inst, tier) {
  return Math.floor(tier.baseCost * (1 + (inst.level || 1) * GAME.trainCostScale));
}
/** exp を加算しレベルアップ処理。上がったレベル数を返す。 */
export function addExp(inst, amount) {
  let levels = 0;
  inst.exp = (inst.exp || 0) + amount;
  while (inst.level < inst.maxLevel && inst.exp >= expToNext(inst.level)) {
    inst.exp -= expToNext(inst.level);
    inst.level++;
    levels++;
  }
  if (inst.level >= inst.maxLevel) inst.exp = 0;   // 上限で打ち止め
  return levels;
}
/** 修行を実行（coin 消費→exp→愛情）。{ok,cost,levels,expGain,affGain} を返す。 */
export function train(inst, tierId) {
  const tier = GAME.train.find((t) => t.id === tierId);
  if (!tier) return { ok: false };
  const cost = trainCost(inst, tier);
  if (getCoin() < cost) return { ok: false, reason: "coin" };
  if (inst.level >= inst.maxLevel) return { ok: false, reason: "max" };
  addCoin(-cost);
  const levels = addExp(inst, tier.exp);
  const affGain = gainAffection(inst, tier.affection);
  saveSave();
  return { ok: true, cost, levels, expGain: tier.exp, affGain };
}

/* ============================================================
   愛情度
   ============================================================ */
export function gainAffection(inst, n) {
  const before = inst.affection || 0;
  inst.affection = Math.max(0, Math.min(GAME.affection.max, before + n));
  return inst.affection - before;
}
export function affectionStage(affection) {
  let stage = 0;
  GAME.affection.stages.forEach((th, i) => { if ((affection || 0) >= th) stage = i; });
  return stage;
}
export function affectionStageName(affection) {
  return GAME.affection.stageNames[affectionStage(affection)] || "";
}
/** 愛情段階で解放された固有ボイス（index 0..stage）。 */
export function unlockedVoices(inst) {
  const sp = speciesById(inst.speciesId);
  if (!sp) return [];
  return sp.voices.slice(0, affectionStage(inst.affection) + 1);
}
/** 愛情段階で深まる図鑑記述（index 0..stage）。 */
export function unlockedLore(inst) {
  const sp = speciesById(inst.speciesId);
  if (!sp) return [];
  return sp.lore.slice(0, affectionStage(inst.affection) + 1);
}

/* ============================================================
   装備（着せ替え）
   ============================================================ */
/** uid を slot に装備（null で解除）。同 uid は他妖怪から外す（1点を複数装備しない）。
    衣装の新規装備で愛情度＋（appearance も実効描画に反映）。 */
export function equip(inst, slot, uid) {
  const s = getState();
  const key = slot === "weapon" ? "weaponUid" : "costumeUid";
  const prev = inst.equip[key];

  if (uid) {
    for (const y of s.yokai) {
      if (y.uid === inst.uid) continue;
      if (y.equip.weaponUid === uid) y.equip.weaponUid = null;
      if (y.equip.costumeUid === uid) y.equip.costumeUid = null;
    }
  }
  inst.equip[key] = uid || null;

  // 衣装を“新たに”着けたときだけ愛情度ボーナス（着け外し連打での稼ぎを防ぐ）
  if (slot === "costume" && uid && uid !== prev) {
    const c = s.inventory.costumes.find((x) => x.uid === uid);
    const m = c && itemMaster(c.itemId);
    if (m && m.affectionBonus) gainAffection(inst, m.affectionBonus);
  }
  saveSave();
}

/* ============================================================
   編成
   ============================================================ */
export function inParty(uid) { return getState().party.includes(uid); }
export function toggleParty(uid) {
  const s = getState();
  const i = s.party.indexOf(uid);
  if (i >= 0) { s.party.splice(i, 1); saveSave(); return true; }
  if (s.party.length >= GAME.partySize) return false;   // 上限
  s.party.push(uid);
  saveSave();
  return true;
}

/* ============================================================
   描画（画像不使用・SVG）。属性で色味、衣装(appearance)で見た目変化。
   ============================================================ */
export function buildYokaiArt(inst) {
  const sp = speciesById(inst.speciesId);
  if (!sp) return "";
  const col = elementColor(sp.element);
  const { appearance } = resolveEquip(inst);
  const body = FORM[sp.form] ? FORM[sp.form](col) : FORM._default(col);
  const cos = appearance && COSTUME[appearance] ? COSTUME[appearance]() : "";
  return `<svg viewBox="0 0 120 120" class="yk-svg">
    <defs><radialGradient id="g_${sp.form}" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#fff" stop-opacity=".25"/><stop offset="55%" stop-color="${col}"/><stop offset="100%" stop-color="${shade(col)}"/>
    </radialGradient></defs>
    ${body}${cos}</svg>`;
}
function shade(hex) {
  // 暗くした色（簡易）
  const n = hex.replace("#", "");
  const r = Math.max(0, parseInt(n.slice(0, 2), 16) - 70);
  const g = Math.max(0, parseInt(n.slice(2, 4), 16) - 70);
  const b = Math.max(0, parseInt(n.slice(4, 6), 16) - 70);
  return `rgb(${r},${g},${b})`;
}
const eyes = (cx1, cx2, cy) =>
  `<circle cx="${cx1}" cy="${cy}" r="4.5" fill="#1a1024"/><circle cx="${cx2}" cy="${cy}" r="4.5" fill="#1a1024"/>
   <circle cx="${cx1 + 1}" cy="${cy - 1}" r="1.4" fill="#fff"/><circle cx="${cx2 + 1}" cy="${cy - 1}" r="1.4" fill="#fff"/>`;

/* species フォーム（簡素だが個性を出す） */
const FORM = {
  _default: (c) => `<circle cx="60" cy="64" r="34" fill="url(#g_${"_default"})"/>${eyes(50, 70, 60)}`,
  tanuki: (c) => `<ellipse cx="60" cy="70" rx="36" ry="32" fill="url(#g_tanuki)"/>
    <ellipse cx="42" cy="48" rx="9" ry="11" fill="${shade(c)}"/><ellipse cx="78" cy="48" rx="9" ry="11" fill="${shade(c)}"/>
    <ellipse cx="48" cy="66" rx="9" ry="7" fill="#241a14" opacity=".5"/><ellipse cx="72" cy="66" rx="9" ry="7" fill="#241a14" opacity=".5"/>
    ${eyes(48, 72, 64)}<ellipse cx="60" cy="76" rx="5" ry="4" fill="#1a1024"/>`,
  cloth: (c) => `<path d="M30 28 Q60 40 90 28 L86 92 Q60 80 34 92 Z" fill="url(#g_cloth)"/>
    ${eyes(50, 70, 56)}<path d="M50 70 q10 8 20 0" stroke="#1a1024" stroke-width="2.5" fill="none"/>`,
  cat: (c) => `<circle cx="60" cy="66" r="33" fill="url(#g_cat)"/>
    <polygon points="36,44 30,20 52,38" fill="${shade(c)}"/><polygon points="84,44 90,20 68,38" fill="${shade(c)}"/>
    <path d="M84 90 q22 -4 24 -26" stroke="${shade(c)}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M92 94 q24 0 26 -22" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>
    ${eyes(49, 71, 62)}<polygon points="57,72 63,72 60,77" fill="#d88aa0"/>
    <path d="M30 66 L12 62 M30 72 L12 74" stroke="#cfc8d8" stroke-width="1.5"/><path d="M90 66 L108 62 M90 72 L108 74" stroke="#cfc8d8" stroke-width="1.5"/>`,
  umbrella: (c) => `<path d="M24 60 Q60 14 96 60 Z" fill="url(#g_umbrella)"/>
    <line x1="60" y1="60" x2="60" y2="100" stroke="${shade(c)}" stroke-width="4"/>
    <path d="M52 100 q8 8 16 0" stroke="${shade(c)}" stroke-width="4" fill="none"/>
    ${eyes(50, 70, 50)}<path d="M50 60 q10 8 20 0" stroke="#1a1024" stroke-width="2.5" fill="none"/>
    <ellipse cx="60" cy="56" rx="4" ry="6" fill="#c8384a"/>`,
  chimera: (c) => `<ellipse cx="60" cy="66" rx="34" ry="30" fill="url(#g_chimera)"/>
    <path d="M86 84 q20 6 22 26 q-10 -8 -24 -14" fill="${shade(c)}"/>
    <polygon points="40,42 34,22 54,38" fill="${shade(c)}"/><polygon points="80,42 86,22 66,38" fill="${shade(c)}"/>
    ${eyes(49, 71, 62)}<path d="M48 78 q12 8 24 0" stroke="#1a1024" stroke-width="2.5" fill="none"/>
    <polygon points="50,78 54,86 58,78" fill="#fff"/><polygon points="62,78 66,86 70,78" fill="#fff"/>`,
  tengu: (c) => `<circle cx="60" cy="64" r="33" fill="url(#g_tengu)"/>
    <polygon points="60,58 96,72 60,76" fill="#c8384a"/>
    <path d="M24 40 Q40 30 54 42" stroke="${shade(c)}" stroke-width="5" fill="none"/><path d="M96 40 Q80 30 66 42" stroke="${shade(c)}" stroke-width="5" fill="none"/>
    ${eyes(48, 72, 56)}<path d="M40 50 L54 54 M80 50 L66 54" stroke="#1a1024" stroke-width="3" stroke-linecap="round"/>`,
  fox: (c) => `<ellipse cx="60" cy="66" rx="32" ry="30" fill="url(#g_fox)"/>
    <polygon points="34,46 26,16 52,40" fill="${shade(c)}"/><polygon points="86,46 94,16 68,40" fill="${shade(c)}"/>
    ${[88,96,102,108,112].map((x,i)=>`<path d="M${82+i*2} 86 q${18+i*4} -${6+i*3} ${20+i*5} -${24+i*4}" stroke="${i%2?c:shade(c)}" stroke-width="5" fill="none" stroke-linecap="round"/>`).join("")}
    ${eyes(49, 71, 62)}<polygon points="55,74 65,74 60,82" fill="#1a1024"/>
    <path d="M40 50 q8 -6 14 -2 M80 50 q-8 -6 -14 -2" stroke="#fff" stroke-width="2" fill="none"/>`,
  serpent: (c) => `<path d="M30 96 Q24 60 48 52 Q72 44 66 24" stroke="url(#g_serpent)" stroke-width="16" fill="none" stroke-linecap="round"/>
    ${[40,52,64,76].map((y,i)=>`<path d="M${40+i*8} 96 Q${30+i*6} ${70-i*4} ${50+i*6} ${56-i*6}" stroke="${shade(c)}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`).join("")}
    <ellipse cx="66" cy="26" rx="13" ry="11" fill="url(#g_serpent)"/>
    ${eyes(61, 71, 24)}<path d="M66 32 l-3 6 M66 32 l3 6" stroke="#c8384a" stroke-width="1.6"/>`,
};

/* 衣装 appearance のオーバーレイ（着せ替え＝即絵に反映） */
const COSTUME = {
  robe_plain: () => `<path d="M34 88 Q60 78 86 88 L86 104 L34 104 Z" fill="#cabfae" opacity=".85"/>`,
  hat_cloth: () => `<path d="M40 40 Q60 26 80 40 Z" fill="#cabfae"/><rect x="40" y="40" width="40" height="5" fill="#b3a890"/>`,
  robe_red: () => `<path d="M32 86 Q60 74 88 86 L88 106 L32 106 Z" fill="#c8384a" opacity=".9"/><line x1="60" y1="80" x2="60" y2="106" stroke="#7a1f2a" stroke-width="2"/>`,
  mask_fox: () => `<path d="M40 50 Q60 44 80 50 Q76 66 60 70 Q44 66 40 50 Z" fill="#f7efe4" stroke="#d8455a" stroke-width="1.5"/>
    <path d="M46 56 q8 -4 14 0 M74 56 q-8 -4 -14 0" stroke="#d8455a" stroke-width="2" fill="none"/>`,
  robe_juni: () => `<path d="M28 84 Q60 72 92 84 L92 108 L28 108 Z" fill="#8b5cf6" opacity=".55"/>
    <path d="M34 88 Q60 80 86 88 L86 102 L34 102 Z" fill="#e8c372" opacity=".7"/>`,
  horns: () => `<path d="M40 38 q-6 -16 -2 -22 q6 8 8 20 Z" fill="#e8dcc0" stroke="#b09a70"/><path d="M80 38 q6 -16 2 -22 q-6 8 -8 20 Z" fill="#e8dcc0" stroke="#b09a70"/>`,
  robe_moon: () => `<path d="M28 84 Q60 70 92 84 L92 110 L28 110 Z" fill="#244e8f" opacity=".7"/>
    <circle cx="60" cy="94" r="7" fill="#ffe07a" opacity=".9"/>`,
  mask_gold: () => `<path d="M40 48 Q60 42 80 48 Q78 66 60 72 Q42 66 40 48 Z" fill="#e8c372" stroke="#a9802f" stroke-width="2"/>`,
};
