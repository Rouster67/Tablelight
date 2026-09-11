# Third-party components

Tablelight's application code is GPL-3.0-or-later. Its desktop runtime is Electron 44.3.0, distributed under the MIT license. Electron incorporates Chromium, Node.js, and other components with their own notices and licenses.

- Electron source and release: https://github.com/electron/electron/tree/v44.3.0
- Electron license: LICENSE.electron.txt in this source folder; the Windows runtime also includes its original LICENSE file.
- The Windows package preserves Electron's LICENSES.chromium.html and all bundled runtime notices. Keep these with redistributed binaries.
- Development dependencies, including Prettier, retain the licenses in their installed packages. They are recorded in package-lock.json; the formatter is not bundled into the application runtime.

The app uses system fonts and an original Tablelight icon. It bundles no spells, class feature descriptions, rulebook passages, character portraits, or external artwork. Tablelight is an independent project and is not affiliated with Wizards of the Coast, D&D Beyond, Larian Studios, or Baldur's Gate 3. Those names identify compatibility or inspiration only.
