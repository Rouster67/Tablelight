# Tablelight

A local Dungeon Master console and transparent player HUD for a TV battle mat. Run your map in its usual browser, place miniatures on the TV, and give each player a character bubble facing their seat.

**Windows desktop · Unlimited saved players · Parties of up to 8 · Offline · GPL-3.0-or-later**

## What it does

- Shows the running application version in the DM window title bar and sidebar.
- Keeps a searchable saved player roster with no fixed player limit. Choose up to eight for the active party; only they appear in the session console and TV overlay. The left sidebar shows Party in your initiative order, then All characters for saved characters outside the party in alphabetical order. Each entry has add/remove and Delete character controls, with session Undo available.
- Saves character portraits, HP, temporary HP, AC, ability scores, skills, and spell-slot totals. Skills and saves have separate proficiency and expertise bubbles.
- Keeps a searchable library of your spells, actions, and features. Create once, attach to multiple characters, and edit shared rules in one place.
- Tracks concentration with a lit HUD toggle and a searchable selection of that character's assigned abilities marked Requires concentration. Using a flagged ability automatically starts concentration or switches it after a warning when already concentrating. Any ability type can carry the shared flag. A separate condition library stores your condition names and descriptions; assigned conditions appear on the HUD with descriptions on hover.
- Keeps expanded HUD dimensions fixed across menus, with exact size and TV scroll controls in the DM’s Currently displayed panel.
- Provides named custom resources with shape icons, colors, and short-rest, long-rest, per-turn, or manual recovery. Edit them inside Edit character; they stack beneath spell slots on the TV.
- Tracks each character's own action, bonus action, reaction, movement, spell slots, resource pools, and unavailable flags.
- Gives each character an independently movable, rotatable, resizable bubble. Expanded HUDs use a wide layout: character vitals on the left, section navigation and its content on the right. Multiple HUDs can expand at once while keeping their orientation.
- Controls the TV from the laptop or directly from the HUD. The DM’s Currently displayed panel mirrors its tabs, lists, and description pages. Action-cost tabs include all matching spells and features. Empty map space remains click-through; a toggle makes the entire overlay click-through.
- Reorders the party with dragging or arrows, or sorts initiative rolls. Added party members go to the bottom. Next turn follows the visible sidebar order while TV seating stays in place; rounds are not counted.
- Saves locally, supports party backups, and keeps the last 40 changes available for Undo during the session.

No spells or rules text are preloaded. Tablelight tracks your configured ability costs and concentration for your chosen rules, including 2024 D&D and homebrew. It does not adjudicate rules; other ability effects are applied manually.

## Use the Windows app

Extract the complete Windows release ZIP, then open **Tablelight.exe**. Keep its accompanying files together. No Node.js, account, or internet connection is needed to run a release.

Connect the TV and choose **Windows + P → Extend**. Keep your DM browser and Tablelight on the laptop, and put your player map browser on the TV. In Tablelight, add characters, arrange their bubbles under **TV & layout**, and choose **Show TV overlay**.

See [the user guide](docs/USER_GUIDE.md) for setup, library use, shortcuts, and backups.

## Run from source

Requirements: Windows with a desktop session, Node.js 24 or newer, and npm. The Windows x64 portable build is the supported release target. Other operating systems are not verified.

```sh
npm ci
npm start
```

The first source run or build downloads Electron's runtime if it is not already installed. The application itself uses local files and makes no external network requests. Source runs use the same `%APPDATA%\Tablelight` save folder as the portable app. Export your party before experimenting; use the isolated tests below for automated checks.

## Check and build

```sh
npm run check
npm run format:check
npm run test:native
npm run build:windows
```

`check` validates JavaScript syntax and runs the unit tests. Native checks open temporary test windows on the available displays, use synthetic characters, and save results under ignored `test-results/`. They do not use your actual party. Run them outside a game session.

The Windows build is written to `dist/Tablelight/` and a versioned ZIP in `dist/`. Move or remove the previous `dist/Tablelight/` before rebuilding. The build includes editable app source, license notices, and the user guide. GitHub Actions checks formatting, runs unit tests, and builds a downloadable artifact; native GUI checks are run on a Windows desktop separately.

## Languages and structure

The application is written in **JavaScript**, with **HTML** screens and **CSS** styles. Electron supplies the desktop windows and Windows integration. JSON stores local data and dependency settings; YAML configures GitHub Actions.

| File                                                                                                                    | Responsibility                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `main.js`, `preload.js`, `window-shape.js`                                                                              | Native windows, display selection, file dialogs, and the restricted bridge to the UI            |
| `core.js`, `storage.js`                                                                                                 | Character rules, shared library, validation, migration, and atomic local saves                  |
| `controller.js`, `library-ui.js`, `condition-ui.js`, `session-ui.js`, `resource-ui.js`, `roster-ui.js`, `sidebar-ui.js` | Laptop controls, character editors, party management, sidebar lists, and shared-library screens |
| `hud.js`, `hud-controls.js`, `overlay.js`                                                                               | Player HUD rendering, dragging, rotation, and direct interaction                                |
| `index.html`, `overlay.html`, `*.css`                                                                                   | Screen structure and appearance                                                                 |
| `tests/`, `scripts/`                                                                                                    | Tests, source checks, and Windows packaging                                                     |

See [architecture and save format](docs/ARCHITECTURE.md), [contributing](CONTRIBUTING.md), and [release instructions](docs/RELEASING.md).

See the [roadmap](docs/ROADMAP.md) for proposed features, agreed designs, and local implementation progress. Roadmap entries do not assign release versions or dates.

## Privacy and saves

Character data, portraits, and the shared library stay on your laptop in `%APPDATA%\Tablelight\party.json`. A previous-save backup is kept alongside it. All saved players, active party membership, and the library are included in the same atomic save and exported backup. Deleting a player does not delete library entries. Restoring a complete backup replaces the entire roster, party, and library after confirmation.

Version 1.8 migrates older saves automatically and writes save format version 4, including the condition library, character assignments, and concentration status. Existing condition text becomes a reusable entry; existing concentration notes remain active. Party membership is preserved. Older app versions cannot read this format; keep an exported pre-update backup if you need to return to one. Saved players have no fixed count limit; available memory and storage still determine practical capacity. Roster management renders twelve rows per page, and the TV receives only the active party.

Do not commit saved parties, private portraits, or rulebook text to a public repository. The included `.gitignore` excludes standard save files, backups, dependencies, test output, and Windows binaries.

## License

Copyright (C) 2026 Tablelight contributors. Released under the [GNU General Public License, version 3 or later](LICENSE), with no warranty. You may use, modify, and share it; distributed modifications must preserve the license's freedoms and source availability. This protects freedom to use and edit; the GPL also permits charging for copies.

See [the license notice](NOTICE.md) and [third-party notices](THIRD_PARTY_NOTICES.md). User-entered content retains its own rights. This independent project is not affiliated with D&D Beyond, Wizards of the Coast, or Larian Studios.
