/* ============================================================
   ui/devpanel.js — 開発者パネル（DEV_MODE 時のみ）
   資源付与/妖怪編集/レアリティ強制/ステージ解放/放置シミュレート/
   セーブ入出力 ＋ 簡易経済シミュレータ。
   DEV_MODE=false なら mountDevPanel が何もしない＝完全に消える。
   ============================================================ */
import { getState, saveSave, addCoin, addShard, getCoin, getShard, uid, loadSave } from "../state.js";
import {
  DEV_MODE, BALANCE, YOKAI_SPECIES, STAGES, FURNITURE, GACHA, RARITY, RARITY_ORDER, GAME,
} from "../config/index.js";
import { recomputeComfort, applyIdleAffection } from "../game/room.js";
import { coverage } from "../config/assets.js";

export function mountDevPanel(appRoot) {
  if (!DEV_MODE) return;   // ★公開時は完全に消える

  const btn = document.createElement("button");
  btn.id = "devFab";
  btn.textContent = "DEV";
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "devPanel";
  panel.className = "hidden";
  document.body.appendChild(panel);

  btn.addEventListener("click", () => { if (panel.classList.contains("hidden")) renderPanel(panel); panel.classList.toggle("hidden"); });
}

function num(el, def = 0) { const v = Number(el.value); return Number.isFinite(v) ? v : def; }
function fmt(n) { try { return Math.floor(n).toLocaleString("ja-JP"); } catch (e) { return String(n | 0); } }

function renderPanel(panel) {
  const s = getState();
  const speciesOpts = YOKAI_SPECIES.map((sp) => `<option value="${sp.speciesId}">${sp.name}(${sp.rarity})</option>`).join("");
  const yokaiOpts = s.yokai.map((y, i) => `<option value="${y.uid}">${speciesName(y.speciesId)} Lv${y.level} ♥${y.affection}</option>`).join("") || `<option value="">（なし）</option>`;
  const rarityOpts = `<option value="">強制なし</option>` + RARITY_ORDER.map((k) => `<option value="${k}">${RARITY[k].name}</option>`).join("");

  panel.innerHTML = `
    <div class="dev-head">開発者パネル <button id="devClose">×</button></div>
    <div class="dev-body">
      <div class="dev-sec">
        <b>資源</b> coin ${fmt(getCoin())} / shard ${fmt(getShard())}
        <div class="dev-row"><input id="dvCoin" type="number" value="10000"><button data-act="addcoin">coin付与</button>
          <input id="dvShard" type="number" value="500"><button data-act="addshard">shard付与</button></div>
      </div>

      <div class="dev-sec">
        <b>妖怪</b>
        <div class="dev-row"><select id="dvYokai">${yokaiOpts}</select></div>
        <div class="dev-row"><input id="dvLv" type="number" value="50"><button data-act="setlv">Lv設定</button>
          <input id="dvAff" type="number" value="100"><button data-act="setaff">愛情設定</button></div>
        <div class="dev-row"><select id="dvSpecies">${speciesOpts}</select><button data-act="grant">付与</button></div>
      </div>

      <div class="dev-sec">
        <b>ガチャ</b> レアリティ強制
        <div class="dev-row"><select id="dvForce">${rarityOpts}</select><button data-act="force">適用</button>
          <span id="dvForceNow">${globalThis.__AYAKASHI_FORCE_RARITY || "なし"}</span></div>
      </div>

      <div class="dev-sec">
        <b>ステージ</b> 解放/クリア
        <div class="dev-row"><input id="dvStage" type="number" value="${STAGES.length}" min="0" max="${STAGES.length}"><button data-act="clearstage">そこまでクリア扱い</button></div>
      </div>

      <div class="dev-sec">
        <b>放置シミュレート</b>
        <div class="dev-row"><input id="dvHours" type="number" value="12"><button data-act="idle">N時間放置を即適用</button></div>
        <div id="dvIdleOut" class="dev-out"></div>
      </div>

      <div class="dev-sec">
        <b>セーブ</b>
        <div class="dev-row"><button data-act="export">エクスポート</button><button data-act="import">インポート</button><button data-act="reset" class="danger">リセット</button></div>
        <textarea id="dvJson" placeholder="ここにJSONを貼ってインポート / エクスポートで出力"></textarea>
      </div>

      <div class="dev-sec sim">
        <b>経済シミュレータ（読取専用）</b>
        <div id="dvSim" class="dev-out"></div>
      </div>

      <div class="dev-sec">
        <b>アセットチェッカー</b>（画像カバレッジ／不足）
        <div id="dvAssets" class="dev-out"></div>
      </div>
    </div>`;

  panel.querySelector("#devClose").addEventListener("click", () => panel.classList.add("hidden"));
  panel.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => onAct(b.dataset.act, panel)));
  renderSim(panel.querySelector("#dvSim"));
  renderAssets(panel.querySelector("#dvAssets"));
}

function speciesName(id) { const sp = YOKAI_SPECIES.find((x) => x.speciesId === id); return sp ? sp.name : id; }

function onAct(act, panel) {
  const s = getState();
  if (act === "addcoin") { addCoin(num(panel.querySelector("#dvCoin"))); renderPanel(panel); }
  else if (act === "addshard") { addShard(num(panel.querySelector("#dvShard"))); renderPanel(panel); }
  else if (act === "setlv") {
    const y = s.yokai.find((x) => x.uid === panel.querySelector("#dvYokai").value);
    if (y) { y.level = Math.max(1, Math.min(y.maxLevel, num(panel.querySelector("#dvLv"), 1))); y.exp = 0; saveSave(); renderPanel(panel); }
  }
  else if (act === "setaff") {
    const y = s.yokai.find((x) => x.uid === panel.querySelector("#dvYokai").value);
    if (y) { y.affection = Math.max(0, Math.min(GAME.affection.max, num(panel.querySelector("#dvAff")))); saveSave(); renderPanel(panel); }
  }
  else if (act === "grant") {
    const spId = panel.querySelector("#dvSpecies").value;
    s.yokai.push({ uid: uid("yk"), speciesId: spId, level: 1, exp: 0, affection: 0, maxLevel: GAME.baseMaxLevel, equip: { weaponUid: null, costumeUid: null } });
    s.zukan.yokai[spId] = true; saveSave(); renderPanel(panel);
  }
  else if (act === "force") {
    const v = panel.querySelector("#dvForce").value;
    globalThis.__AYAKASHI_FORCE_RARITY = v || null;
    panel.querySelector("#dvForceNow").textContent = v || "なし";
  }
  else if (act === "clearstage") {
    const n = Math.max(0, Math.min(STAGES.length, num(panel.querySelector("#dvStage"))));
    s.battle.cleared = STAGES.slice(0, n).map((st) => st.id);
    s.battle.highestStage = n;
    saveSave(); renderPanel(panel);
  }
  else if (act === "idle") {
    const hours = num(panel.querySelector("#dvHours"), 0);
    recomputeComfort();
    const out = applyIdleAffection(Date.now() - hours * 3600000);
    panel.querySelector("#dvIdleOut").textContent = out
      ? `付与 +${out.per}（対象: ${out.names.join("・") || "なし"}）comfort=${getState().room.comfort}`
      : `付与なし（comfort=${getState().room.comfort} / 表示妖=${getState().room.displayed.length}）`;
  }
  else if (act === "export") {
    panel.querySelector("#dvJson").value = JSON.stringify(getState());
  }
  else if (act === "import") {
    try {
      const obj = JSON.parse(panel.querySelector("#dvJson").value);
      localStorage.setItem("ayakashi_save", JSON.stringify(obj));
      loadSave();
      location.reload();
    } catch (e) { alert("JSONが不正です"); }
  }
  else if (act === "reset") {
    if (confirm("セーブをリセットして再読込します")) { localStorage.removeItem("ayakashi_save"); location.reload(); }
  }
}

/* ============================================================
   経済シミュレータ — 勘を数字にする（読み取り専用）
   ============================================================ */
function renderAssets(el) {
  const cov = coverage();
  const totalHave = cov.reduce((a, c) => a + c.have, 0);
  const totalAll = cov.reduce((a, c) => a + c.total, 0);
  const rows = cov.map((c) => {
    const pct = c.total ? Math.round((c.have / c.total) * 100) : 0;
    const miss = c.missing.length ? `<div class="asset-miss">不足: ${c.missing.slice(0, 8).join(", ")}${c.missing.length > 8 ? " …他" + (c.missing.length - 8) : ""}</div>` : `<div class="asset-ok">✓ 完備</div>`;
    return `<div class="asset-row"><b>${c.label}</b> <span>${c.have}/${c.total}（${pct}%）</span>${miss}</div>`;
  }).join("");
  el.innerHTML = `<div class="asset-total">合計 ${totalHave}/${totalAll}（${totalAll ? Math.round(totalHave / totalAll * 100) : 0}%）</div>${rows}
    <div class="sim-note">assets/ に画像を置き、js/config/assets.js の AVAILABLE に登録すると反映されます。</div>`;
}

function gambleBalancedDepth(casino) {
  // 累積生存率が 50% を割る直前の深さで撤退する前提の概算
  const { bustStep, bustCap, mulBase } = BALANCE.gamble;
  let psurv = 1, mult = 1, best = { depth: 0, coinMul: 1, winP: 1 };
  for (let d = 1; d <= 40; d++) {
    const bust = Math.min(casino.bustBase + d * bustStep, bustCap);
    const ns = psurv * (1 - bust);
    const nm = mult * (mulBase + d * casino.mulStep);
    if (ns < 0.5) break;
    psurv = ns; mult = nm;
    best = { depth: d, coinMul: mult, winP: psurv };
  }
  return best;
}

function renderSim(el) {
  const bring = BALANCE.gamble.bring.presets[0];
  const kitsune = BALANCE.gamble.casinos.find((c) => c.id === "kitsune");
  const g = gambleBalancedDepth(kitsune);
  const expectedCoin = Math.round(bring * g.coinMul * g.winP);
  const netPerSession = expectedCoin - bring;

  const SESS_PER_HOUR = 30;             // 概算: 1セッション ≒ 2分
  const gambleIncomeHr = netPerSession * SESS_PER_HOUR;

  // 戦闘: 最終ステージ周回 coin（初回ボーナス除く）
  const lastStage = STAGES[STAGES.length - 1];
  const battlePerClear = lastStage.rewards.coin;

  // 修行: Lv10 で 1レベル上げるおよそのコスト（小修行で expToNext 分）
  const lv = 10;
  const need = Math.floor(BALANCE.train.exp.base * Math.pow(lv, BALANCE.train.exp.pow));
  const small = BALANCE.train.tiers[0];
  const trainCost1lv = Math.ceil(need / small.exp) * Math.floor(small.baseCost * (1 + lv * BALANCE.train.costScale));

  const repFurniture = FURNITURE.find((f) => f.id === "f_futon");
  const multi = GACHA.multiCost;

  const minsFor = (cost) => gambleIncomeHr > 0 ? Math.round((cost / gambleIncomeHr) * 60) : Infinity;

  el.innerHTML = `
    <div class="sim-line">博打1回（狐・生存${Math.round(g.winP*100)}%/深さ${g.depth}撤退）期待 <b>◉${fmt(expectedCoin)}</b>（純益 ${netPerSession>=0?"+":""}${fmt(netPerSession)}）</div>
    <div class="sim-line">想定 coin 収入：博打 <b>◉${fmt(gambleIncomeHr)}/時</b>（${SESS_PER_HOUR}回/時 概算）</div>
    <div class="sim-line">戦闘 周回：最終ステージ <b>◉${fmt(battlePerClear)}/回</b></div>
    <div class="sim-hr"></div>
    <div class="sim-line">▸ ガチャ10連 ◉${fmt(multi)} ＝ 博打 <b>${minsFor(multi)}分</b>相当</div>
    <div class="sim-line">▸ Lv10→11 修行 ◉${fmt(trainCost1lv)} ＝ 博打 <b>${minsFor(trainCost1lv)}分</b>相当</div>
    <div class="sim-line">▸ 代表家具「${repFurniture.name}」◉${fmt(repFurniture.price.coin || 0)} ＝ 博打 <b>${minsFor(repFurniture.price.coin || 0)}分</b>相当</div>
    <div class="sim-hr"></div>
    <div class="sim-line ${gambleIncomeHr>0?"ok":"bad"}">収支：流入 ◉${fmt(gambleIncomeHr)}/時 ${gambleIncomeHr>0?"＞ 健全な蛇口":"＜ 赤字（破綻）"}</div>
    <div class="sim-note">※ balance.js を変えるとこの試算も即変わる。破綻の早期発見用。</div>`;
}
