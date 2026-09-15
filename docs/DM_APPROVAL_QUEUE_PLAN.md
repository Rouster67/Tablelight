# DM approval queue and History

Branch: `codex/dm-approval-queue`, starting from `b8883db` (the merge of PR #10).
Status: milestone 1 committed as `479ce68`; milestone 2 implemented for review, uncommitted.
This document replaces the earlier F10 post-use notice proposal in ABILITY_DETAILS_PLAN.md.

Work one approved milestone at a time. Leave changes uncommitted; the user handles staging,
commits, publishing, and branch changes. The visible approval flow is now connected. History,
Reconsider, and targeted undo still await their own approved milestone.

## Agreed product behavior

### Overlay requests and reserved costs

- Only ability uses initiated from the player overlay request DM approval. Using an ability
  directly from the DM console retains its immediate-use behavior and does not create a request.
- The player chooses a spell-slot level before submitting. The request identifies the character,
  ability, chosen slot, and every tracked cost that approval will spend.
- Pending requests reserve their action, bonus action, reaction, spell slots, and linked resource
  charges. The player's overlay displays the remaining amounts after those reservations. The
  DM's actual counters and saved character values remain unchanged until approval.
- A player may submit multiple requests, including repeated uses of the same ability, only if
  all that character's pending requests could be used together with the available tracked costs.
  An action request prevents another request that needs that same spent action; an affordable
  bonus action can still be requested. Manual ability text does not introduce automatic rules.
- Each pending use appears separately on the player's overlay, with Awaiting DM approval and its
  own Cancel button. Denial, cancellation, and expiry release the reserved costs.
- At most three non-reaction ability requests may be pending across the whole party, including
  the request currently open on the DM screen. A fourth attempt does not reserve costs or enter
  the queue; its player sees: **Hold up—the DM is super busy!**
- Reactions have no extra queue cap and do not count toward those three. Existing reaction
  availability and reservations still apply. They are marked **Urgent**, shown in red, and
  listed before ordinary requests.
- Future kinds of DM requests must be able to use this queue without counting toward the ability
  cap. This branch implements ability requests only.

### DM popup and queue

- Show a popup containing all ability details, closely matching the existing DM View dialog.
  Reuse the common ability detail renderer, including local icons, manual fields, long sections,
  upgrades, and Reference. Show costs as awaiting approval, not already spent.
- Provide Allow use, Deny use, View character, and Minimize.
- Allow use revalidates the request and spends its actual costs exactly once. Deny use spends
  nothing. No denial-reason field or written explanation to the player; conversation happens
  over the table.
- View character opens that character's DM page and minimizes the request to the queue.
  Minimize keeps the request pending without navigating. Reopening it restores its details.
- The queue is accessed through an appropriate icon in the bottom right of the DM console.
  It pulses and displays **!** while anything is pending. Its list uses brief entries such as
  **Aria — using Guiding Bolt**, with the Urgent indication where applicable.
- A newly received request may open automatically only when no popup is open and there is no
  existing request waiting in the queue. If any popup is open, incoming requests quietly queue.
  Requests also quietly queue while an earlier request is minimized. Urgency does not replace
  an open popup or discard an editor draft.
- Allowing or denying closes the current popup. Never automatically open the next waiting
  request. The DM can select and approve any request in any order, regardless of priority.
- Treat the popup close button/Escape consistently with Minimize so closing does not silently
  deny or cancel a pending request.

### Changes while requests are pending

- Always use the current ability definition and cost settings. A stale request cannot authorize
  a previous version of an edited ability.
- Before saving an edit or applying an external change to data that pending requests depend on,
  show a warning that names the affected requests and explains that continuing will deny them.
  Continue applies the change and automatically denies those requests; Cancel leaves the change
  unapplied and the requests queued. Canceling the warning must preserve any open editor draft.
- This confirmed-change rule supersedes the earlier suggestion to leave requests pending after
  a conflicting manual edit. Check actual changed fields: opening an editor or changing unrelated
  data is not a reason to deny requests.
- Starting a character's new turn shows a small warning when they have pending requests.
  Continue starts the turn, expires their requests, and releases their reservations. Cancel
  leaves the turn and requests unchanged. History marks these **Expired — new turn**.
- Normal admission, cancellation, and approval are queue operations; approving one request must
  not trigger the external-edit warning or deny the other affordable requests.
- If a request becomes invalid or unaffordable outside a confirmed change, keep Allow disabled
  with a specific explanation. Recheck immediately before approval to prevent stale spending.

### Concentration

- Warn the player before they submit a use that replaces existing concentration.
- Inform the DM of the concentration change in the request; keep the notice current if the
  relevant state changes. Switch actual concentration only when the DM approves.
- Pending requests reserve costs without starting, ending, or replacing actual concentration.
- A later concentration change blocks targeted undo that would overwrite it, even if the
  concentration name later happens to match again.

### History and Reconsider

- History has its own icon in the bottom left of the DM console. It opens a brief list using
  character, ability, and outcome. It retains the five most recently resolved requests.
- Approved, denied, player-canceled, and expired requests appear in History. Removing an old
  entry to enforce the five-entry limit does not undo a use or refund anything.
- Denied and canceled requests have Reconsider; expiry is a cancellation caused by the turn
  change. Reconsider returns the request to the front of the pending queue and opens its popup
  immediately because the DM explicitly selected it. Urgent entries retain their priority.
- Reconsider uses current ability details and cost settings, rechecks reservations and queue
  limits, and cannot create duplicate pending copies through repeated clicks.
- Approved entries offer Undo this use. A successful undo marks that entry **Undone**. An Undone
  entry has no Reconsider action and cannot be undone again.
- Both queues, their History, and pending reservations are session-only. They clear when
  Tablelight closes. Approved spending remains in the normal character save. These session
  records must not become part of exported character/library backups.

### Targeted undo

- Undo only the chosen approved use's recorded costs and concentration change. Keep unrelated
  later HP, movement, notes, ability edits, placements, and other characters' actions intact.
- Later tracked spending from the same pool or slot may remain intact while refunding only the
  chosen use's exact amount. Record actual costs; do not derive refunds from the ability's
  potentially edited settings.
- A relevant rest, manual correction, capacity change, new-turn refresh, or later concentration
  change disables undo with a clear reason. Equal values alone do not prove that nothing changed.
- Recommended implementation: all-or-nothing reversal. If any affected component cannot be
  restored safely, change nothing. Never silently cap a refund or label a partial refund as Undo.
- Keep ordinary session Undo coherent with the request states, History, and targeted reversals.
  It must not produce duplicate refunds or labels that disagree with the saved costs.

## Implementation recommendations

These are implementation choices proposed to deliver the agreed behavior, not additional features.

- Identify requests by a unique attempt ID and character/assignment IDs. Use the existing manual
  Turn cost value `reaction` to classify Urgent requests; do not infer it from names or rules text.
- Resolve shared and local abilities through the existing character assignment. Preserve local
  definitions and resource bindings; copying an entry must not accidentally share its live costs.
- Keep session request state separate from the persisted party model. Extend authenticated IPC
  and session broadcasts so player projections do not overwrite the authoritative character
  counts. Restrict player commands to requesting/canceling; only the DM can approve, deny, or undo.
- The controller currently owns mutations through `commit`; the main process validates overlay
  senders and serializes saves. Preserve a single ordered mutation path for requests, approvals,
  cancellation, and edits. A submitted request must receive a prompt acknowledgement that it was
  queued; do not leave the existing IPC request waiting for a human approval.
- Do not report a successful use until its authoritative state transition succeeds. Handle save
  failures, retries, repeated clicks, cancellation/approval races, and window reloads without
  spending or refunding twice. Restoring a different backup should clear incompatible session data.
- Record the approved definition snapshot, chosen slot, actual deductions, concentration before
  and after, and revision/ownership markers for affected counters. Track relevant direct DM
  spending too, without creating player requests or extra History entries.
- Audit mutations of ability definitions, assignments, slot levels, resource pools, turn controls,
  and concentration. Add dependency checks before mutations. Ordinary approval is exempt from
  the external-edit warning; manual edits/corrections that touch dependencies are guarded.
- Reconsider keeps a previous selected slot only if it remains valid for the current ability.
  A missing assignment or invalid slot must be explained and cannot silently authorize a
  different character, ability, or slot. A full normal queue prevents another normal request.
- Preserve drafts and focus across warnings and minimized requests. New session UI must fit the
  current DM layouts and the player's growing HUD at every supported rotation and chosen scale.
- Use accessible labels on icon buttons and an Urgent label alongside red styling. Honor reduced
  motion for the queue pulse. Do not reveal another character's requests on a player's HUD.

## HUD layout amendment — approved September 14, 2026

The user replaced the original fixed-height requirement: the expanded HUD must grow taller to
show its entire left column, including the portrait/name, HP, stats, conditions, spell slots,
custom resources, and Smaller/Larger controls. Pending approvals belong in their own far-right
column after the ability browser. The browser retains its width and independent scrolling;
the pending column appears only while that character has requests. Saved scale and rotation
remain unchanged. Native checks cover long content, picker resizing, preview agreement,
request cancellation, and rotated frames; native input regions also support tall frames.

## Small milestones and completion checks

### 1. Session requests and cost accounting

**Complete locally:** `approval-session.js` implements the separate session model. Its 21 tests
cover the checks below, dependency confirmation/cancellation, same-value resets, private player
views, character-specific bindings and shared-to-local conversion, and save/restart separation.
At that milestone, all 126 unit tests and JavaScript syntax checks passed. The foundation was
left inactive until the milestone 2 integration.

Add the session request model, admission limits, reservation projection, approval/cancel/deny
transitions, use receipts, and dependency/revision tracking behind the existing behavior. Keep
the app's current use path available until the complete approval flow is ready in milestone 2.

Completion checks:

- Request an action and a bonus action together; reject an additional action. Permit repeated
  affordable free uses, with distinct request IDs. Reserved costs change only the player projection.
- Accept three ordinary requests across several characters, reject a fourth with no mutation,
  and admit affordable reactions independently. Confirmed spending occurs once on approval.
- Cancel or deny one request and release only its reservations. Process approvals out of order.
- Verify current shared/local definitions and independent character cost bindings. Neither
  admission nor projection changes concentration, saves, HP, damage, or other manual effects.
- Exercise duplicate delivery, late replies, failed writes, and simultaneous commands using
  meaningful unit tests before connecting the new UI.

### 2. Player requests, DM popup, and pending queue

**Implemented locally:** `approval-service.js` owns the session in the main process, serializes
all changes, and preserves pending requests across window reloads. Authenticated IPC exposes
player projections and bounded request/cancel commands. `approval-ui.js` supplies the DM queue,
review popup, and draft-preserving dependency warnings; the overlay includes per-use cancellation,
concentration warnings, and the full-queue popup. Direct DM uses remain immediate. Backup restore
clears incompatible session records; ordinary Undo now lives with the main-process state owner.

The 10 service tests and tall-frame input check join the 126 existing tests. All 20 desktop scenarios pass, including the
new approval flow and regression coverage of saves, updates, shared/local abilities, party order,
and HUD layout. The new desktop checks also exercise failed approval saves and retry.

Connect overlay Use to request submission, slot choice, concentration warnings, pending-use
display and individual cancellation. Add the bottom-right queue icon/list and full DM approval
popup, including navigation/minimization, non-interruption rules, caps, and red Urgent entries.
Connect dependency warnings and the new-turn expiry warning before enabling the flow for review.

Completion checks:

- Only overlay uses queue. DM-console uses retain their direct behavior. Allow spends the chosen
  costs and switches concentration; Deny and Cancel release reservations without spending.
- Any open popup or minimized request keeps incoming requests queued. Neither resolving one
  request nor an Urgent arrival replaces an editor or automatically advances the review.
- View character goes to the correct character and minimizes; every queued item can be reopened
  and approved in any order. Long details match the existing DM View dialog.
- Warnings apply only to dependent changes. Cancel preserves drafts/state/requests; Continue
  applies the edit and denies the affected requests. A canceled new-turn prompt changes nothing.
- Use isolated native tests and screenshots for multiple players, many reactions, long names,
  the full-queue popup, disabled approvals, fully visible character summaries, and rotated controls.

### 3. History, Reconsider, and targeted undo

Add the bottom-left History list, five-entry eviction, current-definition Reconsider, and safe
targeted undo. Connect ordinary Undo to the session bookkeeping so state and labels stay aligned.

Completion checks:

- Resolve six requests of different outcomes and retain only the newest five. Eviction does not
  alter character costs. Both queues clear on app restart while approved spending stays saved.
- Reconsider opens immediately, respects caps/current data, and creates no double reservation.
  Undone entries cannot be reconsidered or refunded twice.
- Start with five charges. Approve use A for two, then a free-turn-cost use B for one. Apply an
  unrelated HP change. Undo A leaves four charges, B spent, and the HP change intact. Undo B
  restores five. Repeat with slot levels and multiple characters.
- A relevant rest, adjustment, turn refresh, capacity change, or concentration replacement blocks
  targeted undo with no partial mutation. Unrelated changes do not block a valid refund.
- Test ordinary Undo before/after approvals and targeted reversals, stale History views, changed
  ability definitions, lost assignments, and cancellation versus approval arriving together.

### 4. Combined review and installed-program verification

Run the full appropriate unit and desktop suites after integration. Check migrations, backups,
shared/local abilities, inactive roster handling, cost changes during edits, rapid requests,
long details, keyboard focus, and 0/90/180/270-degree plus angled/scaled HUDs. Update documentation.
Back up the installed review copy and verify saved-data preservation before installing for user
review. Leave all source changes uncommitted; no branch changes or release publishing.

## Next milestone recommendation

Review and commit milestone 2 before starting milestone 3: History controls, Reconsider, targeted
undo, and coordination of those reversals with ordinary Undo. Receipts and counter markers alone
do not implement reversal. The final combined milestone will repeat relevant desktop checks
after those controls are connected.
