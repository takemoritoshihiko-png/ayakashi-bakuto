/* ============================================================
   screens/battle.js — ターン制戦闘（ステージ選択 / バトル / 結果）
   ============================================================ */
import { getState } from "../state.js";
import { STAGES, ENEMIES, BATTLE, ELEMENTS } from "../config/index.js";
import { speciesById, elementColor, buildYokaiArt } from "../game/yokai.js";
import {
  makeAlly, makeEnemy, turnOrder, getStat, performSkill, computeDamage,
  aiChoose, tickStatuses, elementMult, stageUnlocked, applyBattleRewards, hasStatus,
} from "../game/battle.js";
import { toast } from "../ui/shell.js";
import Sfx from "../ui/sfx.js";

let _root = null, _ctx = null, _view = "select";
let _timers = [], _alive = true;
let B = null;   // 戦闘ランタイム

const wait = (ms, fn) => { const id = setTimeout(() => { if (_alive) fn(); }, ms); _timers.push(id); return id; };
const clearTimers = () => { _timers.forEach((t) => clearTimeout(t)); _timers = []; };

export const battleScreen = {
  mount(root, ctx) { _root = root; _ctx = ctx; _alive = true; _timers = []; _view = "select"; renderSelect(); },
  unmount() { _alive = false; clearTimers(); B = null; _root = null; },
};
export default battleScreen;

function fmt(n) { try { return Math.floor(n).toLocaleString("ja-JP"); } catch (e) { return String(n | 0); } }

/* ===================== ステージ選択 ===================== */
function renderSelect() {
  const s = getState();
  const rows = STAGES.map((st, i) => {
    const unlocked = stageUnlocked(i);
    const cleared = s.battle.cleared.includes(st.id);
    const enemies = st.enemyTeam.map((id) => ENEMIES[id].name).join("・");
    return `<button class="stage-row ${unlocked ? "" : "locked"} ${st.isBoss ? "boss" : ""}" data-stage="${i}" ${unlocked ? "" : "disabled"}>
      <div class="sr-main">
        <div class="sr-name">${st.isBoss ? "👹 " : ""}${st.name}${cleared ? ' <span class="sr-clear">✓</span>' : ""}</div>
        <div class="sr-foe">${unlocked ? enemies : "🔒 前のステージをクリアで解放"}</div>
      </div>
      <div class="sr-reward">◉${fmt(st.rewards.coin)}${st.bossCaptureSpeciesId ? "<br>封印あり" : ""}</div>
    </button>`;
  }).join("");

  _root.innerHTML = `
    <section class="screen battle-select">
      <div class="yk-top">
        <button class="btn-ghost" id="bBack">← 戻る</button>
        <span class="bs-party">編成 ${s.party.length}/3</span>
      </div>
      <h2 class="yk-title">⚔️ 戦闘</h2>
      ${s.party.length === 0 ? `<p class="party-note">先に「妖怪」で編成してください。</p>` : ""}
      <div class="stage-list">${rows}</div>
    </section>`;

  _root.querySelector("#bBack").addEventListener("click", () => _ctx.go("home"));
  _root.querySelectorAll("[data-stage]").forEach((b) =>
    b.addEventListener("click", () => startBattle(Number(b.dataset.stage))));
}

/* ===================== バトル開始 ===================== */
function startBattle(stageIdx) {
  const s = getState();
  if (s.party.length === 0) { toast("編成が空です", "warn"); _ctx.go("yokai"); return; }
  Sfx.ensure();
  const stage = STAGES[stageIdx];
  const allies = s.party.map((u) => s.yokai.find((y) => y.uid === u)).filter(Boolean).map(makeAlly);
  const enemies = stage.enemyTeam.map(makeEnemy);
  B = { stage, stageIdx, allies, enemies, all: [...allies, ...enemies], order: [], qi: 0, round: 0, dom: new Map(), awaiting: false, ended: false };
  _view = "battle";
  buildScene();
  newRound();
}

/* ===================== シーン構築（カードは作り直さず更新） ===================== */
function buildScene() {
  _root.innerHTML = `
    <section class="screen battle">
      <div class="bt-enemies" id="btEnemies"></div>
      <div class="bt-log" id="btLog"></div>
      <div class="bt-allies" id="btAllies"></div>
      <div class="bt-cmd" id="btCmd"></div>
    </section>`;
  const eWrap = _root.querySelector("#btEnemies");
  const aWrap = _root.querySelector("#btAllies");
  B.dom.clear();
  B.enemies.forEach((c) => eWrap.appendChild(makeCard(c, true)));
  B.allies.forEach((c) => aWrap.appendChild(makeCard(c, false)));
}

function makeCard(c, isEnemy) {
  const el = document.createElement("div");
  el.className = "bt-card " + (isEnemy ? "foe" : "ally") + (c.isBoss ? " boss" : "");
  el.style.setProperty("--ec", c.color);
  el.innerHTML = `
    <div class="bt-art">${c.artHtml}</div>
    <div class="bt-name">${c.name} <span class="bt-el">${c.element}</span></div>
    <div class="bar bt-hp"><div class="bar-fill" ></div></div>
    <div class="bt-hptext"></div>
    ${isEnemy ? "" : `<div class="bar bt-sp"><div class="bar-fill"></div></div><div class="bt-sptext"></div>`}
    <div class="bt-status"></div>
    <div class="bt-pop"></div>`;
  const ref = {
    el,
    hpFill: el.querySelector(".bt-hp .bar-fill"),
    hpText: el.querySelector(".bt-hptext"),
    spFill: el.querySelector(".bt-sp .bar-fill"),
    spText: el.querySelector(".bt-sptext"),
    status: el.querySelector(".bt-status"),
    pop: el.querySelector(".bt-pop"),
  };
  B.dom.set(c, ref);
  el.addEventListener("click", () => onCardClick(c));
  updateCard(c);
  return el;
}

function updateCard(c) {
  const d = B.dom.get(c); if (!d) return;
  d.hpFill.style.width = Math.max(0, (c.hp / c.maxHp) * 100) + "%";
  d.hpText.textContent = `${Math.max(0, c.hp)}/${c.maxHp}`;
  if (d.spFill) { d.spFill.style.width = (c.sp / c.maxSp) * 100 + "%"; d.spText.textContent = `SP ${c.sp}`; }
  d.status.textContent = c.statuses.map((s) => statusIcon(s.type)).join("");
  d.el.classList.toggle("dead", !c.alive);
  d.el.classList.toggle("defending", !!c._defending);
}
function statusIcon(t) {
  return { poison: "☠", buff_atk: "▲攻", buff_def: "▲防", buff_spd: "▲速", debuff_atk: "▼攻", debuff_def: "▼防", debuff_spd: "▼速", paralyze: "⚡" }[t] || "•";
}

/* ===================== ログ ===================== */
function log(msg) {
  const el = _root && _root.querySelector("#btLog");
  if (!el) return;
  el.textContent = msg;
}

/* ===================== ラウンド/ターン進行 ===================== */
function newRound() {
  if (B.ended) return;
  B.round++;
  B.order = turnOrder(B.all);
  B.qi = 0;
  processNext();
}

function processNext() {
  if (B.ended) return;
  if (checkEnd()) return;
  if (B.qi >= B.order.length) {
    // ラウンド終了 → 状態異常処理
    const events = tickStatuses(B.all);
    events.forEach((e) => { popDamage(e.target, e.dmg, false, "poison"); updateCard(e.target); });
    if (checkEnd()) return;
    return wait(events.length ? 650 : 60, newRound);
  }
  const actor = B.order[B.qi];
  if (!actor || !actor.alive) { B.qi++; return processNext(); }

  actor._defending = false;
  actor.sp = Math.min(actor.maxSp, actor.sp + BATTLE.spRegen);
  updateCard(actor);

  // 麻痺
  if (hasStatus(actor, "paralyze") && Math.random() < BATTLE.paralyzeSkip) {
    log(`${actor.name} は痺れて動けない！`);
    return wait(700, () => { B.qi++; processNext(); });
  }

  if (actor.side === "ally") {
    B.awaiting = true;
    highlightActor(actor);
    renderCommand(actor);
  } else {
    enemyAct(actor);
  }
}

function highlightActor(actor) {
  B.all.forEach((c) => { const d = B.dom.get(c); if (d) d.el.classList.toggle("acting", c === actor); });
}

/* ===================== プレイヤー指令 ===================== */
let _pending = null;   // { actor, skill }（対象選択待ち）
function renderCommand(actor) {
  const cmd = _root.querySelector("#btCmd");
  const skillBtns = actor.skills.map((sk, i) => {
    if (sk.basic) return "";
    const dis = actor.sp < sk.spCost;
    return `<button class="cmd-skill" data-skill="${i}" ${dis ? "disabled" : ""}>${sk.name}<small>SP${sk.spCost}・${sk.power > 0 ? "威" + sk.power : effShort(sk.effect)}</small></button>`;
  }).join("");
  cmd.innerHTML = `
    <div class="cmd-actor">${actor.name} のターン</div>
    <div class="cmd-row">
      <button class="cmd-btn" data-act="attack">攻撃</button>
      <button class="cmd-btn" data-act="defend">防御</button>
    </div>
    <div class="cmd-skills">${skillBtns || '<span class="cmd-none">技なし</span>'}</div>`;
  cmd.querySelector('[data-act="attack"]').addEventListener("click", () => beginTargeting(actor, actor.skills[0]));
  cmd.querySelector('[data-act="defend"]').addEventListener("click", () => doDefend(actor));
  cmd.querySelectorAll("[data-skill]").forEach((b) =>
    b.addEventListener("click", () => beginTargeting(actor, actor.skills[Number(b.dataset.skill)])));
}
function effShort(e) { return { buff_atk: "攻↑", buff_def: "防↑", buff_spd: "速↑", debuff_atk: "敵攻↓", debuff_def: "敵防↓", debuff_spd: "敵速↓", heal: "回復", aoe: "全体", drain: "吸収", poison: "毒" }[e] || "—"; }

function beginTargeting(actor, skill) {
  // 自己/味方対象（heal/buff）は即実行
  if (skill.effect === "heal" || skill.effect.startsWith("buff")) {
    return resolveAction(actor, skill, actor);
  }
  if (skill.effect === "aoe") {
    return resolveAction(actor, skill, B.enemies.find((e) => e.alive));
  }
  // 敵単体選択
  _pending = { actor, skill };
  const cmd = _root.querySelector("#btCmd");
  cmd.innerHTML = `<div class="cmd-actor">対象を選べ（${skill.name}）</div><div class="cmd-hint" id="cmdHint"></div><button class="cmd-btn" id="cmdCancel">やめる</button>`;
  cmd.querySelector("#cmdCancel").addEventListener("click", () => { _pending = null; renderCommand(actor); B.enemies.forEach(clearTargetable); });
  // 相性ヒント表示＋対象クリック可能化
  B.enemies.forEach((e) => {
    if (!e.alive) return;
    const d = B.dom.get(e); if (!d) return;
    d.el.classList.add("targetable");
    const m = elementMult(skill.element, e.element);
    d.el.classList.toggle("weakpoint", m > 1);
    d.el.classList.toggle("resist", m < 1);
  });
}
function clearTargetable(e) { const d = B.dom.get(e); if (d) d.el.classList.remove("targetable", "weakpoint", "resist"); }

function onCardClick(c) {
  if (!_pending || c.side !== "enemy" || !c.alive) return;
  const { actor, skill } = _pending;
  _pending = null;
  B.enemies.forEach(clearTargetable);
  resolveAction(actor, skill, c);
}

function doDefend(actor) {
  actor._defending = true;
  actor.sp = Math.min(actor.maxSp, actor.sp + 10);
  log(`${actor.name} は防御の構え。`);
  updateCard(actor);
  endActorTurn();
}

/* ===================== 行動解決 ===================== */
function resolveAction(actor, skill, target) {
  B.awaiting = false;
  clearCmd();
  const opposing = actor.side === "ally" ? B.enemies : B.allies;
  const events = performSkill(actor, skill, target, opposing);
  log(`${actor.name} の ${skill.name}！`);
  updateCard(actor);
  animateEvents(events, () => { updateAll(); endActorTurn(); });
}

function enemyAct(actor) {
  const choice = aiChoose(actor, B.allies);
  if (!choice) return endActorTurn();
  highlightActor(actor);
  wait(500, () => {
    const events = performSkill(actor, choice.skill, choice.target, B.allies);
    log(`${actor.name} の ${choice.skill.name}！`);
    updateCard(actor);
    animateEvents(events, () => { updateAll(); endActorTurn(); });
  });
}

function endActorTurn() {
  highlightActor(null);
  if (checkEnd()) return;
  wait(420, () => { B.qi++; processNext(); });
}

function clearCmd() { const cmd = _root && _root.querySelector("#btCmd"); if (cmd) cmd.innerHTML = ""; }
function updateAll() { B.all.forEach(updateCard); }

/* ===================== 演出 ===================== */
function animateEvents(events, done) {
  let i = 0;
  const step = () => {
    if (!_alive) return;
    if (i >= events.length) return done();
    const e = events[i++];
    const d = B.dom.get(e.target);
    if (e.type === "damage") {
      popDamage(e.target, e.dmg, e.crit, e.mult > 1 ? "weak" : e.mult < 1 ? "resist" : "");
      if (d) { flash(d.el); shake(d.el); }
      if (e.mult > 1) { log("効果抜群！"); Sfx.fanfare(false); }
      else if (e.crit) Sfx.fanfare(false);
      else Sfx.blip(0);
    } else if (e.type === "heal") {
      popDamage(e.target, "+" + e.amt, false, "heal"); Sfx.blip(6);
    } else if (e.type === "buff" || e.type === "status") {
      if (d) flash(d.el); Sfx.blip(3);
    } else if (e.type === "poison") {
      popDamage(e.target, e.dmg, false, "poison");
    }
    if (e.target) updateCard(e.target);
    if (e.target && !e.target.alive) { const dd = B.dom.get(e.target); if (dd) dd.el.classList.add("dead"); }
    wait(360, step);
  };
  step();
}
function popDamage(c, val, crit, cls) {
  const d = B.dom.get(c); if (!d) return;
  const p = document.createElement("div");
  p.className = "dmg-pop " + (cls || "") + (crit ? " crit" : "");
  p.textContent = (crit ? "会心! " : "") + val;
  d.pop.appendChild(p);
  wait(900, () => p.remove());
}
function flash(el) { el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); }
function shake(el) { el.classList.remove("shk"); void el.offsetWidth; el.classList.add("shk"); }

/* ===================== 勝敗 ===================== */
function checkEnd() {
  if (B.ended) return true;
  const foesDead = B.enemies.every((e) => !e.alive);
  const alliesDead = B.allies.every((a) => !a.alive);
  if (foesDead) { B.ended = true; wait(700, onWin); return true; }
  if (alliesDead) { B.ended = true; wait(700, onLose); return true; }
  return false;
}

function onWin() {
  const survivors = B.allies.filter((a) => a.alive).map((a) => a.refUid);
  const rewards = applyBattleRewards(B.stage, survivors);
  renderResult(rewards);
}
function onLose() {
  _root.querySelector("#btCmd").innerHTML = `
    <div class="result lose">
      <h3>敗北…</h3>
      <p>妖どもに退けられた。次は編成と育成を見直そう。</p>
      <button class="reveal-close" id="loseHome">ホームへ</button>
    </div>`;
  _root.querySelector("#loseHome").addEventListener("click", () => _ctx.go("home"));
}

function renderResult(r) {
  Sfx.fanfare(true);
  const expRows = r.exp.map((e) => `<div class="res-row">${e.name}：EXP +${e.gained}${e.levels > 0 ? ` ／ <b>Lv${e.level}</b>に上昇！` : ""}</div>`).join("");
  const drops = r.drops.length ? r.drops.map((d) => `<span class="res-drop">${d.name}</span>`).join("") : "なし";
  const capture = r.captured
    ? `<div class="res-capture"><div class="rc-seal">封 印</div><div class="rc-name">${r.captured.name} を仲間にした！</div><div class="rc-art">${buildCaptureArt(r.captured)}</div></div>`
    : "";
  const cmd = _root.querySelector("#btCmd");
  cmd.innerHTML = `
    <div class="result win">
      <h3>勝利！${r.firstClear ? " <span class='res-first'>初クリア</span>" : ""}</h3>
      ${capture}
      <div class="res-rewards">
        <div class="res-row gold">獲得コイン ◉ +${fmt(r.coin)}</div>
        ${expRows}
        <div class="res-row">ドロップ：${drops}</div>
      </div>
      <button class="reveal-close" id="winNext">戻る</button>
    </div>`;
  if (r.captured) Sfx.mythic();
  cmd.querySelector("#winNext").addEventListener("click", () => { _view = "select"; renderSelect(); });
}
function buildCaptureArt(species) {
  // 封印された妖を species の素体で描画
  return `<div style="width:80px;height:80px;margin:6px auto;">${buildYokaiArt({ speciesId: species.speciesId, level: 1, affection: 0, equip: { weaponUid: null, costumeUid: null } })}</div>`;
}
