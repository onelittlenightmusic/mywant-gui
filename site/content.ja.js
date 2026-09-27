/*
 * The mywant-gui guide in Japanese. content.en.js is the same guide in English:
 * both keep the same topic ids, icons and colours, so a link (#install) opens
 * the same topic in either language. `ui` is the page's own wording; `sections`
 * are the rows of cards, each topic one card and the sidebar page it opens.
 * `body` is HTML — a `.code` block's "#" lines are drawn as comments, and every
 * block gets a copy button (app.js). Accent colours are the GUI's menu colours.
 */
window.GUIDE = window.GUIDE || {};
window.GUIDE.ja = {
  ui: {
    htmlLang: 'ja',
    langName: '日本語',
    docTitle: 'mywant-gui ガイド',
    subtitle: 'やさしいガイド',
    topics: n => `${n} topics`,
    heroLead: 'MyWant で起きていることを、ブラウザでカードとして眺めて、動かす画面です。',
    heroSub: 'マウスでも、キーボードでも、ゲームパッドだけでも動かせます。カードを押すと、右側にくわしい説明が開きます。',
    menu: 'メニュー',
    sections: 'Sections',
    startHere: 'Start here',
    theme: '明るさの切り替え',
    lang: 'Switch to English',
    close: '閉じる',
    copy: 'コピー',
    prev: '前へ',
    grid: '一覧',
    next: '次へ',
    guides: 'ガイド',
    guidesNote: 'MyWant のほかのガイド',
  },
  sections: [
    {
      id: 'start',
      title: 'はじめる',
      note: '上から順に読めば、画面が使えるようになります',
      icon: 'rocket',
      topics: [
        {
          id: 'what',
          step: 'Step 1',
          title: 'mywant-gui ってなに？',
          sub: 'MyWant をブラウザで見て、さわる画面',
          icon: 'layout-dashboard',
          color: '#6366f1',
          body: `
<p>MyWant は「やってほしいこと（Want）」を書くと、エージェントが代わりに動いてくれる仕組みです。
<strong>mywant-gui</strong> は、その様子をブラウザで見るための画面（ダッシュボード）です。</p>
<h4>できること</h4>
<ul>
  <li>置いた Want が 1 枚ずつカードになって並び、状態がひと目でわかる</li>
  <li>カードを押すと、結果・設定・履歴が見られる</li>
  <li>Want の追加・停止・削除が、ボタンでできる</li>
  <li>よく使う値（Thing）、Want の種類、エージェント、レシピを眺められる</li>
  <li><strong>ゲームパッドだけで</strong>ぜんぶ操作できる</li>
  <li>スマホからも開ける</li>
</ul>
<div class="box">
  <p class="box-title"><i data-lucide="info"></i>MyWant 本体が必要です</p>
  <p>mywant-gui は画面だけなので、裏で MyWant のサーバーが動いている必要があります。MyWant 自体のことは <a href="https://onelittlenightmusic.github.io/MyWant/?lang=ja">MyWant ガイド</a> を見てください。</p>
</div>
${shot("dashboard.jpg", "ダッシュボード。置いた Want がカードで並びます")}
`,
        },
        {
          id: 'install',
          step: 'Step 2',
          title: 'インストール',
          sub: 'Homebrew で本体と一緒に',
          icon: 'download',
          color: '#10b981',
          body: `
<p>Mac では <a href="https://brew.sh/ja/" target="_blank" rel="noopener">Homebrew</a> で入れるのがいちばん簡単です。
「ターミナル」アプリに、下のコマンドを順に貼りつけてください。</p>
<ol class="steps">
  <li><strong>配布元を登録して、信頼する</strong>（はじめの 1 回だけ）
    <div class="code"><pre>brew tap onelittlenightmusic/mywant
brew trust onelittlenightmusic/mywant</pre></div>
  </li>
  <li><strong>MyWant 本体と画面を入れる</strong>
    <div class="code"><pre>brew install mywant mywant-gui</pre></div>
  </li>
</ol>
<h4>ソースから作る場合</h4>
<p>Go と Node.js が入っていれば、自分でビルドすることもできます。</p>
<div class="code"><pre>git clone https://github.com/onelittlenightmusic/mywant-gui.git
cd mywant-gui
make install   # ~/.local/bin/mywant-gui に入ります</pre></div>
`,
        },
        {
          id: 'run',
          step: 'Step 3',
          title: '起動と停止',
          sub: 'サーバーのあとに画面を',
          icon: 'power',
          color: '#14b8a6',
          body: `
<p>先に MyWant のサーバーを、次に画面を起動します。<code>-D</code> は「裏で動かしておく」という意味です。</p>
<ol class="steps">
  <li><strong>MyWant のサーバーを起動する</strong>
    <div class="code"><pre>mywant start -D</pre></div>
  </li>
  <li><strong>画面を起動する</strong>
    <div class="code"><pre>mywant-gui start -D</pre></div>
  </li>
  <li><strong>ブラウザで開く</strong><br />
    <a href="http://localhost:8081" target="_blank" rel="noopener">http://localhost:8081</a> を開きます。
  </li>
</ol>
<h4>止める</h4>
<div class="code"><pre>mywant-gui stop</pre></div>
<div class="box">
  <p class="box-title"><i data-lucide="info"></i>ポート番号</p>
  <p>画面は 8081 番を使い、8080 番の MyWant サーバーにつなぎます。変えたいときは <code>mywant-gui start -D --port 9091</code> や <code>--backend http://別のマシン:8080</code> のように指定します。</p>
</div>
${shot("dashboard.jpg", "http://localhost:8081 を開いたところ")}
`,
        },
        {
          id: 'tour',
          step: 'Step 4',
          title: '画面のつくり',
          sub: 'ヘッダ・カード・サイドバー',
          icon: 'panels-top-left',
          color: '#6366f1',
          body: `
<p>画面は 3 つの部分でできています。このガイドのページも同じ形です。</p>
<dl class="terms">
  <dt>ヘッダ</dt><dd>いちばん上の帯。左の <strong>Menu</strong> でページを切り替えます。右側には、そのページで使えるボタン（追加・選択・読み込みなど）が並びます。</dd>
  <dt>カード</dt><dd>Want やエージェントなどが 1 枚ずつ並びます。アイコンや色で、種類や状態がわかります。</dd>
  <dt>サイドバー</dt><dd>カードを押すと右側に開きます。下のタブで、見る内容を切り替えます。スマホでは下から出てきます。</dd>
</dl>
<div class="box">
  <p class="box-title"><i data-lucide="menu"></i>Menu の中身</p>
  <p>Wants・Thing・Want Types・Worlds・Agents・Recipes・Achievements・Logs・Devices・Help・Settings。それぞれのページは「ページごとの使い方」で説明しています。</p>
</div>
${shot("dashboard-detail.jpg", "上がヘッダ、左がカード、右がサイドバー")}
${shot("menu.jpg", "左上の Menu。ページの一覧です")}
`,
        },
        {
          id: 'add',
          step: 'Step 5',
          title: 'Want を追加する',
          sub: '種類を選んで、項目を埋めるだけ',
          icon: 'circle-plus',
          color: '#ec4899',
          body: `
<ol class="steps">
  <li><strong>ヘッダ右端の ＋ を押す</strong><br />キーボードなら <code>a</code> キーでも開きます。</li>
  <li><strong>種類を選ぶ</strong><br />天気（weather）、リマインダー（reminder）など。上の欄に文字を入れると絞り込めます。</li>
  <li><strong>項目を埋める</strong><br />場所や時刻など、その種類が必要とする値を入れます。例がある種類は、例から始められます。</li>
  <li><strong>Deploy を押す</strong><br />カードが増えて、エージェントが動き始めます。</li>
</ol>
<h4>ファイルから読み込む</h4>
<p>YAML ファイルに書いた Want は、ヘッダの <strong>Import</strong> ボタンからまとめて読み込めます。</p>
${shot("add-want.jpg", "＋ を押すと、Want の種類が分類ごとに並びます")}
${shot("add-want-form.jpg", "種類を選ぶと、入れる項目のフォームになります")}
`,
        },
      ],
    },
    {
      id: 'pages',
      title: 'ページごとの使い方',
      note: 'Menu から開けるページ',
      icon: 'layout-grid',
      topics: [
        {
          id: 'wants',
          title: 'Wants',
          sub: '置いた Want の一覧',
          icon: 'heart',
          color: '#ec4899',
          body: `
<p>いちばんよく使うページです。置いた Want が 1 枚ずつカードで並びます。</p>
<h4>カードを押すと</h4>
<p>右にサイドバーが開きます。下のタブで見るものを切り替えます。</p>
<dl class="terms">
  <dt>Settings</dt><dd>渡した値。ここで書き換えられます</dd>
  <dt>Results</dt><dd>エージェントが書き込んだ結果</dd>
  <dt>Wiring</dt><dd>ほかの Want とのつながり</dd>
  <dt>History</dt><dd>これまでに起きたこと</dd>
</dl>
<h4>動かす・止める</h4>
<p>サイドバーのボタンで <strong>Start</strong>（動かす）、<strong>Stop</strong>（止める）、<strong>Suspend</strong>（一時停止）、<strong>Delete</strong>（消す）ができます。</p>
<h4>並べ替える</h4>
<p>カードはドラッグで並べ替えられます。</p>
${shot("dashboard-detail.jpg", "カードを押すと、右にサイドバーが開きます")}
${shot("dashboard-results.jpg", "Results タブ：エージェントが書き込んだ結果")}
`,
        },
        {
          id: 'thing',
          title: 'Thing',
          sub: '名前をつけた値',
          icon: 'circle',
          color: '#f59e0b',
          body: `
<p>「自宅の駅」「よく行くお店」のように、よく使う値に名前をつけて置いておくページです。</p>
<ul>
  <li>ヘッダのボタンから Thing を追加できます</li>
  <li>Thing のカードから、その値を使う Want をすぐ作れます</li>
  <li>関係のある Thing どうしは、星座（constellation）としてまとめられます</li>
</ul>
${shot("thing.jpg", "Thing ページ")}
`,
        },
        {
          id: 'want-types',
          title: 'Want Types',
          sub: '置ける Want の種類',
          icon: 'zap',
          color: '#a855f7',
          body: `
<p>置ける Want の種類のカタログです。カードを押すと、説明・受け取る値・例が見られます。</p>
<p>「どんな値を入れればいいんだろう？」と思ったら、まずここで <strong>Examples</strong> を見るのが近道です。</p>
${shot("want-types.jpg", "Want Types ページ。種類を押すと説明が開きます")}
`,
        },
        {
          id: 'worlds',
          title: 'Worlds',
          sub: 'Want の組み合わせを保存',
          icon: 'layers',
          color: '#6366f1',
          body: `
<p>いま置いている Want 全部を、名前をつけて保存しておくページです。
「旅行の準備」「仕事の見張り」のように場面ごとに作り、押すだけで切り替えられます。</p>
<p>切り替えるときは、いまの World が自動で保存されます。</p>
${shot("worlds.jpg", "Worlds ページ")}
`,
        },
        {
          id: 'agents',
          title: 'Agents',
          sub: '働いているエージェント',
          icon: 'bot',
          color: '#3b82f6',
          body: `
<p>Want のために実際に動くエージェントの一覧です。カードを押すと、できること（Capabilities）や設定が見られます。</p>
<dl class="terms">
  <dt>Do</dt><dd>1 回だけやる</dd>
  <dt>Monitor</dt><dd>見張り続ける</dd>
  <dt>Think</dt><dd>考える</dd>
</dl>
${shot("agents.jpg", "Agents ページ。エージェントを押すと、できることが開きます")}
`,
        },
        {
          id: 'recipes',
          title: 'Recipes',
          sub: '再利用できるひな形',
          icon: 'book-open',
          color: '#10b981',
          body: `
<p>いくつかの Want の組み合わせを、ひな形として保存したものです。値を変えるだけで何度でも置けます。</p>
<p>Want のサイドバーにある <strong>Recipe</strong> ボタンから、その Want をもとにレシピを作れます。</p>
${shot("recipes.jpg", "Recipes ページ")}
`,
        },
        {
          id: 'others',
          title: 'そのほかのページ',
          sub: 'Achievements・Logs・Devices',
          icon: 'ellipsis',
          color: '#64748b',
          body: `
<dl class="terms">
  <dt>Achievements</dt><dd>できるようになったこと（実績）と、その条件</dd>
  <dt>Logs</dt><dd>何が起きたかの記録。うまくいかないときに見ます</dd>
  <dt>Devices</dt><dd>いまこの画面を開いているブラウザやスマホ</dd>
  <dt>Help</dt><dd>キーボード操作の一覧（<code>?</code> キーでも開きます）</dd>
  <dt>Settings</dt><dd>画面の設定（「設定」を見てください）</dd>
</dl>
${shot("help.jpg", "Help：キーボード操作の一覧")}
`,
        },
      ],
    },
    {
      id: 'more',
      title: 'もっと使う',
      note: '慣れてきたら',
      icon: 'wrench',
      topics: [
        {
          id: 'gamepad',
          title: 'ゲームパッドで操作',
          sub: '設定のしかたと、ボタンの役割',
          icon: 'gamepad-2',
          color: '#8b5cf6',
          body: `
<p>mywant-gui は <strong>ゲームパッド（コントローラー）だけで操作できる</strong>ように作られています。
ソファからテレビに映した画面を動かしたり、キーボードを使わずに Want を眺めて開いたりできます。</p>
<h4>設定のしかた ①　そのまま使う</h4>
<p>いちばん簡単な方法です。Chrome・Edge・Safari・Firefox など、ふつうのブラウザで使えます。</p>
<ol class="steps">
  <li><strong>コントローラーを Mac（PC）につなぐ</strong><br />USB ケーブルでつなぐか、コントローラーをペアリング状態にして Mac の「システム設定 → Bluetooth」から接続します。Xbox・PlayStation・Switch Pro など、ふつうのゲームパッドが使えます。</li>
  <li><strong>mywant-gui を開く</strong><br /><a href="http://localhost:8081" target="_blank" rel="noopener">http://localhost:8081</a> を開きます。</li>
  <li><strong>コントローラーのボタンをどれか 1 回押す</strong><br />ブラウザは、ボタンが押されるまでコントローラーを画面に見せない決まりになっています。1 回押せば、そのあとはすぐ操作できます。</li>
</ol>
<h4>設定のしかた ②　Chrome で WebHID 接続する（Mac）</h4>
<p>Mac の Chrome なら、画面の設定から直接つなぐこともできます。一度許可すれば次からは自動でつながり、Switch Pro コントローラーは操作に合わせて振動もします。</p>
<ol class="steps">
  <li><strong>Menu → Settings を開く</strong></li>
  <li><strong>「Controller (WebHID)」の「コントローラーを接続」をクリックする</strong><br />ブラウザの決まりで、このボタンだけはマウスのクリックで押す必要があります。</li>
  <li><strong>Chrome の小さな画面でコントローラーを選び、「接続」を押す</strong></li>
  <li><strong>ボタンが緑の「接続済み」になり、コントローラーの名前が出れば完了</strong><br />次に開いたときは、自動でつながります。</li>
</ol>
${shot('settings-controller.jpg', 'Settings の「Controller (WebHID)」と「Interaction Mode」')}
<div class="box">
  <p class="box-title"><i data-lucide="lock"></i>キャンバスで遊ぶなら Game モード</p>
  <p>同じ Settings の <strong>Interaction Mode</strong> を <strong>Game</strong> にすると、キャンバスのタイルの位置が固定されます。ゲームパッドで盤面を歩き回っても、うっかりタイルを動かしません。並べ替えたいときは <strong>Edit</strong> に戻します。</p>
</div>
<h4>ボタンの役割</h4>
<dl class="terms">
  <dt>十字キー / 左スティック</dt><dd>カードを移動する（B を押しながらだと速く動く）</dd>
  <dt>A</dt><dd>決定・開く。すばやく 2 回で大きく表示</dd>
  <dt>B</dt><dd>やめる・戻る</dd>
  <dt>X</dt><dd>切り替え・選ぶ</dd>
  <dt>Y</dt><dd>ヘッダのボタンへ移る</dd>
  <dt>L1 / R1</dt><dd>サイドバーのタブを前後に切り替える（B を押しながらだと下の段のタブ）</dd>
  <dt>Select</dt><dd>Menu を開く</dd>
  <dt>Start</dt><dd>選んでいるカードのクイックアクション。選択モードで選んでいれば、まとめて操作</dd>
</dl>
<p>画面の中でも <code>?</code> キー（Menu の Help）で、ボタンの図と一覧が見られます。</p>
<div class="box">
  <p class="box-title"><i data-lucide="map"></i>キャンバスではもっと</p>
  <p>キャンバス拡張（mywant-guiex）では、右スティックでズーム、L2 / R2 でタイルからタイルへジャンプ、A 長押しでタイルを動かす、といった操作も加わります。</p>
</div>
${shot("help-gamepad.jpg", "Help の「Gamepad Layout」。ボタンの図と役割が見られます")}
<h4>うまく動かないとき</h4>
<ul>
  <li><strong>何も反応しない</strong>：画面をクリックしてから、コントローラーのボタンを押し直してください。</li>
  <li><strong>「このブラウザは WebHID 未対応です」と出る</strong>：WebHID は Chrome 系のブラウザだけです。ほかのブラウザでは ① の方法で使えます。</li>
  <li><strong>ほかのアプリがコントローラーを使っている</strong>：ゲームなど、コントローラーをつかんでいるアプリを閉じてから試してください。</li>
  <li><strong>ボタンの役割を確かめたい</strong>：Menu の Help（<code>?</code> キー）の「Gamepad Layout」に図があります。</li>
</ul>
`,
        },
        {
          id: 'select',
          title: 'まとめて操作',
          sub: 'いくつかの Want を一度に',
          icon: 'list-checks',
          color: '#0ea5e9',
          body: `
<p>ヘッダの <strong>Select</strong>（または <code>s</code> キー）で選択モードになります。
カードを押して選ぶと、選んだものをまとめて動かせます。</p>
<dl class="terms">
  <dt>Start</dt><dd>まとめて動かす</dd>
  <dt>Stop</dt><dd>まとめて止める</dd>
  <dt>Delete</dt><dd>まとめて消す</dd>
</dl>
<p>終わったら右上の ✕ か、もう一度 <code>s</code> で戻ります。</p>
${shot("select.jpg", "選択モードで Tokyo と Osaka を選んだところ")}
`,
        },
        {
          id: 'keys',
          title: 'キーボード操作',
          sub: 'マウスなしでも使える',
          icon: 'keyboard',
          color: '#64748b',
          body: `
<p>画面はキーボードだけでも操作できます（ゲームパッドは「ゲームパッドで操作」を見てください）。全部の一覧は <code>?</code> キーで出ます。</p>
<dl class="terms">
  <dt>↑ ↓ ← →</dt><dd>カードを移動する</dd>
  <dt>Enter</dt><dd>決定・開く</dd>
  <dt>Esc</dt><dd>やめる・閉じる</dd>
  <dt>Tab</dt><dd>次の部品へ</dd>
  <dt>Shift + 矢印</dt><dd>選んだカードを並べ替える</dd>
  <dt>Alt + Enter</dt><dd>Menu を開く</dd>
  <dt>a</dt><dd>Want を追加</dd>
  <dt>s</dt><dd>選択モード</dd>
  <dt>?</dt><dd>ヘルプ</dd>
</dl>
${shot("help.jpg", "? キーで開く一覧")}
`,
        },
        {
          id: 'settings',
          title: '設定',
          sub: '明るさ・ヘッダの位置など',
          icon: 'settings',
          color: '#6b7280',
          body: `
<p>Menu の <strong>Settings</strong> で、操作のしかた（Interaction Mode）やゲームパッドの接続（「ゲームパッドで操作」を参照）などを変えられます。</p>
<h4>明るさとヘッダの位置</h4>
<p>画面の明るさとヘッダの位置は MyWant の設定に保存され、どのブラウザで開いても同じになります。</p>
<div class="code"><pre># 明るさ：light / dark / system
mywant config set color_mode dark
# ヘッダの位置：top / bottom
mywant config set header_position bottom</pre></div>
<p>スマホでは、ヘッダを下にすると親指で届きやすくなります。</p>
${shot("settings.jpg", "Menu の Settings")}
`,
        },
        {
          id: 'phone',
          title: 'スマホで使う',
          sub: '同じネットワークから開く',
          icon: 'smartphone',
          color: '#14b8a6',
          body: `
<p>ふつうに起動すると、その Mac からしか開けません。スマホなど、同じネットワークのほかの機械から開くには、次のように起動します。</p>
<div class="code"><pre>mywant-gui stop
mywant-gui start -D -H 0.0.0.0</pre></div>
<p>スマホのブラウザで <code>http://（Mac の IP アドレス）:8081</code> を開きます。
Mac の IP アドレスは「システム設定 → ネットワーク」で確かめられます。</p>
<div class="box">
  <p class="box-title"><i data-lucide="shield"></i>家の外から使うとき</p>
  <p>インターネットに公開するときは、パスワードで守られた方法を使ってください。くわしくは MyWant のドキュメントの認証の説明を見てください。</p>
</div>
${shot("phone.jpg", "スマホで開いたところ。カードが縦に並びます", { phone: true })}
`,
        },
        {
          id: 'cli',
          title: 'コマンドで画面を動かす',
          sub: '開いている画面を外から操作',
          icon: 'terminal',
          color: '#64748b',
          body: `
<p><code>mywant-gui</code> コマンドは、開いている画面を外から動かすこともできます。
AI エージェントに画面を操作させるときにも使えます。</p>
<div class="code"><pre># Want のサイドバーを開く
mywant-gui show want &lt;Want の ID&gt;
# ページを移る
mywant-gui show dashboard
# Want の追加フォームを開いて、種類を選ぶ
mywant-gui form open
mywant-gui form select reminder
# カードを画像にする
mywant-gui capture want &lt;Want の ID&gt;</pre></div>
<p>使えるコマンドの一覧は次で出ます。</p>
<div class="code"><pre>mywant-gui commands</pre></div>
`,
        },
        {
          id: 'extend',
          title: '拡張する',
          sub: 'ページやボタンを足す',
          icon: 'puzzle',
          color: '#a855f7',
          body: `
<p>mywant-gui には、あとからページ・メニュー・ボタン・見た目を足せる <strong>拡張</strong> の仕組みがあります。
拡張は <code>~/.mywant/gui-extensions/</code> に置くと、次に起動したときに読み込まれます。</p>
<p>拡張の作り方は <a href="https://onelittlenightmusic.github.io/mywant-gui-dev/">開発者ドキュメント</a>（英語）で説明しています。できあがった拡張の例が、次の「キャンバス（mywant-guiex）」です。</p>
`,
        },
        {
          id: 'canvas',
          title: 'キャンバス（mywant-guiex）',
          sub: 'Want を盤面のタイルとして並べる拡張',
          icon: 'map',
          color: '#0891b2',
          body: `
<p><strong>mywant-guiex</strong> は、mywant-gui に <strong>キャンバス</strong> を足す拡張です。
Want が 1 つずつ <strong>タイル</strong> になって盤面に並び、カードの一覧とは違った見かたができます。</p>
${shot('canvas-detail.jpg', 'キャンバス。天気・リマインダー・タイマーなどの Want がタイルとして並び、押すと右に中身が開きます')}
<h4>できること</h4>
<ul>
  <li>Want を好きな位置に並べて、自分だけの盤面を作る</li>
  <li>Want が使っている Thing（丸いもの）が横に浮かび、つながりが線で見える</li>
  <li>自分のキャラクターが盤面を歩き、立ったタイルを開いたり動かしたりできる</li>
  <li>ミニマップで盤面の全体を見渡せる</li>
  <li>ゲームパッドとの相性がよく、右スティックでズーム、L2 / R2 でタイルからタイルへジャンプできる</li>
</ul>
${shot('canvas.jpg', '右のミニマップで、盤面の全体と今いる場所がわかります')}
<h4>入れる</h4>
<div class="code"><pre>brew install mywant-guiex
# 画面を起動し直すと、Menu に Canvas が増えます
mywant-gui stop
mywant-gui start -D</pre></div>
<p>Menu の <strong>Canvas</strong>（または <code>c</code> キー）でキャンバスへ、<code>l</code> キーでカードの一覧へ戻ります。</p>
<h4>コマンドで動かす</h4>
<div class="code"><pre># タイルを (0, 1) のマスへ動かす
mywant guiex tile set tokyo-weather 0 1
# 使えるコマンドの一覧
mywant guiex commands</pre></div>
`,
        },
      ],
    },
  ],
};
