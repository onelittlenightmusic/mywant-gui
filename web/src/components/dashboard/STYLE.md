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

- near は want のタイルがカード面になる境目（`FACE_FROM_SCALE` 2.0 で出て `FACE_UNTIL_SCALE` 1.8 で消える）と同じ。ほかの段階は、戻るときは境目の 0.9 倍まで下がってから（ヒステリシス）。段階が変わると、詳細は左上の角から少しだけ広がりながら現れる（0.85 倍→等倍）。
- 寄りは Thing カードを盤面用に描き直さず、カードそのものを縮めて載せる。札の小さな絵も、カードと同じ `ThingPicture`（時刻→針の時計 `ClockDial`、写真→写真、場所→地図 `ThingMap`、それ以外→型のアイコン）。
- 詳細は表示だけ（pointer-events なし、inert）。押す・ドラッグ・フォーカスはチップが受け持つ。
- **ズームしても世界の中での大きさを変えない。** 札もカードも、その Thing のマスの幅（リストのカードと同じ横長）に収め、隣のマスに出ない。寄って増えるのは中身で、大きさではない。
- 段階は大きさ（½・¼）ごとに一つに決まる。同じ大きさの Thing は同じズームで切り替わる（立っている Thing も同じ）。
- 粒が小さくなっても、押す・ドラッグの当たり判定はマス全体のまま。
- 同時に描く詳細は、見えている中で中央に近いものから near 12・mid 40 まで。

## 6. 縮小しても同じものに見えること

折りたたんだ constellation（`ConstellationClusterLayer`）、ミニマップ、カードのバッジなど、小さく描く場所でも**同じ部品を同じ比率で**使う。小さい版だけ平たい円や白い台紙にしない。

- 14px 未満ではアイコンが潰れるので、球と頭文字だけにする（`ThingDot`）。
- 大きさが違うだけで、影・色・文字の決まりは上と同じ。

## 7. アーカイブしたものは色を抜く

アーカイブ表示を On にしたときだけ、アーカイブした want / Thing も盤面に出る。そのときは**同じ物体のまま色を抜く**（`ARCHIVED_FILTER`：グレースケール）。

- 半透明にしない。文字が半透明になり（§3）、物体が盤面に立っているように見えなくなる。
- フィルタはタイルがもともと持っている filter（影・光り方）の前に足す。影も一緒に灰色になる。
- 座標のない Thing は盤面が空いているセルを暫定で選ぶ。書き込まない。生きている Thing の配置を先に決め、アーカイブはその残りに置く。

## 部品の置き場所

| 部品 | ファイル |
| --- | --- |
| `sphereBackground` / `thingFaceBackground` / `thingInk` / `thingFaceText` / `thingNameShadow` / `dropCap` / `fitThingValue` / `THING_GLYPH_*` / `DROP_CAP_SCALE` | `web/src/utils/thingFace.ts` |
| `ThingPicture` / `thingPictureKind` | `web/src/components/dashboard/ThingPicture.tsx`、`web/src/utils/thingPicture.ts` |
| `ClockDial` / `ThingMap` | `web/src/components/common/` |
| `thingStage` | `web/src/stores/boardLodStore.ts`（mywant-guiex） |
| `ThingTileDetail`（札とカード） | `web/src/components/dashboard/ThingTileDetail.tsx`（mywant-guiex） |
| `THING_CLIP` | `web/src/utils/thingShape.ts` |
| `boardLiftFilter` / `boardLiftShadow` / `boardEdgeFilter` / `iconEmbossFilter` / `wantTypeIconStyle` / `vividIconColor` | `web/src/components/dashboard/WantCardFace.tsx` |
| `glowLayers` / `glowRadius` | `web/src/components/dashboard/canvasGlow.ts` |
| 盤面の重なり順 | `web/src/design/zLayers.ts` |
| `ARCHIVED_FILTER` | `web/src/components/dashboard/archiveLook.ts`（mywant-guiex） |

見本になる実装：`CanvasThingTile.tsx`（Thing のチップ）、`ThingTileDetail.tsx`（寄ったときの詳細）、`ThingDot.tsx`（小さい Thing）、`ConstellationClusterLayer.tsx`（折りたたみ時の縮小版）。
