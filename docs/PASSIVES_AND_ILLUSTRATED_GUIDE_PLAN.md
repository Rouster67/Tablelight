# Passive abilities and illustrated user guide — implementation plan

Status: milestone 1 was published by the user as `5953c11`, followed by the Behavior/Turn cost
editor in `eb06b48` and milestone 2's DM Passives in `aee73e9` (including `AGENTS.md`). The local
and published branch were verified at `aee73e9` before the user-authorized next change. Milestone 3's
player HUD and DM display controls were published as `9f5996c`. Milestone 4's offline guide link,
authoring pipeline and draft were published as `0b140ba`. Milestone 5's complete illustrated
manual is committed as `8e3b699`, followed by the review record in `e55be28`. The user has
authorized milestone 6's final verification. See the [release check record](PASSIVES_AND_GUIDE_RELEASE_CHECKS.md)
for completed checks and remaining blockers. Branch, commit, and publishing decisions stay
with the user. The user now intends a 2.0 release; applying that version and preparing its final
guide/build remain outstanding. The current package is still 1.12.1.

Originally prepared September 13 against Tablelight 1.10.2. Updated for the user's branch at
`2c583f9` (package 1.12.1 plus the latest merged HUD/DM layout changes).

## Branch setup and current scope

1. The branch originally created during planning was removed by the user. The earlier setup
   record is historical and does not describe the current branch. Branch changes require the
   user's approval; the user created `codex/passives-and-illustrated-guide` themselves.
2. On September 15, verified that branch was active in `D:\Repos\Tablelight-source`, the
   working tree was clean, and the starting commit was `2c583f9`. The user subsequently
   committed and published milestone 1 as `5953c11`. The editor follow-up starts there and
   leaves the same branch active, with local changes ready for the user's review and commit.
3. This one branch will contain all work in this plan, divided into focused commits. The first
   commit implements passive behavior/state, compatible persistence, command safeguards and
   tests, plus the guide coverage outline. The visible editor/Passives sections and PDF follow.
4. Automated checks use isolated synthetic data. The user subsequently designated
   `D:\Programs\Tablelight` as their testing copy and authorized keeping it current after completed
   changes. Back up that installation and its saves, update it, then verify the actual installed
   app and confirm real saves are unchanged. This preference is recorded in `AGENTS.md`.
   Recheck the branch and uncommitted changes at each work session; publishing remains the user's task.

## What the current project already provides

- The earlier version display, updater, concentration improvements, custom-folder update fix,
  and uninstall saved-data choice remain merged. The initial planning baseline was 1.10.2.
- The ability-details work has since merged: Reference/Upgrades and the revised **manual** F07
  fields, shared and character-only abilities, duplication and deletion choices, DM approval
  requests, reservations, History, reconsideration, and targeted Undo. Do not reintroduce the
  rejected automatic ability attack/DC proposal. Character-sheet calculations remain independent.
- Icons, class themes, and recipient messages merged in PR #13 and are documented in 1.12.0.
  PR #14 added the 1.12.1 DM layout and PR #15 added the latest natural-height, paginated HUD.
  Some roadmap rows still say Implemented on branch; the merged code and changelog are the
  implementation baseline. This commit does not broadly rewrite unrelated roadmap history.
- [Core state](../core.js): the previous baseline writes format 10; this milestone advances it
  to 11 and imports formats 1–10. Shared definitions are stored once; assignments retain IDs,
  personal costs/availability and passive state. Character-only items retain their full definition.
- [Library editing](../library-ui.js): shared changes reach active/inactive players. Duplicate
  and local-only paths must retain new definition fields. The deletion dialog can preserve
  assignments as local copies or remove them; keep that current behavior and its confirmations.
- [Approval service](../approval-service.js): the main process owns changes, pending requests,
  saving, retries and Undo. Passive requests must be rejected there through core availability;
  hybrid reminder switches must not reserve costs or invalidate an unchanged active request.
- [HUD](../hud.js) and [architecture](ARCHITECTURE.md): preserve the **current** 880px base width,
  content-driven height, chosen scale/rotation, 1150px width with the existing pending column,
  fifteen-ability pages, six-condition pages and three-resource pages. The old 650px fixed-height
  and column-scroll assumptions in the original plan are superseded by the user's merged changes.
- [Help](../controller.js) still has the three paragraphs to replace in F13. Packaging already
  includes `docs/**/*`; [USER_GUIDE.md](USER_GUIDE.md) remains the written companion. The new
  [coverage checklist](user-guide/COVERAGE.md) starts the future illustrated guide using the
  actual current features. Final captures wait for the finished interface and release version.
- Before editing, all 197 baseline unit tests passed. After implementation, syntax checks and
  all 211 unit tests passed, including 14 passive-specific cases. The full 30-scenario native
  suite passed (253 checks), including the new real-bridge/editor/save/reload test and existing restart cases.
  The actual pre-change format-10 reader was checked and rejects format-11 saves. Physical TV
  review and final PDF/install checks belong to later milestones. The automated desktop run
  detected 2560 × 1440, 1440 × 2560, and 1920 × 1080 displays, all at 100% Windows scaling.

## Recommended order and milestones

Implement F01's data rules, then its DM interface, then its player HUD. Outline F13 early, but
finish its screenshots and walkthroughs after both F01 and the final Setup & help interface work.
Add the guide-opening route and packaging before taking the final help screenshot; complete the
PDF and inspect the exact installed artifact before presenting the combined change for release.

The ability-details and visual features are now merged. Reuse their current helpers and preserve
their behavior; the older plans remain historical context. F13 must cover these shipped features
as well as finished passives. It depends on the final release feature set, not on completion of
every remaining roadmap idea.

### Milestone 1 — passive behavior, shared data, and save compatibility

Implemented and verified in the first commit. This milestone adds data/command support; the
editor follow-up below exposes Behavior. Passives sections are not exposed yet.

Add a shared Behavior choice: **Active**, **Passive**, or **Passive + active**. Keep the existing
Type choice for action/ability, spell, and class/species/other feature. Recommend a separate
behavior field instead of a fourth type or a new turn cost: a spell or feature can have either
behavior, and hybrid entries need both. Default every old entry to Active; never classify one
by its name, description, type, turn cost, or unavailable flag.

Keep the existing description as the primary text. For Passive it is the passive description;
for Active it retains its current meaning. For Passive + active, label it Active effect and add
one shared Passive effect text field, with the same 40,000-character bound and escaping as the
existing description. Store one definition and one assignment per character, with two views.
Keep both text fields through behavior changes; do not move, merge, or erase text silently.

Add an optional shared **Track whether the passive applies** setting, off by default. When
enabled, store an independent boolean on each character's assignment. New assignments begin
Inactive; the DM or player marks them Active when the described circumstance applies. This
records a manual reminder, not an inferred effect. With tracking off, show Always applies and
no toggle. Preserve any previously recorded manual state when tracking is temporarily disabled.

Keep active configuration separate: turn cost, slot use, resource binding/cost, concentration
requirement, and existing unavailable flag affect only active use. Retain dormant values when
changing to Passive so existing personal settings are not discarded. Milestones 2–3 hide active
controls and cost summaries on passive-only entries. The authoritative spending path must reject a passive
use before changing anything, even if an old UI or crafted command attempts it.

Extend normalization, validation, exact-content definition comparison, attachment defaults,
assignment backup whitelists, active/inactive roster handling, and stale-editor merging together.
This milestone uses save format 11 on top of the merged format 10. Accept formats 1–10,
default missing passive fields safely, and reject unsupported future formats clearly. Released
format-10 readers must reject new saves rather than silently drop passive data.
Preserve the save folder and atomic save/recovery behavior; exporting a pre-upgrade backup remains
the supported way to return to an older app.

Begin a guide coverage checklist from the inventory below, recording the expected release scope
and sample workflows. This is an outline only; final screenshots depend on later milestones.

Completion and tests:

- Old format 1–10 fixtures load as Active with original text, IDs, costs, libraries, conditions,
  portraits, settings, and live values preserved. Cover missing fields versus invalid values
  in a new-format save, missing references, and distinct same-name definitions.
- Create all three behaviors, save/reload/export/restore them, and verify complete expected state.
  Check unused definitions and assignments in the inactive roster as well as the active party.
- One shared conditional passive on two characters keeps different active states. Shared text
  edits update both; personal state, resource bindings, unavailable flags, and IDs stay separate.
- Toggling changes only the selected assignment's reminder state, with one save and Undo change;
  it never changes HP, AC, scores, movement, actions, slots, charges, conditions, or concentration.
- Reject passive spending in the core and command routes. Hybrid active use retains normal
  availability, costs, and concentration behavior regardless of the passive reminder state.
- Confirm the agreed schema and migration can coexist with any already-merged new ability fields.

### Milestone 2 — shared authoring and the DM Passives section

**Current DM implementation:** Passives is a tab next to Features. It shows always-on or
conditional reminders, readable inactive text, and View/Edit/remove controls without Use or
cost summaries. New entries from this tab default to Passive; the picker starts with a Passives
filter, including hybrids. Shared and character-only editors expose tracking and separate
hybrid descriptions. Switching between passive and active detail windows changes no HUD and
spends nothing. Passive-only entries are excluded from ordinary DM/TV action lists; converting
an open TV detail to passive-only returns only that HUD to its existing list. Dedicated player
Passives navigation is intentionally reserved for milestone 3.

The new `passives-dm` desktop scenario verifies the DM workflows, state preservation, shared/local
copies, removal and Undo, export/restore/reload, and long text at 940 × 660. Existing `passives`
checks retain concentration-conversion safeguards and all Type/Behavior combinations. Final PDF
captures still wait for the finished player HUD and release interface.

**Approved editor follow-up, September 15:** Add Behavior (Active / Passive / Passive + active)
to shared and character-only editors, with Turn cost beside it below Name and Type. Type is
grouping only: it never restricts fields or costs. A feature may spend spell slots, and a spell
may use a bonus action or reaction. Hide Turn cost for Passive while retaining its value;
other cost fields stay available with a clear explanation that passive-only entries cannot
spend them. Keep text, shared links, personal resource settings, and HUD placement unchanged.
Move the image editor below these choices so they remain visible near the top.

This focused step does not complete milestone 2: conditional reminder controls, separate hybrid
effect text, Passives lists, and player presentation still need implementation. The regression
captures of the editor are for development review; final guide screenshots still wait until
the interface and release version are settled. The `passives` desktop scenario covers all nine
Type/Behavior combinations, independent character settings, cancel/Undo, retained draft values,
blocked concentration conversion, disk/reload persistence, and the minimum 940 × 660 window.
Verification passed: 211 unit tests, all 30 desktop scenarios (260 checks), syntax and formatting.
Editor screenshots were inspected at 1440 × 950 and 940 × 660 window sizes. No installed program
files were updated.

Expose Behavior and the conditional-tracking choice in the shared library editor. Label shared
fields and character-specific active state clearly. Starting Create new from Passives defaults
to Passive; library-wide creation and existing ability flows retain their Active default.
Add an understandable Passives library filter/search treatment that includes hybrid entries.

Add a dedicated **Passives** section to the selected character's DM view, with readable names,
descriptions, and Always applies / Active / Inactive labels. Keep inactive passives readable.
Allow View, Edit, assignment/removal, and the optional labeled switch. Do not show an ordinary
Use button, turn-cost icon, Ready/Spent status, slot selector, or resource-cost summary there.
Use the existing add/choose-existing flow so this remains the same shared library.

Hybrid entries appear in Passives for their passive text and in the appropriate active lists
for their active effect. Use **View active effect** / **View passive effect** navigation to
connect the two descriptions; opening either view never spends anything. The Use control belongs
only to the active view. Preserve the single stable assignment ID and distinguish which effect
is being read so paging and selection do not confuse the two views.

Behavior edits apply to all linked characters. Show their affected scope in the shared editor.
If changing to passive-only would invalidate a current concentration binding, block that edit
with a specific explanation until the DM ends or changes those bindings, including on saved
characters. Do not silently clear another character's concentration. Cancel changes nothing;
Undo restores behavior and any affected view selection coherently.

Completion and tests:

- Create once and assign to two characters, including an inactive player; edit shared text,
  toggle only one assignment, remove one assignment, and verify the existing delete/keep-local-copies choices.
- Verify empty lists, many entries, long names/descriptions, blank text, and HTML-like text.
  Save, cancel, Undo, reload, and restore keep descriptions and per-character states intact.
- Every passive-only list/detail/preview lacks use/cost controls; a hybrid's passive view has
  the same rule. Ordinary active lists exclude passive-only entries, including Free / other.
- Active-to-passive-to-hybrid edits retain dormant costs, text, and personal settings. Moving
  between sections retains a valid selection or returns to the correct list without jumping
  another player's HUD. Cover edits that would invalidate concentration and removed assignments.
- Saving a previously opened library or character editor preserves intervening passive switches,
  HUD spending, and HP changes unless the user explicitly edited the same field.

### Milestone 3 — player HUD, DM display controls, and passive regression

**Implemented locally:** Expanded HUDs and Currently displayed offer Passives, with matching
effect text/pages, conditional reminder switches and both sides of a hybrid. Click-through keeps
readable status and DM controls. Existing `hud.panel = 'passive'` selects passive detail text,
avoiding an extra saved field or format change. Explicit Show on TV controls display a passive;
ordinary DM reading links remain independent of the HUD. Widths, natural height, rotation, scale,
and other characters are preserved. New unit/native coverage checks paging, empty active text,
conditional switches, pending requests, click-through, reload, backups, zero/one/many passives,
maximum-length text and 30 rotation/scale/interaction combinations. Test captures are for review,
not final guide screenshots. The next proposed commit is milestone 4's offline guide-opening
route, authoring setup and packaging; full guide content follows in milestone 5.

Add Passives to the shared HUD section choices and DM Currently displayed controls. Put the new
choice next to Features, with navigation contained inside the existing frame. Determine the
precise spacing with the current HUD; retain its base width and natural-height layout, without
reducing the existing portrait/summary to make room or reintroducing content scrollbars.

Use the same passive/hybrid content and status rules on the expanded HUD and DM preview. Extend
detail/page counts for the correct effect text, including a hybrid whose active description is
empty. Preserve independent page selections during unrelated updates; clamp pages after edits.

With HUD controls on, allow a player to change only their assigned conditional passive's state.
Send an explicit desired boolean through the checked DM-owned command route, so repeating the
same request does not flip the state twice. With click-through on, show status as text and leave
the controls to the DM. Reject stale commands after hiding/collapsing the HUD or disabling
interaction, unknown assignments, nonconditional entries, and characters outside the party.

Completion and tests:

- Navigate Passives and both sides of a hybrid from DM and TV, including back/page controls.
  Both screens show matching text and state. Refresh, save broadcasts, and simultaneous actions
  neither lose a toggle nor overwrite a newer unrelated change.
- Check 0°, 90°, 180°, 270°, and an angled HUD at multiple scales, including supported minimum
  and maximum scale. Verify the current base/pending-column widths and natural height, saved placement/rotation, independent
  players, expanded/collapsed transitions, DM preview, and reading position.
- Test zero/one/many passives, maximum text, long unbroken words, and both hybrid descriptions.
  Keep navigation and switches inside the frame with readable labels and reachable click targets.
- Verify interactive and click-through modes, map clicks outside rotated HUDs, hidden players,
  and mode changes while a passive detail is open. Check native dimensions and screenshots.
- Run unit and relevant native library, session, concentration, interaction, and HUD-layout
  scenarios with synthetic data. Verify the behavior policy below, including rests and Undo.

### Milestone 4 — guide authoring setup, help link, and packaging

**Current implementation:** The help link, DM-only fixed-path opening service and recoverable
error feedback are connected. A repeatable ReportLab/Python build produces the seven-page Draft
with embedded fonts, original real-app screenshots, linked contents and 13 bookmarks. Its 28
internal links and destinations are checked; all seven pages were visually inspected. The three
removed help topics remain readable in the draft. Source/capture/version hashes and a final
review gate reject stale or unreviewed PDFs. CI checks the prototype but skips release artifacts;
only isolated, explicitly no-publish testing builds accept it. The complete illustrated manual
and final walkthrough/screenshots are still milestone 5, not completed by this prototype.

Create editable guide source and approved example assets under `docs/user-guide/`, with a
repeatable documented generation command. Recommend Markdown content plus a local PDF generator,
embedded fonts, and locally stored screenshots; the exact authoring tool should pass a short
layout/navigation prototype before adoption. Keep generation tools as development dependencies.
Installed users should need only Tablelight and a PDF viewer, not Python, Node, or internet.

Propose **Open illustrated user guide (PDF, offline)** for the help link and
`docs/Tablelight-User-Guide.pdf` for the delivered file. Use a stable filename across app updates;
put the applicable app version inside the PDF, metadata, and generation record. Keep
`docs/USER_GUIDE.md` and installation-root `START HERE.md` as the concise written companion.

In Setup & help, remove exactly the headings **Use the HUDs directly**, **Concentration &
conditions**, and **Rests & corrections**, plus their explanatory paragraphs and redundant
separators. Replace that block with the single clearly labeled guide link. Preserve the setup
steps, manual-tracker note, license access, backup explanation/buttons/path, update controls,
keyboard shortcuts, display tips, and global controls. Cover every removed topic in the PDF.

Expose one DM-authenticated, no-path-argument operation in preload/main to open the bundled guide
with the default PDF viewer. Resolve a fixed `docs/Tablelight-User-Guide.pdf` from the running
application's source directory, which is currently `resources/app` in an installed build.
Do not derive it from the shell's working directory, saved-data folder, registry, an assumed
drive, or `D:\Programs\Tablelight`. Use the platform's file-open operation and handle both an
error result and a rejected request. Do not expose arbitrary file or command launching.

Report missing/unreadable files or failure to open a viewer in Setup & help with a clear retry
and practical recovery instructions. Keep Tablelight usable and saves untouched. A browser-only
preview should explain that opening the installed guide requires the desktop app.

Use the existing documentation packaging allowlist for the PDF and approved editable source.
Add an explicit build check that the expected PDF is present, valid, and matches the release
version/content manifest; fail the release build on missing, stale, or draft guide content.
Keep raw QA output in ignored `outputs`/`test-results`, outside bundled documentation.

Completion and tests:

- A local prototype proves readable screenshots, selectable/searchable text, embedded fonts,
  linked contents, bookmarks, and repeatable generation. Mark it Draft and keep it out of release
  artifacts; a prototype must not satisfy the final-guide completion check.
- Assert all three removed headings/paragraphs are absent and the named preserved help content
  and controls remain functional, including export/restore confirmation, license, and updates.
- Test keyboard focus/activation, repeated clicks, successful open, missing file, inaccessible
  file, and viewer failure with recoverable feedback. Reject requests from the overlay and
  malformed/unexpected path arguments. Opening the guide does not write saves or enter Undo.
- Test source and unpacked desktop opening with the fixed relative path. Inspect an isolated
  test package to confirm the PDF and companion/source files are actually included.
- The final help-link interface is ready for Milestone 5 screenshots. Treat link replacement
  and the completed guide as one deliverable: do not merge/release an incomplete PDF substitute.

### Milestone 5 — full manuscript, final screenshots, and PDF inspection

**Content implementation:** The seven-page prototype is replaced by a 17-chapter manual with
about 15,000 words, original Mira/Rowan/Ash walkthroughs, complete editor field references,
library and session workflows, and real DM/player captures. `docs/user-guide/COVERAGE.md`
maps current controls and examples to chapters, screenshot IDs and verification. The new
`guide-manual` native scenario exercises the original examples and records capture provenance.
This is the current development interface, not a claim of a newly published 1.12.1 release.
The exact final PDF inspection record is in `docs/user-guide/review.json`; release-version and
two-viewer certification remain part of milestone 6.

Freeze the intended release feature list, visible labels, layout, and version before final
capture. Write the manuscript from the coverage inventory below, then run each example in an
isolated app using synthetic characters, original example text, and nonpersonal portraits.
Capture the actual release interface, including the finished help link, DM Passives, hybrid
active/passive views, and rotated HUDs. Never use design mockups as instructions for real controls.

Recommend US Letter portrait pages, 11–12 pt body text, high-contrast captions/callouts, page
numbers, short numbered procedures, and generous screenshot space. Use a whole-screen image to
orient the reader, then large cropped details for controls; divide crowded workflows across
pages instead of shrinking a full DM window to unreadable text. Choose a readable page design,
not a fixed page quota; expect a substantial guide, approximately 35–55 pages if coverage needs
it. Every procedure states its starting point, purpose, actions, expected result, and correction.

Include a linked table of contents, nested PDF bookmarks for chapters and major workflows,
cross-references with working destinations, and a searchable text layer. Record app version,
UI source revision, fixture version, window size/Windows scaling, capture IDs, and corresponding
chapters in a manifest. Use stable screenshot names so later interface changes can be mapped to
affected pages. Any change to a documented control after capture requires a walkthrough recheck
and replacement of affected images before packaging; a version-only update still requires the
cover, metadata, and any screenshots showing the version to agree.

Completion and tests:

- Review the inventory against every sidebar section, editor field, menu, dialog, HUD section,
  and currently available control in the release build. Every item has a chapter/workflow and
  verification result; no unmerged feature is described as available.
- Follow the first-session tutorial from a fresh isolated profile. Then execute every focused
  walkthrough from its documented starting state, comparing DM, HUD, and saved results. Record
  pass/fail and corrections; verify backup restore and uninstall examples only on synthetic data.
- Render every PDF page to an image, enumerate all pages, and inspect each individually at
  readable resolution. Keep a page checklist for text, screenshots, captions, callouts, tables,
  margins, wrapping, contrast, and unclipped content. Contact sheets help navigation but do not
  replace individual page inspection. Correct failures, regenerate, and recheck affected pages
  plus the full final pagination/navigation after layout changes.
- Verify small screenshot labels at normal reading zoom, color/grayscale readability, font
  embedding, text search and selection, page numbering, and absence of blank/placeholder pages.
  Check every contents link, bookmark, and internal cross-reference reaches its intended heading.
  External optional links must be labeled; no essential instruction or image depends on them.
- Inspect the PDF in at least two available viewers, including the Windows default viewer.
  Open with networking disabled and confirm every page/image/navigation element works locally.
- Reconcile PDF and Markdown companion wording against actual behavior. Keep editable source,
  approved images, build instructions, and manifest with the app's source for future updates.

### Milestone 6 — combined regression, installations, and review

**September 16 status:** Verification is in progress. The installer regression now includes
passive/hybrid definitions, independent reminder states and HUD settings, and replacement of
a deliberately different old guide in a custom folder with spaces and a non-ASCII name.
Its actual installation run is blocked by Windows Application Control. Interactive PDF-reader,
offline installation and physical TV checks remain open; the user cannot test the TV now.
The [release check record](PASSIVES_AND_GUIDE_RELEASE_CHECKS.md) distinguishes automated
evidence, earlier installed-copy checks, and checks that still need a suitable environment.

**Verification follow-up:** The save fixture and assertions are now shared with the independent
`upgrade-data` desktop scenario, which passes a real close/reopen cycle without an installer.
It verifies reminder Undo/spending protection, complete saved content, personal HUD settings,
guide handoff, update opt-out and cleared messages. The installer harness also reports launch
failures promptly. The user has no second Windows test PC or signing certificate available;
the installer and manual reader/TV checks remain separate outstanding requirements.

Run required project checks and the full native suite on the final combined source. Test with
isolated synthetic saves, including old-format parties through format 10 upgraded to format 11, inactive players,
unused libraries, distinct individual settings, a previous save, and update preferences. Compare
expected complete content after first launch, save/reload, export/restore, Undo, and recovery.
Preserve IDs and values while accounting for the intentional format/default-field migration;
do not expect migrated JSON bytes to be identical. For installer-only copying before the app
loads/migrates data, require byte-for-byte preservation of the existing files.

Extend the installed-update harness for the final guide and passive fixtures. Installation
opening must be tested in a real Windows desktop session, not only by checking the path string.

| Installation/opening case                                                           | Completion check                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh install in the ordinary per-user folder                                       | With networking disabled, open Setup & help and its guide link; confirm the default viewer displays the bundled, matching-version PDF.                                                                    |
| Fresh custom installation on another drive, with spaces and a non-ASCII folder name | Open from the shortcut and executable, with an unrelated working directory. The exact installed PDF opens; no default-folder copy or source-checkout file is used.                                        |
| Existing version updated in a custom folder                                         | Guide is included/replaced with the new version, the same shortcut reopens the same updated app, and saves/settings survive. Include missing/stale installation-path records supported by existing tests. |
| More than one isolated installed test copy                                          | Each running app opens its own guide; changes to current directory or another copy do not redirect it.                                                                                                    |
| Missing/unreadable PDF or unavailable viewer                                        | Show a recoverable message, retain normal app operation, and retry successfully after the test fault is repaired. Do not alter the user's default associations to simulate failure.                       |

Compare the installed PDF hash with the approved generated PDF, check its cover/metadata against
the running app version, and inspect the final artifact's page count and navigation. Exercise
an update with an intentionally different synthetic old guide to prove replacement rather than
mere file presence. Verify ordinary uninstallation removes bundled program documentation while
preserving saves by default; exported backups remain outside the program folder.

Before a pull request, run the formatting and checks required by [contributing](../CONTRIBUTING.md),
including `npm run check`, `npm run format:check`, and `npm run test:native`. Packaging changes
also require `npm run test:installed-update` and the fresh-install cases above. Format only
intended changes while pre-existing drafts remain uncommitted; review the resulting diff.
Record the actual Windows/TV/scaling configurations, PDF viewers, all-page review record, and
walkthrough results. Any untested required configuration stays an explicit release blocker.

Update architecture, release instructions, Markdown guide, roadmap status, and changelog to
match implemented and verified behavior. Create focused roadmap-linked issues when implementation
is scheduled. A later reviewed merge and deliberate app release remain separate actions; this
planning session does not publish a version or update the working installation.

## Passive behavior — proposed policy

| Situation                                                    | Recommended result                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Always-applicable passive                                    | Assigned and readable in Passives, labeled Always applies; no Use button, turn cost, or switch. It documents the player's own rule text.                                                                                                       |
| Conditional passive                                          | Remains assigned whether Active or Inactive. Optional state switch is a reminder for this character only; text stays readable in either state.                                                                                                 |
| Hybrid ability                                               | One definition/assignment, separate passive and active text/views. Only the active view can spend costs. A passive switch neither enables nor disables active use.                                                                             |
| Active effect should require a circumstance                  | Describe the prerequisite in user text and adjudicate it manually. Automatic gating based on a passive switch is outside this pass.                                                                                                            |
| Active part is spent or marked unavailable                   | Passive text/state remain visible and independent; no Spent/Ready label is inherited by its passive view.                                                                                                                                      |
| Turns, short/long rests, or concentration changes            | Preserve passive reminder states. Do not infer durations, rest resets, equipment, HP thresholds, or concentration dependencies from descriptions.                                                                                              |
| Existing concentration-bound entry is changed to Passive     | Require the DM to resolve current bindings first; do not silently end concentration. The passive-only entry is then excluded from concentration selection. Hybrid active effects keep existing concentration support.                          |
| Remove from party and rejoin, save/reload, or backup restore | Preserve assignment IDs, shared text, personal reminder states, costs, unavailable flags, and HUD settings. Restore uses the states saved in that backup.                                                                                      |
| Remove an ability assignment                                 | Remove that character's passive state with the assignment; keep the shared definition. Undo restores the assignment and prior state. Reassigning later creates a fresh assignment with the documented default.                                 |
| Behavior/tracking setting changes                            | Keep text and dormant personal settings, show only applicable controls, and preserve a valid detail selection. A never-tracked assignment starts Inactive when tracking is first enabled.                                                      |
| Condition versus passive                                     | A condition is an applied status from Condition library; a passive is an owned ability from Ability library. Both use manual text, but a passive can stay assigned while inactive. Neither creates/removes the other or calculates statistics. |

Concrete acceptance example: assign original homebrew **Lantern sense** to Mira and Rowan, with
the description “While carrying your lantern, you notice the marker described by the DM.” Enable
conditional tracking; both begin Inactive. Mark Mira Active from her HUD. Rowan remains Inactive,
and both characters' HP, AC, actions, slots, charges, and conditions are unchanged. Rename the
shared ability; both names update without changing their states. Rest, remove/rejoin, and restart
retain the states. Undo the switch within the session restores only its expected snapshot behavior.

For a hybrid **Watchkeeper**, write a passive reminder and a separately labeled active “Signal”
effect that costs a reaction and one of that character's charges. Reading either side or changing
the reminder spends nothing. Using Signal spends those configured active costs once and leaves
the passive state alone. A second use without a reaction is unavailable, while the passive remains
readable. Do not ship these examples as preloaded rules; use them in the guide and test fixtures.

## Illustrated guide — proposed coverage inventory

Every chapter should explain intended use, identify the relevant controls in a readable image,
and provide a practical procedure with observable results. Expand this inventory into a complete
control checklist against the release candidate; chapter names alone do not prove full coverage.

| Chapter/workflow                                | Required coverage and illustrated example                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome and quick orientation                   | What Tablelight tracks, what remains manual, DM laptop versus TV, local/offline use, version identification, manual rules entry, and how to navigate the PDF.                                                                                                                                        |
| Install, open, and prepare displays             | Installer folder choice, portable-user transition, launch/shortcut, Windows Extend, choose the TV, show/hide overlay, first-launch hidden state, display disconnect/reconnect, and scaling.                                                                                                          |
| Guided first session                            | From an empty profile: create two original sample players, assign shared abilities and a passive, configure a resource, arrange rotated HUDs, run turns, use an ability, toggle a reminder, correct a mistake, export, and reopen. Show expected changes on both screens.                            |
| Players, party, and sidebar                     | Create/edit/delete, active-party maximum, saved roster, search/filter/paging, independent scrolling, add/remove/rejoin versus permanent deletion, initiative order, selection, and preservation of character state.                                                                                  |
| Character editor and Sheet                      | Identity/level, portrait, color and other released appearance settings, HP/temp HP/AC/speed, ability scores, proficiency, skills/saves/expertise/overrides, casting selection and attack/DC overrides, spell slot None/Cantrip/levels, and notes privacy.                                            |
| Resources and costs                             | Create/edit/remove pools, max/current, shape/color, short/long/turn/manual reset rules, links and charges per ability, standard versus custom spell pools, slot selection, spending and corrections, concurrent editor changes, and protected removal.                                               |
| Shared ability library                          | Create/search/filter/edit, assignment preview and choosing existing, shared versus personal fields, unavailable state, remove versus delete, protections, all released metadata fields, long details/paging, and propagation to inactive players.                                                    |
| Passives and mixed effects                      | Always versus conditional, shared tracking choice versus personal switch, no Use or action cost, hybrid's two views, active costs versus passive state, explicit manual effects, and contrast with conditions/concentration. Use Lantern sense and Watchkeeper.                                      |
| Run combat and make corrections                 | Initiative entry/sort/manual order, Start/Next turn, movement and action/bonus/reaction controls, ability and slot/resource use, HP/damage/healing/temp HP, single/party rests with exact reset rules, availability flags, Undo limits, and manual correction examples.                              |
| Concentration and condition library             | Concentration checkbox, choose/change/end, use warnings and Cancel, automatic selection after successful use, damage reminder with manual outcome, shared condition creation/edit/search/assignment/removal/deletion, TV choosing existing only, and persistence through rests.                      |
| Player HUDs, Currently displayed, and TV layout | Every released section; DM-to-TV and TV-to-DM selection; description/list pages; condition/resource page controls; show/hide/expand/collapse; multiple HUDs; position, free/snapped rotation, scale, preview, automatic arrangement, opacity/expansion settings, click-through, and map interaction. |
| Setup & help and keyboard controls              | Remaining setup text, guide link, license, each keyboard shortcut and its context, backups/path, update controls, and display tips. Show the finished help interface with the link.                                                                                                                  |
| Save, restore, update, and uninstall            | Automatic and previous-save recovery, complete backup contents, moving computers, restore replacement/confirmation/Undo, app/save version compatibility, update offer/Later/cancel/manual/opt-out/errors, custom-folder retention, offline behavior, and both uninstall save choices.                |
| Troubleshooting and reference                   | Hidden/covered/offscreen HUDs, wrong display, too-small text, click-through confusion, spent/unavailable active abilities, inactive passives, shared edits affecting others, save/open/update errors, missing viewer, shortcuts, glossary, and a quick session checklist.                            |
| Other features actually included in the release | Already merged: Reference/Upgrades, revised manual ability fields, local copies, approval requests/History/targeted undo, uploaded icons, class themes, and player messages. Cover their actual shipped behavior; do not restore the rejected automatic ability-value proposal.                      |

## Design defaults and decisions for later milestones

Milestone 1 uses the following passive-data defaults. Visible controls, final guide design,
and release work remain subject to their later milestones.

1. **Behavior and hybrid design:** adopt Active / Passive / Passive + active independently of Type,
   with one shared definition and assignment, separate hybrid text, and linked views? Recommend
   excluding passive-only entries from all ordinary action/spell/feature use lists, while the
   library can still filter by their underlying Type.
2. **Conditional tracking:** include the optional shared tracking choice and per-character
   Active/Inactive switch, initially Inactive, usable by both DM and an interactive player HUD?
   Recommend persistent manual state, no automatic resets, no statistics changes, and no gating
   of a hybrid's active effect. DM-only switching would be an alternative if preferred.
3. **Conversion and concentration:** preserve dormant text/costs/personal settings, restrict
   concentration controls to active effects, and block conversion while a current concentration
   binding needs explicit resolution? This avoids silent loss while keeping passive use impossible.
4. **Save compatibility and release scope:** Milestone 1 uses format 11 and imports 1–10.
   The earlier ability-details and visual work is already merged. Recheck any further changes
   before the final guide capture and choose the release version during release preparation.
5. **Guide label, filename, and packaging:** approve Open illustrated user guide (PDF, offline),
   `docs/Tablelight-User-Guide.pdf`, opening that copy under the running app's program files,
   and retaining the shorter Markdown/START HERE companion? Opening requires a local PDF viewer;
   a built-in viewer is outside this proposal.
6. **Guide design and completeness:** approve US Letter portrait, large readable screenshots,
   linked contents/bookmarks, versioned editable source/assets, synthetic examples, the complete
   coverage inventory, and final capture after interface freeze? Choose another page size now if
   preferred. Recommend coverage and readability as the acceptance measure, with no fixed page cap.
7. **Release checks:** require completed passive regressions, every-page visual inspection, every
   walkthrough checked against the release build, and real ordinary/custom-folder offline opening
   plus an update test before the feature is considered ready?

Across every milestone, keep user-authored text in the shared library, individual state on each
character's assignment, and live values on the character. Preserve existing saves, both libraries,
inactive players, independent settings, stale-editor merging, Undo/save recovery, escaping, checked
IPC, and omission of private DM notes/unused libraries from player broadcasts. Preserve current HUD
layout/pagination and stored placement/rotation. Automatic passive statistics or rules interpretation,
new condition automation, and unrelated roadmap implementations are outside these features.

First commit: **Milestone 1 — passive behavior, shared data, and save compatibility**,
authorized September 15, 2026. It establishes the distinction between
passive state and active spending, protects existing saves, and gives both interfaces a consistent
foundation. Outline the guide at this stage; capture its final screenshots after Milestone 4.
