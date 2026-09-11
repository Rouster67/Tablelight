# Publishing the project and releases

## First GitHub upload

1. Create an empty repository under your GitHub account. Use the files in this **Tablelight-source** folder as its root; do not upload the entire working folder or the portable Windows folder.
2. Include hidden files such as `.gitignore`, `.github/`, and `.gitattributes`, plus package-lock.json and LICENSE. The repository already includes GPL-3.0-or-later terms; do not ask GitHub to generate a different license.
3. Review staged files before committing. Saved characters, portraits, private text, local paths, generated test results, and Windows binaries do not belong in the source repository. `.gitignore` helps with the standard locations but does not recognize arbitrary renamed private files.
4. Push the source and let the included GitHub Actions workflow check and build it. Add the actual repository URL to package.json's `repository` and `bugs` fields when the URL exists.
5. Enable private vulnerability reporting in repository settings. Choose any branch protection and review preferences appropriate for your collaborators.

No repository has been created or uploaded by preparing this source folder.

## Windows release

1. Export your real party before development. Update the application version in package.json, the sidebar label, CHANGELOG.md, and user guide as needed; run `npm install --package-lock-only` after dependency changes.
2. Run `npm ci`, `npm run check`, and `npm run format:check`. Run `npm run test:native` on a Windows desktop, then verify your actual HDMI/TV layout, drag and rotation, and both interaction modes.
3. Run `npm run build:windows`. Upload its versioned ZIP as a GitHub Release asset. Binaries belong in Release assets rather than ordinary source commits.
4. Tag the matching source commit. Make corresponding source available alongside the release, using the tagged repository or a source archive with dependencies and build instructions. The portable package also includes editable application source in `resources/app`.
5. Preserve LICENSE.Tablelight.txt, NOTICE.Tablelight.md, Electron's LICENSE and LICENSES.chromium.html, and the third-party notices. The original application is GPL-3.0-or-later; Electron and its components keep their own licenses.

Builds are portable, unsigned Windows x64 folders. They do not install a service or updater. The packaging script copies the pinned Electron runtime and an allowlist of application files; it excludes local saves, node_modules, and test outputs. The script uses the Electron installed by `npm ci`. `TABLELIGHT_ELECTRON_DIST` is an optional local verification override and must point to a runtime directory whose version matches package.json.
