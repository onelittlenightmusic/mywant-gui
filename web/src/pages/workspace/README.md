# workspace — 両ページ共通の器

`/dashboard` と `/canvas` のどちらでも同じように要るもの。盤面にも一覧にも属さない。

| ファイル | 内容 |
| --- | --- |
| `useWorkspace.tsx` | 両ページが最初に呼ぶ共通部分（旧 Dashboard の盤面でも一覧でもない全部）。キー listener は登録しない |
| `boardLink.ts` | workspace が盤面に触れる値だけの型 `BoardLink` と、盤面の無い一覧ページ用の `useNoBoard()` |
| `WorkspaceChrome.tsx` | 両ページ共通の見た目：ヘッダーの選択バー／確認帯、Want フォーム・レシピ保存・ドラッグ中の影 |
| `usePanelRequests.ts` | 詳細パネルへの要求（開いて／閉じた）と Add・Edit Thing、thing の一覧 |
| `useGuiStateSync.ts` | `/api/v1/gui/state` との唯一の会話。読み・書き戻し・CLI からのフォーム操作 |
| `useWorkspaceSidebar.tsx` | 右パネルが何を表示するか、閉じるとは何か |
| `useWantActions.ts` | want への操作（削除・停止・archive・レシピ化）と、それが上げる確認 |
| `useDetailTarget.ts` | 詳細パネルが誰のためのもので、どう入るか |
| `useSelectionInput.ts` | 決定・取消・コンテキストメニューが何に効くか |
| `useWantCreationDrops.ts` | drop が何を生み、誰の子になるか |
| `useWorkspaceShortcuts.ts` | 単文字キー（a s S q x l c g ?）の一覧 |
| `useGlobalTemplateDrop.ts` | ページそのものへの drop と、そのドロップ表示 |
