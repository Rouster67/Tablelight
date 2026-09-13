# Publishing Tablelight releases

Source changes and app releases are separate. Commit and push through GitHub Desktop, review
GitHub's checks, and merge the feature PR into `main`. Publishing a GitHub Release is a later,
deliberate action; neither a push nor a merge installs an update on users' computers.

## Prepare the Windows release

1. Export your real party before development. Choose a new stable version, update `package.json`
   and the user guide, and move the appropriate Unreleased entries into a dated changelog section.
   Run `npm install --package-lock-only` after version or dependency changes. The DM title bar
   and sidebar read the app version automatically.
2. Use Windows, Node.js 24+, and `npm ci`. Run `npm run check`, `npm run format:check`, and
   `npm run test:native`. For updater or packaging changes, also run `npm run test:installed-update`.
   Verify your actual HDMI/TV layout, movement, rotation, and both interaction modes.
3. Run `npm run build:windows`. It builds a Windows x64 NSIS installer, an `.exe.blockmap`, and
   `latest.yml` in `dist/`. `dist/win-unpacked` is for inspection, not distribution as an updater.
   The build always uses `publish: never`; it cannot publish a release or use a GitHub upload token.
4. Inspect and test the installer. It installs per user, offers a folder choice, creates
   shortcuts, and retains `%APPDATA%\Tablelight` on upgrade and uninstall. Existing portable
   users need a one-time installation. Preserve the app ID `io.github.rouster67.tablelight` and
   save directory across future releases so updates find the same installation and data.

## Publish on GitHub

1. From the reviewed, merged source, create a GitHub Release draft with a matching stable tag
   such as `vX.Y.Z`. Build from exactly that source and version. Keep draft/prerelease builds out
   of the stable update channel.
2. Attach **all three** outputs from the same build: `Tablelight-Setup-X.Y.Z-x64.exe`, its
   `.exe.blockmap`, and `latest.yml`. Never hand-edit checksums. Confirm the metadata version,
   installer filename, size, and SHA-512 digest match the uploaded file. Tablelight currently
   uses full downloads; retain the generated blockmap for the standard release artifact set.
3. Add release notes and a link to the tagged source, and publish only after every asset is
   attached. Mark it as the latest stable release. Do not replace the bytes of an already
   published version; fix mistakes with a new version and build.
4. Verify the published asset URLs and test an update from the previous installed release.
   Keep a source archive or tagged repository with dependencies and build instructions available.

GitHub Actions creates downloadable build artifacts on pushes and PRs. It does not publish
GitHub Releases. Before the first installer-enabled release with `latest.yml` is published,
checks against older ZIP-only releases may report that update information is unavailable.

## Included files and signing

The installer contains the pinned Electron runtime, production updater dependencies, editable
application source in `resources/app`, the user guide, and license notices. The build uses an
allowlist and excludes saved parties, private backups, development caches, and test output.
The original source dependency manifests are also included under `resources/source-package.json`
and `resources/source-package-lock.json`. To rebuild from the included source, copy `resources/app`
to a separate development folder, copy those two manifests into it as `package.json` and
`package-lock.json`, and follow the source instructions with `npm ci`.

Preserve LICENSE.Tablelight.txt, NOTICE.Tablelight.md, Electron's LICENSE and
LICENSES.chromium.html, THIRD_PARTY_NOTICES.md, and dependency licenses when redistributing.
The original application is GPL-3.0-or-later; dependencies retain their respective licenses.

Initial installers are unsigned. Creating and testing them needs no paid service or additional
account. SHA-512 verification detects damaged or mismatched downloads but does not independently
verify the publisher. Code signing remains a separate distribution decision; retain the updater's
normal signature validation when adding it. Do not disable Windows security settings as part of
installation or updating. An interrupted installation may require rerunning the official
installer; automatic rollback is not implemented.

## Installer regression test

`npm run test:installed-update` builds versions 0.0.1 and 0.0.2 with a dedicated test name and
application ID. It installs in an isolated `test-results` directory, serves the next installer
from a loopback-only HTTP server, and exercises the real download, checksum, save, quit, install,
and relaunch path. It checks that saved data and the opt-out survive, then uninstalls only that
test app. Test feed and save-path configuration is embedded only in these specially named test
packages; ordinary production packages cannot select a custom feed through environment variables
or renderer messages. Review test results and installer logs under the reported directory.
