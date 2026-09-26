# canvas — 盤面のもの

`/canvas` でしか意味を持たないもの。一覧側からは何も参照しない。

| ファイル | 内容 |
| --- | --- |
| `CanvasPage.tsx` | `/canvas` のページ本体。useBoardState → useWorkspace → useBoard / useBoardInput（key listener の順番に注意） |
| `useBoard.ts` | 盤面のフックをひとまとめにしたもの。共通の器から受け取り、盤面ページの描画と共通パネルが要るものを返す |
| `useBoardState.ts` | 盤面だけが持つ状態（主人公の位置・ズーム・カメラ・盤面そのもの・運搬中のタイル） |
| `usePresence.ts` | 誰が盤面に居て何を言っているか。カーソル配信・say・ride・call |
| `useArrangeReview.ts` | テーマの並べ替えを盤面で見せ、同意を待つ |
| `CanvasView.tsx` / `CanvasFloatCards.tsx` / `CanvasOverlays.tsx` | 盤面ページの描画（盤面・パッド・カメラ／スマホの角カード／スキルと吹き出し） |
| `useBoardNavigation.ts` | 歩く／跳ぶ、タイルを持ち上げて運ぶ、L1/R1 でミニマップへ |
| `useCursorFocus.ts` | 足元に何があるか、盤面が何を差し出すか（開くかどうかは押してから） |
| `useBoardCamera.ts` | 視点が主人公から離れているときの往復と、マークからのジャンプ |
| `useCanvasWantPlacement.ts` | タイルの位置・回転・長さをラベルとして書き戻す |
| `useTileMoveInput.ts` | タイルを 1 マス押す／隣のタイルへ飛ばす |
| `useRotationGuideInput.ts` | マウス無しでタイルを回す・伸ばす（長押しで開き、離して確定） |
