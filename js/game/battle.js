/* ============================================================
   game/battle.js — ターン制戦闘エンジン（Phase E）
   getEffectiveStats / species 技をそのまま使用。報酬で循環を閉じる。
   ============================================================ */
import { getState, saveSave, addCoin, uid as genUid } from "../state.js";
import {
  ELEMENT_CHART, ELEMENT_MULT, BATTLE, ENEMIES, STAGES, MASTER, GAME,
} from "../config/index.js";
import {
  speciesById, getEffectiveStats, skillsOf, addExp, gainAffection,
  buildYokaiArt, elementColor,
} from "./yokai.js";

/* ---- 属性相性 ---- */
export function elementMult(atkEl, defEl) {
  const ch = ELEMENT_CHART[atkEl];
  if (!ch) return ELEMENT_MULT.normal;
  if (ch.strong.includes(defEl)) return ELEMENT_MULT.strong;
  if (ch.weak.includes(defEl)) return ELEMENT_MULT.weak;
  return ELEMENT_MULT.normal;
}

/* ---- SP コスト（技から導出） ---- */
export function skillSpCost(skill) {
  if (skill.basic) return 0;
  let c = skill.power <= 0 ? 30 : Math.min(60, Math.max(20, Math.round(skill.power * 0.55)));
  if (skill.effect === "aoe") c += 10;
  return c;
}
function withCost(skill) { return { ...skill, spCost: skillSpCost(skill) }; }
function basicSkill(element) { return { id: "attack", name: "攻撃", power: BATTLE.basicPower, element, effect: "none", basic: true, spCost: 0 }; }

/* ---- コンバタント生成 ---- */
export function makeAlly(inst) {
  const sp = speciesById(inst.speciesId);
  const stats = getEffectiveStats(inst);
  return {
    side: "ally", refUid: inst.uid, speciesId: inst.speciesId,
    name: sp.name, element: sp.element,
    base: { ...stats }, hp: stats.hp, maxHp: stats.hp,
    sp: BATTLE.startSp, maxSp: BATTLE.maxSp,
    skills: [basicSkill(sp.element), ...skillsOf(inst).map(withCost)],
    statuses: [], alive: true, _defending: false,
    artHtml: buildYokaiArt(inst), color: elementColor(sp.element),
  };
}
export function makeEnemy(enemyId) {
  const e = ENEMIES[enemyId];
  const sc = BATTLE.enemyScale || 1;       // 難度係数（BALANCE）
  const st = { hp: Math.round(e.stats.hp * sc), atk: Math.round(e.stats.atk * sc), def: Math.round(e.stats.def * sc), spd: Math.round(e.stats.spd * sc) };
  return {
    side: "enemy", refId: enemyId,
    name: e.name, element: e.element,
    base: { ...st }, hp: st.hp, maxHp: st.hp,
    sp: BATTLE.maxSp, maxSp: BATTLE.maxSp,
    skills: [basicSkill(e.element), ...e.skills.map(withCost)],
    statuses: [], alive: true, _defending: false, isBoss: !!e.isBoss,
    artHtml: buildEnemyArt(e), color: elementColor(e.element),
  };
}

/* ---- ステータス補正 ---- */
function statMult(c, key) {
  let m = 1;
  for (const st of c.statuses) {
    if (st.type === "buff_" + key) m *= (1 + BATTLE.buffMag);
    if (st.type === "debuff_" + key) m *= (1 - BATTLE.debuffMag);
  }
  return m;
}
export function getStat(c, key) { return Math.max(1, Math.floor(c.base[key] * statMult(c, key))); }
export function hasStatus(c, type) { return c.statuses.some((s) => s.type === type); }
function addStatus(c, type, turns) {
  const ex = c.statuses.find((s) => s.type === type);
  if (ex) ex.turns = Math.max(ex.turns, turns);
  else c.statuses.push({ type, turns });
}

/* ---- ダメージ計算 ---- */
export function computeDamage(attacker, defender, skill) {
  const atk = getStat(attacker, "atk");
  const def = getStat(defender, "def");
  const mult = elementMult(skill.element, defender.element);
  const crit = Math.random() < BATTLE.critChance;
  const variance = BATTLE.varianceMin + Math.random() * (BATTLE.varianceMax - BATTLE.varianceMin);
  let dmg = skill.power * (atk / def) * mult * (crit ? BATTLE.critMult : 1) * variance;
  if (defender._defending) dmg *= BATTLE.defendMult;
  dmg = Math.max(1, Math.floor(dmg));
  return { dmg, crit, mult };
}

/* ---- 技の実行（イベント配列を返す。UI が演出に使う） ---- */
export function performSkill(actor, skill, primaryTarget, opposing) {
  const events = [];
  actor.sp = Math.max(0, actor.sp - (skill.spCost || 0));
  const isSupport = skill.power <= 0;

  if (isSupport) {
    if (skill.effect === "heal") {
      const amt = Math.floor(getStat(actor, "atk") * 1.2 + 20);
      actor.hp = Math.min(actor.maxHp, actor.hp + amt);
      events.push({ type: "heal", target: actor, amt });
    } else if (skill.effect.startsWith("buff")) {
      addStatus(actor, skill.effect, 3);
      events.push({ type: "buff", target: actor, effect: skill.effect });
    } else if (skill.effect.startsWith("debuff") || skill.effect === "poison") {
      if (primaryTarget && primaryTarget.alive) {
        addStatus(primaryTarget, skill.effect, 3);
        events.push({ type: "status", target: primaryTarget, effect: skill.effect });
      }
    }
    return events;
  }

  // ダメージ技（none / aoe / drain ＋ 付随 debuff/poison）
  const targets = skill.effect === "aoe" ? opposing.filter((c) => c.alive) : [primaryTarget];
  let total = 0;
  for (const t of targets) {
    if (!t || !t.alive) continue;
    const { dmg, crit, mult } = computeDamage(actor, t, skill);
    t.hp = Math.max(0, t.hp - dmg);
    total += dmg;
    if (t.hp === 0) t.alive = false;
    events.push({ type: "damage", target: t, dmg, crit, mult });
    if (t.alive && (skill.effect.startsWith("debuff") || skill.effect === "poison")) {
      addStatus(t, skill.effect, 3);
      events.push({ type: "status", target: t, effect: skill.effect });
    }
  }
  if (skill.effect === "drain" && total > 0) {
    const heal = Math.floor(total * 0.5);
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    events.push({ type: "heal", target: actor, amt: heal });
  }
  return events;
}

/* ---- ラウンド終了時の状態異常処理（毒ダメージ・持続減算） ---- */
export function tickStatuses(all) {
  const events = [];
  for (const c of all) {
    if (!c.alive) continue;
    for (const st of c.statuses) {
      if (st.type === "poison") {
        const dmg = Math.max(1, Math.floor(c.maxHp * BATTLE.poisonFrac));
        c.hp = Math.max(0, c.hp - dmg);
        if (c.hp === 0) c.alive = false;
        events.push({ type: "poison", target: c, dmg });
      }
    }
    c.statuses.forEach((s) => s.turns--);
    c.statuses = c.statuses.filter((s) => s.turns > 0);
  }
  return events;
}

/* ---- 敵 AI ---- */
export function aiChoose(enemy, allies) {
  const alive = allies.filter((a) => a.alive);
  if (!alive.length) return null;
  const target = Math.random() < 0.4
    ? alive.reduce((a, b) => (a.hp <= b.hp ? a : b))
    : alive[Math.floor(Math.random() * alive.length)];
  const affordable = enemy.skills.filter((sk) => !sk.basic && enemy.sp >= sk.spCost);
  let skill;
  if (affordable.length && Math.random() < 0.7) skill = affordable[Math.floor(Math.random() * affordable.length)];
  else skill = enemy.skills[0];
  return { skill, target };
}

/* ---- ターン順（SPD 降順・毎ラウンド再計算） ---- */
export function turnOrder(all) {
  return all.filter((c) => c.alive).slice().sort((a, b) => getStat(b, "spd") - getStat(a, "spd"));
}

/* ---- ステージ ---- */
export function stageByIndex(i) { return STAGES[i]; }
export function stageUnlocked(i) {
  if (i === 0) return true;
  const prev = STAGES[i - 1];
  return getState().battle.cleared.includes(prev.id);
}

/* ============================================================
   勝利報酬（ループの閉じ）
   ============================================================ */
export function applyBattleRewards(stage, survivorUids) {
  const s = getState();
  const out = { exp: [], coin: 0, drops: [], firstClear: false, captured: null };

  // exp（→レベルアップ）＋ affection
  for (const u of survivorUids) {
    const inst = s.yokai.find((y) => y.uid === u);
    if (!inst) continue;
    const levels = addExp(inst, stage.rewards.expBase);
    gainAffection(inst, 3);
    out.exp.push({ name: speciesById(inst.speciesId).name, gained: stage.rewards.expBase, levels, level: inst.level });
  }

  // coin（初クリアボーナス）
  let coin = stage.rewards.coin;
  const first = !s.battle.cleared.includes(stage.id);
  if (first) { coin += stage.firstClearBonus || 0; out.firstClear = true; s.battle.cleared.push(stage.id); }
  addCoin(coin);
  out.coin = coin;

  // ドロップ（装備）
  for (const d of (stage.rewards.dropTable || [])) {
    if (Math.random() < d.rate) {
      const m = MASTER.find((x) => x.id === d.itemId);
      if (!m) continue;
      const bucket = m.type === "weapon" ? s.inventory.weapons : s.inventory.costumes;
      bucket.push({ uid: genUid("it"), itemId: m.id });
      s.zukan.items[m.id] = true;
      out.drops.push(m);
    }
  }

  // 最高到達ステージ
  const idx = STAGES.findIndex((x) => x.id === stage.id) + 1;
  if (idx > (s.battle.highestStage | 0)) s.battle.highestStage = idx;

  // ボス封印（仲間化＋図鑑）
  if (stage.bossCaptureSpeciesId) {
    const spId = stage.bossCaptureSpeciesId;
    s.yokai.push({ uid: genUid("yk"), speciesId: spId, level: 1, exp: 0, affection: 0, maxLevel: GAME.baseMaxLevel, equip: { weaponUid: null, costumeUid: null } });
    s.zukan.yokai[spId] = true;
    out.captured = speciesById(spId);
  }

  saveSave();
  return out;
}

/* ============================================================
   敵の描画（SVG・属性色）
   ============================================================ */
function shade(hex) {
  if (!hex.startsWith("#")) return hex;
  const n = hex.replace("#", "");
  const r = Math.max(0, parseInt(n.slice(0, 2), 16) - 70);
  const g = Math.max(0, parseInt(n.slice(2, 4), 16) - 70);
  const b = Math.max(0, parseInt(n.slice(4, 6), 16) - 70);
  return `rgb(${r},${g},${b})`;
}
const ev = (a, b, y) => `<circle cx="${a}" cy="${y}" r="4" fill="#1a1024"/><circle cx="${b}" cy="${y}" r="4" fill="#1a1024"/>`;
function buildEnemyArt(e) {
  const c = elementColor(e.element);
  const forms = {
    onibi: () => `<circle cx="60" cy="62" r="22" fill="${c}" opacity=".9"/><circle cx="60" cy="62" r="34" fill="${c}" opacity=".25"/>
      <path d="M44 70 q16 18 32 0 q-4 26 -16 30 q-12 -4 -16 -30Z" fill="${c}" opacity=".7"/>${ev(53, 67, 58)}`,
    kappa: () => `<ellipse cx="60" cy="66" rx="30" ry="30" fill="url(#ge)"/><ellipse cx="60" cy="48" rx="20" ry="10" fill="${shade(c)}"/>
      <circle cx="60" cy="46" r="9" fill="#cdebff"/>${ev(50, 70, 64)}<path d="M50 78 q10 6 20 0" stroke="#1a1024" stroke-width="2" fill="none"/>`,
    kodama: () => `<circle cx="60" cy="64" r="30" fill="url(#ge)"/><circle cx="48" cy="58" r="9" fill="#0c0814"/><circle cx="72" cy="58" r="9" fill="#0c0814"/>
      <ellipse cx="60" cy="78" rx="7" ry="9" fill="#0c0814"/>`,
    kamaitachi: () => `<ellipse cx="60" cy="64" rx="28" ry="24" fill="url(#ge)"/><polygon points="40,46 32,24 54,42" fill="${shade(c)}"/><polygon points="80,46 88,24 66,42" fill="${shade(c)}"/>
      <path d="M84 70 l22 -8 M84 78 l22 4" stroke="${shade(c)}" stroke-width="4" stroke-linecap="round"/>${ev(50, 70, 62)}`,
    gashadokuro: () => `<ellipse cx="60" cy="58" rx="28" ry="30" fill="#e8e2d0"/><circle cx="49" cy="56" r="8" fill="#1a1024"/><circle cx="71" cy="56" r="8" fill="#1a1024"/>
      <polygon points="56,68 64,68 60,76" fill="#1a1024"/><path d="M46 84 h28 M50 84 v8 M58 84 v9 M66 84 v8" stroke="#1a1024" stroke-width="2"/>`,
    cat: () => `<circle cx="60" cy="66" r="30" fill="url(#ge)"/><polygon points="38,46 32,24 54,42" fill="${shade(c)}"/><polygon points="82,46 88,24 66,42" fill="${shade(c)}"/>
      ${ev(50, 70, 62)}<polygon points="57,72 63,72 60,77" fill="#d88aa0"/>`,
    chimera: () => `<ellipse cx="60" cy="64" rx="32" ry="28" fill="url(#ge)"/><path d="M86 82 q20 6 22 26 q-10 -8 -24 -14" fill="${shade(c)}"/>
      ${ev(50, 70, 60)}<path d="M48 76 q12 8 24 0" stroke="#1a1024" stroke-width="2.5" fill="none"/><polygon points="50,76 54,84 58,76" fill="#fff"/><polygon points="62,76 66,84 70,76" fill="#fff"/>`,
  };
  const inner = (forms[e.art] || forms.onibi)();
  return `<svg viewBox="0 0 120 120" class="yk-svg"><defs><radialGradient id="ge" cx="42%" cy="35%" r="70%">
    <stop offset="0%" stop-color="#fff" stop-opacity=".2"/><stop offset="55%" stop-color="${c}"/><stop offset="100%" stop-color="${shade(c)}"/></radialGradient></defs>${inner}</svg>`;
}
