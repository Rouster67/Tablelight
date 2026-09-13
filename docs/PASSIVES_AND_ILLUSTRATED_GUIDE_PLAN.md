# Passive abilities and illustrated user guide — proposed plan

Status: awaiting the user's approval. This document does not authorize feature implementation.
Prepared September 13, 2026 against `main` at `4b44cf49675e99f599ecb69398a042a76fdef232`
(Tablelight 1.10.2 source). The release version for this work has not been chosen.

## Branch setup completed

1. Checked the source checkout, branches, remotes, working folders, changes, and stashes.
   `D:\Repos\Tablelight-source` was on `codex/ability-details-and-review`. It had a modified
   `docs/ROADMAP.md` and an untracked `docs/ABILITY_DETAILS_PLAN.md`; there were no stashes.
   Read both documents, including the roadmap's local F13 addition and F11 removal. Those
   edits were existing work, not changes made by this session.
2. Fetched GitHub's branches and confirmed local `main` and `origin/main` matched at the
   commit above. Copied the two unfinished documents into the ignored local folder
   `backups/branch-setup-passives-guide-20260913-125627`, with a record of their original
   branch and commit. Verified the copies against the originals by file hash.
3. Switched to `main` and performed a fast-forward-only update; Git reported Already up to
   date. The documents stayed in place because the old branch and main had identical committed
   contents. An additional untracked `docs/VISUAL_IMPROVEMENTS_PLAN.md` appeared during setup;
   preserved and verified a backup of that document too. No reset, cleanup, stash, or commit
   was needed. The separate `work/visual-improvements` working folder was left intact.
4. Created and activated `codex/passives-and-illustrated-guide` from verified main. This name
   describes both the passive-ability behavior and the illustrated documentation deliverable,
   and remains appropriate during implementation and review.
5. Published that exact starting commit through the connected GitHub account, fetched it back,
   and set local tracking to `origin/codex/passives-and-illustrated-guide`. Confirmed the source
   folder's active branch and zero commits ahead of or behind GitHub. Main, the new branch,
   and both corresponding remote branches all matched the recorded commit.

GitHub branch: [codex/passives-and-illustrated-guide](https://github.com/Rouster67/Tablelight/tree/codex/passives-and-illustrated-guide).
The branch is published; this proposed plan is saved locally and is not committed or published.
The existing documents remain uncommitted alongside it. No feature code, roadmap status,
installed application, release, or real saved party was changed.

For the next work session, check the active branch and working changes again before editing.
The backup folder preserves the earlier drafts but does not attach uncommitted files to a branch.
If committed contents differ during a future switch, first preserve intended work with a focused
commit on its own branch, a named stash including untracked files, or a separate working folder.
Verify that preservation before switching. Keep ignored saves and backups out of source commits.
If main has diverged, examine and preserve its commits instead of resetting it or forcing a push.

## What the current project already provides

- **Merged earlier work:** Git history confirms F06 concentration reminders, replacement warnings,
  and automatic concentration selection in [PR #2](https://github.com/Rouster67/Tablelight/pull/2);
  F03 version display and F04 Windows installer/updater in
  [PR #3](https://github.com/Rouster67/Tablelight/pull/3); the custom installation-folder update
  fix in [PR #5](https://github.com/Rouster67/Tablelight/pull/5); and the optional uninstall
  saved-data choice in [PR #7](https://github.com/Rouster67/Tablelight/pull/7). The roadmap and
  changelog record releases 1.10.0, 1.10.1, and 1.10.2 respectively. Main also includes the
  roadmap update in [PR #8](https://github.com/Rouster67/Tablelight/pull/8).
- **Still planned:** F01 remains Considering and F13 Planned candidate in the local
  [roadmap](ROADMAP.md). The existence of the ability-details and visual-improvements branches
  does not mean their features are merged. F05/F08 text fields, F07 ability-level calculated
  values, F10 review/targeted undo, F09 icons, F12 themes, and F02 messages are still planned
  on this baseline. Character spellcasting selection and character-level attack/DC overrides
  already exist; they are not the full F07 proposal.
- [Core state](../core.js) and [architecture](ARCHITECTURE.md): ability definitions are shared;
  assignments keep separate IDs, resource links, costs, and unavailable flags. Normalization
  copies shared display fields into each character. Backups store definitions once and explicitly
  whitelist assignment fields. Saves write format 4 and accept formats 1–4.
- [Library editor](../library-ui.js): a shared edit reaches active and inactive characters.
  Character-only settings are labeled separately. Existing assignment/deletion protections,
  exact-content migration, and changed-field merging must extend to the new fields.
- [Controller](../controller.js), [HUD](../hud.js), and [HUD controls](../hud-controls.js): DM and
  player uses reach the same spending logic. Type and turn cost are separate, but every current
  ability is presented as usable. A free/other ability can still spend charges, slots, or affect
  concentration; it is not equivalent to a passive. Shared section choices also drive the DM's
  Currently displayed controls.
- **Conditions:** a separate shared condition library provides name/description definitions;
  characters record applied condition IDs. Conditions are applied and removed, stay through
  turns/rests, and do not automatically calculate statistics. Concentration has its own tracker
  and assigned-ability binding. Neither should be repurposed as passive state.
- **Fixed HUDs:** expanded frames remain 880 × 650 CSS pixels before scaling, with bounded
  scrolling in two columns. Position, rotation, scale, visibility, expansion, section, and detail
  selection belong to each character. The DM preview shares the rendering path; native input
  regions preserve map clicks outside rotated HUDs.
- **Help and packaging:** `renderHelp` in the controller contains the three named headings and
  paragraphs. [The current written guide](USER_GUIDE.md) is extensive text without screenshots
  or a PDF. [Packaging](../electron-builder.cjs) already includes `docs/**/*` under
  `resources/app` and copies the Markdown guide to installation-root `START HERE.md`.
  [Main](../main.js) owns file access and checks DM-only requests through [preload](../preload.js).
- **Baseline verification:** JavaScript syntax checks and all 75 existing unit tests passed in
  this planning session using the bundled Node runtime. No new tests or feature code were written.
  Native UI, PDF, installer, and physical TV checks remain future implementation work.

## Recommended order and milestones

Implement F01's data rules, then its DM interface, then its player HUD. Outline F13 early, but
finish its screenshots and walkthroughs after both F01 and the final Setup & help interface work.
Add the guide-opening route and packaging before taking the final help screenshot; complete the
PDF and inspect the exact installed artifact before presenting the combined change for release.

F01 does not require the other planned branches to ship first. Coordinate shared schema,
ability-detail rendering, and HUD navigation with the
[ability-details plan](ABILITY_DETAILS_PLAN.md) and [visual plan](VISUAL_IMPROVEMENTS_PLAN.md).
Reuse their helpers if they merge first; do not implement their features as incidental work here.
If those features join this release, incorporate and test them before the screenshot freeze.
If they do not, the guide must describe only the available version. F13 depends on the final
release feature set, not on completion of every roadmap idea.

### Milestone 1 — passive behavior, shared data, and save compatibility

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
changing to Passive so existing personal settings are not discarded. Hide active controls and
cost summaries on passive-only entries. The authoritative spending path must reject a passive
use before changing anything, even if an old UI or crafted command attempts it.

Extend normalization, validation, exact-content definition comparison, attachment defaults,
assignment backup whitelists, active/inactive roster handling, and stale-editor merging together.
Choose the next save-format version with the other branches; do not independently assume all
of them can use the same new version with different meanings. Accept all previously released
formats, default missing passive fields safely, and reject unsupported future formats clearly.
Version 1.10.2 drops unknown fields, so writing new passive data as format 4 is not acceptable.
Preserve the save folder and atomic save/recovery behavior; exporting a pre-upgrade backup remains
the supported way to return to an older app.

Begin a guide coverage checklist from the inventory below, recording the expected release scope
and sample workflows. This is an outline only; final screenshots depend on later milestones.

Completion and tests:

- Old format 1–4 fixtures load as Active with original text, IDs, costs, libraries, conditions,
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
  toggle only one assignment, remove one assignment, and verify protected library deletion.
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

Add Passives to the shared HUD section choices and DM Currently displayed controls. Put the new
choice next to Features, with navigation contained inside the existing frame. Determine the
precise spacing with the actual fixed HUD; keep labels reachable without increasing its width
or height or reducing the existing portrait/summary to make room.

Use the same passive/hybrid content and status rules on the expanded HUD and DM preview. Extend
detail/page counts for the correct effect text, including a hybrid whose active description is
empty. Preserve both column scroll positions during unrelated updates; clamp pages after edits.

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
  and maximum scale. Verify the 880 × 650 base frame, saved placement/rotation, independent
  players, expanded/collapsed transitions, DM preview, and reading position.
- Test zero/one/many passives, maximum text, long unbroken words, and both hybrid descriptions.
  Keep navigation and switches inside the frame with readable labels and reachable click targets.
- Verify interactive and click-through modes, map clicks outside rotated HUDs, hidden players,
  and mode changes while a passive detail is open. Check native dimensions and screenshots.
- Run unit and relevant native library, session, concentration, interaction, and fixed-HUD
  scenarios with synthetic data. Verify the behavior policy below, including rests and Undo.

### Milestone 4 — guide authoring setup, help link, and packaging

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

Run required project checks and the full native suite on the final combined source. Test with
isolated synthetic saves, including a format-4 party upgraded to the new format, inactive players,
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

| Chapter/workflow                                | Required coverage and illustrated example                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome and quick orientation                   | What Tablelight tracks, what remains manual, DM laptop versus TV, local/offline use, version identification, manual rules entry, and how to navigate the PDF.                                                                                                                                   |
| Install, open, and prepare displays             | Installer folder choice, portable-user transition, launch/shortcut, Windows Extend, choose the TV, show/hide overlay, first-launch hidden state, display disconnect/reconnect, and scaling.                                                                                                     |
| Guided first session                            | From an empty profile: create two original sample players, assign shared abilities and a passive, configure a resource, arrange rotated HUDs, run turns, use an ability, toggle a reminder, correct a mistake, export, and reopen. Show expected changes on both screens.                       |
| Players, party, and sidebar                     | Create/edit/delete, active-party maximum, saved roster, search/filter/paging, independent scrolling, add/remove/rejoin versus permanent deletion, initiative order, selection, and preservation of character state.                                                                             |
| Character editor and Sheet                      | Identity/level, portrait, color and other released appearance settings, HP/temp HP/AC/speed, ability scores, proficiency, skills/saves/expertise/overrides, casting selection and attack/DC overrides, spell slot None/Cantrip/levels, and notes privacy.                                       |
| Resources and costs                             | Create/edit/remove pools, max/current, shape/color, short/long/turn/manual reset rules, links and charges per ability, standard versus custom spell pools, slot selection, spending and corrections, concurrent editor changes, and protected removal.                                          |
| Shared ability library                          | Create/search/filter/edit, assignment preview and choosing existing, shared versus personal fields, unavailable state, remove versus delete, protections, all released metadata fields, long details/paging, and propagation to inactive players.                                               |
| Passives and mixed effects                      | Always versus conditional, shared tracking choice versus personal switch, no Use or action cost, hybrid's two views, active costs versus passive state, explicit manual effects, and contrast with conditions/concentration. Use Lantern sense and Watchkeeper.                                 |
| Run combat and make corrections                 | Initiative entry/sort/manual order, Start/Next turn, movement and action/bonus/reaction controls, ability and slot/resource use, HP/damage/healing/temp HP, single/party rests with exact reset rules, availability flags, Undo limits, and manual correction examples.                         |
| Concentration and condition library             | Requires concentration, choose/change/end, use warnings and Cancel, automatic selection after successful use, damage reminder with manual outcome, shared condition creation/edit/search/assignment/removal/deletion, TV choosing existing only, and persistence through rests.                 |
| Player HUDs, Currently displayed, and TV layout | Every released section; DM-to-TV and TV-to-DM selection; description/list pages; both column scroll controls; show/hide/expand/collapse; multiple HUDs; position, free/snapped rotation, scale, preview, automatic arrangement, opacity/expansion settings, click-through, and map interaction. |
| Setup & help and keyboard controls              | Remaining setup text, guide link, license, each keyboard shortcut and its context, backups/path, update controls, and display tips. Show the finished help interface with the link.                                                                                                             |
| Save, restore, update, and uninstall            | Automatic and previous-save recovery, complete backup contents, moving computers, restore replacement/confirmation/Undo, app/save version compatibility, update offer/Later/cancel/manual/opt-out/errors, custom-folder retention, offline behavior, and both uninstall save choices.           |
| Troubleshooting and reference                   | Hidden/covered/offscreen HUDs, wrong display, too-small text, click-through confusion, spent/unavailable active abilities, inactive passives, shared edits affecting others, save/open/update errors, missing viewer, shortcuts, glossary, and a quick session checklist.                       |
| Other features actually included in the release | If merged into this release, fully cover source/upgrades, resolved character values, use notices/targeted undo, uploaded icons, class themes, and player messages. Otherwise omit their procedures and screenshots rather than presenting planned behavior as shipped.                          |

## Decisions to approve before coding

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
4. **Save compatibility and merge order:** agree the next supported format with the other plans,
   accepting older released saves and rejecting newer unsupported saves. Decide which other
   branches belong in this release before final guide writing/capture; do not pick a release
   version or encode a competing schema independently.
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
IPC, and omission of private DM notes/unused libraries from player broadcasts. Preserve fixed HUD
dimensions and stored placement/rotation. Automatic passive statistics or rules interpretation,
new condition automation, and unrelated roadmap implementations are outside these features.

Recommended first milestone: **Milestone 1 — passive behavior, shared data, and save compatibility**,
after this plan and its initial decisions are approved. It establishes the distinction between
passive state and active spending, protects existing saves, and gives both interfaces a consistent
foundation. Outline the guide at this stage; capture its final screenshots after Milestone 4.
