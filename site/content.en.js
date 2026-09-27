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
    heroSub: 'Drive it with a mouse, a keyboard — or a gamepad alone. Press a card to open its explanation on the right.',
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
  <li>Drive all of it <strong>with just a gamepad</strong></li>
  <li>Open it from your phone too</li>
</ul>
<div class="box">
  <p class="box-title"><i data-lucide="info"></i>It needs MyWant itself</p>
  <p>mywant-gui is only the screen, so a MyWant server has to be running behind it. For MyWant itself, see the <a href="https://onelittlenightmusic.github.io/MyWant/?lang=en">MyWant guide</a>.</p>
</div>
${shot("dashboard.jpg", "The dashboard: your Wants as cards")}
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
${shot("dashboard.jpg", "What you see at http://localhost:8081")}
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
${shot("dashboard-detail.jpg", "The header on top, cards on the left, the sidebar on the right")}
${shot("menu.jpg", "Menu, at the top left: every page")}
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
${shot("add-want.jpg", "Press + and the kinds of Want appear, by category")}
${shot("add-want-form.jpg", "Pick a kind and it becomes a form for its values")}
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
${shot("dashboard-detail.jpg", "Press a card and the sidebar opens on the right")}
${shot("dashboard-results.jpg", "The Results tab: what the agents wrote back")}
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
${shot("thing.jpg", "The Thing page")}
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
${shot("want-types.jpg", "The Want Types page. Press a kind to open its description")}
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
${shot("worlds.jpg", "The Worlds page")}
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
${shot("agents.jpg", "The Agents page. Press an agent to see what it can do")}
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
${shot("recipes.jpg", "The Recipes page")}
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
${shot("help.jpg", "Help: every keyboard shortcut")}
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
          id: 'gamepad',
          title: 'Play it with a gamepad',
          sub: 'A controller is all you need',
          icon: 'gamepad-2',
          color: '#8b5cf6',
          body: `
<p>mywant-gui is built so that <strong>a gamepad alone can drive all of it</strong>.
Steer the screen on your TV from the sofa, or browse and open your Wants without touching a keyboard.</p>
<h4>Connect</h4>
<ol class="steps">
  <li><strong>Connect the controller over USB or Bluetooth</strong><br />Ordinary gamepads work — Xbox, PlayStation, Switch Pro and so on.</li>
  <li><strong>Open the screen and press any button</strong><br />The browser finds the controller and you are in control.</li>
</ol>
<div class="box">
  <p class="box-title"><i data-lucide="usb"></i>Even more reliable in Chrome on a Mac</p>
  <p>Connect it from <strong>Settings</strong> in the Menu → "Controller (WebHID)", and a controller you have allowed once reconnects by itself next time. A Switch Pro Controller also rumbles as you play.</p>
</div>
<h4>What the buttons do</h4>
<dl class="terms">
  <dt>D-pad / left stick</dt><dd>Move between cards (hold B to move faster)</dd>
  <dt>A</dt><dd>Confirm, open. Twice quickly to show it large</dd>
  <dt>B</dt><dd>Cancel, back</dd>
  <dt>X</dt><dd>Toggle, pick</dd>
  <dt>Y</dt><dd>Jump to the header's buttons</dd>
  <dt>L1 / R1</dt><dd>Previous / next sidebar tab (with B held: the tabs in the lower row)</dd>
  <dt>Select</dt><dd>Open the Menu</dd>
  <dt>Start</dt><dd>Quick actions for the chosen card — or, in select mode with cards picked, act on them all</dd>
</dl>
<p>Inside the screen, <code>?</code> (Help in the Menu) shows a picture of the pad and the whole list.</p>
<div class="box">
  <p class="box-title"><i data-lucide="map"></i>More on the canvas</p>
  <p>With the canvas extension (mywant-guiex) you also get zoom on the right stick, jumps from tile to tile on L2 / R2, and moving a tile by holding A.</p>
</div>
${shot("help-gamepad.jpg", "\"Gamepad Layout\" in Help: a picture of the pad and what each button does")}
`,
        },
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
${shot("select.jpg", "Select mode with Tokyo and Osaka picked")}
`,
        },
        {
          id: 'keys',
          title: 'Keyboard',
          sub: 'No mouse needed',
          icon: 'keyboard',
          color: '#64748b',
          body: `
<p>The whole screen works from the keyboard (for a gamepad, see "Play it with a gamepad"). Press <code>?</code> for the full list.</p>
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
${shot("help.jpg", "The list the ? key opens")}
`,
        },
        {
          id: 'settings',
          title: 'Settings',
          sub: 'Light or dark, header position',
          icon: 'settings',
          color: '#6b7280',
          body: `
<p><strong>Settings</strong> in the Menu changes how you interact (Interaction Mode), connects a gamepad (see "Play it with a gamepad"), and more.</p>
<h4>Light or dark, and the header's place</h4>
<p>These are kept in MyWant's settings, so every browser you open it in looks the same.</p>
<div class="code"><pre># light / dark / system
mywant config set color_mode dark
# top / bottom
mywant config set header_position bottom</pre></div>
<p>On a phone, a header at the bottom is easier to reach with your thumb.</p>
${shot("settings.jpg", "Settings, from the Menu")}
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
${shot("phone.jpg", "On a phone: the cards stack in one column", { phone: true })}
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
<p>How to write one is in the <a href="https://onelittlenightmusic.github.io/mywant-gui-dev/">developer docs</a>. A finished example is the next topic, "The canvas (mywant-guiex)".</p>
`,
        },
        {
          id: 'canvas',
          title: 'The canvas (mywant-guiex)',
          sub: 'An extension that lays Wants out as tiles',
          icon: 'map',
          color: '#0891b2',
          body: `
<p><strong>mywant-guiex</strong> is an extension that adds a <strong>canvas</strong> to mywant-gui.
Each Want becomes a <strong>tile</strong> on a board — a different way to see them from the list of cards.</p>
${shot('canvas-detail.jpg', 'The canvas: weather, reminder, timer and other Wants as tiles. Press one and its details open on the right')}
<h4>What you can do</h4>
<ul>
  <li>Place Wants where you like and build a board of your own</li>
  <li>The Things a Want uses (the round ones) float beside it, with lines showing the connection</li>
  <li>Your character walks the board, opening and moving the tile it stands on</li>
  <li>See the whole board at once on the minimap</li>
  <li>Made for a gamepad: zoom on the right stick, jump from tile to tile on L2 / R2</li>
</ul>
${shot('canvas.jpg', 'The minimap on the right shows the whole board and where you are')}
<h4>Install</h4>
<div class="code"><pre>brew install mywant-guiex
# restart the screen, and Canvas appears in the Menu
mywant-gui stop
mywant-gui start -D</pre></div>
<p><strong>Canvas</strong> in the Menu (or the <code>c</code> key) goes to the canvas; <code>l</code> goes back to the list of cards.</p>
<h4>Drive it from commands</h4>
<div class="code"><pre># move a tile to cell (0, 1)
mywant guiex tile set tokyo-weather 0 1
# every command
mywant guiex commands</pre></div>
`,
        },
      ],
    },
  ],
};
