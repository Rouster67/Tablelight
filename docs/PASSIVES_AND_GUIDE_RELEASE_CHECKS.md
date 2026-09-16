# Passive abilities and illustrated guide — release checks

Updated September 16, 2026. Milestone 6 is **not complete**. This record covers the development
build on `codex/passives-and-illustrated-guide`, based on `e55be28`, plus the current verification
changes. The app still identifies itself as 1.12.1; no new public release is approved or published.
The user has identified **2.0** as the intended release. Version preparation is still pending;
the user controls commits, publishing and merge.

## Automated and document evidence

| Check                         | Evidence and limits                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core behavior and syntax      | 225 checks passed on September 16; `work/continued-verification-unit.log`. Includes old-save migration, shared/local definitions, independent settings, passive spending protection, reminders and hybrid effects.       |
| Desktop regression            | 288 checks across all 34 scenarios passed on September 16; `work/continued-verification-native.log`. All tests use isolated synthetic saves.                                                                             |
| Worked examples               | Earlier `guide-manual-pVwx3I` run passed all seven grouped walkthrough checks. The UI and manuscript have not changed during this milestone.                                                                             |
| Every PDF page                | All 67 final pages accounted for in `user-guide/review.json`; 17 chapters, 37 figures, 83 bookmarks and 183 internal links. No PDF or screenshot changes in this milestone.                                              |
| Installed testing copy        | Earlier `installed-guide-7zRzwe` run passed 36 checks against `D:\Programs\Tablelight`; all 592 build files matched and all 48 real saved-data files were preserved. A final file comparison accompanies this milestone. |
| Custom paths                  | Earlier `guide-paths-jSRiMo` run passed five guide checks each from unpacked and copied custom `é` folders with an unrelated working directory. These are path-resolution tests, not installer tests.                    |
| Real Windows handoff          | Earlier `guide-real-viewer-20260916-010302` run confirmed Windows accepted the installed PDF through the real DM bridge. This does not prove interactive navigation or offline viewing.                                  |
| Extended installer regression | Prepared in `scripts/test-installed-update.cjs` and `tests/installed-update-native.js`; execution through the installer remains blocked. Do not count these new assertions as passed.                                    |

The guide's exact SHA-256 remains
`4ad0e36ec39bbb7f66c7f5f86b64d8e868a2e6fcf862501b875183d389091e45`.
Keep `review.json` Draft, with `walkthroughsPassed` and `offlineInstallsPassed` false. Add a reader
to its completed viewer list only after its required interactive/offline checks pass. Core walkthroughs passing does not
certify installation/update/uninstall procedures or the final release edition.

## PDF testing on September 16

The source and installed PDF are identical and were not changed. A fresh read-only audit verified
all 67 pages, 83 bookmarks and 183 internal links, including matching every contents link to its
actual heading. All fonts and image streams are embedded and decode successfully. No external
resources, remote actions, JavaScript or launch actions were found. Text remains selectable and
within page bounds; every footer identifies the correct development edition and page number.

Poppler and PDFium both rendered all 67 pages. Every fresh Poppler page is pixel-identical to
the previously inspected final page. The PDFium pages with the largest rendering differences,
plus representative contents, screenshot and table pages, were individually inspected without
finding clipping, overlap or missing images. The inspected page numbers are recorded in
`user-guide/review.json`; ignored local evidence is in `outputs/pdf-test-20260916/results.json`
and its `poppler` and `pdfium` render folders.

The user confirmed that **Setup & help → Open illustrated user guide** opens the installed guide,
and that clicking **Passives** in its contents reaches that chapter. The user identified the browser
as **Firefox**, and subsequently confirmed that the links they tested work. Its version remains
unconfirmed. Bookmark interaction, search, a fresh offline open
and a second distinct reader remain pending. Embedded resources and successful local rendering
support offline readiness but do not replace an actual disconnected reader check.

While the user was away, a direct case-insensitive search of the installed PDF found **24 matches
for "bonus action" across 15 pages**, including text wrapped across lines. PDFium provided valid
on-page highlight bounds for every match, and independent pypdf extraction identified the same
pages. The installed PDF hash still matches the reviewed source. This passes the file-level
search check; Firefox's search interface and visible highlighting remain untested. Ignored local
evidence is in `outputs/pdf-test-20260916/search-results.json`.

## Confirmed blockers

- **Installer:** Windows Code Integrity event 3077 at September 16, 2026, 01:00:09 local time
  records that `dist/testing-full-guide/Tablelight-Setup-1.12.1-x64.exe` did not meet signing
  requirements or violated the active Application Control policy. Its signature status is
  `NotSigned`. This is a Windows execution block, not a failed app assertion or Codex approval
  rejection. No security settings were changed. No alternate launch method is used to evade it.
  The user confirmed that neither another Windows test PC nor a signing certificate is available.
- **Interactive readers:** Firefox was previously identified as the Windows default viewer.
  The available Windows automation previously refused Firefox interaction because it could
  not enforce browser URL policy. The user has since confirmed opening from the app and following
  the Passives contents link in Firefox. Remaining reader interactions, a second reader and
  offline viewing are pending. PDF structural inspection is separate evidence.
  A follow-up attempt through the supported in-app browser was also rejected by its local-file
  URL policy. No alternate URL, server or browser automation route was used to bypass that block.
- **Physical TV:** The user cannot check the TV now. Do not infer seat-distance readability,
  physical display scaling or rotated interaction quality from automated screenshots.
- **Release edition:** The user intends a 2.0 release; the app and guide still identify themselves
  as 1.12.1 development. Prepare the release version, refresh affected captures, and regenerate
  and review the final PDF after any resulting interface fixes.

## Resume the installer matrix

The independent `upgrade-data` desktop check now uses the same synthetic party and assertions
as the installer regression. Its first and restarted processes each pass three grouped checks.
It verifies the complete save, independent reminders and HUD settings, passive spending rejection,
Undo, guide handoff, retained update opt-out and cleared messages. This closes the gap where those
new fixture checks could only run through an installer. It does **not** certify installer file
replacement or uninstallation. Three focused unit checks also verify immediate launch-error
reporting, normal old-app exit followed by a new-app result, and timeout without a result.

Use an isolated Windows test environment whose policy permits the installer, or an appropriately
signed build. Keep real party data outside the test accounts. Run the checks below on the exact
release candidate; preserve logs and record app version, PDF hash, folder, Windows build and viewer.

1. Run `npm run test:installed-update`. Its unique app identity, test shortcuts and synthetic
   save/cache folders keep it separate from the real installation. Require all existing updater
   and uninstall checks plus the new passive and PDF assertions. The 0.0.1/0.0.2 fixture versions
   test updating; they do not certify matching release-guide versions.
2. Install the release candidate into the ordinary per-user location in a clean test account.
   With internet unavailable, start Tablelight and open Setup & help → Open illustrated user
   guide. Confirm the guide's cover/version and hash match that installation. Do not rely on a
   previously open PDF tab. Verify retained license, backup and update controls remain present.
3. Repeat a fresh installation into a folder on another drive containing spaces and `é`.
   Launch both its shortcut and its executable from an unrelated working directory. Confirm
   each opens the PDF inside that installation, without a source checkout or default-folder copy.
4. Update an older custom installation containing a deliberately different old PDF. Confirm the
   new guide replaces it, the shortcut still starts the custom copy, and the party, previous save,
   library, individual settings and update preference survive. Include the missing/stale path
   record cases supported by the existing harness; never edit the real app's registry records.
5. Keep two isolated test copies available and open their guides in turn. Compare the displayed
   file locations and hashes. Each app must use its own guide regardless of current directory.
6. Exercise missing/unreadable PDF and unavailable-viewer recovery only in a synthetic test copy;
   retain the existing fault-injection tests rather than changing personal PDF associations.
7. Uninstall the test copy with saved-data removal unchecked. The executable and bundled guide
   must disappear; synthetic saves and exported backups must remain. Run the optional deletion
   confirmation checks described in `RELEASING.md` using only disposable test data.

## Reader and physical review

Use the Windows default PDF reader and a second distinct reader already available on the test
machine. Record their names and versions. With internet unavailable, open the installed guide
afresh, follow several contents links including the first/last chapters, expand bookmarks and
follow a nested section, use page navigation, search for an ability-field label, select/copy text,
and inspect screenshots and tables at a readable zoom. Every page/image must remain available.
Record actual observations; a successful open request alone is insufficient.

On the usual TV, check collapsed and expanded player HUDs at the normal seat distance and
Windows scaling. Read long passive descriptions and Active/Inactive/Always applies labels;
switch a hybrid between passive and active views; check the usual rotations, page controls,
multiple HUDs, and interactive/click-through modes. Note clipping or text that is too small.
Preserve each character's chosen scale and rotation while checking.

After any fixes, rerun affected checks. After choosing the final release version, refresh affected
screenshots, regenerate the PDF, inspect every resulting page and validate all links/bookmarks.
Only then complete `review.json` and run `npm run guide:check` for release approval. Merge,
version changes and publication still require the user's direction.
