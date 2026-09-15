# Ability details and DM review

The ability-details branch was merged in PR #10. Its F10 proposal below is historical;
the agreed replacement is [DM approval queue and History](DM_APPROVAL_QUEUE_PLAN.md) on
`codex/dm-approval-queue`. Use that plan for current F10 requirements and milestones.

Current branch: `codex/ability-details-and-review`. The user committed the approved manual ability
fields as `7ff4a47` and duplication/local creation as `96f9648`. F05, F08, and the revised manual
F07 scope are complete. Assigned library deletion is the current approved follow-up. F10 still
requires separate approval.

**Working agreement:** Edit and test, then leave changes uncommitted. The user handles staging,
commits, and publishing. Never perform those Git actions automatically or switch branches.
Work one approved milestone at a time.

Manual-fields verification: all 90 unit tests and all 17 native desktop scenarios (175 checks) passed,
along with syntax, formatting, and diff checks. Reviewed the editor and DM detail screenshots at
1440 × 950. Native checks cover both player HUDs, shared edits after later spending, long text,
reloading saves, independent resource costs, fixed frames, rotation, and click-through behavior.

## Completed foundation

F05 added shared reference text, library search, and a shared detail renderer. F08 added a separate
long upgrade section and section-aware HUD paging. The editor places upgrades directly beneath
Damage / Healing. Reference remains below Description at the bottom right. Saves retain shared
definitions once and keep each character's resource binding and live counts separate.

## Approved manual ability fields

The user's field list is authoritative: Name, Type, Trigger, Duration, Range, Area, Casting Time,
Spell Level, Components, School, Attack, Save, On Save, Damage / Healing, Upcast / Upgrades,
standard spell-slot spending, Concentration, Reference, Description, linked resource pool,
charges spent per use, Requirements, and Special. No automatic ability calculations.

Attack, Save, and On Save are plain text. Type keeps the existing dropdown; Spell Level offers
None, Cantrip, and levels 1–9 on every type. Casting Time is plain text alongside the existing
Turn cost selector, preserving explicit action spending. A question about keeping that selector
was offered during implementation; the existing behavior is retained pending a different preference.
Resource links and per-use charges remain character-specific. The Concentration checkbox uses
the existing tracker. Blank fields are accepted and hidden in details; blank names use Unnamed ability.

Requirements and Special are long text sections. DM details, player HUDs, assignment previews,
and future notices use the same ordered metadata and sections. Reference follows the final
section. Long text stays reachable through paging and internal scrolling without resizing or
rotating a HUD.

Save format 9 accepts formats 1–8. Existing text and character state remain intact. For saves
written by the earlier calculation preview, only explicitly entered fixed values and selected
target abilities become text. Distinct personal manual exceptions become reusable library
variants; automatic modes are removed. No calculated number is written into a shared entry.

Completion checks:

- Create, edit, clear, save, reopen, export, and import every manual field for every type.
- Confirm the full field list, labels, checkbox behavior, upgrades placement, and Reference footer.
- Confirm changing character stats cannot change the entered Attack, Save, On Save, or damage.
- Check shared active/inactive characters, independent costs, exact legacy text, format 7
  transitions, and saving an editor after later HUD spending.
- Read all long sections in the fixed frame, with valid paging and preserved rotation/scale.
- Run unit, syntax, formatting, and native desktop checks. Update the installed review copy only
  after backing it up and checking saved-data preservation. Leave source changes uncommitted.

## Current milestone — library and character-only duplicates

Add Duplicate to library rows and a copy icon to each character ability row. Its tooltip is
Duplicate locally only. Arrange View, Use, copy icon, Edit on one line, with Remove underneath. Copies
receive numbered names and open for editing. Library duplication makes a new shared definition;
local duplication makes an independent character item that never enters the library. Local text,
standard-slot spending, resource links, and charge costs can all be edited independently.

The approved follow-up adds a person icon before every local ability name, plus two small
buttons in the character Add dialog: Create new local ability beneath Create new, and Create
local-only copy beneath Choose existing. Both explain their scope on hover. Blank local drafts
save only on confirmation; the library picker makes an independent local copy immediately and
allows abilities already assigned to that character. Shared choices keep their existing behavior.

Completion checks: preserve copied details and original values; increment colliding names; support
duplicating existing copies, removal, and ordinary Undo; preserve inactive-roster copies, save
recovery, export/import, and character editors after later HUD spending. Verify the two-special-
casts example: each local use spends one charge, original uses spend slots, and a long rest restores
the selected pool. Shared edits cannot rewrite the local copy. Format 9 accepts formats 1–8 and
keeps explicit local definitions outside library migration. HUD size and rotation remain fixed.

Duplication and local-creation verification: all 99 unit tests and all 18 native desktop scenarios (182 checks)
passed, plus syntax, formatting, and diff checks. Reviewed library controls at 1100 × 800 and
character details/editors at 1440 × 950. Tests cover two resource casts, original slot spending,
shared/local edits, stale editors, duplicate names, Undo, removal, inactive roster, backup
recovery, app reload, and fixed HUD dimensions/rotation. The Add options, cancelled blank drafts,
direct copies of already assigned abilities, filtered local pickers, local name icons, and Undo
after creating a second local ability are also covered.

## Current follow-up — deleting assigned library abilities

Replace blocked deletion with a warning naming every active and inactive character assigned the
ability. Offer Edit instead, Remove and delete, or Make local copies and delete. Edit instead is
a white button immediately left of the yellow Make local copies and delete button. The
second dialog lists all assignments with checked-by-default character choices and Go back.
Confirmation keeps checked assignments as local definitions and removes unchecked assignments
before deleting the shared entry. Kept copies retain names, IDs, cost bindings, concentration,
and HUD selection; existing local copies remain independent.

Completion checks: exercise Edit, Cancel, Go back, mixed/all/none selections, inactive characters,
normal Undo, latest resource spending, changed-assignment review, capacity limits, backup recovery,
reopening, and fixed HUD dimensions. No save-format change is required. F10 is still pending approval.

Verification: all 105 unit tests and all 19 native desktop scenarios (186 checks) passed, plus
syntax, formatting, and diff checks. Both deletion dialogs were visually reviewed at 1100 × 800.

## Next milestones — F10, approval required

1. **Use records and targeted undo.** A successful use records a unique request/use ID, character,
   assignment ID and library ID when linked, sequence, origin, selected slot level, a snapshot of manual ability
   details, costs actually deducted, and concentration before/after. Record only changed costs;
   a free use has none. Do not store full characters, portraits, or private notes. Records join
   the authoritative save transaction; failures/canceled warnings create no successful notice.
   Retries and duplicate commands must not spend or notify twice. Test logic before adding UI.
2. **DM notice queue.** HUD uses reveal a review panel with the captured ability, acting character,
   use order, chosen slot, and Spent list. New notices queue without replacing the one being read
   or interrupting an editor. Provide Undo this use, Acknowledge/Next, Close, and a pending count.
   Close hides the panel without acknowledging/refunding. Keep acknowledged notices available
   in session history. Test rapid uses, preserved drafts, close/reopen, errors, and removed players.
3. **Combined review.** Run save migrations, resource and concentration regressions, stale editors,
   simultaneous uses, ordinary Undo interleaving, and notice privacy. Verify 0°, 90°, 180°, 270°,
   and angled/scaled HUDs in interactive and click-through modes. Do not publish a release as part
   of feature review.

The order is F05 → F08 → manual fields → use records/undo → notice queue. The first three provide
consistent content and persistence; receipts then provide trustworthy costs and reversal before
the notice UI consumes them. F09 icons and automatic effects are outside this branch's scope.

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

## Decisions before F10 coding

- Approve additive refunds after later tracked spending, but all-or-nothing blocking after a
  relevant rest, correction, turn refresh, or concentration replacement, as specified above.
- Approve queued HUD-use notices, explicit acknowledgement, and closing without acknowledgement.
- Confirm session-only history initially, ending at restart or backup restore. Keep it outside
  exported party data, with visible paging and no silent loss of unread notices. Persistent
  history needs its own storage design.
- Decide whether DM uses should also open notices; recording them internally is needed to track
  later spending even if only HUD uses open notices.

Next review: assigned library deletion. After it is accepted and committed by the user,
recommend the F10 use-record and targeted-undo milestone, subject to approval of these decisions.
