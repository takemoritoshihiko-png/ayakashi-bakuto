/* ============================================================
   screens/home.js — ホーム（帰ってくる場所・作品の顔）
   留守番の妖を主役に、各セクション入口を木札/提灯/暖簾風に。
   coin/蒐集率/天井 を上品に常時表示。
   ============================================================ */
import { SECTIONS, CARETAKER, RETURN_DAY_MS, APP, GACHA, DEV_MODE } from "../config/index.js";
import { getState, addCoin, resetSave, getShard } from "../state.js";
import { toast } from "../ui/shell.js";
import { overallStats } from "../game/zukan.js";

export const homeScreen = {
  mount(root, ctx) {
    const s = getState();
    const greeting = pickGreeting(ctx.lastSeenPrev, s.meta.createdAt);
    const comp = Math.floor(overallStats().pct * 100);
    const pity = s.gacha.pityCount | 0;
    const pityLeft = Math.max(0, GACHA.pityCeiling - pity);

    root.innerHTML = `
      <section class="screen home">
        <!-- 暖簾（見出し） -->
        <div class="home-noren">
          <span class="noren-l"></span>
          <span class="noren-title">妖賭場</span>
          <span class="noren-r"></span>
        </div>

        <!-- 留守番の妖（主役） -->
        <div class="caretaker" id="ctBox">
          <div class="ct-lantern"></div>
          <div class="ct-art">${CARETAKER.icon}</div>
          <div class="ct-bubble">
            <div class="ct-name">${CARETAKER.name}</div>
            <div class="ct-line" id="ctLine">${greeting}</div>
          </div>
        </div>

        <!-- 状態（上品に常時表示） -->
        <div class="home-status">
          <span class="hs-item"><i>蒐集</i><b>${comp}%</b></span>
          <span class="hs-sep"></span>
          <span class="hs-item"><i>神話まで</i><b>${pityLeft}</b><small>連</small></span>
          <span class="hs-sep"></span>
          <span class="hs-item"><i>勾玉</i><b>◈${getShard()}</b></span>
        </div>

        <!-- セクション入口（木札） -->
        <div class="section-grid">
          ${SECTIONS.map(secCard).join("")}
        </div>

        ${DEV_MODE ? `<div class="dev-tools">
          <button class="btn-ghost" id="devCoin">＋100 コイン（仮）</button>
          <button class="btn-ghost danger" id="devReset">セーブ初期化</button>
        </div>` : ""}
        <div class="home-foot">${APP.title} ${APP.subtitle}　ver ${APP.version}</div>
      </section>
    `;

    root.querySelectorAll("[data-route]").forEach((b) => {
      b.addEventListener("click", () => ctx.go(b.dataset.route));
    });

    if (DEV_MODE) {
      root.querySelector("#devCoin").addEventListener("click", () => { addCoin(100); toast("＋100 コイン"); });
      root.querySelector("#devReset").addEventListener("click", () => {
        if (confirm("セーブを初期化しますか？（元に戻せません）")) { resetSave(); toast("セーブを初期化した", "warn"); ctx.go("home"); }
      });
    }

    root.querySelector("#ctBox").addEventListener("click", () => {
      root.querySelector("#ctLine").textContent = randOf(CARETAKER.lines.returnedSoon);
    });
  },
  unmount() {},
};

function secCard(sec) {
  const lock = sec.ready ? "" : `<span class="sec-soon">準備中</span>`;
  return `
    <button class="sec-card" data-route="${sec.route}">
      <span class="sec-peg"></span>
      <span class="sec-ico">${sec.icon}</span>
      <span class="sec-name">${sec.name}</span>
      <span class="sec-desc">${sec.desc}</span>
      ${lock}
    </button>`;
}

function pickGreeting(lastSeenPrev, createdAt) {
  const now = Date.now();
  if (!lastSeenPrev || lastSeenPrev === createdAt) return randOf(CARETAKER.lines.firstVisit);
  return (now - lastSeenPrev >= RETURN_DAY_MS) ? randOf(CARETAKER.lines.returnedDay) : randOf(CARETAKER.lines.returnedSoon);
}
function randOf(arr) { return (arr && arr.length) ? arr[Math.floor(Math.random() * arr.length)] : ""; }

export default homeScreen;
