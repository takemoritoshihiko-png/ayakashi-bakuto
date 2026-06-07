/* ============================================================
   screens/home.js — ホーム（各セクション入口＋留守番の妖）
   ============================================================ */
import { SECTIONS, CARETAKER, RETURN_DAY_MS, APP } from "../config/index.js";
import { getState, addCoin, resetSave } from "../state.js";
import { toast } from "../ui/shell.js";
import { overallStats } from "../game/zukan.js";

export const homeScreen = {
  mount(root, ctx) {
    const s = getState();
    const greeting = pickGreeting(ctx.lastSeenPrev, s.meta.createdAt);

    root.innerHTML = `
      <section class="screen home">
        <!-- 留守番の妖のお出迎え -->
        <div class="caretaker">
          <div class="ct-art">${CARETAKER.icon}</div>
          <div class="ct-bubble">
            <div class="ct-name">${CARETAKER.name}</div>
            <div class="ct-line" id="ctLine">${greeting}</div>
          </div>
        </div>

        <!-- セクション入口 -->
        <div class="section-grid">
          ${SECTIONS.map(secCard).join("")}
        </div>

        <!-- 開発用ユーティリティ（Phase 進行で整理予定） -->
        <div class="dev-tools">
          <button class="btn-ghost" id="devCoin">＋100 コイン（仮）</button>
          <button class="btn-ghost danger" id="devReset">セーブ初期化</button>
        </div>
        <div class="home-comp">図鑑コンプ率 ${Math.floor(overallStats().pct * 100)}%</div>
        <div class="home-foot">${APP.title} ${APP.subtitle}　ver ${APP.version}</div>
      </section>
    `;

    // セクション遷移
    root.querySelectorAll("[data-route]").forEach((b) => {
      b.addEventListener("click", () => ctx.go(b.dataset.route));
    });

    // 仮: コイン増加（ヘッダのカウントアップ＆フラッシュ確認用）
    root.querySelector("#devCoin").addEventListener("click", () => {
      addCoin(100);
      toast("＋100 コイン");
    });

    // セーブ初期化
    root.querySelector("#devReset").addEventListener("click", () => {
      if (confirm("セーブを初期化しますか？（元に戻せません）")) {
        resetSave();
        toast("セーブを初期化した", "warn");
        ctx.go("home");   // 再描画
      }
    });

    // 留守番の妖：クリックで一言（再訪台詞からランダム）
    root.querySelector(".caretaker").addEventListener("click", () => {
      const line = randOf(CARETAKER.lines.returnedSoon);
      root.querySelector("#ctLine").textContent = line;
    });
  },
  unmount() {},
};

function secCard(sec) {
  const lock = sec.ready ? "" : `<span class="sec-soon">準備中</span>`;
  return `
    <button class="sec-card" data-route="${sec.route}">
      <span class="sec-ico">${sec.icon}</span>
      <span class="sec-name">${sec.name}</span>
      <span class="sec-desc">${sec.desc}</span>
      ${lock}
    </button>`;
}

/* lastSeenPrev（今回の訪問“前”の最終訪問時刻）と createdAt から台詞帯を選ぶ */
function pickGreeting(lastSeenPrev, createdAt) {
  const now = Date.now();
  // 初回（作成直後）
  if (!lastSeenPrev || lastSeenPrev === createdAt) {
    return randOf(CARETAKER.lines.firstVisit);
  }
  const gap = now - lastSeenPrev;
  if (gap >= RETURN_DAY_MS) return randOf(CARETAKER.lines.returnedDay);
  return randOf(CARETAKER.lines.returnedSoon);
}

function randOf(arr) {
  if (!arr || !arr.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

export default homeScreen;
