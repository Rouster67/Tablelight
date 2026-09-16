# Offline guide source and build

Milestone 4 supplies the guide-opening interface, a seven-page **development draft**, and the
generation/packaging checks. It does not complete F13. The full manuscript, complete control
inventory, final screenshots and all walkthroughs are milestone 5; final installations and
release review are milestone 6. Do not merge/release the help replacement with an unfinished PDF.

## Files

- `GUIDE.md`: editable Markdown manuscript. Supported blocks: `#` chapters, `##` sections,
  paragraphs, numbered steps, bold text, images with captions, and internal heading links.
  Each chapter starts on a new page. Separate blocks with blank lines; no raw HTML is needed.
- `images/`: original screenshots from isolated synthetic characters. Keep personal data out.
- `captures.json`: fixture, app version, source revision, exact UI hashes, window size and scaling.
- `fonts/`: embedded Bitstream Vera fonts and their redistribution license.
- `manifest.json`: generated PDF hash, app version, pages, navigation and build input hashes.
- `review.json`: final human review record; currently Draft. It must match the exact final PDF.
- `requirements.txt`: pinned Python authoring dependencies. End users need no Python or Node.
- `../Tablelight-User-Guide.pdf`: the stable file opened from the running app's installation.

The generated text is searchable/selectable. Contents entries and their page numbers link to
chapters/sections; nested bookmarks reach their headings. Font embedding and every link/bookmark
destination are checked during generation. The invariant build is deterministic for the same
inputs and pinned environment. Essential content never loads from a remote URL.

## Generate a development draft

From the repository root, use Python 3.10+ with the pinned dependencies, for example:

```powershell
python -m venv work/guide-env
work/guide-env/Scripts/python.exe -m pip install -r docs/user-guide/requirements.txt
node scripts/test-native.cjs guide-capture
```

Inspect the two screenshots in the new `test-results/guide-capture-*` directory. After approving
them, copy `help-link.png` and `passive-detail.png` into `docs/user-guide/images/`, and copy that
run's `captures.json` into `docs/user-guide/`. They are prototype captures, not the final freeze.
Then run:

```powershell
work/guide-env/Scripts/python.exe scripts/build-guide.py --draft
node scripts/check-guide.cjs --allow-draft
```

`npm run guide:build -- --draft` is the equivalent when `python` points to that environment.
The generator takes the app version from `package.json`; it rejects stale screenshot inputs.
Keep the resulting PDF and manifest together. Rebuild after changing the manuscript or assets.
Do not run a formatter on the generated manifest/capture records after building: their exact
bytes are recorded. The renderer and Python generator use LF text for reproducible checkouts.

## Inspect the PDF

Render every page with Poppler, for example `pdftoppm -r 130 -png
docs/Tablelight-User-Guide.pdf outputs/guide-review/page`. Inspect each full-size image, then
test text selection, search, contents links and bookmarks in a local PDF viewer. Repeat after
layout changes; a contact sheet does not replace individual inspection.

Prototype review: all seven pages inspected individually; chapter transitions, captions,
margin/line wrapping and screenshot labels checked. The generator verified 13 bookmarks,
28 internal links and embedded text fonts. Two successive builds produced identical PDF bytes.
This is not an approval of the future complete guide or a record of all required walkthroughs.

## Packaging and release gate

`npm run build:windows` and the builder's `beforePack` hook reject missing, damaged, stale,
wrong-version or Draft PDFs. CI checks the draft but skips installer creation/upload until the
manifest is Final. This keeps a prototype out of ordinary release artifacts.

For an explicitly local testing installer only, set `TABLELIGHT_ALLOW_DRAFT_GUIDE=1`, pass
`--publish never`, and use an output directory under `dist/testing-*` or `test-results/<run>/`.
The hook rejects that exception for ordinary release output or publishing. The installed-update
harness uses this exception only for its isolated synthetic test installers. Those fake version
numbers test the updater; they do not certify the guide's release version.

After completing the manuscript and final screenshots, generate without `--draft`. Inspect the
exact PDF and record these fields in `review.json` before a release build can pass:

- `status`: `approved`; `pdfSha256` and `appVersion` match the generated manifest.
- `coverageComplete`, `walkthroughsPassed`, `offlineInstallsPassed`, `navigationChecked`: true
  only after recording the corresponding evidence in the coverage/release review documents.
- `pagesInspected`: every page number in order, from 1 to the final page count.
- `viewers`: at least two distinct PDF viewers, including the Windows default viewer.

Final checks must include normal/custom folders, spaces and non-ASCII folder names, unrelated
working directories, real default-viewer opening offline, custom-folder upgrades, and replaced
guide bytes. Keep QA images/logs in ignored `outputs/` or `test-results/`, outside installed docs.
