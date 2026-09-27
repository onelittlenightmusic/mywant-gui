/*
 * The mywant-gui guide in English — the same topics, ids, icons and colours as
 * content.ja.js (see the note there). Change both together.
 */
window.GUIDE = window.GUIDE || {};
window.GUIDE.en = {
  ui: {
    htmlLang: 'en',
    langName: 'English',
    docTitle: 'mywant-gui Guide',
    subtitle: 'A gentle guide',
    topics: n => `${n} topics`,
    heroLead: 'The screen where you watch what MyWant is doing, as cards, and move it along.',
    heroSub: 'Press a card to open its explanation on the right. MyWant itself is explained in the MyWant guide.',
    menu: 'Menu',
    sections: 'Sections',
    startHere: 'Start here',
    theme: 'Switch light and dark',
    lang: '日本語に切り替える',
    close: 'Close',
    copy: 'Copy',
    prev: 'Prev',
    grid: 'All',
    next: 'Next',
    guides: 'Guides',
    guidesNote: 'More guides to MyWant',
  },
  sections: [
    {
      id: 'start',
      title: 'Getting started',
      note: 'Read from the top and the screen is yours',
      icon: 'rocket',
      topics: [
        {
          id: 'what',
          step: 'Step 1',
          title: 'What is mywant-gui?',
          sub: 'See and handle MyWant in your browser',
          icon: 'layout-dashboard',
          color: '#6366f1',
          body: `
<p>MyWant lets you write down what you want done (a Want), and agents do it for you.
<strong>mywant-gui</strong> is the screen for watching that in your browser — the dashboard.</p>
<h4>What you can do</h4>
<ul>
  <li>Every Want you placed is a card, so you can see how each is doing at a glance</li>
  <li>Press a card to see its results, settings and history</li>
  <li>Add, stop and remove Wants with buttons</li>
  <li>Browse your named values (Things), the kinds of Want, agents and recipes</li>
  <li>Open it from your phone too</li>
</ul>
<div class="box">
  <p class="box-title"><i data-lucide="info"></i>It needs MyWant itself</p>
  <p>mywant-gui is only the screen, so a MyWant server has to be running behind it. For MyWant itself, see the <a href="https://onelittlenightmusic.github.io/MyWant/?lang=en">MyWant guide</a>.</p>
</div>
`,
        },
        {
          id: 'install',
          step: 'Step 2',
          title: 'Install',
          sub: 'With Homebrew, together with MyWant',
          icon: 'download',
          color: '#10b981',
          body: `
<p>On a Mac, <a href="https://brew.sh/" target="_blank" rel="noopener">Homebrew</a> is the easiest way.
Paste the commands below into the Terminal app, one at a time.</p>
<ol class="steps">
  <li><strong>Add the source and trust it</strong> (only the first time)
    <div class="code"><pre>brew tap onelittlenightmusic/mywant
brew trust onelittlenightmusic/mywant</pre></div>
  </li>
  <li><strong>Install MyWant and the screen</strong>
    <div class="code"><pre>brew install mywant mywant-gui</pre></div>
  </li>
</ol>
<h4>Building from source</h4>
<p>With Go and Node.js installed, you can build it yourself.</p>
<div class="code"><pre>git clone https://github.com/onelittlenightmusic/mywant-gui.git
cd mywant-gui
make install   # goes to ~/.local/bin/mywant-gui</pre></div>
`,
        },
        {
          id: 'run',
          step: 'Step 3',
          title: 'Start and stop',
          sub: 'The server first, then the screen',
          icon: 'power',
          color: '#14b8a6',
          body: `
<p>Start the MyWant server first, then the screen. <code>-D</code> means "keep it running in the background".</p>
<ol class="steps">
  <li><strong>Start the MyWant server</strong>
    <div class="code"><pre>mywant start -D</pre></div>
  </li>
  <li><strong>Start the screen</strong>
    <div class="code"><pre>mywant-gui start -D</pre></div>
  </li>
  <li><strong>Open it in your browser</strong><br />
    Go to <a href="http://localhost:8081" target="_blank" rel="noopener">http://localhost:8081</a>.
  </li>
</ol>
<h4>Stop</h4>
<div class="code"><pre>mywant-gui stop</pre></div>
<div class="box">
  <p class="box-title"><i data-lucide="info"></i>Ports</p>
  <p>The screen uses port 8081 and talks to the MyWant server on 8080. To change them, use <code>mywant-gui start -D --port 9091</code> or <code>--backend http://another-machine:8080</code>.</p>
</div>
`,
        },
        {
          id: 'tour',
          step: 'Step 4',
          title: 'The layout',
          sub: 'Header, cards and sidebar',
          icon: 'panels-top-left',
          color: '#6366f1',
          body: `
<p>The screen has three parts. This guide's page has the same shape.</p>
<dl class="terms">
  <dt>Header</dt><dd>The bar at the top. <strong>Menu</strong> on the left changes pages; on the right are the buttons for the page you are on (add, select, import, …).</dd>
  <dt>Cards</dt><dd>Wants, agents and so on, one card each. Icons and colours show their kind and how they are doing.</dd>
  <dt>Sidebar</dt><dd>Press a card and it opens on the right. Tabs along its foot switch what you see. On a phone it slides up from the bottom.</dd>
</dl>
<div class="box">
  <p class="box-title"><i data-lucide="menu"></i>What is in the Menu</p>
  <p>Wants, Thing, Want Types, Worlds, Agents, Recipes, Achievements, Logs, Devices, Help and Settings. Each page is explained under "Page by page".</p>
</div>
`,
        },
        {
          id: 'add',
          step: 'Step 5',
          title: 'Add a Want',
          sub: 'Pick a kind and fill it in',
          icon: 'circle-plus',
          color: '#ec4899',
          body: `
<ol class="steps">
  <li><strong>Press + at the right end of the header</strong><br />Or press the <code>a</code> key.</li>
  <li><strong>Pick a kind</strong><br />The weather (weather), a reminder (reminder), … Type in the box at the top to narrow the list.</li>
  <li><strong>Fill it in</strong><br />Enter the values that kind needs, like a place or a time. Kinds with examples let you start from one.</li>
  <li><strong>Press Deploy</strong><br />A new card appears and the agents get to work.</li>
</ol>
<h4>From a file</h4>
<p>Wants written in a YAML file can be loaded all at once with the <strong>Import</strong> button in the header.</p>
`,
        },
      ],
    },
    {
      id: 'pages',
      title: 'Page by page',
      note: 'The pages in the Menu',
      icon: 'layout-grid',
      topics: [
        {
          id: 'wants',
          title: 'Wants',
          sub: 'The Wants you placed',
          icon: 'heart',
          color: '#ec4899',
          body: `
<p>The page you will use most. Every Want you placed is a card.</p>
<h4>Press a card</h4>
<p>The sidebar opens on the right. The tabs along its foot switch what you see.</p>
<dl class="terms">
  <dt>Settings</dt><dd>The values you gave it — you can change them here</dd>
  <dt>Results</dt><dd>What the agents wrote back</dd>
  <dt>Wiring</dt><dd>How it connects to other Wants</dd>
  <dt>History</dt><dd>What has happened so far</dd>
</dl>
<h4>Run and stop</h4>
<p>The sidebar's buttons <strong>Start</strong>, <strong>Stop</strong>, <strong>Suspend</strong> (pause) and <strong>Delete</strong> it.</p>
<h4>Rearrange</h4>
<p>Drag cards to put them in the order you like.</p>
`,
        },
        {
          id: 'thing',
          title: 'Thing',
          sub: 'Values with names',
          icon: 'circle',
          color: '#f59e0b',
          body: `
<p>The page for values you use often, kept under a name — "my home station", "my favourite shop".</p>
<ul>
  <li>Add a Thing with the button in the header</li>
  <li>Make a Want that uses a Thing's value right from its card</li>
  <li>Group related Things into a constellation</li>
</ul>
`,
        },
        {
          id: 'want-types',
          title: 'Want Types',
          sub: 'The kinds of Want you can place',
          icon: 'zap',
          color: '#a855f7',
          body: `
<p>The catalogue of Wants you can place. Press a card to see its description, the values it takes, and examples.</p>
<p>When you wonder "what should I put in here?", its <strong>Examples</strong> are the quickest answer.</p>
`,
        },
        {
          id: 'worlds',
          title: 'Worlds',
          sub: 'Save a set of Wants',
          icon: 'layers',
          color: '#6366f1',
          body: `
<p>Save every Want you have placed under a name.
Make one per situation — "trip planning", "watching work" — and switch with a press.</p>
<p>When you switch, the current World is saved for you first.</p>
`,
        },
        {
          id: 'agents',
          title: 'Agents',
          sub: 'The agents at work',
          icon: 'bot',
          color: '#3b82f6',
          body: `
<p>The agents that actually do the work for Wants. Press a card to see what it can do (Capabilities) and its settings.</p>
<dl class="terms">
  <dt>Do</dt><dd>Does it once</dd>
  <dt>Monitor</dt><dd>Keeps watching</dd>
  <dt>Think</dt><dd>Thinks it through</dd>
</dl>
`,
        },
        {
          id: 'recipes',
          title: 'Recipes',
          sub: 'Reusable templates',
          icon: 'book-open',
          color: '#10b981',
          body: `
<p>A set of Wants saved as a template. Change the values and place it as often as you like.</p>
<p>The <strong>Recipe</strong> button in a Want's sidebar makes a recipe from that Want.</p>
`,
        },
        {
          id: 'others',
          title: 'Other pages',
          sub: 'Achievements, Logs, Devices',
          icon: 'ellipsis',
          color: '#64748b',
          body: `
<dl class="terms">
  <dt>Achievements</dt><dd>What you have achieved, and the rules for earning it</dd>
  <dt>Logs</dt><dd>A record of what happened — look here when something goes wrong</dd>
  <dt>Devices</dt><dd>The browsers and phones that have the screen open right now</dd>
  <dt>Help</dt><dd>Every keyboard shortcut (the <code>?</code> key opens it too)</dd>
  <dt>Settings</dt><dd>Settings for the screen (see "Settings")</dd>
</dl>
`,
        },
      ],
    },
    {
      id: 'more',
      title: 'Going further',
      note: 'Once you are used to it',
      icon: 'wrench',
      topics: [
        {
          id: 'select',
          title: 'Many at once',
          sub: 'Handle several Wants together',
          icon: 'list-checks',
          color: '#0ea5e9',
          body: `
<p><strong>Select</strong> in the header (or the <code>s</code> key) turns on select mode.
Press cards to pick them, then act on all of them at once.</p>
<dl class="terms">
  <dt>Start</dt><dd>Run them all</dd>
  <dt>Stop</dt><dd>Stop them all</dd>
  <dt>Delete</dt><dd>Remove them all</dd>
</dl>
<p>When you are done, press ✕ at the top right, or <code>s</code> again.</p>
`,
        },
        {
          id: 'keys',
          title: 'Keyboard',
          sub: 'No mouse needed',
          icon: 'keyboard',
          color: '#64748b',
          body: `
<p>The whole screen works from the keyboard. Press <code>?</code> for the full list.</p>
<dl class="terms">
  <dt>↑ ↓ ← →</dt><dd>Move between cards</dd>
  <dt>Enter</dt><dd>Confirm, open</dd>
  <dt>Esc</dt><dd>Cancel, close</dd>
  <dt>Tab</dt><dd>Next element</dd>
  <dt>Shift + arrows</dt><dd>Move the focused card</dd>
  <dt>Alt + Enter</dt><dd>Open the Menu</dd>
  <dt>a</dt><dd>Add a Want</dd>
  <dt>s</dt><dd>Select mode</dd>
  <dt>?</dt><dd>Help</dd>
</dl>
`,
        },
        {
          id: 'settings',
          title: 'Settings',
          sub: 'Light or dark, header position',
          icon: 'settings',
          color: '#6b7280',
          body: `
<p><strong>Settings</strong> in the Menu changes how you interact (Interaction Mode), connects a game controller, and more.</p>
<h4>Light or dark, and the header's place</h4>
<p>These are kept in MyWant's settings, so every browser you open it in looks the same.</p>
<div class="code"><pre># light / dark / system
mywant config set color_mode dark
# top / bottom
mywant config set header_position bottom</pre></div>
<p>On a phone, a header at the bottom is easier to reach with your thumb.</p>
`,
        },
        {
          id: 'phone',
          title: 'On your phone',
          sub: 'Open it from the same network',
          icon: 'smartphone',
          color: '#14b8a6',
          body: `
<p>Started normally, only the Mac itself can open it. To open it from a phone or another machine on the same network, start it like this.</p>
<div class="code"><pre>mywant-gui stop
mywant-gui start -D -H 0.0.0.0</pre></div>
<p>Then open <code>http://(your Mac's IP address):8081</code> in the phone's browser.
You can find the Mac's IP address in System Settings → Network.</p>
<div class="box">
  <p class="box-title"><i data-lucide="shield"></i>From outside your home</p>
  <p>If you put it on the internet, use a way that is protected by a password. See the authentication notes in MyWant's documentation.</p>
</div>
`,
        },
        {
          id: 'cli',
          title: 'Drive it from commands',
          sub: 'Control the open screen from outside',
          icon: 'terminal',
          color: '#64748b',
          body: `
<p>The <code>mywant-gui</code> command can also move the open screen from outside —
handy when an AI agent is doing the driving.</p>
<div class="code"><pre># open a Want's sidebar
mywant-gui show want &lt;want ID&gt;
# go to a page
mywant-gui show dashboard
# open the Add Want form and pick a kind
mywant-gui form open
mywant-gui form select reminder
# save a card as an image
mywant-gui capture want &lt;want ID&gt;</pre></div>
<p>This lists every command.</p>
<div class="code"><pre>mywant-gui commands</pre></div>
`,
        },
        {
          id: 'extend',
          title: 'Extend it',
          sub: 'Add pages and buttons',
          icon: 'puzzle',
          color: '#a855f7',
          body: `
<p>mywant-gui has <strong>extensions</strong>: pages, menu entries, buttons and looks you can add later.
Put an extension in <code>~/.mywant/gui-extensions/</code> and it is loaded the next time the screen starts.</p>
<p>How to write one is in the <a href="https://onelittlenightmusic.github.io/mywant-gui-dev/">developer docs</a>.</p>
`,
        },
      ],
    },
  ],
};
