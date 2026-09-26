# 盤面のスタイル規約

want canvas（`/canvas`）の上に描くものの見た目の決まりごと。新しく何かを盤面に置くときは、まずここにある部品を使う。数値や色をその場で決めない。

## 1. 盤面の上のものは「物体」である

Thing も want も、盤面に**置かれた立体**として描く。盤面に貼ったシールや注釈に見えたら失敗。

| もの | 形 | 立体感の出し方 |
| --- | --- | --- |
| want | 角のあるブロック | 上面が明るく、右下に側面と影（cubic デザイン） |
| Thing | 球 | `sphereBackground`：左上にハイライト、右下へ暗くなる縁 |
| 地面（constellation の枠・道） | 平面 | 影を落とさない。立っていないので |

- **形で区別する、色で区別しない。** want は四角、Thing は丸。縮小表示（折りたたんだ constellation、ミニマップ）でもこの対応を崩さない。
- 球の中身の色は必ず不透明な下地の上に塗る（`sphereBackground` の最後の層）。背景画像で色が変わらないように。

## 2. 光は左上から、一つだけ

盤面の光源は左上に一つ。cubic のブロックの側面が右下 `{dx: 6, dy: 8}` に伸びることで決まっている。

- 立っているものの影は `boardLiftFilter(depth, isLight)`（clip-path のあるもの）か `boardLiftShadow(depth)`。真下に落ちる `0 4px 8px` は使わない。
- `depth` は高さ：1 がタイルの高さ、それ未満は低い印、それ以上は持ち上げた状態。
- 小さく切り抜いた形の輪郭は `boardEdgeFilter`。白い後光（光源のない光）はつけない。
- 選択中の光り方は `glowLayers` / `glowRadius`（`canvasGlow.ts`）で。リングで囲まない。

## 3. 文字は頭文字を大きく（ドロップキャップ）

盤面に書く名前は、**最初の一文字が名前を担い、残りは添える**。

- 分け方は `dropCap(value)`（`utils/thingFace.ts`）。コードポイント単位で切るので絵文字やサロゲートペアの漢字も割れない。3 文字以上は残りを `…` にする。
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

## 5. 縮小しても同じものに見えること

折りたたんだ constellation（`ConstellationClusterLayer`）、ミニマップ、カードのバッジなど、小さく描く場所でも**同じ部品を同じ比率で**使う。小さい版だけ平たい円や白い台紙にしない。

- 14px 未満ではアイコンが潰れるので、球と頭文字だけにする（`ThingDot`）。
- 大きさが違うだけで、影・色・文字の決まりは上と同じ。

## 部品の置き場所

| 部品 | ファイル |
| --- | --- |
| `sphereBackground` / `thingFaceBackground` / `thingInk` / `thingFaceText` / `thingNameShadow` / `dropCap` / `THING_GLYPH_*` / `DROP_CAP_SCALE` | `web/src/utils/thingFace.ts` |
| `THING_CLIP` | `web/src/utils/thingShape.ts` |
| `boardLiftFilter` / `boardLiftShadow` / `boardEdgeFilter` / `iconEmbossFilter` / `wantTypeIconStyle` / `vividIconColor` | `web/src/components/dashboard/WantCardFace.tsx` |
| `glowLayers` / `glowRadius` | `web/src/components/dashboard/canvasGlow.ts` |
| 盤面の重なり順 | `web/src/design/zLayers.ts` |

見本になる実装：`CanvasThingTile.tsx`（Thing の球）、`ThingDot.tsx`（小さい Thing）、`ConstellationClusterLayer.tsx`（折りたたみ時の縮小版）。
