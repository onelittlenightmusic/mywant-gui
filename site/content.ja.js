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
    heroSub: 'カードを押すと、右側にくわしい説明が開きます。MyWant 本体のことは「MyWant ガイド」で説明しています。',
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
  <li>スマホからも開ける</li>
</ul>
<div class="box">
  <p class="box-title"><i data-lucide="info"></i>MyWant 本体が必要です</p>
  <p>mywant-gui は画面だけなので、裏で MyWant のサーバーが動いている必要があります。MyWant 自体のことは <a href="https://onelittlenightmusic.github.io/MyWant/?lang=ja">MyWant ガイド</a> を見てください。</p>
</div>
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
`,
        },
        {
          id: 'keys',
          title: 'キーボード操作',
          sub: 'マウスなしでも使える',
          icon: 'keyboard',
          color: '#64748b',
          body: `
<p>画面はキーボードだけでも操作できます。全部の一覧は <code>?</code> キーで出ます。</p>
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
`,
        },
        {
          id: 'settings',
          title: '設定',
          sub: '明るさ・ヘッダの位置など',
          icon: 'settings',
          color: '#6b7280',
          body: `
<p>Menu の <strong>Settings</strong> で、操作のしかた（Interaction Mode）やゲームコントローラーの接続などを変えられます。</p>
<h4>明るさとヘッダの位置</h4>
<p>画面の明るさとヘッダの位置は MyWant の設定に保存され、どのブラウザで開いても同じになります。</p>
<div class="code"><pre># 明るさ：light / dark / system
mywant config set color_mode dark
# ヘッダの位置：top / bottom
mywant config set header_position bottom</pre></div>
<p>スマホでは、ヘッダを下にすると親指で届きやすくなります。</p>
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
<p>拡張の作り方は <a href="https://onelittlenightmusic.github.io/mywant-gui-dev/">開発者ドキュメント</a>（英語）で説明しています。</p>
`,
        },
      ],
    },
  ],
};
