# 妖賭場 — AYAKASHI

和の暗色基調の妖怪ゲームアプリ。賭場・ガチャ・育成・戦闘・部屋・図鑑を少しずつ足していく拡張前提の構成です。

## 起動方法（重要）

ES Modules（`<script type="module">`）を使っているため **`file://` で直接開くと動きません**。
ローカルサーバ経由か GitHub Pages で開いてください。

### ローカルサーバ（Python があれば最短）

```bash
cd ayakashi-bakuto
python3 -m http.server 8000
```

ブラウザで <http://localhost:8000/> を開く。

### その他のサーバ例

```bash
npx serve .          # Node があれば
php -S localhost:8000
```

### GitHub Pages

リポジトリを Pages 公開すると `https://<user>.github.io/<repo>/` で動きます（モジュールも問題なし）。

## ファイル構成

```
ayakashi-bakuto/
├── index.html               # エントリ。#app をマウントし js/main.js を読む
├── build_gamble.cjs         # 開発ツール: legacy → css/gamble.css + js/screens/gamble.js を生成
├── css/
│   ├── style.css            # 共通スタイル＋テーマ変数（和の暗色基調）
│   └── gamble.css           # 賭場専用CSS（.gamble-root にスコープ・自動生成）
├── js/
│   ├── main.js              # 起動・画面ルーター（SPA）
│   ├── state.js             # セーブのスキーマ・load/save/reset・移行(migrate)
│   ├── config/
│   │   └── index.js         # ゲームデータ定数（最小・各 Phase で追記）
│   ├── ui/
│   │   └── shell.js         # 常駐ヘッダ（所持金表示）＋トースト
│   └── screens/
│       ├── _placeholder.js  # 未実装画面の共通プレースホルダ
│       ├── home.js          # ホーム（入口＋留守番の妖）
│       ├── gamble.js        # 賭場（Phase B で旧妖賭場を統合）
│       ├── gacha.js         # ガチャ（placeholder）
│       ├── yokai.js         # 妖怪 育成/装備（placeholder）
│       ├── battle.js        # 戦闘（placeholder）
│       ├── room.js          # 部屋（placeholder）
│       └── zukan.js         # 図鑑（placeholder）
└── legacy/
    └── ayakashi-standalone.html   # 旧・単一ファイル版の妖賭場（保全。Phase B で参照）
```

## セーブシステム（背骨）

- 単一情報源は `js/state.js`。`localStorage` キー `ayakashi_save`。
- `loadSave() / saveSave() / resetSave() / getState()` と変更系ヘルパ（例 `addCoin(n)`）。
- **`migrate(save)`**: セーブ `version` が最新未満なら、初期形にあって既存セーブに無いフィールドを自動補完して `version` を更新。
  これにより今後フィールドを足してもセーブが壊れません（開発の生命線）。
- `localStorage` は `try/catch` でガード。使えない環境ではメモリ上で動作継続。

### migrate のセルフテスト（任意）

ブラウザのコンソールで:

```js
const m = await import("./js/state.js");
console.log(m.__migrateSelfTest());   // { ok: true, migrated: {...} }
```

旧形式（多くのフィールドが欠けたセーブ）が初期値で補完され、既存値（コイン等）は保持されることを確認できます。

## 賭場（Phase B）: 持ち込み制

`coin` は中央通貨（ガチャ・家具・全てに使う財布）です。賭場で全財産を溶かさないよう **持ち込み制**にしています。

- 入場画面で財布から「持ち込み額(bankroll)」を選ぶ（プリセット/スライダー/全額。財布以上は不可）。
- 賭け・破産・配当は **bankroll の中だけ**で起こる。財布の残りは安全。
- 退場/離脱時に **純損益（残bankroll − 持ち込み）** を中央 `coin` へ反映（ヘッダがカウントアップ）。
- 破産しても失うのは持ち込み分のみ。旧仕様の「ゲームオーバーで1000リセット」は廃止。
- 財布が空の新規プレイヤーには無償の「ご祝儀」(=会計上の持ち込み0)で経済の蛇口を確保。

賭場の永続データ（お守り/解放賭場/称号/実績/日替わり）は `save.gamble` に、最深記録などは `save.stats` に保存します。旧版の独自 `localStorage`/独自 `coins` は廃止しました。

賭場ロジックは `legacy/ayakashi-standalone.html` を `build_gamble.cjs` で移植生成しています（CSS は `.gamble-root` にスコープ）。再生成は `node build_gamble.cjs`。

## 経済バランス調整（Phase H）

- **`js/config/balance.js` が経済の単一調整点**。博打カーブ/持ち込み・ガチャ単価/確率/天井/重複shard/交換価格・育成exp/コスト・戦闘報酬/難度係数・家具価格/comfort・放置レートを集約。ここを変えれば挙動が変わる（例: `gacha.singleCost` を半分にすれば半額で引ける）。`config/index.js` は見た目/構造のみを持ち、経済値は balance から合成。
- **開発者パネル**: `balance.js` の `DEV_MODE = true` で右下に「DEV」ボタンが出現（`false` で完全に消える）。coin/shard付与・妖怪Lv/愛情度変更・任意species付与・ガチャレアリティ強制・ステージ解放・放置N時間シミュレート・セーブ入出力(JSON)/リセット。
- **経済シミュレータ**（パネル内・読取専用）: 博打1回の期待coin、想定 coin/時、ガチャ10連や修行・家具が「博打◯分相当」かを試算し、破綻（赤字や安すぎ）を数字で発見できる。

## 開発メモ

- バニラ JS / ビルド不要。各画面は `{ mount(root, ctx), unmount() }` を export。
- `ctx` から `go(route)` / `back()` / `toast(msg)` が使えます。
- 数値や定数は `js/config/index.js` に集約し、画面側でハードコードしない方針。
