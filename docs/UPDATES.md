# Updates and network use

Tablelight's installed Windows version can check for and install stable releases from
[the official repository](https://github.com/Rouster67/Tablelight/releases/latest).
Local play and saved data remain available without internet access.

## When requests happen

- Automatic checks default to on. About 1.5 seconds after the DM window is ready, Tablelight
  checks once for a newer stable release. Results are kept for this session. There is no timer
  that checks again during play and no scheduled background service.
- **Setup & help → Updates → Check now** starts an explicit check, including when automatic
  checks are off. Concurrent checks share the same operation. Source runs and unpacked preview
  copies do not enable in-app checks or installation.
- A newer version produces one DM launch offer, deferred while an editor or dialog is open.
  **Later** leaves the sidebar icon. Selecting **Update and restart** downloads the installer;
  checking alone does not download it. Cancellation stops the transfer.
- **Release page / Release notes** opens the fixed official release-page URL in the default
  browser. That browser applies its own cookies, extensions, and privacy settings.

## Destinations and data

The pinned updater uses HTTPS GET requests for the repository's `releases.atom` feed,
`releases/latest` information, and the selected release's `latest.yml` metadata under
`github.com/Rouster67/Tablelight`. The release download can redirect to GitHub asset hosts:
`release-assets.githubusercontent.com`, `objects.githubusercontent.com`, and
`github-releases.githubusercontent.com`. The transport also permits the same repository's
release API under `api.github.com/repos/Rouster67/Tablelight`. Other destinations, plain HTTP,
embedded URL credentials, and nonstandard HTTPS ports are rejected. Redirect loops are bounded;
rejected redirects report a normal update failure and keep the app open. Only isolated test builds
can use the loopback test server.

No character, party, portrait, note, message, or library content is included. There is no request
body, account login, analytics event, or telemetry. Requests identify the client as
`Tablelight-updater`. The transport strips the updater library's rollout identifier and any
cookie or authorization headers, and uses a separate nonpersistent network session. GitHub can
still see the public IP address, request timing, requested release, and normal connection
information, and can count release downloads.

The automatic-check preference is stored in `%APPDATA%\Tablelight\updates.json`, separately from
`party.json`. Party restore and session Undo do not change this preference. If it is unreadable,
automatic checks default to off until corrected. The updater may keep its local cache and a
local rollout-ID file; that identifier is removed from outgoing requests. Downloaded installers
are cached under the local Windows application cache in `tablelight-updater`.

## Failures and installation

The launch check has a 12-second deadline. A request that stops transferring data also times
out. Automatic failures show no popup; manual status appears under Updates. Turning automatic
checks off cancels a pending automatic check. A missing `latest.yml` on an older release produces
a status message explaining that update information is not available yet, with the Release page
as a fallback. It is not treated as proof that the installed app is current.

The app uses full NSIS installers and verifies their SHA-512 digest against release metadata.
It rejects prerelease, equal, older, and invalid versions. No update installs on ordinary quit.
After an explicit Update and restart, the app waits for successful saving and pauses new HUD
commands before starting installation. Failed downloads and saves keep the app open. A
downloaded update can be retried without downloading it again. Restart hides the TV overlay,
as an ordinary launch does.

Installers are currently unsigned. Digest checking detects a damaged or mismatched download;
it does not establish a verified publisher independently of GitHub and the release metadata.
The updater retains its normal signature verification when a signed release is configured in
the future. Windows can warn about or block unsigned software. If Windows blocks the installer,
or a system interruption prevents completion, rerun the official installer. This version does
not promise automatic rollback after an interrupted installation. Saves live outside the
program directory and uninstalling does not remove them.

Existing portable users must install the first updater-enabled release manually. Publishing
new source commits is separate from publishing app updates: the updater sees a versioned stable
GitHub Release with its installer and metadata, not ordinary commits or pull requests.
