/* ============================================================
   config/assets.js — 画像アセットのマニフェスト＋解決関数（Phase J）
   画像は外部（画像生成AI）で用意し assets/ に置く。ここに「在るファイル」を
   手動登録する。無ければ解決関数が null を返し、呼び出し側は既存SVGへフォールバック。
   ============================================================ */
import { YOKAI_SPECIES, MASTER, ENEMIES, FURNITURE } from "./index.js";

const EXT = "webp";
/* キャッシュバスティング用バージョン。画像を差し替えたら +1 すると
   ブラウザ/Pages のキャッシュに負けず最新画像が表示される。 */
export const ASSET_VER = 2;
const path = (dir, key) => `assets/${dir}/${key}.${EXT}?v=${ASSET_VER}`;

/* ------------------------------------------------------------
   用意済みアセット集合（★手動更新）。
   画像を assets/ に追加したら、ここに「拡張子なしのキー」を足す。
     yokai:     "kyuubi"（ベース） / "kyuubi__cos_juni"（衣装差分）
     weapons:   "wp_youtou"
     costumes:  "cos_juni"
     enemies:   "e_onibi"
     furniture: "f_tatami"
   ------------------------------------------------------------ */
export const AVAILABLE = {
  // 実画像のある妖怪（assets/yokai/{speciesId}.webp）。amefurashi は未配置＝SVG。
  // ※ zip 内の mame_danuki/kyubi は実 speciesId の mametanuki/kyuubi にリネーム済み。
  yokai: new Set([
    "bakeneko", "chochin_kozo", "kamaitachi", "mametanuki", "kyuubi",
    "tofu_kozo", "kappa", "kasha", "tsuchigumo", "oni", "hakutaku",
  ]),
  weapons:   new Set([]),
  costumes:  new Set([]),
  enemies:   new Set([]),
  furniture: new Set([]),
};

/* ---- 解決関数：差分 → ベース → null ---- */
export function getYokaiImage(speciesId, costumeId) {
  if (costumeId && AVAILABLE.yokai.has(`${speciesId}__${costumeId}`)) return path("yokai", `${speciesId}__${costumeId}`);
  if (AVAILABLE.yokai.has(speciesId)) return path("yokai", speciesId);
  return null;
}
export function getItemImage(item) {
  if (!item) return null;
  const dir = item.type === "weapon" ? "weapons" : "costumes";
  const set = item.type === "weapon" ? AVAILABLE.weapons : AVAILABLE.costumes;
  return set.has(item.id) ? path(dir, item.id) : null;
}
export function getEnemyImage(enemyId) { return AVAILABLE.enemies.has(enemyId) ? path("enemies", enemyId) : null; }
export function getFurnitureImage(id) { return AVAILABLE.furniture.has(id) ? path("furniture", id) : null; }

/* ---- カバレッジ／不足一覧（dev のアセットチェッカー用） ---- */
export function coverage() {
  const cats = [
    { label: "妖怪", ids: YOKAI_SPECIES.map((s) => s.speciesId), set: AVAILABLE.yokai },
    { label: "武器", ids: MASTER.filter((m) => m.type === "weapon").map((m) => m.id), set: AVAILABLE.weapons },
    { label: "衣装", ids: MASTER.filter((m) => m.type === "costume").map((m) => m.id), set: AVAILABLE.costumes },
    { label: "敵",   ids: Object.keys(ENEMIES), set: AVAILABLE.enemies },
    { label: "家具", ids: FURNITURE.map((f) => f.id), set: AVAILABLE.furniture },
  ];
  return cats.map((c) => {
    const missing = c.ids.filter((id) => !c.set.has(id));
    return { label: c.label, have: c.ids.length - missing.length, total: c.ids.length, missing };
  });
}
