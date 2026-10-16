# 盤面のスタイル規約

want canvas（`/canvas`）の上に描くものの見た目の決まりごと。新しく何かを盤面に置くときは、まずここにある部品を使う。数値や色をその場で決めない。

## 1. 盤面の上のものは「物体」である

Thing も want も、盤面に**置かれた立体**として描く。盤面に貼ったシールや注釈に見えたら失敗。

| もの | 形 | 立体感の出し方 |
| --- | --- | --- |
| want | 角のあるブロック | 上面が明るく、右下に側面と影（cubic デザイン） |
| Thing | チップ（今は球）＋寄ると育つ詳細 | `sphereBackground`：左上にハイライト、右下へ暗くなる縁。詳細は `boardLiftShadow` で立たせる |
| 地面（constellation の枠・道） | 平面 | 影を落とさない。立っていないので |

- **形で区別する、色で区別しない。** want は四角、Thing はチップ（今は丸）。縮小表示（折りたたんだ constellation、ミニマップ）でもこの対応を崩さない。
- 球の中身の色は必ず不透明な下地の上に塗る（`sphereBackground` の最後の層）。背景画像で色が変わらないように。

## 2. 光は左上から、一つだけ

盤面の光源は左上に一つ。cubic のブロックの側面が右下 `{dx: 6, dy: 8}` に伸びることで決まっている。

- 立っているものの影は `boardLiftFilter(depth, isLight)`（clip-path のあるもの）か `boardLiftShadow(depth)`。真下に落ちる `0 4px 8px` は使わない。
- `depth` は高さ：1 がタイルの高さ、それ未満は低い印、それ以上は持ち上げた状態。
- 小さく切り抜いた形の輪郭は `boardEdgeFilter`。白い後光（光源のない光）はつけない。
- 選択中の光り方は `glowLayers` / `glowRadius`（`canvasGlow.ts`）で。リングで囲まない。

## 3. 文字は頭文字を大きく（ドロップキャップ）

盤面に書く名前は、**最初の一文字が名前を担い、残りは添える**。

- 分け方は `dropCap(value)`（`utils/thingFace.ts`）。コードポイント単位で切るので絵文字やサロゲートペアの漢字も割れない。
- **Thing の値は切らない。** 1〜2 文字はドロップキャップ、3 文字以上は `fitThingValue` で全部を収める（文字を縮め、それでも小さすぎれば行を分ける。`…` にしない）。「6:50」が「6…」になると、どの時刻かが分からない。
- 大きさの比は `DROP_CAP_SCALE`（残りの 3 倍）。
- 名前をその場所以外に書かない場合（折りたたんだ constellation の名前など）は、`…` にせず残りを全部書いてよい。頭文字を大きくするのは変わらない。
- 太さは `font-bold`（700）で揃える。`font-black` や半透明の文字は使わない。
- 色と縁取りは対で決まっている：文字色 `thingFaceText`、縁取り `thingNameShadow`。ライトでは白字に同系色の濃い縁、ダークでは明るい同系色に黒い縁。
- 名前を箱（角丸の背景つきラベル）に入れない。縁取りで読めるようにする。

## 4. アイコンは物体に刻まれた印

- Thing のアイコンは球の上の**デカール**：大きさ `THING_GLYPH_SIZE`、右下に `THING_GLYPH_OFFSET` ずらす（光から遠ざかる側）。中央は名前の場所。
- 色は `thingInk`、影は `iconEmbossFilter(isLight)`。
- want の型アイコンは `wantTypeIconStyle` で色と浮き彫りを決める。同じ型がどこでも同じ色になるように。
- 線の太さは `strokeWidth={1.75}` を基本にする。

## 5. 寄ると Thing の詳細が育つ

Thing はタイルの画面上の大きさで段階が変わる（`thingStage`、mywant-guiex の `boardLodStore.ts`）。Thing ごとに決めるので、½・¼ の Thing は遅れて育つ。

| 段階 | 画面上の大きさ | 見え方 |
| --- | --- | --- |
| dot | 27px 未満 | チップだけ。文字なし |
| normal | 27〜110px | チップに値を全部（§3） |
| mid | 110〜180px | マスの中に札（カードと同じ広さ）。値と小さな絵。チップは小さな粒になって左上の角に乗る |
| near | 180px 以上（want のカード面と同じ） | その Thing のマスに Thing カードそのもの（`ThingCard` の `display`）。チップは小さな粒になってカードの左上の角に乗る。カードはマスより大きくしない |

- 画素密度 3 倍のタッチ画面（iPhone）では、カード面と Thing の段階の境目をすべて 0.55 倍にする（`DETAIL_AT`、guiex `boardLodStore.ts`）。細かい文字がくっきり読め、画面が狭いので、早めに詳細を出す。盤面の文字が消える境目も 0.6 から 0.5 に下げる。全体図に切り替わる境目は描画の負荷で決めているので変えない。
- near は want のタイルがカード面になる境目（`FACE_FROM_SCALE` 2.0 で出て `FACE_UNTIL_SCALE` 1.8 で消える）と同じ。ほかの段階は、戻るときは境目の 0.9 倍まで下がってから（ヒステリシス）。段階が変わると、詳細は左上の角から少しだけ広がりながら現れる（0.85 倍→等倍）。
- 寄りは Thing カードを盤面用に描き直さず、カードそのものを縮めて載せる。札の小さな絵も、カードと同じ `ThingPicture`（時刻→針の時計 `ClockDial`、写真→写真、場所→地図 `ThingMap`、それ以外→型のアイコン）。
- 詳細は表示だけ（pointer-events なし、inert）。押す・ドラッグ・フォーカスはチップが受け持つ。
- **ズームしても世界の中での大きさを変えない。** 札もカードも、その Thing のマスの幅（リストのカードと同じ横長）に収め、隣のマスに出ない。寄って増えるのは中身で、大きさではない。
- 段階は大きさ（½・¼）ごとに一つに決まる。同じ大きさの Thing は同じズームで切り替わる（立っている Thing も同じ）。
- 粒が小さくなっても、押す・ドラッグの当たり判定はマス全体のまま。
- 同時に描く詳細は、見えている中で中央に近いものから near 12・mid 40 まで。

## 5b. 寄ると want のタイルがカード面になる

- 面はカードの延長。カードを盤面用に描き直さず、カードの本体（`WantCardContent`）をそのまま縮めて載せる（guiex `WantTileFace`）。プラグインのない種類は結果があるときだけ。
- 面は表示だけ（inert）。結果のページ送りなどの操作は出さない。
- 中で動き続けるものは、面では**同じ中身の静止画**にする（`TileFaceContext`）。地図は Leaflet ではなく `StaticMap`（同じタイル・同じ経路と点）。ページの埋め込みは iframe ではなく `EmbeddedPage`（面ではそのページのスクリーンショット）。
- **カードに出ていない代わりの絵（アイコンの札など）は面に出さない。** 静止画がないときは面を持たない（`tileFace: false`、または want を見て決める関数）。タイルのアイコンのほうが多くを言う。いま面がないのは Grafana、録画中の Replay、スクリーンショットのない web want、Timer。

## 6. 縮小しても同じものに見えること

折りたたんだ constellation（`ConstellationClusterLayer`）、ミニマップ、カードのバッジなど、小さく描く場所でも**同じ部品を同じ比率で**使う。小さい版だけ平たい円や白い台紙にしない。

- 14px 未満ではアイコンが潰れるので、球と頭文字だけにする（`ThingDot`）。
- 大きさが違うだけで、影・色・文字の決まりは上と同じ。

## 7. アーカイブしたものは色を抜く

アーカイブ表示を On にしたときだけ、アーカイブした want / Thing も盤面に出る。そのときは**同じ物体のまま色を抜く**（`ARCHIVED_FILTER`：グレースケール）。

- 半透明にしない。文字が半透明になり（§3）、物体が盤面に立っているように見えなくなる。
- フィルタはタイルがもともと持っている filter（影・光り方）の前に足す。影も一緒に灰色になる。
- 座標のない Thing は盤面が空いているセルを暫定で選ぶ。書き込まない。生きている Thing の配置を先に決め、アーカイブはその残りに置く。

## 8. 段（tier）：地面は静か、物体はしっかり、注目は一番強く

盤面が散らかって見えるのは、ものの多さではなく、**全部が同じ強さで描かれている**から。そこで盤面を明るさで三つの段に分け、段がどこまで目立ってよいかを決める。情報は減らさない。色相（何に属するか）は残し、強さだけを段が決める。

| 段 | 何があるか | 強さ |
| --- | --- | --- |
| ground（地面） | 背景のグリッド、床、オーラ、道、線（tether・constellation）、着地の波紋、ピン留めの写真 | 地面の色から少しだけ離れる。彩度は低い。探せば読める |
| object（物体） | want・Thing のタイル、その側面、タイルに付く印 | 立体感はそのまま。ただし広い面は彩度を抑える |
| focus（注目） | いま見ているもの：キャラクター、吹き出し、パネルが話題にしているタイル、選択の枠 | 盤面で一番強い |

目を細めて見たとき、物体が浮き、地面が沈み、注目が一番明るいこと。確かめるには、ブラウザのコンソールで `__mywantTierView()` を実行する（灰色にして少しぼかした表示。もう一度で戻る）。

### 段はレイヤーの側で決まる

- 盤面の重なり順（guiex `design/zLayers.ts`）の各スロットが、自分の段を宣言している。段を書かないとスロットを足せない。描く側が段を思い出す必要はない。
- 色はそのスロットの**インク**を通す。インクは、地面の色に対して段の幅に色を収める（OKLCH で、地面からの明るさの差と彩度の上限）。
  - `useLayerInk('road')`：スロットが分かっているレイヤーで使う。
  - `useInk()`：レイヤーの中で描かれる部品（フォームの矢印、道の印、タイルの素材など）で使う。どのスロットかは、外側の `<BoardSlot slot="…">` から受け取る。新しく足した部品も、置かれた場所の段に自動で従う。
  - `tierInk(tier, color, ctx)`：フックが使えない場所で使う。
- 色を数値で書かない。`ink('#475569')` のようにインクに渡す。重なり順も `zIndex` を数字で書かず、`Z.<slot>` を使う。

### 広い面は静かに、小さな印は鮮やかに（`role`）

- `ink(color, 'surface')`：広い面。タイルの上面と側面、レンガなどの素材が当たる。彩度を抑える。
- `ink(color)`（`'mark'`）：その上の印。アイコンや文字が当たる。型の色をそのまま保つ。
- 色の強さは面積に反比例させる。広い面が鮮やかだと、その上に何を描いても面のほうに目が行く。
- 模様（レンガの目地、床板の継ぎ目）は `useTexture()` を通して、段が残すコントラストまで弱める。模様は境目の集まりで、境目は目を引く。

### 見ているものは浮かび上がる

ふだんは地面の強さで描くもの（立っている want の道、want の答えの玉）も、いま見ているときは注目の強さで描く。立っている want の道はハイライト色、立っている want や選んだ玉の答えの玉は元の明るさ。気を引くために光らせるのではなく、見ているから浮かぶ。

### 寄ると明るくなる

- 引いているときの盤面は地図なので、地面は静かにする。寄ると、見ている場所の道・床・模様・面の色が戻る。
- 寄ったときは、どの段のどの値も**同じ比率**（`NEAR_GAIN`、いまは 2 倍）で強める。値ごとにばらばらに変えない。上限は、明るさの差とコントラストが 1、彩度が 0.4。
- ズームでの混ぜ方は CSS で行う。インクは両端の色を一度だけ計算して `color-mix` に書き、盤面は寄り具合を変数 `--board-near`（0〜1）一つで知らせる。ズームしても React での描き直しは起きない。
- 色から別の色を計算するときは、混ぜる前に両端それぞれに計算を当てる（`ink(color, 'surface', derive)`。例：壁の側面の陰）。どうしても普通の hex が要る場所（球の陰影、hex を並べたグラデーション、テーマのオーラ）は `ink.fixed(color)` を使う。そこは寄っても変わらない。
- `color-mix` の中で CSS 変数を使えないブラウザでは、引いたときの色のまま描く。

### 守らせる仕組み

- `scripts/check-tiers.mjs`（guiex。ビルドで実行される）が、盤面のレイヤー（`zLayers` か `boardTiers` を読み込むファイル、各デザインのフォルダ、フォームと道の印）で、色と `zIndex` を数値で書くとビルドを落とす。
- 既存のぶんは `tier-baseline.json` に数えてある。増えたら落ち、減らしたら `node scripts/check-tiers.mjs --update` で基準を下げる。基準は減るだけ。
- 地面のグリッドの色は、地面の色から段が作る（`groundPatternVars` → `--canvas-dot` / `--canvas-dot-hi` / `--canvas-grid`）。どのデザインの背景もこの変数で描く。
- 全体図（`BoardOverview`）も同じ段で描く。引いたときだけ地図が一番うるさくならないように。
- 盤面全体に CSS の filter をかけて暗くするやり方は採らない。盤面の大きさで描かれるので、iPhone ではメモリが足りなくなる。

## 部品の置き場所

| 部品 | ファイル |
| --- | --- |
| `sphereBackground` / `thingFaceBackground` / `thingInk` / `thingFaceText` / `thingNameShadow` / `dropCap` / `fitThingValue` / `THING_GLYPH_*` / `DROP_CAP_SCALE` | `web/src/utils/thingFace.ts` |
| `ThingPicture` / `thingPictureKind` | `web/src/components/dashboard/ThingPicture.tsx`、`web/src/utils/thingPicture.ts` |
| `ClockDial` / `ThingMap` / `StaticMap` | `web/src/components/common/` |
| `EmbeddedPage` / `PagePicture` | `web/src/components/dashboard/WantCard/plugins/embeddedPage.tsx` |
| `thingStage` | `web/src/stores/boardLodStore.ts`（mywant-guiex） |
| `ThingTileDetail`（札とカード） | `web/src/components/dashboard/ThingTileDetail.tsx`（mywant-guiex） |
| `THING_CLIP` | `web/src/utils/thingShape.ts` |
| `boardLiftFilter` / `boardLiftShadow` / `boardEdgeFilter` / `iconEmbossFilter` / `wantTypeIconStyle` / `vividIconColor` | `web/src/components/dashboard/WantCardFace.tsx` |
| `glowLayers` / `glowRadius` | `web/src/components/dashboard/canvasGlow.ts` |
| 盤面の重なり順（スロットごとの段） | `web/src/design/zLayers.ts`（mywant-guiex） |
| 段の幅・インク：`TIER_BANDS` / `NEAR_GAIN` / `useLayerInk` / `useInk` / `BoardSlot` / `useTexture` / `tierInk` / `inkCss` / `groundPatternVars` / `boardNear` | `web/src/design/boardTiers.ts`（mywant-guiex） |
| 段の検査 | `web/scripts/check-tiers.mjs`、`web/scripts/tier-baseline.json`（mywant-guiex） |
| `ARCHIVED_FILTER` | `web/src/components/dashboard/archiveLook.ts`（mywant-guiex） |

見本になる実装：`CanvasThingTile.tsx`（Thing のチップ）、`ThingTileDetail.tsx`（寄ったときの詳細）、`ThingDot.tsx`（小さい Thing）、`ConstellationClusterLayer.tsx`（折りたたみ時の縮小版）。
