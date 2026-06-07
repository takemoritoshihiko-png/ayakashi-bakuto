/* ============================================================
   screens/room.js — 妖怪部屋（配置/模様替え/家具屋/暮らし）
   ============================================================ */
import { getState, getCoin, getShard } from "../state.js";
import { FURNITURE, ROOM, ROOM_MURMURS } from "../config/index.js";
import {
  furnById, footprint, availableCount, ownedCount, buyFurniture,
  place, moveTo, rotate, removeAt, recomputeComfort, themeProgress,
  toggleDisplayed, isDisplayed,
} from "../game/room.js";
import { speciesById, buildYokaiArt, yokaiImageArt } from "../game/yokai.js";
import { furnitureArt } from "../ui/art.js";
import { toast } from "../ui/shell.js";

let _root = null, _ctx = null;
let _mode = "view";        // view | edit
let _selPlaced = -1;       // 編集中に選択した配置 index
let _selFurniture = null;  // 配置トレイで選んだ家具 id（設置待ち）
let _walkTimer = null, _cell = 36, _alive = true;

export const roomScreen = {
  mount(root, ctx) {
    _root = root; _ctx = ctx; _alive = true; _mode = "view"; _selPlaced = -1; _selFurniture = null;
    recomputeComfort();
    render();
  },
  unmount() { _alive = false; stopWalk(); _root = null; },
};
export default roomScreen;

function fmt(n) { try { return Math.floor(n).toLocaleString("ja-JP"); } catch (e) { return String(n | 0); } }
function stopWalk() { if (_walkTimer) { clearInterval(_walkTimer); _walkTimer = null; } }

function render() {
  if (!_root) return;
  stopWalk();
  const s = getState();
  const comfort = s.room.comfort || 0;
  const themes = themeProgress();

  // セルサイズを横幅から算出
  const wrapW = Math.min(448, (window.innerWidth || 448)) - 32;
  _cell = Math.floor(wrapW / ROOM.cols);
  const gw = _cell * ROOM.cols, gh = _cell * ROOM.rows;

  _root.innerHTML = `
    <section class="screen room">
      <div class="yk-top">
        <button class="btn-ghost" id="rBack">← 戻る</button>
        <div class="room-stat">心地 <b>${comfort}</b></div>
      </div>

      <div class="room-themes">
        ${themes.map((t) => `<span class="theme-chip ${t.complete ? "done" : ""}">${t.name} ${t.have}/${t.total}${t.complete ? " ✓+" + t.bonus : ""}</span>`).join("")}
      </div>

      <div class="room-grid-wrap">
        <div class="room-grid ${_mode === "edit" ? "editing" : ""}" id="roomGrid" style="width:${gw}px;height:${gh}px;background-size:${_cell}px ${_cell}px;">
          ${s.room.placed.map(placedHtml).join("")}
          <div class="room-yokai-layer" id="ykLayer"></div>
        </div>
      </div>

      <div class="room-tools">
        <button class="btn-ghost ${_mode === "edit" ? "on" : ""}" id="rEdit">${_mode === "edit" ? "模様替え中…完了" : "🛠 模様替え"}</button>
        <button class="btn-ghost" id="rShop">🪧 家具屋</button>
        <button class="btn-ghost" id="rDisplay">妖を出す（${s.room.displayed.length}/${ROOM.yokaiMax}）</button>
      </div>

      ${_mode === "edit" ? editPanel() : ""}
      <div class="room-overlay hidden" id="roomOverlay"></div>
    </section>`;

  _root.querySelector("#rBack").addEventListener("click", () => _ctx.go("home"));
  _root.querySelector("#rEdit").addEventListener("click", () => { _mode = _mode === "edit" ? "view" : "edit"; _selPlaced = -1; _selFurniture = null; render(); });
  _root.querySelector("#rShop").addEventListener("click", openShop);
  _root.querySelector("#rDisplay").addEventListener("click", openDisplayPicker);

  wireGrid();
  if (_mode === "edit") wireEditPanel();
  if (_mode === "view") startWalk();
}

/* ---- 配置描画 ---- */
function placedHtml(p, i) {
  const f = furnById(p.furnitureId);
  const fp = footprint(f, p.rot || 0);
  const sel = i === _selPlaced ? " sel" : "";
  return `<div class="furn${sel}" data-idx="${i}"
    style="left:${p.x * _cell}px;top:${p.y * _cell}px;width:${fp.w * _cell}px;height:${fp.h * _cell}px;font-size:${Math.min(fp.w, fp.h) * _cell * 0.6}px;">
    <span class="furn-art">${furnitureArt(f)}</span></div>`;
}

function wireGrid() {
  const grid = _root.querySelector("#roomGrid");
  if (!grid) return;
  // 配置物の選択（編集時）
  grid.querySelectorAll("[data-idx]").forEach((el) => el.addEventListener("click", (e) => {
    if (_mode !== "edit") return;
    e.stopPropagation();
    _selFurniture = null;
    _selPlaced = Number(el.dataset.idx);
    render();
  }));
  // グリッドクリック＝設置 or 移動先
  grid.addEventListener("click", (e) => {
    if (_mode !== "edit") return;
    const rect = grid.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / _cell);
    const y = Math.floor((e.clientY - rect.top) / _cell);
    if (_selFurniture) {
      if (place(_selFurniture, x, y, 0)) { if (availableCount(_selFurniture) <= 0) _selFurniture = null; render(); }
      else toast("そこには置けない", "warn");
    } else if (_selPlaced >= 0) {
      if (moveTo(_selPlaced, x, y)) render();
      else toast("移動できない", "warn");
    }
  });
}

/* ---- 編集パネル（選択中の操作 / 設置トレイ） ---- */
function editPanel() {
  const s = getState();
  // 設置可能（available>0）な家具トレイ
  const tray = FURNITURE.filter((f) => availableCount(f.id) > 0).map((f) =>
    `<button class="tray-item ${_selFurniture === f.id ? "sel" : ""}" data-furn="${f.id}">
      <span class="tray-art">${f.art}</span><span class="tray-name">${f.name}</span><span class="tray-n">×${availableCount(f.id)}</span>
    </button>`).join("") || `<span class="cmd-none">置ける家具がない。家具屋で購入を。</span>`;

  const selOps = _selPlaced >= 0 ? `
    <div class="sel-ops">
      <span>選択中：${furnById(s.room.placed[_selPlaced].furnitureId).name}</span>
      <button class="btn-ghost" id="opRot">回転</button>
      <button class="btn-ghost danger" id="opRemove">撤去</button>
    </div>` : `<div class="sel-hint">家具を選ぶ→空きマスをタップで設置。配置物をタップ→移動/回転/撤去。</div>`;

  return `<div class="edit-panel">
    ${selOps}
    <div class="tray">${tray}</div>
  </div>`;
}
function wireEditPanel() {
  _root.querySelectorAll("[data-furn]").forEach((b) => b.addEventListener("click", () => {
    _selFurniture = _selFurniture === b.dataset.furn ? null : b.dataset.furn;
    _selPlaced = -1;
    render();
  }));
  const rot = _root.querySelector("#opRot");
  if (rot) rot.addEventListener("click", () => { if (rotate(_selPlaced)) render(); else toast("回転できない", "warn"); });
  const rm = _root.querySelector("#opRemove");
  if (rm) rm.addEventListener("click", () => { removeAt(_selPlaced); _selPlaced = -1; render(); });
}

/* ---- 家具屋 ---- */
function openShop() {
  const ov = _root.querySelector("#roomOverlay");
  const cats = ["床", "壁", "家具", "装飾", "特殊"];
  const list = cats.map((cat) => {
    const items = FURNITURE.filter((f) => f.category === cat);
    if (!items.length) return "";
    return `<div class="shop-cat">${cat}</div>` + items.map((f) => {
      const priceTxt = f.price.coin != null ? `◉ ${fmt(f.price.coin)}` : `◈ ${fmt(f.price.shard)}`;
      const can = f.price.coin != null ? getCoin() >= f.price.coin : getShard() >= f.price.shard;
      return `<div class="fshop-row">
        <span class="fs-art">${f.art}</span>
        <div class="fs-main"><div class="fs-name">${f.name} <small>${f.size.w}×${f.size.h}</small></div>
          <div class="fs-meta">心地+${f.comfort}　所持 ${ownedCount(f.id)}</div></div>
        <button class="fs-buy" data-buy="${f.id}" ${can ? "" : "disabled"}>${priceTxt}</button>
      </div>`;
    }).join("");
  }).join("");

  ov.innerHTML = `<div class="room-card">
    <h3>家具屋</h3>
    <div class="sub">所持 ◉ ${fmt(getCoin())} ・ ◈ ${fmt(getShard())}</div>
    <div class="fshop-list">${list}</div>
    <button class="close" id="fsClose">閉じる</button>
  </div>`;
  ov.classList.remove("hidden");
  ov.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => {
    const r = buyFurniture(b.dataset.buy);
    if (!r.ok) { toast(r.reason === "shard" ? "shard が足りない" : "coin が足りない", "warn"); return; }
    toast(furnById(b.dataset.buy).name + " を購入");
    openShop();   // 再描画（所持/残高更新）
  }));
  ov.querySelector("#fsClose").addEventListener("click", () => ov.classList.add("hidden"));
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.add("hidden"); });
}

/* ---- 部屋に出す妖怪の選択 ---- */
function openDisplayPicker() {
  const s = getState();
  const ov = _root.querySelector("#roomOverlay");
  const rows = s.yokai.length ? s.yokai.map((inst) => {
    const sp = speciesById(inst.speciesId);
    const on = isDisplayed(inst.uid);
    return `<button class="disp-row ${on ? "on" : ""}" data-disp="${inst.uid}">
      <span class="disp-art">${yokaiImageArt(inst)}</span>
      <span class="disp-name">${sp.name} <small>Lv${inst.level} ♥${inst.affection}</small></span>
      <span class="disp-tog">${on ? "出す中" : "出す"}</span>
    </button>`;
  }).join("") : `<div class="cmd-none">妖怪がいない。</div>`;

  ov.innerHTML = `<div class="room-card">
    <h3>部屋に出す妖（最大 ${ROOM.yokaiMax}）</h3>
    <div class="disp-list">${rows}</div>
    <button class="close" id="dispClose">閉じる</button>
  </div>`;
  ov.classList.remove("hidden");
  ov.querySelectorAll("[data-disp]").forEach((b) => b.addEventListener("click", () => {
    if (!toggleDisplayed(b.dataset.disp)) toast("出せるのは " + ROOM.yokaiMax + " 体まで", "warn");
    openDisplayPicker();
  }));
  ov.querySelector("#dispClose").addEventListener("click", () => { ov.classList.add("hidden"); render(); });
  ov.addEventListener("click", (e) => { if (e.target === ov) { ov.classList.add("hidden"); render(); } });
}

/* ---- 妖怪が暮らす（歩く・座る・つぶやく） ---- */
function startWalk() {
  const s = getState();
  const layer = _root.querySelector("#ykLayer");
  if (!layer) return;
  const insts = s.room.displayed.map((u) => s.yokai.find((y) => y.uid === u)).filter(Boolean);
  layer.innerHTML = insts.map((inst, i) =>
    `<div class="room-yokai" id="ry${i}" style="left:${(2 + i * 2) * _cell}px;top:${(ROOM.rows - 2) * _cell}px;width:${_cell * 1.4}px;height:${_cell * 1.4}px;">
       <div class="ry-bubble" id="ryb${i}"></div>${yokaiImageArt(inst)}
     </div>`).join("");
  if (!insts.length) return;

  const move = () => {
    if (!_alive) return;
    insts.forEach((inst, i) => {
      const el = _root.querySelector("#ry" + i);
      if (!el) return;
      const x = (1 + Math.floor(Math.random() * (ROOM.cols - 2))) * _cell;
      const y = (1 + Math.floor(Math.random() * (ROOM.rows - 2))) * _cell;
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.classList.toggle("flip", Math.random() < 0.5);
      if (Math.random() < 0.4) {
        const b = _root.querySelector("#ryb" + i);
        if (b) {
          b.textContent = ROOM_MURMURS[Math.floor(Math.random() * ROOM_MURMURS.length)];
          b.classList.add("show");
          setTimeout(() => { if (b) b.classList.remove("show"); }, 2600);
        }
      }
    });
  };
  _walkTimer = setInterval(move, 3200);
  setTimeout(move, 400);
}
