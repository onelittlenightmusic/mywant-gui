# list — 一覧のもの

`/dashboard` のカードグリッド。方向キーは空間ではなく読み順を意味する。

| ファイル | 内容 |
| --- | --- |
| `WantListPage.tsx` | `/dashboard` のページ本体。useWorkspace ＋ 一覧の hook。global のマークはここで答え、want/thing のマークは `/canvas` へ渡す |
| `WantListView.tsx` | 一覧ページの描画（want のグリッドとエラー表示） |
| `useListNavigation.ts` | カードグリッドを読み順で歩く。Add Want / Open Archive の仮想スロットも |
| `useListReorder.ts` | 並べ替え（ドラッグ・Shift+矢印・A+D-pad）と Cmd+Shift+矢印 |
