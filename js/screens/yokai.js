/* ============================================================
   screens/yokai.js — 妖怪（一覧 / 詳細 / 編成）
   実効ステ表示・修行・装備着せ替え・愛情度・編成。
   ============================================================ */
import { getState, getCoin } from "../state.js";
import { RARITY, ELEMENTS, GAME, MASTER } from "../config/index.js";
import {
  speciesById, getEffectiveStats, skillsOf, expToNext, train, trainCost,
  equip, resolveEquip, affectionStage, affectionStageName, unlockedVoices,
  unlockedLore, inParty, toggleParty, buildYokaiArt, itemMaster, elementColor,
} from "../game/yokai.js";
import { toast } from "../ui/shell.js";
import Sfx from "../ui/sfx.js";

let _root = null, _ctx = null, _view = "list";

export const yokaiScreen = {
  mount(root, ctx) { _root = root; _ctx = ctx; _view = "list"; render(); },
  unmount() { _root = null; },
};
export default yokaiScreen;

function fmt(n) { try { return Math.floor(n).toLocaleString("ja-JP"); } catch (e) { return String(n | 0); } }
function rarityRank(r) { return RARITY[r].rank; }

function render() {
  if (!_root) return;
  if (_view === "list") return renderList();
  if (_view === "party") return renderParty();
  if (_view.startsWith("detail:")) return renderDetail(_view.slice(7));
  renderList();
}

/* ===================== 一覧 ===================== */
function renderList() {
  const s = getState();
  const list = s.yokai.slice().sort((a, b) => {
    const ra = rarityRank(speciesById(a.speciesId).rarity);
    const rb = rarityRank(speciesById(b.speciesId).rarity);
    if (rb !== ra) return rb - ra;
    return speciesById(a.speciesId).element.localeCompare(speciesById(b.speciesId).element);
  });

  _root.innerHTML = `
    <section class="screen yk">
      <div class="yk-top">
        <button class="btn-ghost" id="ykBack">← 戻る</button>
        <button class="btn-ghost" id="ykParty">編成（${s.party.length}/${GAME.partySize}）</button>
      </div>
      <h2 class="yk-title">妖怪</h2>
      ${list.length === 0 ? emptyState() : `<div class="yk-grid">${list.map(card).join("")}</div>`}
    </section>`;

  _root.querySelector("#ykBack").addEventListener("click", () => _ctx.go("home"));
  _root.querySelector("#ykParty").addEventListener("click", () => { _view = "party"; render(); });
  const toG = _root.querySelector("#ykToGacha");
  if (toG) toG.addEventListener("click", () => _ctx.go("gacha"));
  _root.querySelectorAll("[data-uid]").forEach((el) =>
    el.addEventListener("click", () => { _view = "detail:" + el.dataset.uid; render(); }));
}

function emptyState() {
  return `<div class="yk-empty">
    <p>まだ妖怪がいない。</p>
    <button class="ent-enter" id="ykToGacha">⛩️ ガチャで招喚する</button>
  </div>`;
}

function card(inst) {
  const sp = speciesById(inst.speciesId);
  const R = RARITY[sp.rarity];
  const eff = getEffectiveStats(inst);
  return `<button class="yk-card" data-uid="${inst.uid}" style="--rc:${R.color};--ec:${elementColor(sp.element)}">
    <div class="ykc-art">${buildYokaiArt(inst)}</div>
    <div class="ykc-name">${sp.name}</div>
    <div class="ykc-meta"><span class="ykc-el">${sp.element}</span><span class="ykc-lv">Lv${inst.level}</span></div>
    <div class="ykc-rar">${R.name}</div>
    ${inParty(inst.uid) ? `<span class="ykc-party">出撃中</span>` : ""}
  </button>`;
}

/* ===================== 詳細 ===================== */
function renderDetail(uid) {
  const s = getState();
  const inst = s.yokai.find((y) => y.uid === uid);
  if (!inst) { _view = "list"; return render(); }
  const sp = speciesById(inst.speciesId);
  const R = RARITY[sp.rarity];
  const eff = getEffectiveStats(inst);
  const { weaponItem, costumeItem } = resolveEquip(inst);
  const coin = getCoin();
  const needExp = expToNext(inst.level);
  const expPct = inst.level >= inst.maxLevel ? 100 : Math.min(100, (inst.exp / needExp) * 100);
  const stage = affectionStage(inst.affection);
  const affPct = (inst.affection / GAME.affection.max) * 100;

  const statRow = (k, label) => `<div class="st-row"><span class="st-k">${label}</span><span class="st-v">${eff[k]}</span></div>`;
  const skillRows = skillsOf(inst).map((sk) => `
    <div class="sk-row" style="--ec:${elementColor(sk.element)}">
      <span class="sk-el">${sk.element}</span>
      <span class="sk-name">${sk.name}</span>
      <span class="sk-pow">${sk.power > 0 ? "威力 " + sk.power : effLabel(sk.effect)}</span>
    </div>`).join("");

  const trainBtns = GAME.train.map((t) => {
    const cost = trainCost(inst, t);
    const dis = coin < cost || inst.level >= inst.maxLevel;
    return `<button class="train-btn" data-train="${t.id}" ${dis ? "disabled" : ""}>${t.label}<small>◉ ${fmt(cost)}</small></button>`;
  }).join("");

  _root.innerHTML = `
    <section class="screen yk-detail" style="--rc:${R.color};--ec:${elementColor(sp.element)}">
      <div class="yk-top">
        <button class="btn-ghost" id="dBack">← 一覧</button>
        <button class="btn-ghost ${inParty(inst.uid) ? "on" : ""}" id="dParty">${inParty(inst.uid) ? "出撃中" : "出撃させる"}</button>
      </div>

      <div class="d-hero">
        <div class="d-art">${buildYokaiArt(inst)}</div>
        <div class="d-head">
          <div class="d-name">${sp.name}</div>
          <div class="d-tags"><span class="d-rar">${R.name}</span><span class="d-el">${sp.element}属性</span></div>
          <div class="d-lv">Lv <b>${inst.level}</b> / ${inst.maxLevel}</div>
          <div class="bar exp"><div class="bar-fill" style="width:${expPct}%"></div></div>
          <div class="bar-cap">EXP ${inst.level >= inst.maxLevel ? "MAX" : inst.exp + " / " + needExp}</div>
        </div>
      </div>

      <div class="d-affection">
        <div class="aff-head">愛情度 <b>${inst.affection}</b> ／ ${affectionStageName(inst.affection)}（段階${stage}）
          <button class="voice-btn" id="dVoice">声をきく</button></div>
        <div class="bar aff"><div class="bar-fill" style="width:${affPct}%"></div></div>
        <div class="aff-voice" id="affVoice"></div>
      </div>

      <div class="d-stats">
        ${statRow("hp", "HP")}${statRow("atk", "攻")}${statRow("def", "防")}${statRow("spd", "速")}
        <div class="st-note">実効値 ＝ 基礎×成長(Lv) ＋ 装備 ＋ 愛情(+${Math.floor(inst.affection * GAME.affection.statPer)})</div>
      </div>

      <div class="d-equip">
        <div class="eq-slot" data-slot="weapon">
          <span class="eq-label">武器</span>
          <span class="eq-name">${weaponItem ? weaponItem.name : "なし"}</span>
          <span class="eq-mods">${weaponItem ? modStr(weaponItem.statMods) : ""}</span>
          <button class="eq-btn" data-open="weapon">変更</button>
        </div>
        <div class="eq-slot" data-slot="costume">
          <span class="eq-label">衣装</span>
          <span class="eq-name">${costumeItem ? costumeItem.name : "なし"}</span>
          <span class="eq-mods">${costumeItem ? modStr(costumeItem.statMods) : ""}</span>
          <button class="eq-btn" data-open="costume">変更</button>
        </div>
      </div>

      <div class="d-skills"><div class="d-subhead">技</div>${skillRows}</div>

      <div class="d-lore"><div class="d-subhead">図鑑</div>${unlockedLore(inst).map((l) => `<p>${l}</p>`).join("")}</div>

      <div class="d-train">${trainBtns}</div>

      <div class="eq-picker hidden" id="eqPicker"></div>
    </section>`;

  _root.querySelector("#dBack").addEventListener("click", () => { _view = "list"; render(); });
  _root.querySelector("#dParty").addEventListener("click", () => {
    if (!toggleParty(inst.uid)) toast("編成は最大 " + GAME.partySize + " 体まで", "warn");
    render();
  });
  _root.querySelector("#dVoice").addEventListener("click", () => {
    const vs = unlockedVoices(inst);
    const line = vs[Math.floor(Math.random() * vs.length)] || "…";
    _root.querySelector("#affVoice").textContent = "「" + line + "」";
  });
  _root.querySelectorAll("[data-train]").forEach((b) => b.addEventListener("click", () => doTrain(inst, b.dataset.train)));
  _root.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openPicker(inst, b.dataset.open)));
}

function effLabel(effect) {
  return {
    buff_atk: "攻UP", buff_def: "防UP", buff_spd: "速UP",
    debuff_atk: "敵攻DOWN", debuff_def: "敵防DOWN", debuff_spd: "敵速DOWN",
    heal: "回復", aoe: "全体", drain: "吸収", none: "—",
  }[effect] || "—";
}
function modStr(mods) {
  if (!mods) return "";
  return Object.entries(mods).map(([k, v]) => `${({ hp: "HP", atk: "攻", def: "防", spd: "速" })[k]}+${v}`).join(" ");
}

function doTrain(inst, tierId) {
  Sfx.ensure();
  const r = train(inst, tierId);
  if (!r.ok) { toast(r.reason === "max" ? "もう限界レベルだ" : "coin が足りない", "warn"); return; }
  if (r.levels > 0) {
    Sfx.fanfare(false);
    toast(`Lv ${inst.level} に上がった！`);
    flashVoice(`「強くなった気がする…」`);
  } else {
    toast(`修行（EXP +${r.expGain}）`);
  }
  render();
}
function flashVoice(t) {
  const el = document.getElementById("affVoice");
  if (el) el.textContent = t;
}

/* ===================== 装備ピッカー ===================== */
function openPicker(inst, slot) {
  const s = getState();
  const bucket = slot === "weapon" ? s.inventory.weapons : s.inventory.costumes;
  const equippedUid = slot === "weapon" ? inst.equip.weaponUid : inst.equip.costumeUid;
  const picker = _root.querySelector("#eqPicker");

  const rows = bucket.map((it) => {
    const m = itemMaster(it.itemId);
    const R = RARITY[m.rarity];
    const onSelf = it.uid === equippedUid;
    const onOther = s.yokai.find((y) => y.uid !== inst.uid && (y.equip.weaponUid === it.uid || y.equip.costumeUid === it.uid));
    return `<button class="pick-row ${onSelf ? "sel" : ""}" data-pick="${it.uid}" style="--rc:${R.color}">
      <span class="pick-rar">${R.name}</span>
      <span class="pick-name">${m.name}</span>
      <span class="pick-mods">${modStr(m.statMods)}${m.affectionBonus ? " ♥+" + m.affectionBonus : ""}</span>
      ${onOther ? `<span class="pick-on">${speciesById(onOther.speciesId).name}が装備中</span>` : ""}
    </button>`;
  }).join("");

  picker.innerHTML = `
    <div class="pick-card">
      <div class="pick-head">${slot === "weapon" ? "武器" : "衣装"}を選ぶ</div>
      <div class="pick-list">
        ${bucket.length ? rows : `<div class="pick-empty">手持ちが無い（ガチャで入手）</div>`}
      </div>
      <div class="pick-foot">
        <button class="btn-ghost" id="pickUnequip">解除</button>
        <button class="btn-ghost" id="pickClose">閉じる</button>
      </div>
    </div>`;
  picker.classList.remove("hidden");

  picker.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
    equip(inst, slot, b.dataset.pick);
    picker.classList.add("hidden");
    render();   // 見た目・実効ステ即反映
  }));
  picker.querySelector("#pickUnequip").addEventListener("click", () => { equip(inst, slot, null); picker.classList.add("hidden"); render(); });
  picker.querySelector("#pickClose").addEventListener("click", () => picker.classList.add("hidden"));
  picker.addEventListener("click", (e) => { if (e.target === picker) picker.classList.add("hidden"); });
}

/* ===================== 編成 ===================== */
function renderParty() {
  const s = getState();
  const list = s.yokai.slice().sort((a, b) => rarityRank(speciesById(b.speciesId).rarity) - rarityRank(speciesById(a.speciesId).rarity));
  _root.innerHTML = `
    <section class="screen yk-party">
      <div class="yk-top"><button class="btn-ghost" id="pBack">← 一覧</button></div>
      <h2 class="yk-title">編成（${s.party.length}/${GAME.partySize}）</h2>
      <p class="party-note">出撃させる妖怪を選ぶ（最大 ${GAME.partySize} 体）。Phase E の戦闘で使用。</p>
      ${list.length === 0 ? `<div class="yk-empty"><p>妖怪がいない。</p></div>` :
        `<div class="yk-grid">${list.map(partyCard).join("")}</div>`}
    </section>`;
  _root.querySelector("#pBack").addEventListener("click", () => { _view = "list"; render(); });
  _root.querySelectorAll("[data-puid]").forEach((el) => el.addEventListener("click", () => {
    if (!toggleParty(el.dataset.puid)) toast("編成は最大 " + GAME.partySize + " 体まで", "warn");
    renderParty();
  }));
}
function partyCard(inst) {
  const sp = speciesById(inst.speciesId);
  const R = RARITY[sp.rarity];
  const on = inParty(inst.uid);
  return `<button class="yk-card ${on ? "psel" : ""}" data-puid="${inst.uid}" style="--rc:${R.color};--ec:${elementColor(sp.element)}">
    <div class="ykc-art">${buildYokaiArt(inst)}</div>
    <div class="ykc-name">${sp.name}</div>
    <div class="ykc-meta"><span class="ykc-el">${sp.element}</span><span class="ykc-lv">Lv${inst.level}</span></div>
    ${on ? `<span class="ykc-party">出撃中</span>` : ""}
  </button>`;
}
