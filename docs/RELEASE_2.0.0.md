# Tablelight 2.0.0 release preparation

Prepared from `codex/passives-and-illustrated-guide`, based on `827c03e`, with uncommitted release
preparation changes. The user controls commits, push, merge and publication. No release or tag
has been created. [Prepared release notes](RELEASE_NOTES_2.0.0.md) are available for the next step.

**Status: 2.0.0 finalized for the owner's commit and release process, with three explicitly
waived manual checks.** The guide is Final. No unrun check is marked passed. On September 16,
2026, the owner instructed: "we will proceed without doing those 3 checks. let me know when
i can commit". The exact authorization, version, final PDF hash and scope are recorded in
`user-guide/review.json`.

## Prepared source

- Package and lockfile both identify 2.0.0; dependency versions are unchanged.
- The changelog, Markdown companion and PDF manuscript describe 2.0.0 and save-format-11
  compatibility. Export a backup before upgrading; earlier releases cannot read the new format.
- All 37 screenshots were recaptured from the actual 2.0.0 app using isolated sample data.
- The complete 67-page guide has 17 chapters, 83 bookmarks and 184 internal links.
- The guide-packaging test now exercises both Draft and Final states independently of the
  checked-in edition, including rejected incomplete reviews. The HUD preview test waits for
  its asynchronous first frame before measuring it; its geometry assertions are unchanged.

## Verification

The final source run passed 225 unit checks and all 288 desktop checks across 34 scenarios.
The worked-example capture passed seven checks. All 67 final PDF pages rendered in both Poppler
and PDFium. The 66 non-cover page bodies are pixel-identical to the reviewed 2.0.0 draft; the
final cover was inspected individually. Every final footer, link/bookmark destination, text
boundary and embedded image/font was checked. No visual or navigation defects were found.

Current evidence is recorded in `user-guide/review.json`; local logs are
`work/release-2.0-finalization-unit.log`, `work/release-2.0-native-final.log` and
`work/release-2.0-final-pdf.log`.
Local logs and screenshots are ignored build evidence, not release downloads. Installation/build
receipts are recorded separately under `work/release-2.0-*.json` after verification.

The testing copy at `D:\Programs\Tablelight` was updated from the verified build after backing
up all 600 previous program files and all 48 saved-data files. All 599 payload files matched,
and all 48 saved-data files remained unchanged. The actual installed app passed 42 checks for
Help, passives, update controls, session behavior and save/restart. Ten additional guide checks
passed from the unpacked copy and a copied custom `é` folder with an unrelated working directory.
These are app/path checks, not installer certification. The original backup is
`backups/before-final-verification-20260916-120906`.

The final release files use the normal Windows build under `dist/`, with publishing disabled.
Their version, installer filename, byte size, SHA-512 metadata and blockmap coverage matched.
Static extraction confirmed the embedded 2.0.0 package, exact reviewed PDF and application
license. 7-Zip's payload integrity check passed with its trailing-data warning for the surrounding
installer executable. The installer is unsigned; it was not executed to evade the recorded
Windows block. Final source/build fingerprints are in `work/release-2.0-final-assets.json`.

## Owner-waived checks — not performed

1. **Real installer/upgrade/uninstall:** Windows Application Control blocked the unsigned test
   installer. No signing certificate or separate Windows test PC is available. Ordinary/custom
   installation, actual upgrade and uninstall need a permitted Windows test environment or an
   appropriately signed build. A copied unpacked build does not complete these checks.
2. **Interactive/offline readers:** The user verified opening and links in Firefox in the prior
   guide. The revised PDF's pages, navigation objects and embedded resources are inspected
   directly, but remaining interactive/offline checks in two distinct readers are pending.
   Automation rejects Firefox/local PDF control; no alternate route is used to bypass it.
3. **Physical TV:** Seat-distance readability and the usual TV/scaling/rotation setup remain
   untested because that setup is unavailable. Automated layout coverage is separate evidence.

The owner accepted proceeding without those three checks. The normal packaging gate accepts
only named waivers with owner authorization bound to this app version and exact PDF hash.
Coverage, core walkthroughs, every-page inspection, navigation and source/hash checks still
must pass. A waiver does not change Windows security settings or certify an unperformed test.
If merging changes source, rebuild and verify the affected output before creating the release.

## Next prompt and release assets

The user requested a GitHub release draft in a later prompt, after their commit/push/merge.
Before creating it, verify the final merged revision and readiness. The three release assets
must come from one approved build: `Tablelight-Setup-2.0.0-x64.exe`,
`Tablelight-Setup-2.0.0-x64.exe.blockmap`, and `latest.yml`. Check the metadata version, installer
name, byte size and SHA-512 digest. Never mix outputs from different builds or publish a
development-guide candidate to the stable update channel.
