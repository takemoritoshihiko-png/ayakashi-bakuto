/* ============================================================
   screens/gamble.js — 妖賭場を「稼ぐ」画面として統合（Phase B）
   ・入場画面（持ち込み額＋賭場選択＋妖の煽り）
   ・賭場本体は legacy を移植（CSS は .gamble-root にスコープ、css/gamble.css）
   ・賭け資金 bankroll は局所変数。退場/離脱時に純損益を中央 coin へ反映。
   ・charms/venues/titles/achievements/daily は save.gamble に保存。
   このファイルの venue ロジックは build_gamble.cjs による自動移植です。
   ============================================================ */
import { getState, saveSave, addCoin, getCoin } from "../state.js";
import { GAMBLE, GAMBLE_VENUES, ENTRY_TAUNTS, BALANCE } from "../config/index.js";

/* ---- 中央セーブ <-> 旧セーブ形 の橋渡し ---- */
function hydrateGamble(){
  const st = getState(), g = st.gamble, s = st.stats;
  return {
    deepest: s.deepestDepth|0,
    bestPot: g.bestPot|0,
    totalRounds: s.gambleRuns|0,
    lifetime: g.lifetime|0,
    unlocked: (g.unlockedVenues||["kitsune"]).slice(),
    owned: (g.charmsOwned||[]).slice(),
    equipped: (g.charmsEquipped||[]).slice(),
    titlesSeen: ((g.titles&&g.titles.seen)||[]).slice(),
    achievements: ((g.achievements&&g.achievements.unlocked)||[]).slice(),
    daily: {
      date: g.daily.date,
      attemptsUsed: g.daily.attemptsUsed|0,
      bestDepth: (g.daily.best&&g.daily.best.depth)|0,
      bestPot: (g.daily.best&&g.daily.best.pot)|0,
    },
    streak: { count: g.daily.streak|0, lastDate: g.daily.lastDate||"" },
    stats: {
      flees: g.flags.flees|0, depth1Flees: g.flags.depth1Flees|0,
      cursedFlee: !!g.flags.cursedFlee, tripleResonance: !!g.flags.tripleResonance,
    },
  };
}
function persistGamble(gv){
  const st = getState();
  st.stats.deepestDepth = Math.max(st.stats.deepestDepth|0, gv.deepest|0);
  st.stats.gambleRuns = gv.totalRounds|0;
  st.gamble.bestPot = gv.bestPot|0;
  st.gamble.lifetime = gv.lifetime|0;
  st.gamble.unlockedVenues = (gv.unlocked||[]).slice();
  st.gamble.charmsOwned = (gv.owned||[]).slice();
  st.gamble.charmsEquipped = (gv.equipped||[]).slice();
  st.gamble.titles.seen = (gv.titlesSeen||[]).slice();
  st.gamble.achievements.unlocked = (gv.achievements||[]).slice();
  st.gamble.daily = {
    date: gv.daily.date, attemptsUsed: gv.daily.attemptsUsed|0,
    best: { depth: gv.daily.bestDepth|0, pot: gv.daily.bestPot|0 },
    streak: gv.streak.count|0, lastDate: gv.streak.lastDate||"",
  };
  st.gamble.flags = {
    flees: gv.stats.flees|0, depth1Flees: gv.stats.depth1Flees|0,
    cursedFlee: !!gv.stats.cursedFlee, tripleResonance: !!gv.stats.tripleResonance,
  };
  saveSave();
}

const VENUE_HTML = "<div class=\"gamble-root\">\n<div class=\"app\" id=\"gambleApp\">\n\n  <!-- 背景（賭場ごとに切替）＋潜行で沈む暗幕 -->\n  <div class=\"scene\" id=\"scene\"><span class=\"ember\"></span><span class=\"ember\"></span><span class=\"ember\"></span><span class=\"ember\"></span><span class=\"ember\"></span><span class=\"ember\"></span></div>\n  <div class=\"veil\" id=\"veil\"></div>\n\n  <button class=\"mute\" id=\"muteBtn\" title=\"ミュート切替\" aria-label=\"ミュート切替\">🔊</button>\n  <div class=\"flash\" id=\"flash\"></div>\n  <div class=\"diving hidden\" id=\"diving\"><div class=\"diving-inner\">潜行中…</div></div>\n\n  <div class=\"topbar\">\n    <div><div class=\"label\">場内資金</div><div class=\"val\" id=\"coins\">1000</div></div>\n    <div style=\"text-align:right\"><div class=\"label\">最深記録</div><div class=\"val\" id=\"record\">0</div></div>\n  </div>\n\n  <div class=\"title\">妖賭場</div>\n  <div class=\"subtitle\">A Y A K A S H I</div>\n\n  <!-- ===== 二つ名バー（常時表示） ===== -->\n  <div class=\"metabar\">\n    <span class=\"title-now\" id=\"titleNow\">小博打</span>\n    <span class=\"title-next\" id=\"titleNext\">次の二つ名まで あと深さ5</span>\n    <button class=\"records-btn\" id=\"recordsBtn\">記録</button>\n    <button class=\"records-btn\" id=\"achvBtn\">実績</button>\n  </div>\n\n  <!-- ===== 装備お守り＋共鳴（常時表示） ===== -->\n  <div class=\"charmbar\">\n    <div class=\"charm-chips\" id=\"charmChips\"></div>\n    <div class=\"reso-badges\" id=\"resoBadges\"></div>\n  </div>\n\n  <!-- ===== 妖との対峙（中央上に妖、下に賭けUI） ===== -->\n  <div class=\"yokai-stage\" id=\"yokaiStage\">\n    <div class=\"yokai-speech\" id=\"yokaiSpeech\"></div>\n    <div class=\"yokai-art\" id=\"yokaiArt\"></div>\n    <div class=\"yokai-name\" id=\"yokaiName\"></div>\n  </div>\n\n  <!-- ===== 記録パネル ===== -->\n  <div class=\"panel hidden\" id=\"recordsPanel\">\n    <div class=\"panel-card\">\n      <h3>賭場の記録</h3>\n      <div class=\"sub\" id=\"panelTitle\">二つ名：小博打</div>\n      <dl>\n        <dt>最深記録</dt>      <dd><span id=\"recDeepest\">0</span> 段</dd>\n        <dt>最高取り分</dt>    <dd><span id=\"recBestPot\">0</span> 枚</dd>\n        <dt>総プレイ回数</dt>  <dd><span id=\"recRounds\">0</span> 回</dd>\n        <dt>累計獲得コイン</dt><dd><span id=\"recLifetime\">0</span> 枚</dd>\n        <dt>次の二つ名まで</dt><dd id=\"recNext\">あと 深さ5</dd>\n      </dl>\n      <button class=\"close\" id=\"closeRecords\">閉じる</button>\n    </div>\n  </div>\n\n  <!-- ===== 妖具屋（ショップ） ===== -->\n  <div class=\"panel hidden\" id=\"shopPanel\">\n    <div class=\"panel-card shop-card\">\n      <h3>妖具屋</h3>\n      <div class=\"sub\">所持金 <span id=\"shopCoins\">0</span> 枚 ・ 5枠中 <span id=\"shopEquipCount\">0</span> 装備</div>\n      <div class=\"shop-offer\" id=\"shopOffer\"></div>\n      <div class=\"shop-foot\">\n        <button class=\"ghost-btn\" id=\"rerollBtn\">再抽選 (−100)</button>\n        <button class=\"close inline\" id=\"closeShop\">閉じる</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- ===== お守り整理（インベントリ） ===== -->\n  <div class=\"panel hidden\" id=\"invPanel\">\n    <div class=\"panel-card\">\n      <h3>お守り整理</h3>\n      <div class=\"sub\" id=\"invSub\">5枠中 0 装備</div>\n      <div class=\"inv-list\" id=\"invList\"></div>\n      <button class=\"close\" id=\"closeInv\">閉じる</button>\n    </div>\n  </div>\n\n  <!-- ===== 実績一覧 ===== -->\n  <div class=\"panel hidden\" id=\"achvPanel\">\n    <div class=\"panel-card\">\n      <h3>実績</h3>\n      <div class=\"sub\" id=\"achvSub\">0/0</div>\n      <div class=\"inv-list\" id=\"achvList\"></div>\n      <button class=\"close\" id=\"closeAchv\">閉じる</button>\n    </div>\n  </div>\n\n  <!-- ===== 黄泉返り（継続オファー） ===== -->\n  <div class=\"panel hidden\" id=\"continuePanel\">\n    <div class=\"panel-card\">\n      <h3>黄泉返り</h3>\n      <div class=\"sub\">飲み込まれかけた——コインを払えば、現世に踏みとどまれる。</div>\n      <div class=\"continue-cost\">継続コスト <span id=\"continueCost\">0</span> 枚</div>\n      <div class=\"shop-foot\">\n        <button class=\"ghost-btn\" id=\"continueBtn\">継続する</button>\n        <button class=\"close inline\" id=\"giveupBtn\">諦める</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- ===== ラウンド中の画面 ===== -->\n  <div id=\"roundView\" class=\"hidden\">\n    <div class=\"daily-banner hidden\" id=\"dailyBanner\"></div>\n    <div class=\"stage\">\n      <div class=\"depth\">潜行 <b id=\"depth\">0</b> 段</div>\n      <div class=\"pot\">取り分<b id=\"pot\">0</b></div>\n    </div>\n\n    <div class=\"forecast\">\n      <div class=\"head\">次に潜ると…</div>\n      <div class=\"row\">\n        <div class=\"item mul\"><div class=\"k\">配当</div><div class=\"v\" id=\"nextMul\">×0.00</div></div>\n        <div class=\"item bust\"><div class=\"k\">破産</div><div class=\"v\" id=\"nextBust\">0%</div></div>\n      </div>\n    </div>\n\n    <button class=\"ama-btn hidden\" id=\"amaBtn\">⛅ 天叢雲を使う（次の段を破産0%に）</button>\n\n    <div class=\"actions\">\n      <button class=\"btn btn-dive\" id=\"diveBtn\">潜る</button>\n      <button class=\"btn btn-flee\" id=\"fleeBtn\">逃げる</button>\n    </div>\n  </div>\n\n  <!-- ===== ラウンド外（賭け金選択）の画面 ===== -->\n  <div id=\"betView\">\n    <!-- 今日の妖（日替わり挑戦） -->\n    <div class=\"daily-card\" id=\"dailyCard\"></div>\n    <div class=\"casinos\">\n      <div class=\"head\">賭場を選ぶ</div>\n      <div class=\"casino-row\" id=\"casinoList\"></div>\n    </div>\n    <div class=\"bets\">\n      <div class=\"head\">賭け金を選んで開始</div>\n      <div class=\"grid\">\n        <button class=\"btn-bet\" data-bet=\"100\">100</button>\n        <button class=\"btn-bet\" data-bet=\"300\">300</button>\n        <button class=\"btn-bet\" data-bet=\"all\">全額</button>\n      </div>\n    </div>\n    <div class=\"shop-actions\">\n      <button class=\"ghost-btn\" id=\"openShopBtn\">🏮 妖具屋</button>\n      <button class=\"ghost-btn\" id=\"openInvBtn\">お守り整理</button>\n      <button class=\"ghost-btn\" id=\"exitBtn\">退場（持ち帰る）</button>\n    </div>\n  </div>\n\n  <!-- ===== ゲームオーバー ===== -->\n  <div id=\"overView\" class=\"hidden\">\n    <div class=\"gameover\">\n      <h2>身ぐるみ剥がされた</h2>\n      <p>持ち込みは妖に呑まれた。財布の残りは無事だ。</p>\n      <div class=\"next-goal\" id=\"overGoal\">\n        <div class=\"ng-label\" id=\"overGoalLabel\">次の二つ名まで</div>\n        <div class=\"ng-val\" id=\"overGoalVal\">あと 深さ5</div>\n      </div>\n      <button class=\"btn btn-flee\" id=\"restartBtn\" style=\"max-width:200px;margin:0 auto;\">退場（ホームへ）</button>\n    </div>\n  </div>\n\n  <div class=\"message\" id=\"message\">いくら賭ける？</div>\n\n</div>\n</div>";

/* ============================================================
   入場画面（財布から持ち込み額を選ぶ）
   ============================================================ */
let _session = null;   // { teardown, getBankroll, bringIn, committed }

function taunt(venueId, bringIn, wallet){
  const t = ENTRY_TAUNTS[venueId] || ENTRY_TAUNTS.kitsune;
  if (wallet > 0 && bringIn >= wallet) return t.allIn;
  if (bringIn <= GAMBLE.minBring || (wallet > 0 && bringIn < wallet * 0.25)) return t.small;
  return t.high;
}

function renderEntry(root, ctx){
  const st = getState();
  const wallet = getCoin();
  const unlocked = st.gamble.unlockedVenues || ["kitsune"];
  const venues = GAMBLE_VENUES;
  let venueId = unlocked.includes("kitsune") ? "kitsune" : (unlocked[0] || "kitsune");

  const free = wallet < GAMBLE.minBring;            // 財布が空ならご祝儀
  const maxBring = free ? GAMBLE.starterStake : wallet;
  let amount = free ? GAMBLE.starterStake : Math.min(GAMBLE.presets[0], wallet);

  function paint(){
    const presetBtns = GAMBLE.presets
      .filter(p => p <= wallet)
      .map(p => `<button class="ent-preset" data-amt="${p}">${p.toLocaleString("ja-JP")}</button>`)
      .join("");
    root.innerHTML = `
      <section class="screen gamble-entry">
        <h2 class="ent-title">妖賭場 — 入場</h2>
        <div class="ent-wallet">財布 <b>${wallet.toLocaleString("ja-JP")}</b> 枚</div>

        <div class="ent-block">
          <div class="ent-label">賭場を選ぶ</div>
          <div class="ent-venues">
            ${venues.map(v => {
              const lock = !unlocked.includes(v.id);
              return `<button class="ent-venue${v.id===venueId?" sel":""}${lock?" lock":""}" data-venue="${v.id}" ${lock?"disabled":""}>
                <span class="ev-ico">${v.icon}</span><span class="ev-name">${v.name}</span>
                <span class="ev-note">${lock? "🔒 "+v.note : v.note}</span>
              </button>`;
            }).join("")}
          </div>
        </div>

        <div class="ent-block">
          <div class="ent-label">持ち込み額 ${free?'<span class="ent-free">ご祝儀（無償）</span>':''}</div>
          <div class="ent-amount" id="entAmount">${amount.toLocaleString("ja-JP")} 枚</div>
          ${free ? "" : `
            <input type="range" id="entSlider" min="${GAMBLE.minBring}" max="${maxBring}" step="100" value="${amount}" class="ent-slider">
            <div class="ent-presets">${presetBtns}<button class="ent-preset" data-amt="all">全額</button></div>
          `}
        </div>

        <div class="ent-taunt" id="entTaunt"></div>

        <div class="ent-foot">
          <button class="btn-ghost" id="entBack">← 戻る</button>
          <button class="ent-enter" id="entEnter">${free? "ご祝儀をもらって入場" : "入場する"}</button>
        </div>
      </section>`;

    // taunt
    root.querySelector("#entTaunt").textContent = "「" + taunt(venueId, amount, wallet) + "」";

    // venue select
    root.querySelectorAll("[data-venue]").forEach(b => b.addEventListener("click", () => {
      if (b.disabled) return;
      venueId = b.dataset.venue; paint();
    }));
    // slider
    const sl = root.querySelector("#entSlider");
    if (sl) sl.addEventListener("input", () => {
      amount = Math.max(GAMBLE.minBring, Math.min(maxBring, Number(sl.value)));
      root.querySelector("#entAmount").textContent = amount.toLocaleString("ja-JP") + " 枚";
      root.querySelector("#entTaunt").textContent = "「" + taunt(venueId, amount, wallet) + "」";
    });
    // presets
    root.querySelectorAll(".ent-preset").forEach(b => b.addEventListener("click", () => {
      amount = b.dataset.amt === "all" ? wallet : Number(b.dataset.amt);
      amount = Math.max(GAMBLE.minBring, Math.min(maxBring, amount));
      paint();
    }));
    // back / enter
    root.querySelector("#entBack").addEventListener("click", () => ctx.go("home"));
    root.querySelector("#entEnter").addEventListener("click", () => {
      const bringIn = free ? 0 : amount;          // ご祝儀は会計上 0（純益＝全額）
      enterVenue(root, ctx, { bankroll: amount, bringIn, venueId, taunt: taunt(venueId, amount, wallet) });
    });
  }
  paint();
}

/* ============================================================
   退場/離脱: 純損益(残bankroll - 持ち込み)を中央 coin へ反映（1回だけ）
   ============================================================ */
function commitSession(){
  if (!_session || _session.committed) return;
  _session.committed = true;
  const net = _session.getBankroll() - _session.bringIn;   // + 勝ち越し / − 負け越し
  if (net !== 0) addCoin(net);                              // ヘッダ coin がカウントアップ
}

function teardownSession(){
  if (_session && _session.teardown) { try { _session.teardown(); } catch (e) {} }
}

function enterVenue(root, ctx, opts){
  const onExit = () => { commitSession(); teardownSession(); _session = null; ctx.go("home"); };
  const handle = initVenue(root, { ...opts, onExit });
  _session = { teardown: handle.teardown, getBankroll: handle.getBankroll, bringIn: opts.bringIn, committed: false };
}

/* ============================================================
   賭場本体（legacy 移植）。initVenue(root, OPTS) -> { teardown, getBankroll }
   ============================================================ */
function initVenue(root, OPTS){
  root.innerHTML = VENUE_HTML;
  let __alive = true;
  const __timers = [];
  function exitVenue(){ OPTS.onExit(); }

  /* ===================== BEGIN ported venue logic ===================== */
  /* ============================================================
     CONFIG — 調整用定数はすべてここに集約
     ============================================================ */
  const CONFIG = {
    startCoins: 1000,
    saveKey: "ayakashi_save",

    // 破産確率: bustBase + depth*bustStep（上限 bustCap）/ 配当: mulBase + depth*mulStep
    // bustStep・bustCap・mulBase は全賭場 共通。bustBase と mulStep のみ賭場ごとに変える。
    bustStep: 0.06,   // 共通
    bustCap:  0.85,   // 共通
    mulBase:  1.4,    // 共通

    // ---- 賭場（第3指示）: カーブが違うだけでルールは共通 ----
    casinos: [
      { id:"kitsune", name:"狐の賭場", icon:"🦊",
        bustBase:0.05, mulStep:0.15,                 // ＝第1指示の標準値
        unlock:{ type:"always" } },
      { id:"oni", name:"鬼の賭場", icon:"👹",
        bustBase:0.10, mulStep:0.28,                 // 高リスク高配当
        unlock:{ type:"depth", value:8, desc:"最深 8 で解放" } },
      { id:"nekomata", name:"猫又の賭場", icon:"🐈‍⬛",
        bustBase:0.03, mulStep:0.10,                 // 低リスク低配当
        unlock:{ type:"lifetime", value:50000, desc:"累計 50,000 枚で解放" } },
    ],

    // ---- 二つ名（第3指示）: 最深記録の閾値で付与 ----
    titles: [
      { min:0,  name:"小博打" },
      { min:5,  name:"常連" },
      { min:8,  name:"深みの住人" },
      { min:12, name:"深淵を覗く者" },
      { min:16, name:"賭神" },
    ],

    whispers: ["まだいける…","次で当たる気がするな","ここで引くのか？","欲が、お前を深くする"],

    /* ============================================================
       妖の固有ボイス（第5指示）: 賭場ごとの口調で生存/紙一重/逃げ/バスト/畏怖
       ============================================================ */
    charVoices: {
      kitsune: {
        survive: ["ふふ…まだ、いけましょう？", "賢いお方は、ここで退く", "存外、肝が据わっておいでで"],
        near:    ["おや、際どい…ふふ", "今のは…私もひやり、と"],
        flee:    ["逃げるのですね。賢明な…つまらない", "またのお越しを、ふふ"],
        bust:    ["あらあら、飲まれましたか", "欲は、身を滅ぼしますのよ"],
        awe:     ["…見事。あなた様には、敵いませぬ"]
      },
      oni: {
        survive: ["もっと来い！", "そんなもんか、ええ？", "ぬるい、ぬるいわ！"],
        near:    ["ほう、しぶといのう！", "今ので死なんか、面白い！"],
        flee:    ["逃げるか、小僧", "腰抜けが！戻ってこい！"],
        bust:    ["ぐははは、喰ろうてやったわ！", "それ見たことか！"],
        awe:     ["…貴様、鬼神か。認めてやる"]
      },
      nekomata: {
        survive: ["にゃはは、次で当たるかもよ？", "もう一声、いっとく？", "おもしろくなってきたにゃ"],
        near:    ["うひゃ、危なかったにゃ〜", "今の見た？ギリギリだにゃ"],
        flee:    ["やめちゃうの？つまんない", "にゃ〜、もう帰るの？"],
        bust:    ["あ〜あ、落ちちゃった♪", "にゃはは、ごちそうさま！"],
        awe:     ["…にゃんと。アンタ、ただ者じゃないにゃ"]
      }
    },

    /* ============================================================
       お守り（第4指示）: 効果フックでルールを上書き
         hooks:
           onRoundStart(state)              ラウンド開始時
           modifyBustChance(base, ctx)→num  破産確率を修正（ctx.depth）
           modifyPayoutMul(mul, ctx)→num    その段の配当倍率を修正（ctx.depth/survives/bust）
           onBust(ctx)→true で救済（バスト無効化）
           onActualBust(ctx)                実バスト確定時の副作用（代償など）
           modifyCashout(pot, ctx)→num      逃げ額を修正
       rarity: 並 / 上 / 極 / 呪
       ============================================================ */
    slots: 5,           // 装備スロット数
    charms: [
      { id:"kitsune_wisdom", name:"狐の知恵", rarity:"並", tags:[],
        desc:"各段の破産確率 -3%",
        hooks:{ modifyBustChance:(b)=> b - 0.03 } },

      { id:"greedy_daruma", name:"欲張り達磨", rarity:"上", tags:["欲"],
        desc:"配当 +0.08/段、破産 +2%",
        hooks:{ modifyPayoutMul:(m,ctx)=> m + ctx.depth*0.08,
                modifyBustChance:(b)=> b + 0.02 } },

      { id:"abyss_eye", name:"深淵の眼", rarity:"上", tags:["深淵"],
        desc:"depth≥8 の段は配当 +50%",
        hooks:{ modifyPayoutMul:(m,ctx)=> ctx.depth>=8 ? m*1.5 : m } },

      { id:"coward_shield", name:"臆病者の盾", rarity:"並", tags:["守"],
        desc:"depth≤3 では破産しない",
        hooks:{ modifyBustChance:(b,ctx)=> ctx.depth<=3 ? 0 : b } },

      { id:"greed_jar", name:"強欲の壺", rarity:"上", tags:["欲"],
        desc:"逃げ額 +20%",
        hooks:{ modifyCashout:(p)=> p*1.2 } },

      { id:"win_bell", name:"連勝の鈴", rarity:"上", tags:[],
        desc:"3段連続生存ごとに次段配当 +30%",
        hooks:{ modifyPayoutMul:(m,ctx)=> m * (1 + 0.30*Math.floor(ctx.survives/3)) } },

      { id:"oni_fire", name:"鬼火", rarity:"極", tags:["深淵"],
        desc:"破産%が50%超の段は配当 2倍",
        hooks:{ modifyPayoutMul:(m,ctx)=> ctx.bust>0.5 ? m*2 : m } },

      { id:"jizo", name:"身代わり地蔵", rarity:"極", tags:["守"],
        desc:"1ラウンドに1回バストを無効化",
        hooks:{ onBust:(ctx)=>{ if(state.round.jizoUsed) return false; state.round.jizoUsed = true; return true; } } },

      { id:"hungry_mask", name:"飢えた面", rarity:"呪", tags:["深淵"],
        desc:"全段の破産 +5%、配当 +0.20/段",
        hooks:{ modifyBustChance:(b)=> b + 0.05,
                modifyPayoutMul:(m,ctx)=> m + ctx.depth*0.20 } },

      { id:"blood_pact", name:"血の契約", rarity:"呪", tags:["欲"],
        desc:"全配当 +80%、バスト時に賭け金分を追加で失う",
        hooks:{ modifyPayoutMul:(m)=> m*1.8,
                onActualBust:()=>{ state.coins = Math.max(0, state.coins - state.bet); } } },

      /* ---- 神話級（第6指示）: 極の上。超低確率＋専用演出 ---- */
      { id:"amatsumukumo", name:"天叢雲", rarity:"神話", tags:["守"],
        desc:"1ラウンドに1段、破産確率を0%にできる（ボタンで任意発動）",
        hooks:{ modifyBustChance:(b)=> state.round.amaArmed ? 0 : b } },

      { id:"yamata", name:"八岐の欲", rarity:"神話", tags:["欲"],
        desc:"他お守りの配当ボーナスを全て1.5倍、ただし破産 +6%",
        // 配当増幅は multiplierAt 内で特別処理（他効果の後に適用）
        hooks:{ modifyBustChance:(b)=> b + 0.06 } },

      { id:"yomigaeri", name:"黄泉返り", rarity:"神話", tags:["守"],
        desc:"バスト時、コインを払えばそのラウンドを継続できる（1回）",
        // 継続処理は resolveDive のバスト分岐で扱う（onBust では消費しない）
        hooks:{} },
    ],

    /* ---- 共鳴（第4指示）: 装備タグの数で発動 ---- */
    resonances: [
      { id:"abyss", name:"共鳴・深淵", tag:"深淵", need:2, desc:"depth≥8 の配当 +30%",
        hooks:{ modifyPayoutMul:(m,ctx)=> ctx.depth>=8 ? m*1.3 : m } },
      { id:"greed", name:"共鳴・強欲", tag:"欲", need:2, desc:"逃げ額 +15%",
        hooks:{ modifyCashout:(p)=> p*1.15 } },
      { id:"wall", name:"共鳴・鉄壁", tag:"守", need:2, desc:"全段の破産 -2%",
        hooks:{ modifyBustChance:(b)=> b - 0.02 } },
    ],

    /* ---- 妖具屋（ショップ） ---- */
    shop: {
      offer:      3,                                            // 提示数
      rerollCost: 250,                                          // 再抽選コスト（引き上げ）
      weights: { "並":60, "上":28, "極":6, "呪":6, "神話":1.2 },// 抽選レアリティ加重（神話は超低確率）
      price:   { "並":700, "上":1800, "極":4500, "呪":600, "神話":13000 }, // お守り価格 引き上げ
    },

    // タグ・レアリティの表示色
    tagColors: { "欲":"#ff8c42", "深淵":"#8b5cf6", "守":"#2cc4d4", "呪":"#c8384a" },
    rarityColors: { "並":"#c2bcae", "上":"#4664cf", "極":"#e8c372", "呪":"#c8384a", "神話":"#b46cff" }, // design.css と統一

    /* ============================================================
       日替わり妖（第6指示）: 日付シードで今日の異形＋特殊ルールを1つ
         hooks に加え canFlee(depth)→bool（逃げ可否）を持てる
       ============================================================ */
    daily: { attempts:3, baseReward:500, streakBonus:200 },   // 1日の挑戦回数・報酬・連続日ボーナス/日
    dailyModifiers: [
      { id:"double", name:"倍返しの宴", icon:"🎴",
        desc:"破産で賭け金を倍失う。ただし全配当 ×3",
        hooks:{ modifyPayoutMul:(m)=> m*3,
                onActualBust:()=>{ state.coins = Math.max(0, state.coins - state.bet); } } },
      { id:"shallow", name:"浅瀬の禁", icon:"🌊",
        desc:"depth≤3 では逃げられない。代わりに破産 -10%",
        hooks:{ modifyBustChance:(b)=> b - 0.10 },
        canFlee:(depth)=> depth > 3 },
      { id:"greedNight", name:"強欲の夜", icon:"🌙",
        desc:"逃げ額 +50%。ただし破産 +8%",
        hooks:{ modifyCashout:(p)=> p*1.5,
                modifyBustChance:(b)=> b + 0.08 } },
    ],

    /* ---- 黄泉返り（継続コスト） ---- */
    yomi: { costRate:0.4, minCost:200 },   // 継続コスト = max(minCost, 所持金*costRate)

    /* ============================================================
       実績（第6指示）: condition(S) は S=state.save を受け真偽を返す
       ============================================================ */
    achievements: [
      { id:"first_return", name:"初めての帰還", desc:"はじめて逃げ切る", hidden:false,
        condition:(S)=> S.stats.flees >= 1 },
      { id:"abyss_dweller", name:"深淵の住人", desc:"深さ12に到達する", hidden:false,
        condition:(S)=> S.deepest >= 12 },
      { id:"ten_thousand", name:"無傷の壱万", desc:"一度の逃げで1万枚超を得る", hidden:false,
        condition:(S)=> S.bestPot > 10000 },
      { id:"cursed_bearer", name:"呪いを背負う者", desc:"呪いのお守りを装備して逃げ切る", hidden:false,
        condition:(S)=> S.stats.cursedFlee },
      { id:"resonance_eye", name:"共鳴開眼", desc:"共鳴を3種 同時に発動する", hidden:false,
        condition:(S)=> S.stats.tripleResonance },
      { id:"god_name", name:"賭神たる証", desc:"最高位の二つ名に到達する", hidden:false,
        condition:(S)=> S.deepest >= 16 },
      { id:"daily_streak3", name:"日参りの徒", desc:"日替わりに3日連続で挑む", hidden:false,
        condition:(S)=> S.streak.count >= 3 },
      { id:"collector", name:"蒐集の鬼", desc:"お守りを8種 集める", hidden:false,
        condition:(S)=> S.owned.length >= 8 },
      { id:"mythic_owner", name:"神話に触れし者", desc:"神話級のお守りを手にする", hidden:false,
        condition:(S)=> S.owned.some(id => { const c = CONFIG.charms.find(x=>x.id===id); return c && c.rarity==="神話"; }) },
      { id:"coward_art", name:"臆病者の美学", desc:"???", hidden:true,
        condition:(S)=> S.stats.depth1Flees >= 5 },
    ],

    /* ---- FX（第2指示）: 演出・音の調整値。ルール/確率/配当には不干渉 ---- */
    fx: {
      diveDelay:       500,    // 「潜る」の溜め時間(ms)
      countUpMs:       450,    // pot/coins のカウントアップ時間(ms)
      nearMissMargin:  0.06,   // |roll - bust| がこの差以内なら「紙一重」
      heartbeatThreshold: 0.45,// 破産%がこれを超えると心音開始
      heartbeatSlow:   900,    // 心音の最遅テンポ(ms間隔)
      heartbeatFast:   320,    // 心音の最速テンポ(ms間隔)
      masterVolume:    0.5     // 全体音量
    }
  };

  /* 経済の一元化（Phase H）: 賭場カーブ/基準値を BALANCE で上書き */
  CONFIG.startCoins = BALANCE.gamble.startCoins;
  CONFIG.bustStep = BALANCE.gamble.bustStep;
  CONFIG.bustCap = BALANCE.gamble.bustCap;
  CONFIG.mulBase = BALANCE.gamble.mulBase;
  BALANCE.gamble.casinos.forEach((bc) => {
    const c = CONFIG.casinos.find((x) => x.id === bc.id);
    if (c) { c.bustBase = bc.bustBase; c.mulStep = bc.mulStep; }
  });

  /* ============================================================
     STATE — 状態は1つに集約
     ============================================================ */
  const state = {
    coins: CONFIG.startCoins,
    inRound: false,
    bet: 0,
    pot: 0,
    depth: 0,
    activeCasino: (typeof OPTS!=="undefined" && OPTS.venueId) || "kitsune",
    round: { jizoUsed:false, amaArmed:false, amaUsed:false, yomiUsed:false },  // ラウンド内フラグ（非永続）
    shopOffer: null,             // 妖具屋の現在の提示（[charmId,...]、非永続）
    dailyRound: false,           // 現在のラウンドが日替わり挑戦か
    pendingDaily: false,         // 次に始めるラウンドを日替わりにする予約
    pendingBust: null,           // 黄泉返り継続待ちのバスト情報
    save: null
  };

  /* ============================================================
     SAVE — 永続化（localStorage）。未対応・失敗時はメモリ上で続行
     ============================================================ */
  const Save = { persist(){ persistGamble(state.save); } };
  state.save = hydrateGamble();
  state.coins = OPTS.bankroll;            // 賭け資金は持ち込み額（中央 coin とは別）
  { // 装備お守りの健全化（中央セーブ由来の不正IDを丸める）
    const __ids = CONFIG.charms.map(c=>c.id);
    state.save.owned = (state.save.owned||[]).filter(id=>__ids.includes(id));
    state.save.equipped = (state.save.equipped||[]).filter(id=>__ids.includes(id) && state.save.owned.includes(id)).slice(0, CONFIG.slots);
  }

  /* ============================================================
     DOM 参照
     ============================================================ */
  const el = {
    app:      document.getElementById('gambleApp'),
    flash:    document.getElementById('flash'),
    diving:   document.getElementById('diving'),
    muteBtn:  document.getElementById('muteBtn'),
    coins:    document.getElementById('coins'),
    record:   document.getElementById('record'),
    depth:    document.getElementById('depth'),
    pot:      document.getElementById('pot'),
    nextMul:  document.getElementById('nextMul'),
    nextBust: document.getElementById('nextBust'),
    message:  document.getElementById('message'),
    roundView:document.getElementById('roundView'),
    betView:  document.getElementById('betView'),
    overView: document.getElementById('overView'),
    diveBtn:  document.getElementById('diveBtn'),
    fleeBtn:  document.getElementById('fleeBtn'),
    restartBtn:document.getElementById('restartBtn'),
    // メタ進行
    titleNow:  document.getElementById('titleNow'),
    titleNext: document.getElementById('titleNext'),
    recordsBtn:document.getElementById('recordsBtn'),
    recordsPanel:document.getElementById('recordsPanel'),
    closeRecords:document.getElementById('closeRecords'),
    panelTitle:document.getElementById('panelTitle'),
    recDeepest:document.getElementById('recDeepest'),
    recBestPot:document.getElementById('recBestPot'),
    recRounds: document.getElementById('recRounds'),
    recLifetime:document.getElementById('recLifetime'),
    recNext:   document.getElementById('recNext'),
    casinoList:document.getElementById('casinoList'),
    overGoalLabel:document.getElementById('overGoalLabel'),
    overGoalVal:document.getElementById('overGoalVal'),
    // お守り / ショップ
    charmChips:document.getElementById('charmChips'),
    resoBadges:document.getElementById('resoBadges'),
    openShopBtn:document.getElementById('openShopBtn'),
    openInvBtn: document.getElementById('openInvBtn'),
    shopPanel:  document.getElementById('shopPanel'),
    shopCoins:  document.getElementById('shopCoins'),
    shopEquipCount:document.getElementById('shopEquipCount'),
    shopOffer:  document.getElementById('shopOffer'),
    rerollBtn:  document.getElementById('rerollBtn'),
    closeShop:  document.getElementById('closeShop'),
    invPanel:   document.getElementById('invPanel'),
    invSub:     document.getElementById('invSub'),
    invList:    document.getElementById('invList'),
    closeInv:   document.getElementById('closeInv'),
    // 世界観 / 妖
    veil:       document.getElementById('veil'),
    yokaiStage: document.getElementById('yokaiStage'),
    yokaiArt:   document.getElementById('yokaiArt'),
    yokaiName:  document.getElementById('yokaiName'),
    yokaiSpeech:document.getElementById('yokaiSpeech'),
    titleScreen:document.getElementById('titleScreen'),
    enterBtn:   document.getElementById('enterBtn'),
    tsDaily:    document.getElementById('tsDaily'),
    // 第6指示
    achvBtn:    document.getElementById('achvBtn'),
    achvPanel:  document.getElementById('achvPanel'),
    achvSub:    document.getElementById('achvSub'),
    achvList:   document.getElementById('achvList'),
    closeAchv:  document.getElementById('closeAchv'),
    dailyCard:  document.getElementById('dailyCard'),
    dailyBanner:document.getElementById('dailyBanner'),
    amaBtn:     document.getElementById('amaBtn'),
    continuePanel:document.getElementById('continuePanel'),
    continueCost: document.getElementById('continueCost'),
    continueBtn:  document.getElementById('continueBtn'),
    giveupBtn:    document.getElementById('giveupBtn'),
  };

  /* ============================================================
     計算ヘルパー（次に潜る段 = depth+1 の予測）
     ============================================================ */
  function nextDepth(){ return state.depth + 1; }

  function activeCasino(){
    return CONFIG.casinos.find(c => c.id === state.activeCasino) || CONFIG.casinos[0];
  }

  /* ============================================================
     CHARMS — お守り効果フック / 共鳴
     ============================================================ */
  function charmById(id){ return CONFIG.charms.find(c => c.id === id); }
  function equippedCharms(){ return state.save.equipped.map(charmById).filter(Boolean); }

  function tagCounts(){
    const counts = {};
    for(const ch of equippedCharms())
      for(const t of (ch.tags || [])) counts[t] = (counts[t] || 0) + 1;
    return counts;
  }
  function activeResonances(){
    const counts = tagCounts();
    return CONFIG.resonances.filter(r => (counts[r.tag] || 0) >= r.need);
  }
  // 値変換フック（modifyBustChance / modifyPayoutMul / modifyCashout）を
  // 装備お守り → 発動中の共鳴 → 日替わり異形 の順に適用
  function applyHook(name, value, ctx){
    for(const ch of equippedCharms()){
      const fn = ch.hooks && ch.hooks[name];
      if(fn) value = fn(value, ctx);
    }
    for(const r of activeResonances()){
      const fn = r.hooks && r.hooks[name];
      if(fn) value = fn(value, ctx);
    }
    if(state.dailyRound){                      // 今日の異形の特殊ルール
      const mod = getTodayModifier();
      const fn = mod && mod.hooks && mod.hooks[name];
      if(fn) value = fn(value, ctx);
    }
    return value;
  }

  function bustChanceAt(depth){
    const c = activeCasino();
    let b = Math.min(c.bustBase + depth * CONFIG.bustStep, CONFIG.bustCap);
    b = applyHook('modifyBustChance', b, { depth });   // お守り/共鳴/異形で上書き
    return Math.max(0, Math.min(1, b));
  }
  function multiplierAt(depth){
    const c = activeCasino();
    const base = CONFIG.mulBase + depth * c.mulStep;
    const ctx = { depth, survives: depth - 1, bust: bustChanceAt(depth) };
    let m = applyHook('modifyPayoutMul', base, ctx);   // お守り/共鳴/異形で上書き
    // 神話「八岐の欲」: 他効果の配当ボーナス分を最後に1.5倍
    if(state.save.equipped.includes('yamata')){
      m = base + (m - base) * 1.5;
    }
    return m;
  }

  /* ---- 二つ名（最深記録 d から判定） ---- */
  function currentTitle(d){
    let t = CONFIG.titles[0];
    for(const x of CONFIG.titles) if(d >= x.min) t = x;
    return t;
  }
  function nextTitle(d){
    for(const x of CONFIG.titles) if(x.min > d) return x;
    return null;   // 最高位
  }

  /* ---- 賭場アンロック判定 ---- */
  function isUnlocked(c){
    return state.save.unlocked.includes(c.id);
  }
  function meetsUnlock(c){
    const u = c.unlock;
    if(u.type === "always")   return true;
    if(u.type === "depth")    return state.save.deepest >= u.value;
    if(u.type === "lifetime") return state.save.lifetime >= u.value;
    return false;
  }
  // 条件を満たした賭場を解放。新規解放された賭場の配列を返す。
  function refreshUnlocks(){
    const newly = [];
    for(const c of CONFIG.casinos){
      if(!isUnlocked(c) && meetsUnlock(c)){
        state.save.unlocked.push(c.id);
        newly.push(c);
      }
    }
    if(newly.length) Save.persist();
    return newly;
  }

  /* ============================================================
     DAILY（第6指示）: 日付シードで今日の異形を全プレイヤー共通に決定
     ============================================================ */
  function todayStr(){
    const d = new Date();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return d.getFullYear() + '-' + m + '-' + day;   // YYYY-MM-DD（端末ローカル日付）
  }
  function hashStr(s){
    let h = 2166136261;
    for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function getTodayModifier(){
    const idx = hashStr(todayStr()) % CONFIG.dailyModifiers.length;
    return CONFIG.dailyModifiers[idx];
  }
  // 日付が変わっていれば今日分のベスト/挑戦回数をリセット
  function syncDaily(){
    const t = todayStr();
    if(state.save.daily.date !== t){
      state.save.daily = { date:t, attemptsUsed:0, bestDepth:0, bestPot:0 };
      Save.persist();
    }
  }
  function dailyAttemptsLeft(){
    syncDaily();
    return Math.max(0, CONFIG.daily.attempts - state.save.daily.attemptsUsed);
  }
  // 日替わり挑戦を1回消費し、ストリーク更新＆報酬を付与
  function consumeDailyAttempt(){
    syncDaily();
    const t = todayStr();
    const first = state.save.daily.attemptsUsed === 0;   // 今日の初挑戦か
    state.save.daily.attemptsUsed++;
    let reward = 0;
    if(first){
      // ストリーク（罰なし・ご褒美のみ）
      const last = state.save.streak.lastDate;
      const y = new Date(); y.setDate(y.getDate()-1);
      const ystr = y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
      if(last === ystr)      state.save.streak.count++;
      else if(last !== t)    state.save.streak.count = 1;
      state.save.streak.lastDate = t;
      reward = CONFIG.daily.baseReward + CONFIG.daily.streakBonus * (state.save.streak.count - 1);
      state.coins += reward;
    }
    Save.persist();
    return reward;
  }
  // 日替わりラウンドのベスト記録更新
  function updateDailyBest(depth, pot){
    syncDaily();
    let upd = false;
    if(depth > state.save.daily.bestDepth){ state.save.daily.bestDepth = depth; upd = true; }
    if(pot   > state.save.daily.bestPot){   state.save.daily.bestPot = pot;     upd = true; }
    if(upd) Save.persist();
  }

  /* ============================================================
     ACHIEVEMENTS（第6指示）: 条件を満たした実績を解除
     ============================================================ */
  function isAchieved(id){ return state.save.achievements.includes(id); }
  function checkAchievements(){
    const newly = [];
    for(const a of CONFIG.achievements){
      if(!isAchieved(a.id) && a.condition(state.save)){
        state.save.achievements.push(a.id);
        newly.push(a);
      }
    }
    if(newly.length){
      Save.persist();
      // 解除演出＋効果音（複数なら順に表示）
      flash('record'); Sound.fanfare(true);
      setMessage('実績 解除：' + newly.map(a=>'「'+a.name+'」').join(' '), 'win');
    }
    return newly;
  }

  /* ============================================================
     AUDIO — Web Audio API で合成（音声ファイル不使用）
     AudioContext は最初のユーザー操作時に生成
     ============================================================ */
  const Sound = {
    ctx:null, master:null, muted:false,
    ensure(){
      if(this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : CONFIG.fx.masterVolume;
      this.master.connect(this.ctx.destination);
    },
    setMuted(m){
      this.muted = m;
      if(this.master) this.master.gain.value = m ? 0 : CONFIG.fx.masterVolume;
    },
    // 単発トーン
    tone(type, f0, f1, dur, peak, t0){
      if(!this.ctx) return;
      const t = t0 ?? this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if(f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    // ホワイトノイズ一発（インパクト用）
    noise(dur, peak){
      if(!this.ctx) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * (1 - i/len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const lp = this.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + dur);
    },
    // 1. 下降する「溜め」音
    descend(ms){ this.ensure(); this.tone('sawtooth', 420, 110, ms/1000, 0.18); },
    // 2. 上昇チャイム：depth が深いほど高音
    chime(depth){
      this.ensure();
      const base = 330 * Math.pow(1.06, depth);
      this.tone('triangle', base, base*1.5, 0.32, 0.22);
      this.tone('sine', base*2, base*2.4, 0.22, 0.10, this.ctx && this.ctx.currentTime+0.02);
    },
    // 3. バスト：低く濁ったインパクト
    impact(){
      this.ensure();
      this.tone('sawtooth', 90, 40, 0.45, 0.3);
      this.noise(0.4, 0.35);
    },
    // 4. 逃げる：コインが連なる上昇音
    coins(n){
      this.ensure();
      if(!this.ctx) return;
      const t0 = this.ctx.currentTime;
      const steps = Math.max(4, Math.min(10, n));
      for(let i=0;i<steps;i++){
        const f = 660 * Math.pow(1.08, i);
        this.tone('square', f, f, 0.10, 0.10, t0 + i*0.055);
      }
    },
    // 5/6. 鼓動音1発（強弱）
    thump(strong){
      this.ensure();
      this.tone('sine', strong?70:55, strong?38:32, strong?0.32:0.22, strong?0.4:0.26);
    },
    // 新記録/二つ名/アンロックの祝いファンファーレ（上昇アルペジオ）
    fanfare(big){
      this.ensure();
      if(!this.ctx) return;
      const notes = big ? [523,659,784,1047,1319] : [659,880,1047];
      const t0 = this.ctx.currentTime;
      notes.forEach((f,i)=>{
        this.tone('triangle', f, f, 0.28, 0.18, t0 + i*0.09);
        this.tone('sine', f*2, f*2, 0.20, 0.07, t0 + i*0.09);
      });
    }
  };

  /* ============================================================
     FX HELPERS — フラッシュ / シェイク / カウントアップ
     ============================================================ */
  function flash(kind){
    el.flash.className = 'flash';
    void el.flash.offsetWidth;          // リフロー強制で再生し直す
    el.flash.classList.add(kind);
  }
  function shake(size){               // 'Small' | 'Big'
    const cls = 'shake' + size;
    el.app.classList.remove(cls);
    void el.app.offsetWidth;
    el.app.classList.add(cls);
  }
  el.app.addEventListener('animationend', e=>{
    if(e.animationName === 'shakeSmall') el.app.classList.remove('shakeSmall');
    if(e.animationName === 'shakeBig')   el.app.classList.remove('shakeBig');
  });

  function countUp(node, from, to, dur){
    const start = performance.now();
    const delta = to - from;
    function step(now){
      if(!__alive) return;
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = Math.floor(from + delta * eased);
      if(t < 1) requestAnimationFrame(step);
      else node.textContent = Math.floor(to);
    }
    requestAnimationFrame(step);
  }
  function popPot(){
    el.pot.classList.remove('pop');
    void el.pot.offsetWidth;
    el.pot.classList.add('pop');
  }

  function showDiving(on){ el.diving.classList.toggle('hidden', !on); }

  /* ============================================================
     HEART — 心音システム（破産%が高い時にループ＋画面脈動）
     ============================================================ */
  const Heart = {
    timer:null, curMs:0,
    update(){
      const bust = bustChanceAt(nextDepth());
      if(state.inRound && bust >= CONFIG.fx.heartbeatThreshold){
        this.run(this._intervalFor(bust));
      } else {
        this.stop();
      }
    },
    _intervalFor(bust){
      const span = CONFIG.bustCap - CONFIG.fx.heartbeatThreshold;
      const c = span > 0 ? Math.max(0, Math.min(1, (bust - CONFIG.fx.heartbeatThreshold)/span)) : 1;
      return CONFIG.fx.heartbeatSlow - (CONFIG.fx.heartbeatSlow - CONFIG.fx.heartbeatFast) * c;
    },
    run(ms){
      if(this.timer && Math.abs(ms - this.curMs) < 1) return; // 同テンポなら据え置き
      this.stop(true);
      this.curMs = ms;
      el.app.style.setProperty('--hb', (ms/1000).toFixed(3) + 's');
      el.app.classList.add('heartbeat');
      Sound.thump(false);
      this.timer = setInterval(()=>Sound.thump(false), ms);
    },
    stop(keepClass){
      if(this.timer){ clearInterval(this.timer); this.timer = null; }
      this.curMs = 0;
      if(!keepClass) el.app.classList.remove('heartbeat');
    }
  };

  /* ============================================================
     メッセージ表示
     ============================================================ */
  function setMessage(text, kind){
    el.message.textContent = text;
    el.message.className = 'message' + (kind ? ' ' + kind : '');
  }

  /* ============================================================
     META 描画 — 二つ名 / 次の目標 / 記録パネル / 賭場選択
     ============================================================ */
  function fmt(n){ return Math.floor(n).toLocaleString('ja-JP'); }

  // 「次の目標」テキスト：次の二つ名 → 無ければ次の賭場アンロック
  function nextGoalText(){
    const d = state.save.deepest;
    const nt = nextTitle(d);
    if(nt) return { label:'次の二つ名まで', val:'あと 深さ' + (nt.min - d) + '（' + nt.name + '）' };
    const locked = CONFIG.casinos.find(c => !isUnlocked(c));
    if(locked) return { label:'次の賭場まで', val:'🔒 ' + locked.name + '：' + (locked.unlock.desc||'') };
    return { label:'到達', val:'すべて極めた' };
  }

  function renderMeta(){
    const d = state.save.deepest;
    el.titleNow.textContent = currentTitle(d).name;
    const nt = nextTitle(d);
    el.titleNext.textContent = nt
      ? '次の二つ名まで あと深さ' + (nt.min - d)
      : '最高位「' + currentTitle(d).name + '」';
  }

  function renderPanel(){
    const d = state.save.deepest;
    el.panelTitle.textContent = '二つ名：' + currentTitle(d).name;
    el.recDeepest.textContent  = d;
    el.recBestPot.textContent  = fmt(state.save.bestPot);
    el.recRounds.textContent   = fmt(state.save.totalRounds);
    el.recLifetime.textContent = fmt(state.save.lifetime);
    const g = nextGoalText();
    el.recNext.textContent = g.val;
  }

  function renderCasinos(){
    el.casinoList.innerHTML = '';
    for(const c of CONFIG.casinos){
      const unlocked = isUnlocked(c);
      const active = c.id === state.activeCasino;
      const div = document.createElement('div');
      div.className = 'casino' + (active ? ' active' : '') + (unlocked ? '' : ' locked');
      const meta = '基準 ' + Math.round(c.bustBase*100) + '% ／ 配当+' + c.mulStep.toFixed(2) + '/段';
      div.innerHTML =
        '<div class="cicon">' + c.icon + '</div>' +
        '<div class="cname">' + c.name + '</div>' +
        (unlocked
          ? '<div class="cmeta">' + meta + '</div>'
          : '<div class="clock">🔒 ' + (c.unlock.desc || '未解放') + '</div>');
      if(unlocked){
        div.addEventListener('click', ()=>{
          if(busy || state.inRound) return;
          state.activeCasino = c.id;
          render();
        });
      }
      el.casinoList.appendChild(div);
    }
  }

  function renderOverGoal(){
    const g = nextGoalText();
    el.overGoalLabel.textContent = g.label;
    el.overGoalVal.textContent = g.val;
  }

  /* ============================================================
     CHARM / SHOP 描画・操作
     ============================================================ */
  function tagPill(t){
    const col = CONFIG.tagColors[t] || '#888';
    return '<span class="o-tag" style="background:' + col + '">' + t + '</span>';
  }
  function tagPills(ch){ return (ch.tags || []).map(tagPill).join(''); }

  // 装備お守り＋発動中の共鳴（常時表示）
  function renderCharmBar(){
    const eq = equippedCharms();
    if(!eq.length){
      el.charmChips.innerHTML = '<span class="charm-chip empty">お守り未装備</span>';
    }else{
      el.charmChips.innerHTML = eq.map(ch=>{
        const rc = CONFIG.rarityColors[ch.rarity] || '#888';
        return '<span class="charm-chip r-' + ch.rarity + '" style="border-left-color:' + rc + '">' +
                 '<b>' + ch.name + '</b>' +
                 '<span class="cdesc">' + ch.desc + '</span>' +
                 tagPills(ch) +
               '</span>';
      }).join('');
    }
    const res = activeResonances();
    el.resoBadges.innerHTML = res.map(r =>
      '<span class="reso-badge" title="' + r.desc + '">' + r.name + '</span>').join('');
  }

  // このお守りを足すと「今は出ていない共鳴」が発動するか
  function wouldSynergize(c){
    const after = tagCounts();
    for(const t of (c.tags || [])) after[t] = (after[t] || 0) + 1;
    const now = tagCounts();
    for(const r of CONFIG.resonances){
      if((now[r.tag] || 0) < r.need && (after[r.tag] || 0) >= r.need) return r;
    }
    return null;
  }

  // レアリティ加重抽選
  function weightedPick(pool){
    let total = 0;
    for(const c of pool) total += (CONFIG.shop.weights[c.rarity] || 1);
    let r = Math.random() * total;
    for(const c of pool){
      r -= (CONFIG.shop.weights[c.rarity] || 1);
      if(r <= 0) return c;
    }
    return pool[pool.length - 1];
  }
  function rollOffer(){
    const offer = [];
    for(let i = 0; i < CONFIG.shop.offer; i++){
      const pool = CONFIG.charms.filter(c =>
        !state.save.owned.includes(c.id) && !offer.includes(c.id));
      if(!pool.length) break;
      offer.push(weightedPick(pool).id);
    }
    state.shopOffer = offer;
    // 神話が並んだら最大級の演出 / 極なら専用演出
    if(offer.some(id => charmById(id).rarity === '神話')){
      flash('mythic'); Sound.fanfare(true); shake('Small');
    }else if(offer.some(id => charmById(id).rarity === '極')){
      flash('record'); Sound.fanfare(true);
    }
  }

  function renderShop(){
    el.shopCoins.textContent = fmt(state.coins);
    el.shopEquipCount.textContent = state.save.equipped.length;
    el.shopOffer.innerHTML = '';
    (state.shopOffer || []).forEach(id=>{
      const c = charmById(id);
      const price = CONFIG.shop.price[c.rarity];
      const owned = state.save.owned.includes(id);
      const canBuy = !owned && state.coins >= price;
      const syn = !owned ? wouldSynergize(c) : null;

      const div = document.createElement('div');
      div.className = 'offer r-' + c.rarity + (owned ? ' bought' : (canBuy ? '' : ' cant')) + (syn ? ' synergy' : '');
      div.style.borderLeftColor = CONFIG.rarityColors[c.rarity] || '#888';
      div.innerHTML =
        '<div class="o-top">' +
          '<span class="o-name">' + c.name + '</span>' +
          '<span class="o-rar r-' + c.rarity + '" style="background:' + (CONFIG.rarityColors[c.rarity]||'#888') + '">' + c.rarity + '</span>' +
          '<span class="o-tags">' + tagPills(c) + '</span>' +
        '</div>' +
        '<div class="o-desc">' + c.desc + '</div>' +
        '<div class="o-foot">' +
          '<span class="o-price">' + fmt(price) + ' 枚</span>' +
          (owned ? '<span class="o-syn">購入済</span>'
                 : (syn ? '<span class="o-syn">装備で ' + syn.name + ' 発動</span>' : '')) +
        '</div>';
      if(canBuy) div.addEventListener('click', ()=> buyCharm(id));
      el.shopOffer.appendChild(div);
    });
    el.rerollBtn.disabled = state.coins < CONFIG.shop.rerollCost;
  }

  function buyCharm(id){
    const c = charmById(id);
    const price = CONFIG.shop.price[c.rarity];
    if(state.save.owned.includes(id) || state.coins < price) return;
    state.coins -= price;
    state.save.owned.push(id);
    if(c.rarity === '神話'){ flash('mythic'); Sound.fanfare(true); shake('Small'); }
    else { flash('gold'); Sound.coins(4); }

    if(state.save.equipped.length < CONFIG.slots){
      state.save.equipped.push(id);
      setMessage(c.name + ' を購入・装備した', 'win');
    }else{
      setMessage(c.name + ' を購入。枠が満杯—整理で入れ替えを', 'win');
    }
    Save.persist();
    checkAchievements();   // 蒐集/神話 など
    renderShop(); render();
    // 満杯なら入替を選ばせる
    if(state.save.equipped.length >= CONFIG.slots && !state.save.equipped.includes(id)){
      openInv();
    }
  }

  function reroll(){
    if(state.coins < CONFIG.shop.rerollCost) return;
    state.coins -= CONFIG.shop.rerollCost;
    Save.persist();
    rollOffer();
    Sound.coins(3);
    renderShop(); render();
  }

  function openShop(){
    if(state.inRound) return;
    if(!state.shopOffer || !state.shopOffer.length) rollOffer();
    renderShop();
    el.shopPanel.classList.remove('hidden');
  }

  function renderInv(){
    el.invSub.textContent = CONFIG.slots + '枠中 ' + state.save.equipped.length + ' 装備';
    el.invList.innerHTML = '';
    if(!state.save.owned.length){
      el.invList.innerHTML = '<div class="inv-item empty">お守りをまだ持っていない</div>';
      return;
    }
    for(const id of state.save.owned){
      const c = charmById(id);
      const equipped = state.save.equipped.includes(id);
      const full = state.save.equipped.length >= CONFIG.slots;
      const item = document.createElement('div');
      item.className = 'inv-item r-' + c.rarity;
      item.style.borderLeftColor = CONFIG.rarityColors[c.rarity] || '#888';
      item.innerHTML =
        '<div class="i-main">' +
          '<div class="i-name">' + c.name + ' ' + tagPills(c) + '</div>' +
          '<div class="i-desc">' + c.desc + '</div>' +
        '</div>';
      const btn = document.createElement('button');
      btn.className = 'i-btn' + (equipped ? ' on' : '');
      btn.textContent = equipped ? '外す' : (full ? '枠なし' : '装備');
      btn.disabled = !equipped && full;
      btn.addEventListener('click', ()=> toggleEquip(id));
      item.appendChild(btn);
      el.invList.appendChild(item);
    }
  }
  function openInv(){ renderInv(); el.invPanel.classList.remove('hidden'); }

  function toggleEquip(id){
    const i = state.save.equipped.indexOf(id);
    if(i >= 0){
      state.save.equipped.splice(i, 1);
    }else{
      if(state.save.equipped.length >= CONFIG.slots) return;
      state.save.equipped.push(id);
    }
    // 共鳴3種同時の達成を記録（実績「共鳴開眼」）
    if(activeResonances().length >= 3) state.save.stats.tripleResonance = true;
    Save.persist();
    checkAchievements();
    renderInv();
    render();
    if(!el.shopPanel.classList.contains('hidden')) renderShop();
  }

  /* ============================================================
     YOKAI（第5指示）: 妖の描画・深度エスカレート・反応・固有ボイス
     画像不使用、SVGで描画
     ============================================================ */
  function svgKitsune(){ return `
  <svg viewBox="0 0 120 120" style="color:#ff5a4d">
    <polygon points="28,40 18,8 46,30" fill="#f5ece0" stroke="#d8455a" stroke-width="2"/>
    <polygon points="92,40 102,8 74,30" fill="#f5ece0" stroke="#d8455a" stroke-width="2"/>
    <polygon points="30,34 24,16 40,28" fill="#d8455a"/>
    <polygon points="90,34 96,16 80,28" fill="#d8455a"/>
    <path d="M60 26 C90 26 96 56 90 78 C84 100 70 108 60 108 C50 108 36 100 30 78 C24 56 30 26 60 26 Z" fill="#f7efe4" stroke="#caa896" stroke-width="1.5"/>
    <path d="M40 50 q12 -10 20 0" fill="none" stroke="#e0455a" stroke-width="3" stroke-linecap="round"/>
    <path d="M80 50 q-12 -10 -20 0" fill="none" stroke="#e0455a" stroke-width="3" stroke-linecap="round"/>
    <path d="M54 30 q6 10 12 0" fill="none" stroke="#e0455a" stroke-width="3" stroke-linecap="round"/>
    <path class="eye" d="M38 59 q9 -7 18 0 q-9 5 -18 0 Z" fill="#ff5a4d"/>
    <path class="eye" d="M64 59 q9 -7 18 0 q-9 5 -18 0 Z" fill="#ff5a4d"/>
    <ellipse cx="60" cy="86" rx="10" ry="8" fill="#fff"/>
    <circle cx="60" cy="83" r="3" fill="#3a2f48"/>
    <path d="M60 86 v8" stroke="#3a2f48" stroke-width="2"/>
  </svg>`; }

  function svgOni(){ return `
  <svg viewBox="0 0 120 120" style="color:#ffd23f">
    <path d="M34 30 C26 10 16 6 14 4 C22 12 24 22 30 36 Z" fill="#e8dcc0" stroke="#b09a70" stroke-width="1.5"/>
    <path d="M86 30 C94 10 104 6 106 4 C98 12 96 22 90 36 Z" fill="#e8dcc0" stroke="#b09a70" stroke-width="1.5"/>
    <path d="M28 42 Q60 16 92 42 L92 30 Q60 6 28 30 Z" fill="#2a1414"/>
    <path d="M60 28 C88 28 94 54 90 76 C85 100 72 110 60 110 C48 110 35 100 30 76 C26 54 32 28 60 28 Z" fill="#c8384a" stroke="#8f2230" stroke-width="2"/>
    <path d="M38 54 L56 61" stroke="#3a1418" stroke-width="4" stroke-linecap="round"/>
    <path d="M82 54 L64 61" stroke="#3a1418" stroke-width="4" stroke-linecap="round"/>
    <circle class="eye" cx="46" cy="65" r="6" fill="#ffd23f"/>
    <circle class="eye" cx="74" cy="65" r="6" fill="#ffd23f"/>
    <circle cx="46" cy="65" r="2.5" fill="#3a1418"/>
    <circle cx="74" cy="65" r="2.5" fill="#3a1418"/>
    <path d="M40 86 Q60 102 80 86 Q60 94 40 86 Z" fill="#3a1418"/>
    <polygon points="46,86 50,96 54,86" fill="#fff"/>
    <polygon points="66,86 70,96 74,86" fill="#fff"/>
  </svg>`; }

  function svgNekomata(){ return `
  <svg viewBox="0 0 120 120" style="color:#9be8c0">
    <path d="M84 96 q24 -6 26 -30 q-1 20 -18 28" fill="none" stroke="#4a4258" stroke-width="6" stroke-linecap="round"/>
    <path d="M92 100 q24 0 28 -22 q-3 18 -20 30" fill="none" stroke="#37304a" stroke-width="6" stroke-linecap="round"/>
    <polygon points="34,42 26,14 52,34" fill="#3a3346" stroke="#5a5268" stroke-width="1.5"/>
    <polygon points="86,42 94,14 68,34" fill="#3a3346" stroke="#5a5268" stroke-width="1.5"/>
    <polygon points="34,38 30,22 44,33" fill="#d88aa0"/>
    <polygon points="86,38 90,22 76,33" fill="#d88aa0"/>
    <ellipse cx="60" cy="72" rx="34" ry="32" fill="#4a4258" stroke="#2a2436" stroke-width="2"/>
    <ellipse class="eye" cx="46" cy="66" rx="8" ry="9" fill="#9be8c0"/>
    <ellipse class="eye" cx="74" cy="66" rx="8" ry="9" fill="#9be8c0"/>
    <ellipse cx="46" cy="66" rx="2" ry="8" fill="#1a2420"/>
    <ellipse cx="74" cy="66" rx="2" ry="8" fill="#1a2420"/>
    <polygon points="56,80 64,80 60,85" fill="#d88aa0"/>
    <path d="M60 85 q-6 6 -12 3 M60 85 q6 6 12 3" fill="none" stroke="#1a1420" stroke-width="2"/>
    <path d="M30 74 L8 70 M30 80 L8 82" stroke="#cfc8d8" stroke-width="1.5"/>
    <path d="M90 74 L112 70 M90 80 L112 82" stroke="#cfc8d8" stroke-width="1.5"/>
  </svg>`; }

  const YOKAI = {
    kitsune:  { build:svgKitsune,  name:"狐面の妖" },
    oni:      { build:svgOni,      name:"鬼" },
    nekomata: { build:svgNekomata, name:"猫又" },
  };

  let _yokaiCasino = null;
  function renderYokai(){
    const id = activeCasino().id;
    // 賭場ごとの背景パレット
    el.app.classList.remove('casino-kitsune','casino-oni','casino-nekomata');
    el.app.classList.add('casino-' + id);
    // 妖の姿（賭場が変わった時だけ再構築）
    if(_yokaiCasino !== id){
      const y = YOKAI[id] || YOKAI.kitsune;
      el.yokaiArt.innerHTML = y.build();
      el.yokaiName.textContent = y.name;
      _yokaiCasino = id;
    }
    // 深度でエスカレート：浅=静か / 中=前のめり・目が光る / 深=高揚・歪み
    const d = state.depth;
    const mood = d >= 9 ? 'mood-frenzy' : (d >= 4 ? 'mood-eager' : 'mood-calm');
    el.yokaiArt.classList.remove('mood-calm','mood-eager','mood-frenzy');
    el.yokaiArt.classList.add(mood);
    // 潜るほど背景が沈む
    el.veil.style.opacity = Math.min(0.6, d * 0.05).toFixed(3);
  }

  let _reactTimer = null;
  function yokaiReact(type){
    const cls = 'react-' + type;
    el.yokaiArt.classList.remove('react-survive','react-near','react-flee','react-bust','react-awe');
    void el.yokaiArt.offsetWidth;
    el.yokaiArt.classList.add(cls);
    if(_reactTimer) clearTimeout(_reactTimer);
    _reactTimer = setTimeout(()=> el.yokaiArt.classList.remove(cls), 1700);
  }

  function yokaiSay(event){
    const id = activeCasino().id;
    const set = CONFIG.charVoices[id] || CONFIG.charVoices.kitsune;
    const lines = set[event] || set.survive || [];
    if(lines.length){
      const line = lines[Math.floor(Math.random() * lines.length)];
      el.yokaiSpeech.textContent = '「' + line + '」';
      el.yokaiSpeech.classList.remove('say');
      void el.yokaiSpeech.offsetWidth;
      el.yokaiSpeech.classList.add('say');
    }
    yokaiReact(event);
  }

  /* ============================================================
     DAILY / ACHIEVEMENTS / 天叢雲 — 描画・操作（第6指示）
     ============================================================ */
  function renderDaily(){
    const mod = getTodayModifier();
    const left = dailyAttemptsLeft();
    const dd = state.save.daily;
    el.dailyCard.innerHTML =
      '<div class="dc-head">今日の妖</div>' +
      '<div class="dc-top"><span class="dc-icon">' + mod.icon + '</span>' +
        '<div class="dc-name">' + mod.name + '</div></div>' +
      '<div class="dc-desc">' + mod.desc + '</div>' +
      '<div class="dc-stats">' +
        '<span>残り挑戦 <b>' + left + '</b>/' + CONFIG.daily.attempts + '</span>' +
        '<span>今日の最深 <b>' + dd.bestDepth + '</b></span>' +
        '<span>今日の最高 <b>' + fmt(dd.bestPot) + '</b></span>' +
        '<span>連続 <b>' + state.save.streak.count + '</b>日</span>' +
      '</div>' +
      '<button class="dc-btn" id="dailyBtnInner"' + (left<=0 ? ' disabled' : '') + '>' +
        (left>0 ? (state.pendingDaily ? '賭け金を選んで挑戦…' : '今日の妖に挑む') : 'また明日') +
      '</button>';
    const b = document.getElementById('dailyBtnInner');
    if(b && left>0 && !state.pendingDaily) b.addEventListener('click', startDaily);

    if(el.tsDaily) el.tsDaily.innerHTML = '今日の妖：<b>' + mod.icon + ' ' + mod.name + '</b><br>' + mod.desc;

    el.dailyBanner.classList.toggle('hidden', !state.dailyRound);
    if(state.dailyRound) el.dailyBanner.textContent = '⚝ 今日の妖：' + mod.name + '（' + mod.desc + '）';
  }

  function startDaily(){
    if(state.inRound || dailyAttemptsLeft() <= 0) return;
    state.pendingDaily = true;
    setMessage('今日の妖に挑む——賭け金を選べ', 'win');
    render();
  }

  function renderAma(){
    const has = state.save.equipped.includes('amatsumukumo');
    const show = has && state.inRound && !state.round.amaUsed;
    el.amaBtn.classList.toggle('hidden', !show);
    el.amaBtn.classList.toggle('armed', !!state.round.amaArmed);
    el.amaBtn.disabled = busy || state.round.amaArmed || state.round.amaUsed;
    el.amaBtn.textContent = state.round.amaArmed
      ? '⛅ 天叢雲 発動中（次の段は破産0%）'
      : '⛅ 天叢雲を使う（次の段を破産0%に）';
  }
  function armAma(){
    if(busy || !state.save.equipped.includes('amatsumukumo')) return;
    if(state.round.amaUsed || state.round.amaArmed || !state.inRound) return;
    state.round.amaArmed = true;
    Sound.thump(true); flash('near');
    setMessage('天叢雲が雲を払う——次の一段、破産せず', 'win');
    render();
  }

  function renderAchv(){
    const total = CONFIG.achievements.length;
    const done = CONFIG.achievements.filter(a => isAchieved(a.id)).length;
    el.achvSub.textContent = done + '/' + total;
    el.achvBtn.textContent = '実績 ' + done + '/' + total;
    el.achvList.innerHTML = '';
    for(const a of CONFIG.achievements){
      const got = isAchieved(a.id);
      const hide = a.hidden && !got;
      const div = document.createElement('div');
      div.className = 'achv-item ' + (got ? 'done' : 'locked');
      div.innerHTML =
        '<span class="a-ico">' + (got ? '🏆' : (hide ? '❔' : '🔒')) + '</span>' +
        '<div><div class="a-name">' + (hide ? '???' : a.name) + '</div>' +
        '<div class="a-desc">' + (hide ? '隠し実績' : a.desc) + '</div></div>';
      el.achvList.appendChild(div);
    }
  }

  /* ============================================================
     描画
     ============================================================ */
  function render(){
    el.coins.textContent  = Math.floor(state.coins);
    el.record.textContent = state.save.deepest;
    el.depth.textContent  = state.depth;
    el.pot.textContent    = Math.floor(state.pot);

    renderMeta();
    renderPanel();
    renderCasinos();
    renderOverGoal();
    renderCharmBar();
    renderYokai();
    renderDaily();
    renderAma();
    renderAchv();

    // 次段の予告（常時表示・お守り/共鳴の効果込み）
    const d = nextDepth();
    el.nextMul.textContent  = '×' + multiplierAt(d).toFixed(2);
    el.nextBust.textContent = Math.round(bustChanceAt(d) * 100) + '%';

    // ビュー切り替え
    const over = state.coins <= 0 && !state.inRound;
    el.overView.classList.toggle('hidden', !over);
    el.roundView.classList.toggle('hidden', !state.inRound || over);
    el.betView.classList.toggle('hidden', state.inRound || over);
    el.yokaiStage.classList.toggle('hidden', over);   // 妖は対局中のみ

    // 潜る/逃げるの可否（溜め演出中は押せない）
    el.diveBtn.disabled = busy || !state.inRound;
    el.fleeBtn.disabled = busy || !state.inRound;

    // 賭け金ボタンの可否（足りない額は押せない）
    document.querySelectorAll('.btn-bet').forEach(b=>{
      const raw = b.dataset.bet;
      const amount = raw === 'all' ? state.coins : Number(raw);
      b.disabled = busy || state.coins <= 0 || amount <= 0 || amount > state.coins;
    });
  }

  /* ============================================================
     アクション
     ============================================================ */
  let busy = false;   // 溜め演出中の二重押し防止

  function startRound(bet){
    if(busy || bet <= 0 || bet > state.coins) return;
    Sound.ensure();

    // 日替わり挑戦の予約があれば消費（報酬＋ストリーク）
    let dailyMsg = '';
    if(state.pendingDaily && dailyAttemptsLeft() > 0){
      state.dailyRound = true;
      state.pendingDaily = false;
      const reward = consumeDailyAttempt();
      const mod = getTodayModifier();
      dailyMsg = '【' + mod.name + '】挑戦！ 報酬+' + fmt(reward) + '（連続' + state.save.streak.count + '日）　';
      flash('record'); Sound.fanfare(true);
    } else {
      state.dailyRound = false;
      state.pendingDaily = false;
    }

    el.pot.classList.remove('crash','pop');
    state.coins -= bet;
    state.bet = bet;
    state.pot = bet;
    state.depth = 0;
    state.inRound = true;
    state.round = { jizoUsed:false, amaArmed:false, amaUsed:false, yomiUsed:false };
    for(const ch of equippedCharms()){  // onRoundStart フック
      if(ch.hooks && ch.hooks.onRoundStart) ch.hooks.onRoundStart(state);
    }
    state.save.totalRounds++;     // 総プレイ回数（ラウンド数）
    Save.persist();
    el.yokaiSpeech.textContent = '';     // 妖の台詞をリセット
    el.yokaiSpeech.classList.remove('say');
    setMessage(dailyMsg + bet + '枚を賭けた。潜るか、退くか。（' + activeCasino().name + '）');
    render();
    Heart.update();
  }

  function dive(){
    if(busy || !state.inRound) return;
    Sound.ensure();
    busy = true;
    el.diveBtn.disabled = true;
    el.fleeBtn.disabled = true;

    // --- 1. 溜め：潜行中表示＋軽い振動＋下降音 ---
    showDiving(true);
    shake('Small');
    Sound.descend(CONFIG.fx.diveDelay);

    __timers.push(setTimeout(resolveDive, CONFIG.fx.diveDelay));
  }

  function resolveDive(){
    showDiving(false);
    busy = false;

    const d = nextDepth();
    const bust = bustChanceAt(d);
    const roll = Math.random();
    const survived = roll >= bust;
    const margin = Math.abs(roll - bust);

    // 天叢雲を発動して潜った段は消費する
    if(state.round.amaArmed){
      state.round.amaArmed = false;
      state.round.amaUsed = true;
    }

    if(!survived){
      // --- お守り救済（身代わり地蔵など onBust が true を返したら無効化） ---
      let rescued = false;
      for(const ch of equippedCharms()){
        if(ch.hooks && ch.hooks.onBust && ch.hooks.onBust({ depth:d, roll, bust }) === true){
          rescued = true; break;
        }
      }
      if(rescued){
        // バスト無効：depth/pot 据え置きでラウンド継続
        flash('near'); shake('Small'); Sound.thump(true);
        setMessage('身代わりが砕けた…！　難を逃れた', 'win');
        render();
        yokaiSay('near');   // 妖は驚き＆面白がる
        Heart.update();
        return;
      }

      // --- 神話「黄泉返り」: コインを払って継続できるなら選択させる ---
      if(state.save.equipped.includes('yomigaeri') && !state.round.yomiUsed){
        const cost = Math.max(CONFIG.yomi.minCost, Math.floor(state.coins * CONFIG.yomi.costRate));
        if(state.coins >= cost){
          state.pendingBust = { d, roll, bust, cost };
          el.continueCost.textContent = fmt(cost);
          el.continuePanel.classList.remove('hidden');
          Heart.stop();
          return;   // バストは保留。ボタンで継続 or 諦める
        }
      }

      finalizeBust({ d, roll, bust });
      return;
    }

    // --- 2. 生存演出 ---
    const oldPot = state.pot;
    state.depth = d;
    state.pot *= multiplierAt(d);

    // --- メタ進行：最深記録 / 二つ名 / 賭場アンロックの判定 ---
    const prevDeepest = state.save.deepest;
    let celebrate = null, celebrateBig = false;
    if(state.depth > state.save.deepest){
      state.save.deepest = state.depth;
      Save.persist();
      celebrate = '最深記録更新！　深さ' + state.depth;
    }
    const beforeTitle = currentTitle(prevDeepest).name;
    const afterTitle  = currentTitle(state.save.deepest).name;
    let topTitle = false;   // 最高位の二つ名に到達したか
    if(afterTitle !== beforeTitle){
      celebrate = '二つ名「' + afterTitle + '」を得た！';
      celebrateBig = true;
      if(!nextTitle(state.save.deepest)) topTitle = true;
    }
    const newly = refreshUnlocks();
    if(newly.length){
      celebrate = newly[0].name + ' が解放された！';
      celebrateBig = true;
    }

    el.pot.classList.remove('crash');
    render();
    countUp(el.pot, Math.floor(oldPot), Math.floor(state.pot), CONFIG.fx.countUpMs);
    popPot();
    Sound.chime(state.depth);

    // --- 5. ニアミス（紙一重生存） ---
    const isNear = margin <= CONFIG.fx.nearMissMargin;
    if(isNear){
      flash('near');
      shake('Small');
      Sound.thump(true);
      setMessage('紙一重だった…！', 'win');
    }else{
      flash('green');
      setMessage('深さ ' + state.depth + '　取り分 ' + fmt(state.pot), 'whisper');
    }

    // --- 5'. 新記録 / 二つ名 / アンロックの祝い演出（最優先で上書き） ---
    if(celebrate){
      flash('record');
      shake('Small');
      Sound.fanfare(celebrateBig);
      setMessage(celebrate, 'win');
    }
    if(topTitle){
      // 最高位到達：妖が畏怖を示す特別演出（メタ進行と物語の接続）
      flash('record'); Sound.fanfare(true);
      setMessage('妖、ひれ伏す——二つ名「' + afterTitle + '」', 'win');
    }

    // --- 妖の固有ボイス＆反応（畏怖 → 紙一重 → 通常生存） ---
    yokaiSay(topTitle ? 'awe' : (isNear ? 'near' : 'survive'));

    // --- 日替わりベスト＆実績 ---
    if(state.dailyRound) updateDailyBest(state.depth, Math.floor(state.pot));
    checkAchievements();

    // --- 6. 心音：深まりで起動／加速 ---
    Heart.update();
  }

  // 実バスト確定（通常 or 黄泉返り「諦める」から呼ばれる）
  function finalizeBust(info){
    // 代償フック（血の契約・倍返しの宴など）
    for(const ch of equippedCharms()){
      if(ch.hooks && ch.hooks.onActualBust) ch.hooks.onActualBust({ bet:state.bet, depth:info.d });
    }
    if(state.dailyRound){
      const mod = getTodayModifier();
      if(mod.hooks && mod.hooks.onActualBust) mod.hooks.onActualBust({ bet:state.bet, depth:info.d });
    }
    state.pot = 0;
    state.inRound = false;
    state.dailyRound = false;
    Heart.stop();
    flash('crack'); shake('Big'); Sound.impact();
    el.pot.classList.remove('pop'); el.pot.classList.add('crash');
    const shortBy = ((info.bust - info.roll) * 100).toFixed(1);
    setMessage('飲み込まれた…　破産' + Math.round(info.bust*100) + '％ ／ あと ' + shortBy + '% で抜けられた', 'bust');
    Save.persist();
    checkAchievements();
    render();
    yokaiSay('bust');
  }

  // 黄泉返り：継続を選択
  function continueRound(){
    const info = state.pendingBust;
    if(!info || state.coins < info.cost) return;
    state.coins -= info.cost;
    state.round.yomiUsed = true;
    state.pendingBust = null;
    el.continuePanel.classList.add('hidden');
    Save.persist();
    flash('near'); shake('Small'); Sound.thump(true);
    setMessage('黄泉返り——' + fmt(info.cost) + '枚を払い、現世に踏みとどまった', 'win');
    render();
    yokaiSay('near');
    Heart.update();
  }
  // 黄泉返り：諦めてバスト確定
  function giveUpBust(){
    const info = state.pendingBust;
    state.pendingBust = null;
    el.continuePanel.classList.add('hidden');
    if(info) finalizeBust(info);
  }

  function flee(){
    if(busy || !state.inRound) return;
    Sound.ensure();
    // 日替わり「浅瀬の禁」等で逃げ不可
    if(state.dailyRound){
      const mod = getTodayModifier();
      if(mod.canFlee && !mod.canFlee(state.depth)){
        flash('crack'); shake('Small');
        setMessage('今日の異形が逃げ道を塞ぐ…（' + mod.name + '）', 'bust');
        return;
      }
    }
    const fleeDepth = state.depth;
    // お守り/共鳴/異形で逃げ額を修正（強欲の壺・共鳴強欲・強欲の夜など）
    const payout = applyHook('modifyCashout', state.pot, { depth:state.depth });
    const won = Math.floor(payout);
    const oldCoins = Math.floor(state.coins);
    state.coins += payout;
    state.inRound = false;
    state.pot = 0;
    Heart.stop();

    // --- メタ進行：累計獲得 / 最高取り分 / 賭場アンロック ---
    state.save.lifetime += won;
    let recMsg = null;
    if(won > state.save.bestPot){
      state.save.bestPot = won;
      recMsg = '最高取り分 更新！　' + won + '枚';
    }
    // 実績用の統計
    state.save.stats.flees++;
    if(fleeDepth === 1) state.save.stats.depth1Flees++;
    if(equippedCharms().some(c => c.rarity === '呪')) state.save.stats.cursedFlee = true;
    // 日替わりベスト
    const wasDaily = state.dailyRound;
    if(wasDaily) updateDailyBest(fleeDepth, won);
    state.dailyRound = false;
    Save.persist();
    const newly = refreshUnlocks();

    // --- 4. 逃げる演出：所持金カウントアップ＋金フラッシュ＋上昇音 ---
    setMessage(won + '枚を懐に。賢明だ。', 'win');
    render();
    countUp(el.coins, oldCoins, Math.floor(state.coins), CONFIG.fx.countUpMs);
    flash('gold');
    Sound.coins(Math.max(4, Math.round(won/100)));
    yokaiSay('flee');   // 妖は「逃げるか」と残念がる・見下す

    // --- 新記録・アンロックの祝い（あれば上書き） ---
    if(recMsg){
      flash('record');
      Sound.fanfare(false);
      setMessage(recMsg, 'win');
    }
    if(newly.length){
      flash('record');
      Sound.fanfare(true);
      setMessage(newly[0].name + ' が解放された！', 'win');
    }
    checkAchievements();
  }

  function restart(){
    // 所持金だけリセット。記録・二つ名・アンロック（state.save）は保持。
    state.coins = CONFIG.startCoins;
    state.inRound = false;
    state.bet = 0;
    state.pot = 0;
    state.depth = 0;
    state.round = { jizoUsed:false, amaArmed:false, amaUsed:false, yomiUsed:false };
    state.dailyRound = false;
    state.pendingDaily = false;
    state.pendingBust = null;
    el.continuePanel.classList.add('hidden');
    busy = false;
    Heart.stop();
    Save.persist();   // リセット後の所持金を保持
    el.pot.classList.remove('crash','pop');
    setMessage('いくら賭ける？');
    render();
  }

  /* ============================================================
     イベント配線
     ============================================================ */
  document.querySelectorAll('.btn-bet').forEach(b=>{
    b.addEventListener('click', ()=>{
      const raw = b.dataset.bet;
      const bet = raw === 'all' ? state.coins : Number(raw);
      startRound(bet);
    });
  });
  el.diveBtn.addEventListener('click', dive);
  el.fleeBtn.addEventListener('click', flee);
  el.restartBtn.addEventListener('click', exitVenue);

  // ミュート切替（右上）
  el.muteBtn.addEventListener('click', ()=>{
    Sound.ensure();
    Sound.setMuted(!Sound.muted);
    el.muteBtn.textContent = Sound.muted ? '🔇' : '🔊';
  });

  // 記録パネルの開閉
  el.recordsBtn.addEventListener('click', ()=>{
    renderPanel();
    el.recordsPanel.classList.remove('hidden');
  });
  el.closeRecords.addEventListener('click', ()=>{
    el.recordsPanel.classList.add('hidden');
  });
  el.recordsPanel.addEventListener('click', e=>{
    if(e.target === el.recordsPanel) el.recordsPanel.classList.add('hidden');
  });

  // 妖具屋（ショップ）
  el.openShopBtn.addEventListener('click', ()=>{ Sound.ensure(); openShop(); });
  el.rerollBtn.addEventListener('click', reroll);
  el.closeShop.addEventListener('click', ()=> el.shopPanel.classList.add('hidden'));
  el.shopPanel.addEventListener('click', e=>{
    if(e.target === el.shopPanel) el.shopPanel.classList.add('hidden');
  });

  // お守り整理（インベントリ）
  el.openInvBtn.addEventListener('click', ()=>{ Sound.ensure(); openInv(); });
  el.closeInv.addEventListener('click', ()=> el.invPanel.classList.add('hidden'));
  el.invPanel.addEventListener('click', e=>{
    if(e.target === el.invPanel) el.invPanel.classList.add('hidden');
  });


  // 実績一覧の開閉
  el.achvBtn.addEventListener('click', ()=>{
    renderAchv();
    el.achvPanel.classList.remove('hidden');
  });
  el.closeAchv.addEventListener('click', ()=> el.achvPanel.classList.add('hidden'));
  el.achvPanel.addEventListener('click', e=>{
    if(e.target === el.achvPanel) el.achvPanel.classList.add('hidden');
  });

  // 天叢雲（神話・任意発動）
  el.amaBtn.addEventListener('click', armAma);

  // 黄泉返り（継続オファー）
  el.continueBtn.addEventListener('click', continueRound);
  el.giveupBtn.addEventListener('click', giveUpBust);

  // 起動時：既存セーブで満たしている実績・今日の日替わりを反映
  syncDaily();
  checkAchievements();

  // 初期描画
  render();
  /* ====================== END ported venue logic ====================== */

  // 追加配線（移植元には無い：退場ボタン・入場時の煽り）
  const __exitBtn = document.getElementById("exitBtn");
  if (__exitBtn) __exitBtn.addEventListener("click", exitVenue);
  if (OPTS.taunt) setMessage(OPTS.taunt, "win");

  return {
    teardown(){
      __alive = false;
      try { Heart.stop(); } catch (e) {}
      __timers.forEach(t => clearTimeout(t));
      try { if (Sound.ctx) Sound.ctx.close(); } catch (e) {}
      Sound.ctx = null;
    },
    getBankroll(){ return Math.max(0, Math.floor(state.coins)); },
  };
}

/* ============================================================
   画面モジュール: { mount, unmount }
   ============================================================ */
export const gambleScreen = {
  mount(root, ctx){ _session = null; renderEntry(root, ctx); },
  unmount(){
    // ホームボタン等で離脱した場合も、未確定なら純損益を確定して片付ける
    commitSession();
    teardownSession();
    _session = null;
  },
};
export default gambleScreen;
