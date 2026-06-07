/* ============================================================
   config/balance.js — 経済バランスの単一調整点（Phase H）
   ゲーム内の coin/shard/exp/愛情度に効く数値はすべてここに集約。
   各値に「何に効くか」を明記。ここを変えれば挙動が変わる。
   （見た目・名前・形状などの非経済データは config/index.js に残す）
   ============================================================ */

/** 開発者モード。★公開時は false にすると dev パネルが完全に消える。 */
export const DEV_MODE = false;

export const BALANCE = {
  /* ===== 博打（賭場）：coin の蛇口 ===== */
  gamble: {
    startCoins: 1000,                  // 旧基準値（バランスの目安）
    bring: { starterStake: 1000, minBring: 100, presets: [1000, 5000] }, // 入場の持ち込み額
    bustStep: 0.06,                    // 共通：1段ごとに増える破産確率
    bustCap: 0.85,                     // 共通：破産確率の上限
    mulBase: 1.4,                      // 共通：配当倍率の基数
    casinos: [                         // 賭場別カーブ（bustBase=初段破産 / mulStep=1段ごとの配当増）
      { id: "kitsune",  bustBase: 0.05, mulStep: 0.15 }, // 標準
      { id: "oni",      bustBase: 0.10, mulStep: 0.28 }, // 高リスク高配当
      { id: "nekomata", bustBase: 0.03, mulStep: 0.10 }, // 低リスク低配当
    ],
  },

  /* ===== ガチャ：coin の主要排出口 ===== */
  gacha: {
    singleCost: 300,                   // 単発コスト(coin)
    multiCost: 2700,                   // 10連コスト(coin)
    multiCount: 10,                    // 連数
    multiGuarantee: "rare",            // 10連で確定する最低レア
    pityCeiling: 90,                   // この回数で神話確定→排出で0リセット
    fakeoutChance: 0.35,               // 昇格フェイクアウト発生率（演出）
    rarity: {                          // prob=排出確率(合計1.0) / shard=重複変換量
      common: { prob: 0.70, shard: 5 },
      rare:   { prob: 0.24, shard: 20 },
      epic:   { prob: 0.05, shard: 80 },
      mythic: { prob: 0.01, shard: 300 },
    },
    exchangeCost: {                    // 交換所価格(shard)
      ticket_rare: 60, grant_kitsunemen: 50, grant_bakeneko: 130,
    },
  },

  /* ===== 育成（修行）：coin の主要なはけ口 ===== */
  train: {
    baseMaxLevel: 50,                  // 妖怪の上限レベル
    partySize: 3,                      // 出撃編成数
    exp: { base: 50, pow: 1.5 },       // 次LvまでのEXP = floor(base × level^pow)
    tiers: [                           // 修行メニュー（baseCost=基本coin / exp=獲得 / affection=愛情+）
      { id: "small", baseCost: 200, exp: 70,  affection: 2 },
      { id: "hard",  baseCost: 900, exp: 360, affection: 5 },
    ],
    costScale: 0.12,                   // 実コスト = baseCost × (1 + level × costScale)
  },

  /* ===== 愛情度 ===== */
  affection: {
    max: 100,
    statPer: 0.15,                     // 実効ステ加算 = floor(affection × statPer)
    stages: [0, 25, 55, 85],           // 段階の閾値（ボイス/図鑑記述の解放）
  },

  /* ===== 戦闘：coin・装備の流入 ===== */
  battle: {
    enemyScale: 1.0,                   // 難度係数：敵ステータス全体倍率
    params: {                          // 戦闘パラメータ
      maxSp: 100, startSp: 50, spRegen: 18,
      critChance: 0.10, critMult: 1.6,
      varianceMin: 0.9, varianceMax: 1.1,
      defendMult: 0.5, basicPower: 12, paralyzeSkip: 0.5,
      buffMag: 0.30, debuffMag: 0.30, poisonFrac: 0.06,
    },
    elementMult: { strong: 2.0, normal: 1.0, weak: 0.5 },
    stages: {                          // ステージ別報酬（coin / expBase / dropTable / firstClearBonus）
      s1: { coin: 300,  expBase: 60,  dropTable: [{ itemId: "wp_bokken", rate: 0.5 }, { itemId: "cos_asa", rate: 0.3 }], firstClearBonus: 500 },
      s2: { coin: 500,  expBase: 95,  dropTable: [{ itemId: "wp_ofuda", rate: 0.4 }, { itemId: "cos_tenugui", rate: 0.3 }], firstClearBonus: 700 },
      s3: { coin: 750,  expBase: 140, dropTable: [{ itemId: "wp_youtou", rate: 0.25 }, { itemId: "cos_hibakama", rate: 0.25 }], firstClearBonus: 1000 },
      s4: { coin: 1100, expBase: 200, dropTable: [{ itemId: "wp_harama", rate: 0.25 }, { itemId: "cos_kitsunemen", rate: 0.2 }], firstClearBonus: 1500 },
      s5: { coin: 1600, expBase: 320, dropTable: [{ itemId: "wp_raikiri", rate: 0.2 }], firstClearBonus: 2500 },
      s6: { coin: 2300, expBase: 460, dropTable: [{ itemId: "wp_saihai", rate: 0.2 }, { itemId: "cos_juni", rate: 0.15 }], firstClearBonus: 3000 },
      s7: { coin: 3500, expBase: 680, dropTable: [{ itemId: "wp_amahabari", rate: 0.12 }, { itemId: "cos_onitsuno", rate: 0.2 }], firstClearBonus: 5000 },
    },
  },

  /* ===== 家具：coin のはけ口（癒し） ===== */
  furniture: {                         // id -> { price:{coin|shard}, comfort }
    f_tatami:   { price: { coin: 400 },  comfort: 8 },
    f_rug:      { price: { coin: 300 },  comfort: 5 },
    f_kakejiku: { price: { coin: 500 },  comfort: 7 },
    f_kabe_mori:{ price: { coin: 600 },  comfort: 8 },
    f_zabuton:  { price: { coin: 150 },  comfort: 4 },
    f_chabudai: { price: { coin: 700 },  comfort: 9 },
    f_tana:     { price: { coin: 550 },  comfort: 6 },
    f_futon:    { price: { coin: 600 },  comfort: 10 },
    f_bonsai:   { price: { coin: 450 },  comfort: 6 },
    f_hanaike:  { price: { coin: 350 },  comfort: 5 },
    f_andon:    { price: { coin: 400 },  comfort: 7 },
    f_kamidana: { price: { coin: 2000 }, comfort: 16 },
    f_onsen:    { price: { shard: 200 }, comfort: 24 },
  },

  /* ===== 放置：愛情度の自然増 ===== */
  idle: {
    ratePerHourPerComfort: 0.02,       // 付与 = elapsedHours × comfort × rate
    maxHours: 12,                      // 経過時間のキャップ
    capPerVisit: 30,                   // 1回の来訪で1体あたり最大付与
  },
};
