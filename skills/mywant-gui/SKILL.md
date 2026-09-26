---
name: mywant-gui
description: MyWant GUIのナビゲーション・ページ遷移・Add Wantフォーム操作・パラメータ設定・スクリーンショット撮影などGUI制御コマンドを実行する。ダッシュボード操作・Wantカードの開閉・パラメータ値の確認・変更・カードのキャプチャが必要なときに使用する。
metadata:
  output-format: text
---

$ARGUMENTS

引数に応じて `mywant-gui` コマンドを実行し、出力をそのまま表示してください。

> このファイルは早見表と、フラグ表だけでは分からない注意点のみを記す。
> 全コマンドは `mywant-gui commands`、各コマンドの全フラグや既定値は `mywant-gui <cmd> --help` で確認できる。

## 実行特性

| 項目 | 値 | 説明 |
|---|---|---|
| 実行モデル | `foreground` | 指示に応じて1回実行し完了する |

## コマンド早見

| 用途 | コマンド |
|---|---|
| Wantを開く/閉じる | `mywant-gui wants open <名前orID>` / `wants close` |
| Wantを全画面/解除 | `mywant-gui wants maximize <名前orID>` / `wants maximize --collapse` |
| 最新wantのID取得 | `mywant-gui wants latest --type <type>` |
| ページ遷移 | `mywant-gui dashboard` / `agents` / `recipes` / `types` |
| ビュー遷移（show） | `mywant-gui show want <ID>` / `show dashboard` / `show global` |
| Add Wantフォーム | `mywant-gui form open` / `form select <type>` / `form suggest-deploy` |
| パラメータ | `mywant-gui params show <key>` / `params set <key> <値>`（`--want <ID>`） |
| スクリーンショット | `mywant-gui capture want <名前orID>` / `capture want <名前orID> --max` |
| サーバー管理 | `mywant-gui start [-D]` / `stop` / `get` |

## フラグ表だけでは分からない注意点

### Want間の接続は mywant CLI 側
`connect`/`disconnect`（expose/import 接続の作成・削除）は GUI カーソル操作ではなく
want グラフの操作なので `mywant-gui` から `mywant wants connect <A> <B>` /
`mywant wants disconnect <A> <B>` に移設済み。


### コマンドは大文字小文字を区別しない
`mywant-gui I SAY hello` も動く（音声入力やスマホの自動大文字化対策、`cobra.EnableCaseInsensitive`）。


### YAMLでwant（curl等）をデプロイする際のcanvas座標

want の YAML（`curl -X POST .../wants` 等）に `metadata.labels` の `mywant.io/canvas-x` /
`mywant.io/canvas-y` を指定しないと、canvas 原点 (0,0) 起点のフォールバック配置になる。
置きたい座標がある場合は、その値をそのまま labels に設定する：

```yaml
wants:
  - metadata:
      name: my-want
      type: <type>
      labels:
        mywant.io/canvas-x: "12"
        mywant.io/canvas-y: "8"
    spec:
      params: {}
```

- 値は必ず**文字列**（`"12"`）で指定する。数値のまま（`12`）だとラベルとして不正。
- 複数の want を並べてデプロイする場合は、座標が重ならないよう x か y を1〜2ずつずらす。

### `capture want` — スクリーンショット撮影と画像表示

`capture want <名前orID>` はサイドバーを開いた状態のカードを PNG として保存する。
`--max` をつけると最大化ビューを撮影する。

```bash
mywant-gui capture want abc-123                        # → abc-123.png
mywant-gui capture want abc-123 --max                  # → abc-123_max.png
mywant-gui capture want abc-123 --output /tmp/shot.png # 出力先を指定
mywant-gui capture want abc-123 --wait 2000            # アニメーション待機を延長
```

**キャプチャ後は Read ツールで画像を表示する。**
コマンドが `Saved: <path>` を出力したら、そのパスを Read ツールで読み込んで
ユーザーに画像を見せること。

```
# 例: コマンド出力が "Saved: /Users/xxx/abc-123.png" ならば
Read(file_path="/Users/xxx/abc-123.png")  →  画像として表示される
```

- headless Chrome が内部で起動するため、初回は数秒かかる場合がある
- GUI サーバー（localhost:8081）が起動済みである必要がある
- `--wait` のデフォルトは 1500ms。アニメーションが完了する前に撮影されるときは増やす

### その他の癖
- `params show/set` は `--want` 省略時に「現在サイドバーで開いている want」を対象にする。
- `--tab` の `versions` は `show want` のみ対応（`wants open` は非対応）。

## スキル入力フィールド

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `command` | string | ✓ | 実行するサブコマンド（wants open / dashboard / form open / params set など） |
| `args` | string | — | コマンドへの追加引数（want名・ID・パラメータキー・値など） |

## エラー時

コマンドが失敗した場合は `Error: ...` の形式でエラーを表示します。
GUIサーバーが起動していない場合は `mywant-gui start` で起動してください。
</content>
