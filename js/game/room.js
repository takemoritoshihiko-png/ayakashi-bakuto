/* ============================================================
   game/room.js — 妖怪部屋ドメイン（配置/快適度/放置愛情度）
   ============================================================ */
import { getState, saveSave, addCoin, getCoin, addShard, getShard } from "../state.js";
import { FURNITURE, THEME_SETS, ROOM, IDLE } from "../config/index.js";
import { speciesById, gainAffection } from "./yokai.js";

export function furnById(id) { return FURNITURE.find((f) => f.id === id); }

/* ---- 形状（回転で w/h 入替） ---- */
export function footprint(item, rot) {
  const r = ((rot % 360) + 360) % 360;
  return (r === 90 || r === 270) ? { w: item.size.h, h: item.size.w } : { w: item.size.w, h: item.size.h };
}
function cellsOf(entry) {
  const f = furnById(entry.furnitureId);
  const fp = footprint(f, entry.rot || 0);
  const out = [];
  for (let dy = 0; dy < fp.h; dy++) for (let dx = 0; dx < fp.w; dx++) out.push({ x: entry.x + dx, y: entry.y + dy });
  return out;
}

/* ---- 所持/配置の在庫管理 ---- */
export function ownedCount(id) { return getState().room.owned.filter((o) => o.furnitureId === id).length; }
export function placedCount(id) { return getState().room.placed.filter((p) => p.furnitureId === id).length; }
export function availableCount(id) { return ownedCount(id) - placedCount(id); }

/* ---- コリジョン ---- */
export function canPlace(furnitureId, x, y, rot, ignoreIndex) {
  const s = getState();
  const f = furnById(furnitureId);
  const fp = footprint(f, rot || 0);
  if (x < 0 || y < 0 || x + fp.w > ROOM.cols || y + fp.h > ROOM.rows) return false;
  const occ = new Set();
  s.room.placed.forEach((p, i) => { if (i === ignoreIndex) return; cellsOf(p).forEach((c) => occ.add(c.x + "," + c.y)); });
  for (let dy = 0; dy < fp.h; dy++) for (let dx = 0; dx < fp.w; dx++) {
    if (occ.has((x + dx) + "," + (y + dy))) return false;
  }
  return true;
}

/* ---- 家具屋 ---- */
export function buyFurniture(id) {
  const f = furnById(id);
  if (!f) return { ok: false };
  if (f.price.coin != null) {
    if (getCoin() < f.price.coin) return { ok: false, reason: "coin" };
    addCoin(-f.price.coin);
  } else if (f.price.shard != null) {
    if (getShard() < f.price.shard) return { ok: false, reason: "shard" };
    addShard(-f.price.shard);
  }
  const s = getState();
  s.room.owned.push({ furnitureId: id });
  s.zukan.furniture[id] = true;   // 図鑑：家具の発見フラグ
  saveSave();
  return { ok: true };
}

/* ---- 配置・移動・回転・撤去 ---- */
export function place(furnitureId, x, y, rot) {
  if (availableCount(furnitureId) <= 0) return false;
  if (!canPlace(furnitureId, x, y, rot)) return false;
  getState().room.placed.push({ furnitureId, x, y, rot: rot || 0 });
  recomputeComfort();
  saveSave();
  return true;
}
export function moveTo(index, x, y) {
  const p = getState().room.placed[index];
  if (!p) return false;
  if (!canPlace(p.furnitureId, x, y, p.rot, index)) return false;
  p.x = x; p.y = y;
  recomputeComfort();
  saveSave();
  return true;
}
export function rotate(index) {
  const p = getState().room.placed[index];
  if (!p) return false;
  const nr = ((p.rot || 0) + 90) % 360;
  if (!canPlace(p.furnitureId, p.x, p.y, nr, index)) return false;
  p.rot = nr;
  saveSave();
  return true;
}
export function removeAt(index) {
  getState().room.placed.splice(index, 1);
  recomputeComfort();
  saveSave();
}

/* ---- 快適度（配置から再計算） ---- */
export function recomputeComfort() {
  const s = getState();
  let c = 0;
  const placedIds = s.room.placed.map((p) => p.furnitureId);
  for (const p of s.room.placed) { const f = furnById(p.furnitureId); if (f) c += f.comfort; }
  for (const key in THEME_SETS) {
    const set = THEME_SETS[key];
    if (set.members.every((m) => placedIds.includes(m))) c += set.bonusComfort;
  }
  s.room.comfort = c;
  return c;
}
export function themeProgress() {
  const placedIds = getState().room.placed.map((p) => p.furnitureId);
  return Object.entries(THEME_SETS).map(([id, set]) => {
    const have = set.members.filter((m) => placedIds.includes(m)).length;
    return { id, name: set.name, have, total: set.members.length, complete: have === set.members.length, bonus: set.bonusComfort };
  });
}

/* ---- 部屋に出す妖怪 ---- */
export function toggleDisplayed(uid) {
  const s = getState();
  const i = s.room.displayed.indexOf(uid);
  if (i >= 0) { s.room.displayed.splice(i, 1); saveSave(); return true; }
  if (s.room.displayed.length >= ROOM.yokaiMax) return false;
  s.room.displayed.push(uid);
  saveSave();
  return true;
}
export function isDisplayed(uid) { return getState().room.displayed.includes(uid); }

/* ============================================================
   放置による愛情度上昇（来訪時に一括・上限で悪用防止）
   ============================================================ */
export function applyIdleAffection(prevLastSeen) {
  const s = getState();
  if (!prevLastSeen) return null;
  const comfort = s.room.comfort || 0;
  if (comfort <= 0 || s.room.displayed.length === 0) return null;
  const hours = Math.min(IDLE.maxHours, (Date.now() - prevLastSeen) / 3600000);
  if (hours <= 0) return null;
  let per = Math.floor(hours * comfort * IDLE.ratePerHourPerComfort);
  per = Math.min(IDLE.capPerVisit, per);
  if (per <= 0) return null;
  const names = [];
  for (const uid of s.room.displayed) {
    const inst = s.yokai.find((y) => y.uid === uid);
    if (!inst) continue;
    if (gainAffection(inst, per) > 0) names.push(speciesById(inst.speciesId).name);
  }
  saveSave();
  return { per, names };
}
