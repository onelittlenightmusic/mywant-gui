# mywant-gui

The web GUI and control CLI for [MyWant](https://github.com/onelittlenightmusic/mywant) —
declarative wants, carried out by autonomous agents.

📖 **Beginner's guide (English / 日本語):** https://onelittlenightmusic.github.io/mywant-gui/

`mywant-gui` serves the web frontend and proxies its API requests to a running
MyWant server. From the browser you can:

- see every want as a card, with its state, results and history, and change it
- add wants from their types (or from things you have named), and save a set of
  wants as a recipe
- keep **things** — the values you have named — and group them into
  constellations
- browse agents, want types, recipes, worlds, devices and logs

The same binary is a CLI that drives the open GUI: open a want, move between
pages, fill in the Add Want form, read and set parameters, capture a card as
an image.

## Install

```sh
brew install onelittlenightmusic/mywant/mywant-gui
```

It needs a MyWant server (`brew install onelittlenightmusic/mywant/mywant`).
Once installed, `mywant gui <command>` reaches it through the MyWant CLI.

## Run

```sh
mywant start -D        # the MyWant server (localhost:8080)
mywant-gui start -D    # the GUI (http://localhost:8081)
mywant-gui stop
```

`mywant-gui commands` lists every command; `mywant-gui <command> --help` gives
its flags.

## Build from source

Requires Go and Node.js.

```sh
make build       # web/ (Vite) → bin/mywant-gui, with the frontend embedded
make install     # → ~/.local/bin/mywant-gui
make gui-restart # install, then restart the GUI on 0.0.0.0:8081
```

For frontend work, `cd web && npm run dev` serves it with hot reload on :3000,
proxying `/api` to the MyWant server on :8080.

## Layout

| Path | What |
|---|---|
| `cmd/mywant-gui`, `commands/` | the CLI (cobra) |
| `server/` | the HTTP server: static frontend, API proxy, auth |
| `web/` | the React + TypeScript frontend, embedded into the binary |
| `web/src/pages/list`, `pages/workspace` | the want list and the workspace around it |
| `web/src/extensions/` | where an edition of this GUI adds pages, menu entries and panels |
| `skills/` | a Claude Code skill for driving the GUI from the CLI |

## Extending

The frontend declares the places it can be extended — pages, menu entries,
named slots in the header, settings and panels, hooks run at the root — in
`web/src/extensions/registry.ts`.

An extension can be built into the app (`web/src/extensions/installed.ts`,
empty here) or installed beside it: `mywant-gui` loads, before the first
render, every extension it finds under `~/.mywant/gui-extensions/<name>/` (or
`<prefix>/share/mywant/gui-extensions/`) — a `gui-extension.json` naming a
script and stylesheets, and an optional `public/` served at the site root.
The script registers itself with the registry, and reaches this app's modules
and React through `window.__mywantModules` (see `web/src/extensions/modules.ts`),
so it is built against one version of mywant-gui and loaded only by that one.
