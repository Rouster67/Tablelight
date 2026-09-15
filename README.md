# Tablelight

A local Dungeon Master console and transparent player HUD for a TV battle mat. Run your map in its usual browser, place miniatures on the TV, and give each player a character bubble facing their seat.

**Windows desktop · Unlimited saved players · Parties of up to 8 · Offline · GPL-3.0-or-later**

## What it does

- Shows the running application version in the DM window title bar and sidebar.
- Keeps a searchable saved player roster with no fixed player limit. Choose up to eight for the active party; only they appear in the session console and TV overlay. The left sidebar shows Party in your initiative order, then All characters for saved characters outside the party in alphabetical order. Each entry has add/remove and Delete character controls, with session Undo available.
- Saves character portraits, HP, temporary HP, AC, ability scores, skills, and spell-slot totals. Skills and saves have separate proficiency and expertise bubbles.
- Offers Default plus all 13 class overlay themes, including Artificer, in Create and Edit character. Each player keeps an independent choice across their bubble, expanded HUD, DM preview, saves, and backups.
- Keeps a searchable library of your spells, actions, and features. Create once, attach to multiple characters, and edit shared rules in one place.
- Shows user-written ability details, references, and upcast/upgrade text consistently on the DM screen and player HUD. Duplicate shared abilities or create independent local-only variants for a character, including different spell-slot and resource costs.
- Sends player-overlay ability uses to a DM approval queue, reserving their costs until approval. Urgent reactions sort first. The five-entry History supports reconsideration and undoing one approved use while preserving unrelated changes and later spending. Pending requests and History clear when the app closes.
- Tracks concentration with a lit HUD toggle and a searchable selection of that character's assigned abilities marked Requires concentration. Using a flagged ability automatically starts concentration or switches it after a warning when already concentrating. Any ability type can carry the shared flag. A separate condition library stores your condition names and descriptions; assigned conditions appear on the HUD with descriptions on hover.
- Grows expanded HUDs vertically to keep the full character summary, spell slots, resources, and size controls visible. Pending approvals occupy their own far-right column; chosen scale, rotation, and ability-browser width are preserved.
- Provides named custom resources with shape icons, colors, and short-rest, long-rest, per-turn, or manual recovery. Edit them inside Edit character; they stack beneath spell slots on the TV.
- Tracks each character's own action, bonus action, reaction, movement, spell slots, resource pools, and unavailable flags.
- Gives each character an independently movable, rotatable, resizable bubble. Expanded HUDs use a wide layout: character vitals on the left, section navigation and its content on the right. Multiple HUDs can expand at once while keeping their orientation.
- Controls the TV from the laptop or directly from the HUD. The DM’s Currently displayed panel mirrors its tabs, lists, and description pages. Action-cost tabs include all matching spells and features. Empty map space remains click-through; a toggle makes the entire overlay click-through.
- Reorders the party with dragging or arrows, or sorts initiative rolls. Added party members go to the bottom. Next turn follows the visible sidebar order while TV seating stays in place; rounds are not counted.
- Saves locally, supports party backups, and keeps the last 40 changes available for Undo during the session.

No spells or rules text are preloaded. Tablelight tracks your configured ability costs and concentration for your chosen rules, including 2024 D&D and homebrew. It does not adjudicate rules; other ability effects are applied manually.

## Use the Windows app

Download **Tablelight-Setup-[version]-x64.exe** from this repository's GitHub Releases and run it. The installer lets you choose a folder and creates shortcuts. No Node.js or Tablelight account is needed. Local play and saves work offline. Existing portable users need this one-time installation to enable in-app updates; the installed app keeps using the same saved data.

Connect the TV and choose **Windows + P → Extend**. Keep your DM browser and Tablelight on the laptop, and put your player map browser on the TV. In Tablelight, add characters, arrange their bubbles under **TV & layout**, and choose **Show TV overlay**.

See [the user guide](docs/USER_GUIDE.md) for setup, library use, shortcuts, and backups.

## Run from source

Requirements: Windows with a desktop session, Node.js 24 or newer, and npm. The Windows x64 NSIS installer is the supported release target. Other operating systems are not verified.

```sh
npm ci
npm start
```

Installing development dependencies downloads Electron and the other pinned packages. Building may also download installer tooling. Source runs and unpacked previews do not automatically check or install updates. They use the same `%APPDATA%\Tablelight` save folder as the installed app. Export your party before experimenting; use the isolated tests below for automated checks.

## Check and build

```sh
npm run check
npm run format:check
npm run test:native
npm run build:windows
npm run test:installed-update
```

`check` validates JavaScript syntax and runs the unit tests. Native checks open temporary test windows on the available displays, use synthetic characters, and save results under ignored `test-results/`. They do not use your actual party. Run them outside a game session.

The Windows build writes a versioned installer, its blockmap, and `latest.yml` to `dist/`, with an unpacked inspection copy under `dist/win-unpacked/`. It includes editable app source, production dependencies and their licenses, and the user guide. It never publishes a release. GitHub Actions checks formatting, runs unit tests, and builds downloadable artifacts; native GUI checks run on a Windows desktop separately. `test:installed-update` builds two isolated versions, installs a dedicated test app, exercises an actual update/relaunch, verifies saved data, and uninstalls only that test app. It uses a loopback server, separate application identity, and synthetic saves under `test-results/`.

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

Installed copies check GitHub for a newer stable release in the background on each launch. An available update offers **Update and restart** or **Later**. Downloading starts only after consent. **Setup & help → Updates** has the disable setting and **Check now**, which also works when automatic checks are off. See [updates and network use](docs/UPDATES.md) for request locations, failure behavior, and unsigned-installer limitations.

Character data, portraits, and the shared library stay on your laptop in `%APPDATA%\Tablelight\party.json`. A previous-save backup is kept alongside it. All saved players, active party membership, and the library are included in the same atomic save and exported backup. Deleting a player does not delete library entries. Restoring a complete backup replaces the entire roster, party, and library after confirmation.

Version 1.11.0 migrates older saves automatically and writes save format version 9, including manual ability details and local-only abilities. It imports formats 1–8 and preserves characters, shared libraries, independent resource settings, concentration, party membership, and HUD choices. Older app versions cannot read format 9; keep an exported pre-update backup if you need to return to one. Pending approvals and History are session-only and are not exported. Saved players have no fixed count limit; available memory and storage still determine practical capacity. Roster management renders twelve rows per page, and the TV receives only the active party.

Do not commit saved parties, private portraits, or rulebook text to a public repository. The included `.gitignore` excludes standard save files, backups, dependencies, test output, and Windows binaries.

## License

Copyright (C) 2026 Tablelight contributors. Released under the [GNU General Public License, version 3 or later](LICENSE), with no warranty. You may use, modify, and share it; distributed modifications must preserve the license's freedoms and source availability. This protects freedom to use and edit; the GPL also permits charging for copies.

See [the license notice](NOTICE.md) and [third-party notices](THIRD_PARTY_NOTICES.md). User-entered content retains its own rights. This independent project is not affiliated with D&D Beyond, Wizards of the Coast, or Larian Studios.
