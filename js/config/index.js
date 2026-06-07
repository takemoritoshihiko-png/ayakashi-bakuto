/* ============================================================
   config/index.js — ゲームデータ定数（今は最小）
   各 Phase で各要素（ガチャ/妖怪種/家具/戦闘…）がここに追記していく。
   画面側は必ずこの config を参照し、数値をハードコードしない。
   経済に効く数値は config/balance.js（BALANCE）から取り込む。
   ============================================================ */
import { BALANCE } from "./balance.js";
export { DEV_MODE, BALANCE } from "./balance.js";

/** アプリ全体のメタ情報 */
export const APP = {
  title: "妖賭場",
  subtitle: "A Y A K A S H I",
  version: "0.A",            // 開発フェーズ表記（セーブ version とは別物）
};

/** ホームのセクション入口。route は main.js のルーターに対応。 */
export const SECTIONS = [
  { id: "gamble", route: "gamble", icon: "🎴", name: "賭場",   desc: "潜って稼ぐ",       ready: true },
  { id: "gacha",  route: "gacha",  icon: "🏮", name: "ガチャ", desc: "妖を引く",         ready: true },
  { id: "yokai",  route: "yokai",  icon: "👹", name: "妖怪",   desc: "育成・装備",       ready: true },
  { id: "battle", route: "battle", icon: "⚔️", name: "戦闘",   desc: "妖と競う",         ready: true },
  { id: "room",   route: "room",   icon: "🏠", name: "部屋",   desc: "飾る・住まう",     ready: true },
  { id: "zukan",  route: "zukan",  icon: "📖", name: "図鑑",   desc: "集めた記録",       ready: true },
];

/** 留守番の妖（ホームのお出迎え）。経過時間帯ごとに台詞を分ける。 */
export const CARETAKER = {
  name: "留守番の妖",
  icon: "🦊",
  // returnedSoon: 直近の再訪 / returnedDay: しばらくぶり / firstVisit: 初回
  lines: {
    firstVisit: [
      "ようこそ、妖賭場へ。",
      "ここは、夜だけ開く賭場さ。",
    ],
    returnedSoon: [
      "おかえり。",
      "賭場が呼んでるよ。",
      "家具、増やさないの？",
      "もう一勝負どう？",
    ],
    returnedDay: [
      "ずいぶん留守にしてたね。",
      "待ちくたびれたよ、ふふ。",
      "顔を見せにきてくれたか。",
    ],
  },
};

/** 「しばらくぶり」と判定する経過(ms)。再訪台詞の出し分けに使う。 */
export const RETURN_DAY_MS = 12 * 60 * 60 * 1000;   // 12時間

/* ============================================================
   賭場（Phase B）— 入場画面用のメタ。曲線等の本体は賭場内 CONFIG が持つ。
   ============================================================ */
export const GAMBLE = {
  starterStake: BALANCE.gamble.bring.starterStake,  // 財布が空の新規へのご祝儀（無償）
  minBring: BALANCE.gamble.bring.minBring,           // 最低持ち込み
  presets: BALANCE.gamble.bring.presets,
};

/** 入場画面で並べる賭場（解放状況は save.gamble.unlockedVenues で判定）。 */
export const GAMBLE_VENUES = [
  { id: "kitsune",  name: "狐の賭場",   icon: "🦊", note: "標準" },
  { id: "oni",      name: "鬼の賭場",   icon: "👹", note: "高リスク高配当（最深8で解放）" },
  { id: "nekomata", name: "猫又の賭場", icon: "🐈‍⬛", note: "低リスク低配当（累計5万で解放）" },
];

/** 持ち込み額を見た妖の煽り（少額/高額/全額）。入場演出に使う。 */
export const ENTRY_TAUNTS = {
  kitsune:  { small: "たったそれだけ？ ふふ…", high: "ほう、太っ腹ですこと。", allIn: "全財産とは…命知らずめ。気に入った。" },
  oni:      { small: "はん、その程度か小僧！", high: "おう、骨のある奴だ！",   allIn: "全部だと！？ 喰いがいがあるわ！" },
  nekomata: { small: "しょぼいにゃ〜",         high: "おっ、やる気だにゃ。",   allIn: "全ツッパ！？ イカれてるにゃ！" },
};

/* ============================================================
   ガチャ（Phase C）
   ============================================================ */
/** レアリティ: 色/序列/光色（見た目）＋ 確率・重複shard（BALANCE 由来）。 */
// 色は design.css のレア度トークンと統一（並=白鼠/上=群青/極=金/神話=玉虫）
export const RARITY = {
  common: { key: "common", name: "並",   color: "#c2bcae", rank: 0, light: "#f2efe6", prob: BALANCE.gacha.rarity.common.prob, shard: BALANCE.gacha.rarity.common.shard },
  rare:   { key: "rare",   name: "上",   color: "#4664cf", rank: 1, light: "#7e98ff", prob: BALANCE.gacha.rarity.rare.prob,   shard: BALANCE.gacha.rarity.rare.shard },
  epic:   { key: "epic",   name: "極",   color: "#e8c372", rank: 2, light: "#ffd76a", prob: BALANCE.gacha.rarity.epic.prob,   shard: BALANCE.gacha.rarity.epic.shard },
  mythic: { key: "mythic", name: "神話", color: "#b46cff", rank: 3, light: "#d79bff", prob: BALANCE.gacha.rarity.mythic.prob, shard: BALANCE.gacha.rarity.mythic.shard },
};
export const RARITY_ORDER = ["common", "rare", "epic", "mythic"];

/** ガチャ設定（BALANCE 由来）。 */
export const GACHA = {
  singleCost: BALANCE.gacha.singleCost,
  multiCost: BALANCE.gacha.multiCost,
  multiCount: BALANCE.gacha.multiCount,
  multiGuarantee: BALANCE.gacha.multiGuarantee,
  pityCeiling: BALANCE.gacha.pityCeiling,
  fakeoutChance: BALANCE.gacha.fakeoutChance,
};

/** 排出プール（type × rarity に2〜3件。後で拡張）。
    weapon/costume は id を itemId に、yokai は speciesId を持つ（id=speciesId）。 */
export const MASTER = [
  // --- weapons（攻撃系の statMods 中心） ---
  { id: "wp_bokken",   type: "weapon",  rarity: "common", name: "木刀",     statMods: { atk: 4 } },
  { id: "wp_ofuda",    type: "weapon",  rarity: "common", name: "古びた札", statMods: { atk: 3, spd: 2 } },
  { id: "wp_youtou",   type: "weapon",  rarity: "rare",   name: "妖刀・青", statMods: { atk: 12 } },
  { id: "wp_harama",   type: "weapon",  rarity: "rare",   name: "破魔の弓", statMods: { atk: 8, spd: 5 } },
  { id: "wp_raikiri",  type: "weapon",  rarity: "epic",   name: "雷切",     statMods: { atk: 22, spd: 6 } },
  { id: "wp_saihai",   type: "weapon",  rarity: "epic",   name: "金の采配", statMods: { atk: 16, def: 8 } },
  { id: "wp_amahabari",type: "weapon",  rarity: "mythic", name: "天羽々斬", statMods: { atk: 38, spd: 10 } },
  { id: "wp_futsu",    type: "weapon",  rarity: "mythic", name: "布都御魂", statMods: { atk: 30, def: 15 } },
  // --- costumes（防御/HP系 ＋ 愛情ボーナス ＋ 見た目変化 appearance） ---
  { id: "cos_asa",      type: "costume", rarity: "common", name: "麻の衣",     statMods: { hp: 15, def: 3 },  affectionBonus: 2, appearance: "robe_plain" },
  { id: "cos_tenugui",  type: "costume", rarity: "common", name: "手ぬぐい",   statMods: { def: 4 },          affectionBonus: 2, appearance: "hat_cloth" },
  { id: "cos_hibakama", type: "costume", rarity: "rare",   name: "緋袴",       statMods: { hp: 30, def: 8 },  affectionBonus: 4, appearance: "robe_red" },
  { id: "cos_kitsunemen",type:"costume", rarity: "rare",   name: "狐面",       statMods: { atk: 6, def: 6 },  affectionBonus: 5, appearance: "mask_fox" },
  { id: "cos_juni",     type: "costume", rarity: "epic",   name: "十二単",     statMods: { hp: 60, def: 18 }, affectionBonus: 8, appearance: "robe_juni" },
  { id: "cos_onitsuno", type: "costume", rarity: "epic",   name: "鬼の角飾り", statMods: { hp: 40, atk: 10 }, affectionBonus: 8, appearance: "horns" },
  { id: "cos_tsukuyomi",type: "costume", rarity: "mythic", name: "月読の装束", statMods: { hp: 90, def: 25, spd: 8 }, affectionBonus: 12, appearance: "robe_moon" },
  { id: "cos_kogane",   type: "costume", rarity: "mythic", name: "黄金の面",   statMods: { hp: 70, def: 20, atk: 10 }, affectionBonus: 12, appearance: "mask_gold" },
  // --- yokai (id = speciesId) ---
  { id: "mametanuki",  type: "yokai", rarity: "common", name: "豆狸",     speciesId: "mametanuki" },
  { id: "ittanmomen",  type: "yokai", rarity: "common", name: "一反木綿", speciesId: "ittanmomen" },
  { id: "chochin_kozo",type: "yokai", rarity: "common", name: "提灯小僧", speciesId: "chochin_kozo" },
  { id: "tofu_kozo",   type: "yokai", rarity: "common", name: "豆腐小僧", speciesId: "tofu_kozo" },
  { id: "kappa",       type: "yokai", rarity: "common", name: "河童",     speciesId: "kappa" },
  { id: "bakeneko",    type: "yokai", rarity: "epic",   name: "化け猫",   speciesId: "bakeneko" },
  { id: "karakasa",    type: "yokai", rarity: "rare",   name: "唐傘小僧", speciesId: "karakasa" },
  { id: "amefurashi",  type: "yokai", rarity: "rare",   name: "雨ふらし", speciesId: "amefurashi" },
  { id: "kamaitachi",  type: "yokai", rarity: "rare",   name: "鎌イタチ", speciesId: "kamaitachi" },
  { id: "kasha",       type: "yokai", rarity: "rare",   name: "火車",     speciesId: "kasha" },
  { id: "tsuchigumo",  type: "yokai", rarity: "rare",   name: "土蜘蛛",   speciesId: "tsuchigumo" },
  { id: "nue",         type: "yokai", rarity: "epic",   name: "鵺",       speciesId: "nue" },
  { id: "daitengu",    type: "yokai", rarity: "epic",   name: "大天狗",   speciesId: "daitengu" },
  { id: "oni",         type: "yokai", rarity: "epic",   name: "鬼",       speciesId: "oni" },
  { id: "hakutaku",    type: "yokai", rarity: "epic",   name: "白沢",     speciesId: "hakutaku" },
  { id: "kyuubi",      type: "yokai", rarity: "mythic", name: "金毛九尾", speciesId: "kyuubi" },
  { id: "orochi",      type: "yokai", rarity: "mythic", name: "八岐大蛇", speciesId: "orochi" },
];

/** 進行役の妖（巫女狐）の結果リアクション（最高レア別）。 */
export const GACHA_MIKO = {
  name: "巫女狐",
  icon: "⛩️",
  react: {
    common: ["ふむ。", "まあ、こんな日もある。"],
    rare:   ["お、悪くない。", "上物が出たね。"],
    epic:   ["おお、大物だ！", "これは…当たりだよ。"],
    mythic: ["…これは、ただ事ではない。", "神話が、降りた。"],
  },
};

/** 交換所（shard のはけ口・固定数点）。 */
export const EXCHANGE = [
  { id: "ticket_rare", label: "確定『上』チケット", desc: "「上」以上を1回引く", cost: BALANCE.gacha.exchangeCost.ticket_rare, kind: "pull", minRarity: "rare" },
  { id: "grant_kitsunemen", label: "狐面（衣装）", desc: "衣装『狐面』を直接入手", cost: BALANCE.gacha.exchangeCost.grant_kitsunemen, kind: "item", itemId: "cos_kitsunemen" },
  { id: "grant_bakeneko", label: "化け猫（妖怪）", desc: "妖怪『化け猫』を直接入手", cost: BALANCE.gacha.exchangeCost.grant_bakeneko, kind: "yokai", speciesId: "bakeneko" },
];

/* ============================================================
   妖怪（Phase D）— 育成/装備/愛情度のチューニング
   ============================================================ */
const _TRAIN_LABELS = { small: "修行", hard: "猛特訓" };
export const GAME = {
  baseMaxLevel: BALANCE.train.baseMaxLevel,   // 妖怪 maxLevel 初期値
  partySize: BALANCE.train.partySize,         // 出撃編成の上限
  exp: BALANCE.train.exp,                      // 次レベル必要EXP = floor(base * level^pow)
  // 修行（coin の主要なはけ口）。ラベル(見た目)＋数値(BALANCE)を合成。
  train: BALANCE.train.tiers.map((t) => ({ ...t, label: _TRAIN_LABELS[t.id] || t.id })),
  trainCostScale: BALANCE.train.costScale,     // 実コスト = baseCost * (1 + level*scale)
  affection: {
    max: BALANCE.affection.max,
    statPer: BALANCE.affection.statPer,        // 実効ステ加算 = floor(affection * statPer)
    stages: BALANCE.affection.stages,          // 段階閾値（固有ボイス/図鑑記述の解放）
    stageNames: ["顔見知り", "なつき", "信頼", "心友"],
  },
};

/** 属性の表示色（描画・相性表示用）。Phase E が相性に使う土台。 */
export const ELEMENTS = {
  "火": { color: "#ff6b4a" },
  "水": { color: "#3b9de8" },
  "風": { color: "#4ad6a0" },
  "地": { color: "#c79a4e" },
  "闇": { color: "#8b5cf6" },
  "光": { color: "#ffe07a" },
};

/* 妖怪マスター（本作の核データ）。speciesId は MASTER(yokai) と一致。
   skills は Phase E のターン制戦闘がそのまま読む。
   effect: none=ダメージ / buff_* / debuff_* / heal / aoe / drain
   voices/lore は index 0=常時, 1..3=愛情段階で解放。 */
export const YOKAI_SPECIES = [
  { speciesId: "mametanuki", name: "豆狸", rarity: "common", element: "地", form: "tanuki",
    baseStats: { hp: 200, atk: 28, def: 30, spd: 26 }, growth: 0.08,  // 耐久寄り
    skills: [
      { id: "hagakure",   name: "葉隠れ", power: 0,  element: "地", effect: "buff_def" },
      { id: "taiatari",   name: "体当たり", power: 16, element: "地", effect: "none" },
    ],
    voiceLines: ["ぽんぽこ♪", "腹が…減ったな。", "餅、半分こしようか。", "お前といると、満腹より安心するなあ。"],
    lore: ["のんびり屋の化け狸。", "化かすより餅が好き。", "満腹だと滅法強い。", "腹鼓は仲間の心も鎮める。"],
    desc: "のんびり食いしん坊の化け狸。" },

  { speciesId: "ittanmomen", name: "一反木綿", rarity: "common", element: "風", form: "cloth",
    baseStats: { hp: 160, atk: 32, def: 22, spd: 38 }, growth: 0.08,
    skills: [
      { id: "makitsuki", name: "巻きつき", power: 13, element: "風", effect: "none" },
      { id: "mekakushi", name: "目隠し",   power: 0,  element: "風", effect: "debuff_atk" },
    ],
    voices: ["ひらり。", "風に乗るよ。", "首に巻きついてもいい？", "…君を、包んでいたい。"],
    lore: ["夜空を舞う布の妖。", "風を読むのが得意。", "巻きつけば逃さない。", "包まれた者は安らかに眠る。"],
    desc: "夜空を舞う布の妖。" },

  { speciesId: "bakeneko", name: "化け猫", rarity: "epic", element: "闇", form: "cat",
    baseStats: { hp: 300, atk: 66, def: 46, spd: 58 }, growth: 0.12,  // 攻撃クリ寄り
    skills: [
      { id: "youtsume", name: "妖爪", power: 24, element: "闇", effect: "none", critBonus: 0.25 }, // クリ高
      { id: "noroi",    name: "呪い", power: 0,  element: "闇", effect: "debuff_atk" },
    ],
    voiceLines: ["にゃ…ふふ。", "遊んでやろうか、ほんの気まぐれに。", "撫でるなら、今だけ許す。", "…お前のそばが、一等いいにゃ。"],
    lore: ["二股の尾を持つ猫又。", "夜目が利き、影に溶ける。", "妖艶で気まぐれ、だが情に厚い。", "懐けば、夜通し喉を鳴らす。"],
    desc: "妖艶で気まぐれな猫又。" },

  { speciesId: "karakasa", name: "唐傘小僧", rarity: "rare", element: "水", form: "umbrella",
    baseStats: { hp: 220, atk: 42, def: 38, spd: 40 }, growth: 0.10,
    skills: [
      { id: "bangasatsuki", name: "番傘突き", power: 19, element: "水", effect: "none" },
      { id: "amayadori",    name: "雨宿り",   power: 0,  element: "水", effect: "heal" },
    ],
    voices: ["ぴょん。", "雨はいいぞ。", "傘に入るかい？", "…雨の日は、君を思い出す。"],
    lore: ["一本足で跳ねる傘の妖。", "雨を呼ぶ。", "意外と世話好き。", "その傘は、誰かの涙も受け止める。"],
    desc: "一本足で跳ねる傘の妖。" },

  { speciesId: "nue", name: "鵺", rarity: "epic", element: "闇", form: "chimera",
    baseStats: { hp: 320, atk: 66, def: 50, spd: 54 }, growth: 0.12,
    skills: [
      { id: "raimei",   name: "雷鳴",     power: 40, element: "闇", effect: "none" },
      { id: "nuenokoe", name: "鵺の声",   power: 0,  element: "闇", effect: "debuff_def" },
      { id: "yamiyari", name: "闇槍",     power: 30, element: "闇", effect: "drain" },
    ],
    voices: ["…ヒョオ。", "夜が満ちる。", "我が声、聞こえるか。", "…お前にだけ、姿を見せよう。"],
    lore: ["猿面・狸胴・虎肢・蛇尾の鵺。", "不吉の象徴とされる。", "声で人を惑わす。", "孤独を知る者にだけ懐く。"],
    desc: "四つの獣を併せ持つ怪鳥。" },

  { speciesId: "daitengu", name: "大天狗", rarity: "epic", element: "風", form: "tengu",
    baseStats: { hp: 300, atk: 70, def: 46, spd: 60 }, growth: 0.12,
    skills: [
      { id: "gufuzan",  name: "颶風斬",   power: 44, element: "風", effect: "none" },
      { id: "tengukaze",name: "天狗風",   power: 0,  element: "風", effect: "buff_spd" },
      { id: "shippu",   name: "疾風連撃", power: 34, element: "風", effect: "none" },
    ],
    voices: ["ぬん。", "未熟者め。", "鍛錬を怠るな。", "…お前は、よき弟子だ。"],
    lore: ["山を統べる天狗の長。", "羽団扇で風を操る。", "誇り高く厳格。", "認めた者には極意を授ける。"],
    desc: "山を統べる天狗の長。" },

  { speciesId: "kyuubi", name: "金毛九尾", rarity: "mythic", element: "火", form: "fox",
    baseStats: { hp: 450, atk: 96, def: 68, spd: 78 }, growth: 0.14,  // 全体高火力
    skills: [
      { id: "kitsunebiranbu", name: "狐火乱舞", power: 78, element: "火", effect: "aoe" },   // 全体大
      { id: "kyubiranbu",     name: "九尾乱舞", power: 92, element: "火", effect: "none" },
      { id: "miryo",          name: "魅了",     power: 0,  element: "火", effect: "paralyze" }, // 麻痺
    ],
    voiceLines: ["…ふ。", "永い時を、生きた。", "人の子よ、面白いことを言う。", "…千年の孤独を、お前が癒した。"],
    lore: ["金色の毛並みを持つ九尾の大妖。", "国を傾けるとも言う。", "荘厳にして、人を見下す。", "ただ一人を、永く想い続ける。"],
    desc: "荘厳にして人を見下す、金毛の大妖。" },

  { speciesId: "orochi", name: "八岐大蛇", rarity: "mythic", element: "水", form: "serpent",
    baseStats: { hp: 520, atk: 86, def: 78, spd: 64 }, growth: 0.14,
    skills: [
      { id: "yashiori", name: "八塩折",   power: 80, element: "水", effect: "none" },
      { id: "daijabari",name: "大蛇の縛", power: 0,  element: "水", effect: "debuff_spd" },
      { id: "saisei",   name: "再生",     power: 0,  element: "水", effect: "heal" },
    ],
    voices: ["……シャアア。", "酒を、寄越せ。", "我が八つの首、貴様を護ろう。", "…貴様だけは、呑まぬ。"],
    lore: ["八つの首を持つ大蛇。", "酒に酔わされた伝説を持つ。", "その身は山八つ分。", "気を許した者には八重の守りを。"],
    desc: "八つの首を持つ厄災の大蛇。" },

  /* ---- 妖怪バッチ1（新規追加） ---- */
  { speciesId: "chochin_kozo", name: "提灯小僧", rarity: "common", element: "火", form: "_default",
    baseStats: { hp: 140, atk: 36, def: 18, spd: 34 }, growth: 0.08,  // 攻撃寄り低耐久
    skills: [
      { id: "hinoko", name: "火の粉", power: 16, element: "火", effect: "none" },
    ],
    voiceLines: ["ともしび、ともった！", "いたずら、しちゃおっと。", "ふふ、こっちだよ〜。", "…きみの夜は、ぼくが照らす。"],
    lore: ["夜道に灯る提灯の妖。", "無邪気な悪戯が好き。", "灯を消すと拗ねる。", "本当は、暗がりが少し怖い。"],
    desc: "無邪気な悪戯好きの提灯妖。" },

  { speciesId: "amefurashi", name: "雨ふらし", rarity: "rare", element: "水", form: "cloth",
    baseStats: { hp: 230, atk: 38, def: 36, spd: 36 }, growth: 0.10,  // 補助回復寄り
    skills: [
      { id: "jiu",        name: "慈雨",   power: 0,  element: "水", effect: "heal" },
      { id: "mizudeppo2", name: "水鉄砲", power: 18, element: "水", effect: "none" },
    ],
    voiceLines: ["…しとしと。", "今日も、曇り空。", "濡れていく方が、楽なのです。", "…あなたの傘に、入れてくれますか。"],
    lore: ["雨雲を連れて現れる妖。", "物憂げで口数が少ない。", "誰かの涙を雨に紛らす。", "晴れた日は、少しだけ笑う。"],
    desc: "物憂げに雨を連れる妖。" },

  { speciesId: "kamaitachi", name: "鎌イタチ", rarity: "rare", element: "風", form: "cat",
    baseStats: { hp: 200, atk: 50, def: 28, spd: 58 }, growth: 0.10,  // 速さ先制寄り
    skills: [
      { id: "mikadukizan", name: "三日月斬り", power: 24, element: "風", effect: "none" }, // 先制（高速で実現）
    ],
    voiceLines: ["…用件は？", "遅い。話にならん。", "…まあ、悪くない速さだ。", "隣を走るのは、お前だけだ。"],
    lore: ["旋風と共に駆ける鼬の妖。", "そっけない俊足。", "斬られても痛みは後から来る。", "認めた相手の歩幅に、合わせてくれる。"],
    desc: "そっけない俊足の鎌鼬。" },

  /* ---- 妖怪アセット同期バッチ（新規6体） ---- */
  { speciesId: "tofu_kozo", name: "豆腐小僧", rarity: "common", element: "闇", form: "_default",
    baseStats: { hp: 160, atk: 28, def: 24, spd: 26 }, growth: 0.08,
    skills: [
      { id: "noroidofu", name: "呪いの豆腐", power: 0,  element: "闇", effect: "debuff_def" },
      { id: "butsukari",  name: "ぶつかり",   power: 14, element: "闇", effect: "none" },
    ],
    voiceLines: ["…お豆腐、いかが？", "ついて来ても、いい？", "ひとりは、さみしいんだ。", "…そばに居てくれて、ありがとう。"],
    lore: ["盆に豆腐を載せた童の妖。", "おどおどして内気。", "雨の日に現れる。", "受け取ってくれた人を、ずっと慕う。"],
    desc: "内気で寂しがりの童の妖。" },

  { speciesId: "kappa", name: "河童", rarity: "common", element: "水", form: "_default",
    baseStats: { hp: 205, atk: 30, def: 32, spd: 28 }, growth: 0.08,
    skills: [
      { id: "mizudeppo", name: "水鉄砲", power: 16, element: "水", effect: "none" },
      { id: "saramamori", name: "皿守り", power: 0,  element: "水", effect: "buff_def" },
    ],
    voiceLines: ["きゅう！", "相撲、とろうぜ！", "きゅうりが好物さ。", "…皿の水、君になら見せてもいい。"],
    lore: ["皿に水を湛えた川の妖。", "悪戯好きで相撲自慢。", "皿が乾くと力を失う。", "恩を受けると律儀に返す。"],
    desc: "悪戯好きで律儀な川の妖。" },

  { speciesId: "kasha", name: "火車", rarity: "rare", element: "火", form: "cat",
    baseStats: { hp: 220, atk: 52, def: 34, spd: 48 }, growth: 0.10,
    skills: [
      { id: "kasharin", name: "火車輪", power: 26, element: "火", effect: "none" },
      { id: "gouka",     name: "業火",   power: 20, element: "火", effect: "aoe" },
    ],
    voiceLines: ["…ニャアア。", "亡者は、よこせ。", "燃え残りはない。", "…お前の魂だけは、奪わぬ。"],
    lore: ["火焔の車輪を駆る化け猫。", "亡骸をさらう獰猛な妖。", "雷雨の夜に現れる。", "情を交わした者には牙を向けない。"],
    desc: "亡者をさらう火焔の化け猫。" },

  { speciesId: "tsuchigumo", name: "土蜘蛛", rarity: "rare", element: "地", form: "chimera",
    baseStats: { hp: 260, atk: 48, def: 42, spd: 34 }, growth: 0.10,
    skills: [
      { id: "itoshibari", name: "糸縛り", power: 0,  element: "地", effect: "debuff_spd" },
      { id: "dokuga",     name: "毒牙",   power: 20, element: "地", effect: "poison" },
    ],
    voiceLines: ["…ジジ。", "巣にかかったな。", "古き地は、我のもの。", "…お前だけは、糸で護ろう。"],
    lore: ["山中に巣くう蜘蛛の大妖。", "八つの眼で獲物を捉える。", "古い地の主を自称する。", "懐いた者を糸で優しく包む。"],
    desc: "山に巣くう古き地の蜘蛛妖。" },

  { speciesId: "oni", name: "鬼", rarity: "epic", element: "闇", form: "tengu",
    baseStats: { hp: 340, atk: 74, def: 50, spd: 44 }, growth: 0.12,
    skills: [
      { id: "kanabou",  name: "金棒砕き", power: 40, element: "闇", effect: "none" },
      { id: "houkou",   name: "鬼の咆哮", power: 0,  element: "闇", effect: "debuff_def" },
      { id: "midaretsu",name: "乱れ突き", power: 30, element: "闇", effect: "none" },
    ],
    voiceLines: ["ぐおおお！", "酒だ、酒を持て！", "力比べといこうや！", "…お前は、よき呑み仲間だ。"],
    lore: ["角と金棒を持つ荒ぶる妖。", "粗野で豪快、酒に目がない。", "力比べを好む。", "一度心を許せば、誰より頼もしい。"],
    desc: "粗野で豪快な角の荒鬼。" },

  { speciesId: "hakutaku", name: "白沢", rarity: "epic", element: "光", form: "_default",
    baseStats: { hp: 320, atk: 60, def: 54, spd: 56 }, growth: 0.12,
    skills: [
      { id: "joukanohikari", name: "浄化の光", power: 0,  element: "光", effect: "heal" },
      { id: "shintaku",      name: "神託",     power: 0,  element: "光", effect: "buff_atk" },
      { id: "kouki",         name: "光輝",     power: 36, element: "光", effect: "none" },
    ],
    voiceLines: ["…案ずるな。", "災いの兆し、見えておる。", "万の事を、我は知る。", "…お前の行く末は、明るい。"],
    lore: ["万物に通じる瑞獣・白沢。", "九つの眼と六本の角を持つ。", "災いを予見し人を導く。", "心を開いた者に、未来を語る。"],
    desc: "災いを予見する博識の瑞獣。" },
];

/* ============================================================
   戦闘（Phase E）
   ============================================================ */
/** 属性相性: 火>風>地>水>火 の循環 ＋ 光⇄闇 相互弱点。
    attacker から見て defender が strong=効果抜群(2.0) / weak=いまひとつ(0.5)。 */
export const ELEMENT_CHART = {
  "火": { strong: ["風"], weak: ["水"] },
  "風": { strong: ["地"], weak: ["火"] },
  "地": { strong: ["水"], weak: ["風"] },
  "水": { strong: ["火"], weak: ["地"] },
  "光": { strong: ["闇"], weak: [] },
  "闇": { strong: ["光"], weak: [] },
};
export const ELEMENT_MULT = BALANCE.battle.elementMult;

/** 戦闘パラメータ（BALANCE 由来）＋難度係数 enemyScale。 */
export const BATTLE = { ...BALANCE.battle.params, enemyScale: BALANCE.battle.enemyScale };

/** 敵マスター（悪い妖怪）。skills の effect は species と共通語彙。 */
export const ENEMIES = {
  e_onibi:   { id: "e_onibi",   name: "鬼火",       element: "火", art: "onibi",
    stats: { hp: 90,  atk: 28, def: 16, spd: 32 },
    skills: [{ name: "火の粉", power: 16, element: "火", effect: "none" }] },
  e_kappa:   { id: "e_kappa",   name: "河童",       element: "水", art: "kappa",
    stats: { hp: 130, atk: 26, def: 24, spd: 24 },
    skills: [{ name: "水鉄砲", power: 18, element: "水", effect: "none" }, { name: "尻子玉", power: 0, element: "水", effect: "debuff_def" }] },
  e_kodama:  { id: "e_kodama",  name: "木霊",       element: "地", art: "kodama",
    stats: { hp: 150, atk: 24, def: 30, spd: 18 },
    skills: [{ name: "根締め", power: 20, element: "地", effect: "none" }, { name: "木霊返し", power: 0, element: "地", effect: "debuff_atk" }] },
  e_kamaitachi: { id: "e_kamaitachi", name: "鎌鼬", element: "風", art: "kamaitachi",
    stats: { hp: 100, atk: 36, def: 18, spd: 44 },
    skills: [{ name: "鎌風", power: 22, element: "風", effect: "none" }] },
  e_gashadokuro: { id: "e_gashadokuro", name: "がしゃどくろ", element: "闇", art: "gashadokuro",
    stats: { hp: 240, atk: 42, def: 30, spd: 22 },
    skills: [{ name: "噛砕き", power: 32, element: "闇", effect: "none" }, { name: "呪詛", power: 0, element: "闇", effect: "poison" }] },
  // --- ボス（撃破で封印＝仲間化） ---
  e_bakeneko_lord: { id: "e_bakeneko_lord", name: "化け猫の主", element: "闇", art: "cat", isBoss: true,
    stats: { hp: 420, atk: 50, def: 38, spd: 48 },
    skills: [{ name: "妖火", power: 34, element: "闇", effect: "none" }, { name: "二尾乱舞", power: 26, element: "闇", effect: "debuff_spd" }] },
  e_nue_boss: { id: "e_nue_boss", name: "鵺", element: "闇", art: "chimera", isBoss: true,
    stats: { hp: 600, atk: 64, def: 50, spd: 54 },
    skills: [{ name: "雷鳴", power: 48, element: "闇", effect: "none" }, { name: "鵺の声", power: 0, element: "闇", effect: "debuff_def" }, { name: "闇槍", power: 38, element: "闇", effect: "drain" }] },
};

/** ステージ（前ステージのクリアで解放）。 */
/* 構造（敵編成・ボス）は config、報酬数値は BALANCE.battle.stages から合成。 */
const _STAGE_DEFS = [
  { id: "s1", name: "宵の野辺", enemyTeam: ["e_onibi"] },
  { id: "s2", name: "古井戸", enemyTeam: ["e_kappa", "e_onibi"] },
  { id: "s3", name: "廃寺", enemyTeam: ["e_kodama", "e_kamaitachi"] },
  { id: "s4", name: "妖の巣", enemyTeam: ["e_kamaitachi", "e_kappa", "e_onibi"] },
  { id: "s5", name: "化け猫屋敷", enemyTeam: ["e_bakeneko_lord"], isBoss: true, bossCaptureSpeciesId: "bakeneko" },
  { id: "s6", name: "百鬼夜行", enemyTeam: ["e_gashadokuro", "e_onibi", "e_kappa"] },
  { id: "s7", name: "鵺の社", enemyTeam: ["e_nue_boss"], isBoss: true, bossCaptureSpeciesId: "nue" },
];
export const STAGES = _STAGE_DEFS.map((s) => {
  const b = BALANCE.battle.stages[s.id] || {};
  return { ...s, rewards: { coin: b.coin, expBase: b.expBase, dropTable: b.dropTable || [] }, firstClearBonus: b.firstClearBonus || 0 };
});

/* ============================================================
   妖怪部屋（Phase F）
   ============================================================ */
export const ROOM = {
  cols: 10, rows: 8,            // 配置グリッド
  yokaiMax: 3,                  // 部屋に出せる妖怪数
};

/** 放置による愛情度上昇（BALANCE 由来）。 */
export const IDLE = {
  ratePerHourPerComfort: BALANCE.idle.ratePerHourPerComfort,
  maxHours: BALANCE.idle.maxHours,
  capPerVisit: BALANCE.idle.capPerVisit,
};

/** テーマセット（揃えて“配置”すると comfort ボーナス）。 */
export const THEME_SETS = {
  wa:   { name: "和の間", members: ["f_tatami", "f_chabudai", "f_zabuton", "f_andon"], bonusComfort: 25 },
  mori: { name: "緑の癒し", members: ["f_bonsai", "f_kabe_mori", "f_hanaike"], bonusComfort: 18 },
};

/* 家具マスター。見た目/サイズ/テーマは config、price・comfort は BALANCE.furniture から合成。 */
const _FURN_DEFS = [
  { id: "f_tatami",   name: "畳",       category: "床",   size: { w: 4, h: 4 }, themeSet: "wa",   art: "🟩" },
  { id: "f_rug",      name: "緋毛氈",   category: "床",   size: { w: 3, h: 2 }, art: "🟥" },
  { id: "f_kakejiku", name: "掛け軸",   category: "壁",   size: { w: 1, h: 2 }, art: "🎴" },
  { id: "f_kabe_mori",name: "森の障子", category: "壁",   size: { w: 2, h: 2 }, themeSet: "mori", art: "🪟" },
  { id: "f_zabuton",  name: "座布団",   category: "家具", size: { w: 1, h: 1 }, themeSet: "wa",   art: "🟫" },
  { id: "f_chabudai", name: "ちゃぶ台", category: "家具", size: { w: 2, h: 2 }, themeSet: "wa",   art: "🍵" },
  { id: "f_tana",     name: "棚",       category: "家具", size: { w: 2, h: 1 }, art: "🗄️" },
  { id: "f_futon",    name: "布団",     category: "家具", size: { w: 2, h: 3 }, art: "🛏️" },
  { id: "f_bonsai",   name: "盆栽",     category: "装飾", size: { w: 1, h: 1 }, themeSet: "mori", art: "🪴" },
  { id: "f_hanaike",  name: "花活け",   category: "装飾", size: { w: 1, h: 1 }, themeSet: "mori", art: "🌼" },
  { id: "f_andon",    name: "行灯",     category: "装飾", size: { w: 1, h: 1 }, themeSet: "wa",   art: "🏮" },
  { id: "f_kamidana", name: "神棚",     category: "特殊", size: { w: 2, h: 1 }, art: "⛩️" },
  { id: "f_onsen",    name: "内湯",     category: "特殊", size: { w: 4, h: 3 }, art: "♨️" },
];
export const FURNITURE = _FURN_DEFS.map((f) => {
  const b = BALANCE.furniture[f.id] || { price: { coin: 0 }, comfort: 0 };
  return { ...f, price: b.price, comfort: b.comfort };
});

/** 部屋に出した妖怪のつぶやき（procedural art と一緒に表示）。 */
export const ROOM_MURMURS = [
  "この座布団、ふかふか…", "いい部屋だね。", "ここが、いちばん落ち着く。",
  "お茶でも飲もうか。", "ずっと、ここにいたいな。", "…ふわぁ。", "模様替え、似合ってるよ。",
];

/* ============================================================
   図鑑（Phase G）
   ============================================================ */
/** 称号マスター（賭場の二つ名のミラー。最深記録 deepestDepth で発見判定）。 */
export const ZUKAN_TITLES = [
  { id: "t0",  name: "小博打",       min: 0,  desc: "賭場に足を踏み入れた者。" },
  { id: "t5",  name: "常連",         min: 5,  desc: "幾度も潜った顔なじみ。" },
  { id: "t8",  name: "深みの住人",   min: 8,  desc: "深淵に魅入られ始めた者。" },
  { id: "t12", name: "深淵を覗く者", min: 12, desc: "底を覗き、底に覗かれた者。" },
  { id: "t16", name: "賭神",         min: 16, desc: "賭場を統べる伝説。" },
];

/** 図鑑カテゴリ表示メタ。 */
export const ZUKAN_CATEGORIES = [
  { id: "yokai",     name: "妖怪",       icon: "👹" },
  { id: "weapon",    name: "武器",       icon: "⚔️" },
  { id: "costume",   name: "衣装",       icon: "👘" },
  { id: "furniture", name: "家具",       icon: "🪑" },
  { id: "venue",     name: "賭場の妖",   icon: "🎴" },
  { id: "title",     name: "称号",       icon: "🏵️" },
];

/** コンプ報酬。pct=達成率の閾値。perCategory は各カテゴリに、overall は全体に適用。 */
export const ZUKAN_REWARDS = {
  perCategory: [
    { pct: 0.5, coin: 1500 },
    { pct: 1.0, shard: 80 },
  ],
  overall: [
    { pct: 0.5, coin: 5000 },
    { pct: 0.8, shard: 200 },
    { pct: 1.0, coin: 10000, shard: 300, captureSpeciesId: "orochi", special: true },
  ],
};

/** 100%達成の締め演出（妖の世界からの言葉）。 */
export const ENDING_WORDS = [
  "——よくぞ、ここまで。",
  "妖もお守りも家具も、みな揃った。",
  "だが妖の夜は、終わらない。",
  "また新たな影が、賭場の戸を叩くだろう。",
  "その時まで——息災で。",
];
