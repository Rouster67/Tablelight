# Third-party components

Tablelight's application code is GPL-3.0-or-later. Its desktop runtime is Electron 44.3.0, distributed under the MIT license. Electron incorporates Chromium, Node.js, and other components with their own notices and licenses.

- Electron source and release: https://github.com/electron/electron/tree/v44.3.0
- Electron license: LICENSE.electron.txt in this source folder; the Windows runtime also includes its original LICENSE file.
- The Windows package preserves Electron's LICENSES.chromium.html and all bundled runtime notices. Keep these with redistributed binaries.
- Development dependencies, including Prettier, retain the licenses in their installed packages. They are recorded in package-lock.json; the formatter is not bundled into the application runtime.

The app uses system fonts and an original Tablelight icon. It bundles no spells, class feature descriptions, rulebook passages, character portraits, or external artwork. Tablelight is an independent project and is not affiliated with Wizards of the Coast, D&D Beyond, Larian Studios, or Baldur's Gate 3. Those names identify compatibility or inspiration only.

The offline PDF embeds Bitstream Vera fonts, redistributed with their full license in
`docs/user-guide/fonts/bitstream-vera-license.txt`. Its screenshots use original synthetic example
text, not preloaded game content. The editable fonts/source accompany the PDF. ReportLab and
pypdf are pinned development-only authoring tools in `docs/user-guide/requirements.txt`; they
are not required or installed when users open the guide.

## Updater runtime dependencies

The installer includes the following production packages and their license files in
`resources/app/node_modules`. `package-lock.json` records the exact dependency graph.

| Package              | Version | License       |
| -------------------- | ------- | ------------- |
| electron-updater     | 6.8.9   | MIT           |
| semver               | 7.8.5   | ISC           |
| builder-util-runtime | 9.7.0   | MIT           |
| argparse             | 2.0.1   | Python-2.0    |
| debug                | 4.4.3   | MIT           |
| fs-extra             | 10.1.0  | MIT           |
| graceful-fs          | 4.2.11  | ISC           |
| js-yaml              | 4.3.2   | MIT           |
| jsonfile             | 6.2.1   | MIT           |
| lazy-val             | 1.0.5   | MIT           |
| lodash.escaperegexp  | 4.1.2   | MIT           |
| lodash.isequal       | 4.5.0   | MIT           |
| ms                   | 2.1.3   | MIT           |
| sax                  | 1.6.1   | BlueOak-1.0.0 |
| tiny-typed-emitter   | 2.1.0   | MIT           |
| universalify         | 2.0.1   | MIT           |

The Windows installer is built with electron-builder 26.15.3 and its NSIS tooling. These build
tools retain their licenses; electron-builder itself is a development dependency rather than
an application runtime dependency. Upstream source: https://github.com/electron-userland/electron-builder.
