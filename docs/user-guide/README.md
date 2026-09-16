# Offline illustrated manual

The final PDF contains the complete 17-chapter manuscript for Tablelight 2.0.0.
It covers the entire interface with a first-session
walkthrough, field tables, focused procedures, examples, real screenshots and troubleshooting.
The package and guide both identify version 2.0.0. The owner explicitly waived the installer,
remaining offline/two-reader and physical-TV checks. The review records that decision separately
from passed checks and binds it to this exact version and PDF.

## Edit and capture

- Edit `GUIDE.md`. Supported blocks are chapters (`#`), sections (`##`), paragraphs,
  numbered steps of any length, bullets, two-column tables, bold text, images and internal links.
- Keep headings unique. Chapters start new pages. Table headers repeat when a table splits.
- Images come from the real Electron renderer using isolated synthetic data, not mockups.
- Run `node scripts/test-native.cjs guide-manual` on Windows to replay the worked examples
  and create captures under `test-results/guide-manual-*`. This scenario is opt-in so ordinary
  regression runs do not regenerate documentation assets.
- Inspect the captures, then copy the referenced PNGs into `images/` and the capture run's
  `captures.json` here. Retain its exact UI hashes, app version, revision, display scaling,
  image names, selector crops and pixel sizes. Recapture affected images after UI changes.
- `COVERAGE.md` maps the complete control inventory and focused procedures to evidence.
  `review.json` records the exact PDF inspection and remaining release checks.

## Build

Use Python with the pinned dependencies in `requirements.txt`, then run:

```powershell
python scripts/build-guide.py --draft
node scripts/check-guide.cjs --allow-draft
```

The generator reads the app version, checks screenshot UI hashes, embeds the bundled Vera
fonts, creates linked contents/nested bookmarks, checks every local link/bookmark destination,
and writes `manifest.json` beside the editable sources. The stable output is
`docs/Tablelight-User-Guide.pdf`. End users need no authoring tools or internet.

Build after formatting/editing the manuscript. Do not format generated capture or manifest
records afterward. Source, screenshot and PDF hashes must agree. The invariant PDF is
byte-identical when rebuilt with the same inputs and pinned environment.

## Inspect

Render every page with Poppler (`pdftoppm -r 110 -png`) and inspect each page individually.
Check text, screenshots, captions, tables, wrapping, margins, links, bookmarks and page numbers.
Use higher-resolution crops when inspecting small screenshot labels. A contact sheet does not
replace page inspection. Keep review renders/logs under ignored `outputs/` or `test-results/`.

The new example harness verifies editor creation/assignment, personal passive state, resource
spending on approval, slot use, damage with concentration, initiative, rest and messages.
Existing feature scenarios cover the focused variants listed in COVERAGE. Never use real saves
for walkthroughs, restore/deletion, update or uninstall tests.

## Release gate

Development manuals retain Draft review status until release review is complete or the owner
explicitly waives the supported manual checks for the exact final edition.
Normal builds reject missing, damaged, stale, mismatched or unapproved PDFs. CI checks drafts
but withholds release installers. This protects public releases; it does not prevent the
user-authorized local testing installation from receiving the complete manual.

For a local-only installer use `TABLELIGHT_ALLOW_DRAFT_GUIDE=1`, `--publish never`, and output
under `dist/testing-*` or `test-results/<run>/`. That exception cannot publish a release.

For final certification, choose the release version, refresh affected captures, generate without
`--draft`, inspect that exact PDF, and record status approved, matching PDF/version, every
page in pagesInspected, coverageComplete/walkthroughsPassed/offlineInstallsPassed/navigationChecked,
and at least two distinct local viewers including the Windows default. Include real offline
ordinary/custom installation and upgrade checks; a copied unpacked folder is only path-resolution
coverage, not a fresh installation. Never mark pending viewer checks as passed.

An explicit owner decision can waive named manual checks for a specific release. Record
`releaseWaivers` with the app version, exact PDF hash, `approvedBy: project-owner`, approval
date, the authorization text, reason and named checks. The supported names are
`installer-upgrade-uninstall`, `offline-pdf-readers` and `physical-tv`. Keep unperformed test
booleans false and the completed-reader list accurate. An installer waiver also requires
`coreWalkthroughsPassed: true`; it cannot waive the actual app walkthroughs. Coverage,
navigation, source/version/hash integrity and every-page inspection cannot be waived.
Regenerating a changed PDF requires a review of the new bytes before binding an authorization
to it. The 2.0.0 authorization is not permission to waive checks on a future release.
