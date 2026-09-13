# Ability details and DM review — proposed plan

Status: the user authorized the first commit, Milestone 1 (F05), on September 13, 2026.
Source references are implemented locally; later milestones and their open decisions await approval.
Milestone 1 verification: 79 unit tests and all 16 native scenarios pass, along with syntax and
formatting checks. Source screenshots were reviewed on a 2560 × 1440 primary display, with
1440 × 950 DM test windows, 0°/180° player HUDs, and a maximum-length source in the fixed frame.
Prepared September 13, 2026 against `main` at `4b44cf49675e99f599ecb69398a042a76fdef232`
(Tablelight 1.10.2 source).

## Branch setup completed

1. Checked the source checkout, current branch, untracked files, and stashes. It was on `main`,
   with no uncommitted changes, untracked files, or stashes. Existing ignored local files were
   left in place. No reset, cleanup, or stash was needed. For a future dirty checkout, inspect
   the changes first, then preserve intended work in a commit on its existing branch or a
   clearly named stash including untracked files; verify that preservation before switching.
   Keep ignored saves and backups in place, and never include them in a source commit.
2. Fetched GitHub's current branches. Local `main` and `origin/main` matched exactly at the
   commit above, including the latest roadmap update. No merge was necessary. If local `main`
   were simply behind, use a fast-forward-only update; if it had diverged, preserve its commits
   and examine the difference before choosing a merge or rebase.
3. Created and switched to `codex/ability-details-and-review`. The name covers the shared
   ability details and the DM's review of a use, including targeted undo.
4. Published that exact commit as the new GitHub branch through the connected GitHub account
   after a direct Git push stalled at credential authentication. Fetched it back and configured
   local tracking. Verified the active branch and zero commits ahead or behind its remote.

GitHub branch: [codex/ability-details-and-review](https://github.com/Rouster67/Tablelight/tree/codex/ability-details-and-review).
This records the initial planning session. The plan was subsequently merged into `main` in PR #9.
The first feature commit starts from that updated `main` at `18da5af`. It adds F05 only; no
application release, installed program, or real saved party is changed.

## What the current project already provides

- [Roadmap](ROADMAP.md): F05 and F08 are planned candidates; F07 and F10 still need design
  decisions. F07 already acknowledges the existing character spellcasting editor.
- [Core state](../core.js): shared definitions are copied into each character's abilities for
  display. Backups store definitions once and retain separate assignment IDs, resource links,
  costs, and availability. Saves use format 4 and accept formats 1–4.
- [Library editor](../library-ui.js): shared changes reach active and inactive characters.
  Character-specific settings already have a separate “For [character] only” section.
- [Controller](../controller.js): the character already has a casting ability and optional
  spell attack/DC overrides. DM and HUD uses reach the same spending function. Session Undo
  currently restores one of up to 40 complete state snapshots.
- [HUD rendering](../hud.js): DM details and HUD details share metadata, but render their
  description bodies separately. HUD paging currently counts only the main description.
- [Architecture](ARCHITECTURE.md): the DM owns changes; saves are queued and broadcast after
  disk saving. HUD commands use a checked bridge through the main process. Expanded HUDs remain
  880 × 650 CSS pixels before scaling, with bounded scrolling and saved position/rotation.

The existing unit test suite passed during planning. Native UI scenarios were reviewed but
were not run during this branch/planning session.

## Recommended order and milestones

Use F05 → F08 → F07 → F10. F05 establishes the shared details path with a small visible change.
F08 extends that path to a second long text section. F07 then supplies consistent character
values. F10 consumes those completed details and adds a separately tested record of each use.
F09 icons, automatic effects, and a general formula engine are outside this plan.

### Milestone 1 — F05 source references and shared details

Add one optional, free-form Source field to shared definitions, proposed maximum 300 characters.
Render it in DM ability details, library assignment previews, and HUD details; hide the row when
blank. Include it in library search. Use escaped plain text. Do not add a URL field yet.

User refinement: label the field simply Source and place it below the description in the editor.
Show the reference below the description at the bottom right of the ability details on both screens.

Create a small shared ability-details helper that produces ordered labels and text sections.
The DM, HUD, and later notices will use that same content, with layouts suited to each screen.
Keep existing descriptions, attack/save text, cost controls, and spending behavior intact.

Completion and tests:

- Create, edit, clear, save, reload, export, and import a source reference.
- Edit one shared ability assigned to two characters, including an inactive roster character;
  both receive the reference while their resources, availability, and assignment IDs stay intact.
- Load old saves with a blank default; preserve exact-content migration and distinct same-name
  definitions. Verify quotes, long text, and HTML-like text display as text.
- Check DM details, assignment preview, and a rotated HUD with fixed dimensions and reachable
  navigation. Extend library unit/native scenarios with synthetic text.

### Milestone 2 — F08 upcast and upgrade text

Add one optional shared multiline “Upcast / upgrades” field, proposed maximum 40,000 characters,
matching the main description limit. Allow it for spells, cantrips, actions, and features.
Keep the original description untouched. Show the new section after it when populated.

Extend the shared text sections and HUD page count together so both descriptions are reachable,
including when the main description is blank. Retain section labels across pages and preserve
the existing internal scrolling. Selected casting level remains a separate fact; the first
version does not interpret, highlight, calculate, or apply the upgrade text.

Completion and tests:

- Empty, short, and maximum-length upgrade text survive shared editing and backup round trips.
- DM and HUD show identical content, with correct paging for either or both text sections.
- Editing text while a later page is open clamps invalid page selections without changing HUD
  size, position, scale, rotation, or another character's selection.
- A higher-slot use still spends the selected slot normally; damage, healing, and other effects
  remain manual. Add long-text native coverage with long words and synthetic paragraphs.

### Milestone 3 — F07 character values and personal exceptions

Keep three separate fields: Attack bonus, Save DC, and Target saving throw ability. A target's
Dexterity save does not select the caster's calculation stat. Attack and save settings are
independent, supporting either, both, or neither.

Recommended initial modes for attack and DC are None, Auto — character spellcasting, and Fixed
number. Auto uses the existing character value, including that character's spell attack/DC
override; otherwise reuse proficiency and the selected ability modifier. Avoid a second copy
of that calculation. Newly enabled attack/DC fields default to Auto. Do not infer applicability
from “Spell,” because many spells use neither value.

The shared definition supplies the defaults. Each character's assignment can inherit them or
override attack and DC independently with None, Auto, or Fixed. Allow an inherited or overridden
target saving throw ability for character-specific variants. Clearing an override restores
inheritance. Label shared settings and personal exceptions clearly in the editor.

Preserve existing attack/save strings exactly as descriptive notes. Migrate old entries to a
legacy-text presentation until deliberately configured; never parse a string into a guessed
number, stat, or formula. In the unassigned library, show Auto without inventing a character
value. With a character, show the resolved values; DM details also explain the calculation or
which override supplied it. A shared fixed value overrides the character calculation; an
assignment override takes precedence over the shared setting.

Completion and tests:

- One definition yields different Auto numbers for two characters. Changing one character's
  casting stat, proficiency, or character-wide override updates only applicable Auto values.
- Cover shared fixed values, independent personal overrides, clearing overrides, None, both
  attack and save, zero/negative attack values, and target save stat independent of casting stat.
- Preserve legacy notes, active/inactive assignments, slots, charges, HUD choices, and existing
  text through reload, export/import, shared edits, and old-save migration.
- Update the explicit assignment backup whitelist and normalization together so new personal
  fields cannot disappear on saving. Test saving a stale editor after intervening HUD spending.
- Check identical resolved numbers across DM and HUD, including a clear DM breakdown.

### Milestone 4 — F10 records of actual uses and targeted undo logic

Before adding the notice interface, make a successful use produce one uniquely identified record
inside the authoritative DM change. Record the character/assignment/library IDs, sequence,
origin, selected casting level, ability details and resolved numbers at that moment, exact costs
actually deducted, and concentration before/after. Record custom pool IDs and names, slot level,
and which turn control changed. Free uses explicitly have no costs.

The record describes the actual state change, not the current library's advertised cost. Later
library edits or character calculations must not rewrite old notices. Capture DM uses internally
too so subsequent changes can be checked, while initially opening notices only for HUD uses.
Do not store whole characters, portraits, or DM notes in these records.

Use stable request/use IDs to prevent replay from charging twice. Validation failures and
canceled concentration warnings produce neither costs nor a successful-use notice. Coordinate
the record with the existing save queue: distinguish a pending/failed save from a rejected use;
retrying a save or receiving a late acknowledgement must not replay spending or duplicate notices.

Targeted undo validates the chosen record, then reverses only its recorded costs and, when safe,
its concentration change. It never restores an old whole-character or whole-session snapshot.
Use the policy below, and commit a successful reversal atomically with the record's undone state.

Completion and tests:

- Test use → later actions → undo by comparing the entire expected state: only the selected
  use's costs/concentration and record status may change.
- Test duplicate commands, two rapid undo requests, missing assignments/characters/resources,
  failed saving, retries, and concentration warning cancellation before adding the notice UI.
- Test every later-action case in the policy table, including both orders of undoing two uses.

### Milestone 5 — F10 DM notice queue

After a successful HUD use, automatically reveal a DM review panel with the acting character,
use time/order, shared details captured at use time, casting level, and a separate “Spent” list.
Show concentration changes separately from costs. Provide Undo this use, Acknowledge/Next, and
Close. Close hides the panel without refunding or acknowledging; keep a pending count visible.

Keep notices in arrival order. New arrivals never replace the notice being read. If the DM has
an editor, confirmation, or update prompt open, increment the pending count and defer automatic
opening until it is safe. Preserve drafts, text focus, and scrolling. Acknowledged notices stay
available in session history; acknowledging does not affect undo eligibility. Avoid a short-lived
toast as the only way to review or undo.

Completion and tests:

- Several players use abilities rapidly: no lost/duplicated notices, correct order and costs,
  one selected notice retained, and correct unread count.
- Use while editing a character; confirm the draft survives and later saving it preserves costs.
- Use → shared edit → review still shows the old use's original text, values, and pool cost.
- Test close, reopen, acknowledge, undo, conflicts, removed party members, and save failure.
  Verify notices remain DM-only and the player HUD geometry stays unchanged.

### Milestone 6 — combined regression and review

Run the project checks and relevant native scenarios, then the full required native suite before
a pull request. Use isolated synthetic saves, never the real party file. Verify migrations from
formats 1–4, linked definitions, inactive roster, backup recovery, independent values, stale
editors, concentration, and simultaneous HUD actions.

Check 0°, 90°, 180°, 270°, and an angled HUD at multiple scales, both interactive and click-through,
with long descriptions and upgrades. Preserve the 880 × 650 base frame, stored placement/rotation,
column scrolling, DM preview, navigation, and map clicks outside the HUD. Document actual display
configurations checked. Update architecture, user guide, roadmap progress, and changelog to match
implemented behavior. Publishing an app release remains a separate action.

## Targeted undo after later actions — proposed policy

Record a revision for each affected turn control, slot level, resource pool, and concentration.
Distinguish later recorded spending from resets or corrections. Equal current values alone do
not prove safety: a rest can return a pool to the same number for a different reason.

| What happened after the use                                                           | Recommended result                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Another character acted, or HP, movement, notes, conditions, or HUD placement changed | Undo the selected use; leave those later changes intact.                                                                                               |
| Another tracked use spent the same pool or slot level                                 | Add back only the selected use's recorded amount, preserving later spending, if no relevant reset/correction occurred and it fits the current maximum. |
| A different pool changed                                                              | Remains undoable; do not invalidate unrelated counters.                                                                                                |
| A relevant pool/slot was restored, rested, manually adjusted, resized, or deleted     | Block automatic undo for that use with a specific reason; do not guess or silently cap a refund.                                                       |
| The relevant turn control was refreshed or manually toggled                           | Do not reopen that control for an earlier turn; block automatic undo for that use.                                                                     |
| Concentration still belongs to this use and its previous selection is valid           | Restore the recorded prior concentration, including legacy text when applicable.                                                                       |
| Concentration changed later, even if it now has the same name                         | Block undo that would overwrite it. A use that never changed concentration can still be undone.                                                        |
| Character moved into the inactive roster                                              | Find the same character by stable ID and apply the same checks.                                                                                        |
| Character was deleted, or a required assignment/reference is no longer valid          | Keep the notice readable; disable automatic undo with a reason.                                                                                        |
| This use was already undone                                                           | No second refund. Display Undone.                                                                                                                      |

Recommend all-or-nothing automatic undo for the first version: if any tracked component cannot
be safely reversed, change nothing and explain the conflict. The DM can make a deliberate manual
correction with existing controls. Partial refunds would require an additional design and a
clear per-component result; they must never be labeled as a complete undo.

Concrete acceptance example: start with five charges. Use A spends two, leaving three. Later
free-action use B spends one, leaving two, and someone loses HP. Undo A leaves four charges,
keeps B spent, and preserves the HP loss. Undo B afterwards leaves five. A second undo of A
changes nothing. If a rest or manual correction touched that pool between A and undo, automatic
undo is blocked instead. Repeat the sequence with same/different slot levels and characters.

Session Undo must remain coherent with targeted undo. Pair its existing state snapshots with
the session use-record and revision state. Ordinary Undo of a use marks/removes its receipt
appropriately; ordinary Undo of a targeted reversal restores both the spending and eligibility
together. Test this interleaving so an old snapshot cannot create a double refund or a false
Undone label. Transport request deduplication must not be rolled back with gameplay history.
Acknowledgement alone should neither enter gameplay Undo nor reopen notices when gameplay is undone.

## Decisions to approve before coding

1. **Text fields:** adopt one plain Source field (including library search) and one plain multiline
   Upcast / upgrades field, without links, level rows, or automatic highlighting initially?
2. **F07 scope:** adopt None / Auto spellcasting / Fixed plus personal overrides for this pass?
   This supports manual weapon/homebrew exceptions. A selected alternate stat, proficiency toggle,
   and additional bonus could be a later explicit formula mode; decide now if those are required
   for the first version. Do not attempt to infer weapon, finesse, multiclass, or homebrew rules.
3. **Undo conflicts:** approve tracked additive refunds after later spending, but all-or-nothing
   blocking after relevant resets/corrections, turn refresh, or concentration replacement?
4. **Notice behavior:** approve a queued review panel, explicit acknowledgement, close without
   acknowledgement, and automatic notices for HUD uses only?
5. **Lifetime:** recommend session-only notices and undo records initially, ending at restart or
   backup restore. Keep them outside exported party content. Do not silently discard unread
   notices; use bounded visible pages. If a memory limit is later necessary, expose retention and
   expire eligibility explicitly. Persistent audit history requires a separate storage decision.
6. **Save compatibility:** recommend a new save-format version when first writing these fields,
   while accepting formats 1–4. Current 1.10.2 normalization drops unknown fields, so retaining
   format 4 would allow an older app to silently lose new text/overrides. Update reader/writer,
   guards, fixtures, and documentation together; resolve whether F05 and later fields share the
   next release before choosing the exact version steps. Old saves must load without loss;
   older apps should reject newer-format saves clearly.

Across every milestone, keep shared text in the library, personal exceptions in assignments,
and live counts on the character. Extend validation, migration, serialization, and stale-editor
merging together. Resolve display values at reading/use time, never store one character's Auto
numbers back into a shared definition. Preserve escaping, narrow checked IPC, save recovery,
and omission of private DM notes and unused libraries from the overlay.

Recommended first milestone: **Milestone 1 — F05 source references and shared details**, once
this plan and its initial decisions are approved. It is small enough to review on both screens
and establishes the rendering and save compatibility work needed by the later milestones.
