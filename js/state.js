/* ============================================================
   state.js — セーブの単一情報源（背骨）
   スキーマ / load / save / reset / バージョン移行(migrate)
   今後フィールドを足してもセーブが壊れないことが最重要。
   ============================================================ */

import { GAME } from "./config/index.js";

export const SAVE_KEY = "ayakashi_save";
export const SAVE_VERSION = 7;   // フィールドを増やすたびに +1 し、migrate に補完を足す

/* ---- セーブ初期形（=スキーマの単一定義） ----
   ここが「正」。新フィールドはここに足し、migrate で既存セーブへ補完する。 */
export function defaultSave() {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    currency: { coin: 0, shard: 0 },                // coin=主通貨 / shard=重複変換の副次通貨(v3)
    gacha: { pityCount: 0 },                        // 天井カウンタ(v3)
    yokai: [],                                      // {uid, speciesId, level, exp, equip:{weaponUid, costumeUid}}
    inventory: { weapons: [], costumes: [] },       // {uid, itemId}
    party: [],                                      // 出撃中妖怪の uid 配列
    room: { placed: [], owned: [], displayed: [], comfort: 0 }, // placed:{furnitureId,x,y,rot} / owned:{furnitureId}
    zukan: { yokai: {}, items: {}, furniture: {}, rewardsClaimed: [] }, // 発見フラグ＋コンプ報酬受領
    battle: { cleared: [], highestStage: 0 },
    gachaHistory: [],
    stats: { totalCoinEarned: 0, gambleRuns: 0, deepestDepth: 0 },
    settings: { muted: false },
    meta: { createdAt: now, lastSeen: now },

    /* v2: 妖賭場（賭場）専用の永続データ。中央通貨(coin)とは別管理。 */
    gamble: {
      bestPot: 0,                                   // 単発逃げ額の記録
      lifetime: 0,                                  // 賭場内の累計獲得（賭場アンロック判定用）
      charmsOwned: [],                              // お守り所持 id
      charmsEquipped: [],                           // 装備中 id
      unlockedVenues: ["kitsune"],                  // 解放済み賭場 id（初期＝狐）
      titles: { seen: [] },                         // 二つ名の既見記録
      achievements: { unlocked: [] },               // 実績の解除 id
      daily: { date: null, attemptsUsed: 0, best: { depth: 0, pot: 0 }, streak: 0, lastDate: "" },
      flags: { flees: 0, depth1Flees: 0, cursedFlee: false, tripleResonance: false }, // 実績用フラグ
    },
  };
}

/* ============================================================
   migrate — version が最新未満なら欠損フィールドを初期値で補完
   ・各 version への移行ステップを順に適用
   ・最後に deepMergeDefaults で「初期形にあって save に無いキー」を補完
     （= フィールド追加だけなら version を上げるだけで安全に通る）
   ============================================================ */
export function migrate(save) {
  if (!save || typeof save !== "object") return defaultSave();

  let v = typeof save.version === "number" ? save.version : 0;

  // 将来の破壊的変更（フィールドの“移動/改名”等）はここに version ごとのステップを書く。
  // v1 -> v2 は「save.gamble を新設」のみなので、下の deepMergeDefaults による
  // 欠損補完だけで安全に通る（破壊的変換は不要）。
  if (v < 2) { v = 2; }
  // v2 -> v3 は「currency.shard / gacha を新設」のみ。deepMergeDefaults で吸収。
  if (v < 3) { v = 3; }
  // v3 -> v4: 既存の各 yokai インスタンスに affection / maxLevel / equip を補完
  if (v < 4) {
    if (Array.isArray(save.yokai)) {
      for (const y of save.yokai) {
        if (typeof y.affection !== "number") y.affection = 0;
        if (typeof y.maxLevel !== "number") y.maxLevel = GAME.baseMaxLevel;
        if (typeof y.level !== "number") y.level = 1;
        if (typeof y.exp !== "number") y.exp = 0;
        if (!y.equip || typeof y.equip !== "object") y.equip = { weaponUid: null, costumeUid: null };
      }
    }
    v = 4;
  }
  // v4 -> v5: battle.highestStage を新設（cleared は既存）。deepMergeDefaults で吸収。
  if (v < 5) { v = 5; }
  // v5 -> v6: room に owned/displayed/comfort を新設、placed 各要素へ rot 補完
  if (v < 6) {
    if (save.room && Array.isArray(save.room.placed)) {
      for (const p of save.room.placed) if (typeof p.rot !== "number") p.rot = 0;
    }
    v = 6;
  }
  // v6 -> v7: zukan に furniture/rewardsClaimed を保証し、既存所持から発見フラグを補修
  if (v < 7) {
    if (!save.zukan || typeof save.zukan !== "object") save.zukan = {};
    if (!save.zukan.yokai) save.zukan.yokai = {};
    if (!save.zukan.items) save.zukan.items = {};
    if (!save.zukan.furniture) save.zukan.furniture = {};
    if (!Array.isArray(save.zukan.rewardsClaimed)) save.zukan.rewardsClaimed = [];
    if (Array.isArray(save.yokai)) save.yokai.forEach((y) => { if (y && y.speciesId) save.zukan.yokai[y.speciesId] = true; });
    if (save.inventory) {
      (save.inventory.weapons || []).forEach((w) => { if (w && w.itemId) save.zukan.items[w.itemId] = true; });
      (save.inventory.costumes || []).forEach((c) => { if (c && c.itemId) save.zukan.items[c.itemId] = true; });
    }
    if (save.room && Array.isArray(save.room.owned)) save.room.owned.forEach((o) => { if (o && o.furnitureId) save.zukan.furniture[o.furnitureId] = true; });
    v = 7;
  }

  // 欠損キーの補完（フィールド“追加”はこれだけで吸収できる）
  save = deepMergeDefaults(save, defaultSave());

  // version を最新へ
  save.version = SAVE_VERSION;
  return save;
}

/* save に無いキーだけ defaults から補う（save 側の既存値は尊重）。
   配列はスキーマ上「中身はゲーム側管理」なので、型が違う場合のみ初期化。 */
function deepMergeDefaults(save, defaults) {
  if (Array.isArray(defaults)) {
    return Array.isArray(save) ? save : defaults.slice();
  }
  if (defaults && typeof defaults === "object") {
    const out = (save && typeof save === "object" && !Array.isArray(save)) ? save : {};
    for (const key of Object.keys(defaults)) {
      out[key] = deepMergeDefaults(out[key], defaults[key]);
    }
    return out;
  }
  // プリミティブ: save に値があればそれを、無ければ default
  return (save === undefined) ? defaults : save;
}

/* ============================================================
   永続化（localStorage / try-catch ガード・未対応時はメモリ動作）
   ============================================================ */
let _state = null;          // 単一情報源（メモリ上の現在値）
let _storageOk = true;      // localStorage 使用可否

function readRaw() {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch (e) {
    _storageOk = false;
    return null;
  }
}
function writeRaw(str) {
  try {
    localStorage.setItem(SAVE_KEY, str);
  } catch (e) {
    _storageOk = false;   // 容量超過・未対応など。メモリ上では保持継続
  }
}

/** セーブを読み込む（無ければ初期値生成）。アプリ起動時に1回呼ぶ。 */
export function loadSave() {
  const raw = readRaw();
  if (raw) {
    try {
      _state = migrate(JSON.parse(raw));
    } catch (e) {
      _state = defaultSave();   // 破損時は作り直し
    }
  } else {
    _state = defaultSave();
  }
  _state.meta.lastSeen = _state.meta.lastSeen || Date.now();
  saveSave();
  return _state;
}

/** 現在のセーブを書き出す。変更系ヘルパの最後で呼ばれる。 */
export function saveSave() {
  if (!_state) return;
  writeRaw(JSON.stringify(_state));
}

/** セーブを初期化（確認はUI側で行う想定）。 */
export function resetSave() {
  _state = defaultSave();
  saveSave();
  return _state;
}

/** 現在のセーブ（単一情報源）への参照を返す。 */
export function getState() {
  if (!_state) loadSave();
  return _state;
}

/** localStorage が使えているか（UI 表示用）。 */
export function isStorageOk() { return _storageOk; }

/* ============================================================
   変更系ヘルパ — 必ずここを経由し、最後に saveSave() を呼ぶ
   通貨変更はイベントを飛ばし、ヘッダがリアルタイム表示に使う。
   ============================================================ */

/** 通貨増減イベント名（shell.js が購読） */
export const EV_CURRENCY = "ayakashi:currency";

function emitCurrency(kind, delta, total) {
  try {
    window.dispatchEvent(new CustomEvent(EV_CURRENCY, { detail: { kind, delta, total } }));
  } catch (e) { /* CustomEvent 未対応環境でも本体は動く */ }
}

/** コインを増減（負値で減算、0未満にはしない）。新残高を返す。 */
export function addCoin(n) {
  const s = getState();
  const before = s.currency.coin;
  s.currency.coin = Math.max(0, Math.floor(before + n));
  const delta = s.currency.coin - before;
  if (n > 0) s.stats.totalCoinEarned += Math.max(0, delta);
  saveSave();
  emitCurrency("coin", delta, s.currency.coin);
  return s.currency.coin;
}

/** 所持コインを取得。 */
export function getCoin() { return getState().currency.coin; }

/** 副次通貨 shard を増減（負値で減算、0未満にはしない）。新残高を返す。 */
export function addShard(n) {
  const s = getState();
  s.currency.shard = Math.max(0, Math.floor((s.currency.shard || 0) + n));
  saveSave();
  emitCurrency("shard", n, s.currency.shard);
  return s.currency.shard;
}
/** 所持 shard を取得。 */
export function getShard() { return getState().currency.shard || 0; }

/** インスタンス用のユニークID（妖怪/装備の uid）。 */
let _uidSeq = 0;
export function uid(prefix = "u") {
  _uidSeq++;
  return prefix + "_" + Date.now().toString(36) + "_" + _uidSeq.toString(36) +
         Math.floor(Math.random() * 1e6).toString(36);
}

/** 設定: ミュート切替。 */
export function setMuted(muted) {
  const s = getState();
  s.settings.muted = !!muted;
  saveSave();
  return s.settings.muted;
}

/** 最終訪問時刻を更新（ホームの「留守番の妖」が経過判定に使う前の値を返す）。 */
export function touchLastSeen() {
  const s = getState();
  const prev = s.meta.lastSeen;
  s.meta.lastSeen = Date.now();
  saveSave();
  return prev;
}

/* ---- 簡易セルフテスト: migrate が欠損を補完するか（devで利用） ----
   コンソールで import 後 __migrateSelfTest() を呼ぶと結果を返す。 */
export function __migrateSelfTest() {
  const old = { version: 0, currency: { coin: 123 } }; // 大半が欠損した古いセーブ
  const m = migrate(JSON.parse(JSON.stringify(old)));
  const ok =
    m.version === SAVE_VERSION &&
    m.currency.coin === 123 &&            // 既存値は保持
    Array.isArray(m.yokai) &&             // 欠損配列を補完
    m.inventory && Array.isArray(m.inventory.weapons) &&
    m.stats && m.stats.deepestDepth === 0 &&
    m.settings && m.settings.muted === false &&
    m.meta && typeof m.meta.createdAt === "number";
  return { ok, migrated: m };
}
