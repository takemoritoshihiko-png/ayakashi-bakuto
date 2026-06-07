/* ============================================================
   screens/_placeholder.js — 未実装画面の共通プレースホルダ
   各 Phase で該当画面ファイルが中身を実装して差し替える。
   ============================================================ */
import { SECTIONS } from "../config/index.js";

export function makePlaceholder(id) {
  const meta = SECTIONS.find((s) => s.id === id) || { icon: "❓", name: id, desc: "" };
  return {
    mount(root, ctx) {
      root.innerHTML = `
        <section class="screen ph-screen">
          <div class="ph-icon">${meta.icon}</div>
          <h2 class="ph-title">${meta.name}</h2>
          <p class="ph-desc">${meta.desc}</p>
          <p class="ph-note">この機能は次の Phase で実装されます。</p>
          <button class="btn-ghost" id="phBack">← ホームへ戻る</button>
        </section>
      `;
      root.querySelector("#phBack").addEventListener("click", () => ctx.back());
    },
    unmount() {},
  };
}
