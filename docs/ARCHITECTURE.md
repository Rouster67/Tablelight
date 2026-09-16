# Architecture and save format

The DM native title and sidebar version label use Electron's `app.getVersion()`, which reads the
running application's package metadata. The existing load response supplies the version to the
renderer; no network request is involved. The native title ignores HTML title changes so loading
or refreshing a page cannot hide the version. Browser-only previews display a preview label.

## Application updates

`update-service.js` manages checks, consent, download progress, cancellation, and the save/install
transition. `updates.json` persists only the automatic-check preference; it is separate from
party state, exports, and Undo. An unreadable preference fails closed. `update-adapter.js` uses
the pinned NSIS updater with automatic download, install-on-quit, prereleases, downgrades, web
installers, and differential downloads disabled. The custom HTTP executor constrains destinations,
strips rollout IDs and credentials, and cancels metadata requests on a 12-second deadline.
Full installer downloads retain the library's SHA-512 and optional publisher-signature checks.

The main process enables updates only on Windows after the installer writes its marker under
`resources`; source and unpacked previews remain inactive. The preload exposes fixed, DM-checked
update operations and a state listener. It never accepts a renderer-supplied feed, URL, path, or
executable. `updates-ui.js` renders the DM controls and defers the launch offer while an editor is
open. Progress changes preserve focus on cancellation. Update state never goes to the TV.

After an explicit update request finishes downloading, main blocks new HUD commands and asks
the DM to persist its current state through the existing save queue. A failed save releases the
block and prevents installation; retry reuses the verified download. A successful save permits
NSIS installation and relaunch. Ordinary quit never installs. Windows interruption recovery is
manual; the save directory remains outside the application directory. See [network use](UPDATES.md).

`electron-builder.cjs` defines a per-user NSIS installer with a stable app ID and data-preserving
uninstall. Production packages use the official GitHub feed. The installer regression test alone
embeds an isolated feed and data directory in specially named test packages, with a separate
application ID; the production build contains no such configuration. Builds never publish.

## Windows and HUD geometry

The Electron main process creates a DM window and one transparent always-on-top TV window. Each player's independently positioned DOM HUD is rendered inside the TV window. Positions are percentages of the selected display, rotation is degrees around the HUD center, and scale is per character. Fitting expanded HUDs to the display does not overwrite their stored position or rotation.

Expanded containers are 880 CSS pixels wide, with a 50px toolbar area and a card at least 600px tall. All columns contribute to the card’s natural height, so the summary, ability browser, and pending approvals fit their content without scrollbars. Ability lists use fifteen entries per page. Conditions use six entries per page in two rows of three; custom resources use three entries per page, with independent normalized `hud.conditionPage` and `hud.resourcePage` settings for each character. The summary and Resources browser share the resource page; DM controls can change either list while the overlay is hidden, collapsed, or click-through. Pending requests add a separate 250px column plus a 20px gap on the far right, making the frame 1150px wide without reducing the browser width. Collapsed portraits retain their existing dimensions.

`HUD.mount` applies the stored scale exactly and uses `HUD.fit`/`fitHud` only to adjust position. Oversized axes are centered instead of silently shrinking. Page selections survive redraws. Long details and message pages grow vertically instead of scrolling. After transient forms mount, the overlay refits the frame and observes later size changes, including asynchronous picker results, before publishing native hit regions. The DM preview shares the renderer and shows pending-column placement with disabled cancellation buttons; actual DM counters remain unreserved. Currently displayed resizing uses the same bounded placement command as other controls. The obsolete DM scroll buttons are removed; legacy scroll messages remain accepted for compatibility but the expanding panels have no scrollable area.

Custom resource counters retain their IDs and bindings. Additive `icon` and `color` fields normalize to one of six CSS shapes and a six-digit hex color; legacy pools default to a circle in the character color. Reset values are short, long, turn, or manual. `startTurn` restores turn controls and per-turn counters; both next-turn traversal and the TV turn command use it. Rests preserve per-turn and manual counters; short-rest pools also recover on long rest. Manual reset is a bounded command. `resource-ui.js` renders inline resource drafts in the character editor; save uses the existing ID-aware merge so appearance edits preserve concurrent spending. All resources render as stacked rows under slots, with matching counters in the paged Resources section.

The controller builds editor drafts through `commit`; the main-process approval service owns authoritative mutations and ordinary Undo. It normalizes and atomically saves changes before broadcasting actual DM state and projected player state. Overlay commands go directly to this service through sender-checked IPC. Pointer gestures use document capture listeners, including when a pointer leaves a transparent region.

On Windows, `window-shape.js` converts each rotated HUD into horizontal rectangles for Electron's native `BrowserWindow.setShape`. The renderer reports validated HUD frames through overlay-only `hud:regions` messages after painting. Windows routes input directly to those areas; gaps pass through to the map. During a gesture, `hud:dragging` temporarily restores the full window region so movement can continue across gaps, then reinstates the HUD regions on completion or cancellation. This avoids relying on forwarded hover events to switch mouse ignoring, which could leave a HUD unreachable. Full click-through mode still uses `setIgnoreMouseEvents(true)`. The renderer publishes regions only when HUD frames or viewport dimensions change. Ordinary stat saves do not rebuild native regions; interaction-mode switches still update immediately. New geometry is validated and calculated once before applying it. The TV window accepts keyboard focus only when HUD controls are on, allowing picker searches.

Only the main process accesses the file system. `storage.js` writes a temporary file, flushes it, preserves a valid previous save, then renames the temporary file over the current save. On load, a corrupt current save falls back to the previous save with a warning. If both fail, they remain intact and the app reports an error.

## Shared library

Save format version 11 keeps `library` and `conditionLibrary` alongside `characters` (active
party), `roster` (inactive saved players), `settings`, and `activeId`. Library entries own
`name`, `kind`, `economy`, `level`, `usesSlot`, `requiresConcentration`, and the manual text
fields: `trigger`, `duration`, `range`, `area`, `castingTime`, `components`, `school`,
`attack`, `save`, `onSave`, `damage`, `upgrades`, `requirements`, `special`, `description`,
and `source`. The visible Reference label retains the existing `source` storage key.
The optional `icon` contains a validated, embedded PNG, defaulting to an empty string.
Library-linked assignments serialize only `id`, `libraryId`, `resourceId`, `resourceCost`,
`disabled`, and `passiveActive`.
Slots, resources, HP, turn state, and HUD settings belong to each character.

Character-only items have `local: true` and an empty `libraryId`. They store their complete
normalized definition on the character alongside resource link, cost, and availability. The
normalizer explicitly skips legacy library promotion for these items, even for exact matches;
`toBackup` retains their definition fields. A local item with a nonempty library link is rejected,
as is a non-boolean local flag. Unmarked legacy unlinked abilities still migrate to the library.

`duplicateLibraryEntry` creates a new definition without assignments. `duplicateLocalItem` copies
the current definition and the originating character's cost settings, creates a fresh item ID,
and adds only a local item. Neither action spends or resets resources, changes concentration,
or changes HUD selection. Names use the first available numbered suffix, ignoring case, within
the library or destination character respectively. Existing numeric suffixes use the same base;
long names reserve room within the 300-character limit. Limits remain 5,000 shared definitions
and 500 abilities per character. Both actions run through ordinary session Undo.

`createLocalItem` adds a new independent definition and validates the destination and resource
link before mutation. `copyLibraryItemLocally` copies directly from a library definition without
attaching it, preserving its name unless already used on that character; resource bindings start
empty. The character Add dialog exposes both paths below the shared choices. Picker search and
filter retain local-copy mode and permit copying an already assigned definition. New blank local
drafts create an item only on Save. `HUD.abilityName` escapes names and prefixes local names with
an accessible person icon in character lists, details, HUD lists, and concentration choices;
the icon is presentation only and never stored as part of the name.

The common editor uses a local branch that merges only edited fields into the latest local item.
It never creates or updates a library definition for that branch. Its title, save action, and
note identify the character-only scope; character rows and views label local copies. Local
removal uses a separate explanation. Copying immediately opens the new editor; Cancel leaves
the created copy. Missing/stale source or destination items fail without recreating deleted data.

All ability text is manual. There is no ability attack/DC resolver, automatic mode, formula,
target-stat control, or new personal numeric setting. Existing character-sheet calculations
remain independent. Spell Level is retained for every type. A selected level above zero plus
`usesSlot` controls the slot chooser and spending, regardless of type; no text is parsed to
infer a cost. Casting Time is plain text; `economy` retains explicit turn-cost tracking.

`abilityTextLimit` bounds description, upgrades, requirements, and special to 40,000 characters;
attack/save to 2,000; and other text to 300. Missing text defaults to empty. The editor accepts
blank fields, keeps Type and Spell Level dropdowns, and labels the concentration flag simply
Concentration. Upcast / Upgrades sits immediately below Damage / Healing. Reference is below
Description on the right. Resource controls are local to the selected character and disabled
with an explanation when editing an unassigned definition.

`HUD.abilityDetails(item, character)` supplies the same ordered metadata to DM details,
assignment previews, and HUDs, including linked pool name and per-use cost when a character is
available. `TL.abilityTextSections` orders Description, populated Upgrades, Requirements, and
Special. The shared section renderer escapes all text. Reference follows all sections as a
right-aligned footer; HUD use controls stay above it. Empty fields are hidden.
`TL.abilityTextPages` splits long sections into 640-character chunks, packs short sections,
and repeats section labels. Normalization clamps invalid detail pages after resolving shared
definitions. Stored position, scale, rotation, and independent page selections stay intact.
Library search and exact-content matching include every new text field.

`normalize` resolves library definitions into character items in memory. `toBackup` removes
repeated definition fields before serialization. Shared edits reach active and inactive players;
changed-field merging preserves concurrent HUD spending. Untouched inputs retain their original
text, including legacy whitespace or line breaks that a single-line input cannot display.
DM details refresh when shared text changes.

Formats 1–10 import into format 11. Older missing text fields become blank; legacy unlinked items match
by their full normalized definition content. Different same-name definitions remain separate.
Missing references and duplicate definition IDs remain errors. IDs, selections, resources, and
all character state are preserved. Format-10 readers reject format 11 rather than silently discard
passive behavior/state; format 10 introduced icons and format 9 introduced character-only copies.
Inactive roster, overlay rendering, resource spending, concentration,
backup recovery, and session Undo all retain local items by their own stable IDs.

The uncommitted calculation preview wrote format 7. Its migration preserves explicitly entered
fixed attack/DC numbers and a selected target ability as appended plain text, without calculating
Auto values or parsing existing notes. Personal exceptions that differ from the shared manual
result become separate reusable library variants; identical variants share a definition. Their
assignment IDs and resource bindings remain unchanged. The version 9 whitelist drops the retired
numeric settings and override keys. Repeated save/load cycles do not append the text again.

Assigned ability deletion uses `deleteLibraryEntry` to remove the definition and resolve every
active or inactive assignment in one commit. Checked characters retain their assignment IDs,
names, current definition fields, resource bindings and availability, with `local: true` and an
empty library link. Unchecked assignments are removed; only their matching HUD detail and
concentration links are cleared. Existing locals, other abilities, spent resources, turn state
and placement remain unchanged. Conversion works at the 500-ability character limit because it
replaces the existing assignment. `libraryAssignments` snapshots character and assignment IDs;
both deletion dialogs require review again when this set changes, while final confirmation uses
the latest shared text and character costs. The full operation uses ordinary session Undo.
The lower-level `removeLibraryEntry` remains restricted to unassigned definitions.
Removing a character or assignment leaves the library intact. A confirmed backup restore replaces
the party, roster, and both libraries. Ordinary Undo remains a chronological stack, now coordinated
with approved-use History and targeted reversals by the approval service.

## Offline illustrated guide

`guide-ui.js` renders the single Setup & help PDF action and persistent, accessible feedback.
It coalesces repeated clicks while opening, restores keyboard focus, and explains browser-preview
limitations. Only the three requested help sections were replaced; setup, license, backup,
updates, shortcuts and display tips remain. The PDF draft contains those removed topics.

The no-argument `guide:open` bridge checks the DM sender and main frame. `GuideService` resolves
`docs/Tablelight-User-Guide.pdf` relative to main's `__dirname`, checks readable PDF bytes, then
uses `shell.openPath`. No user path, URL, working-directory assumption or data-folder lookup is
accepted. Missing/unreadable/damaged files and both viewer-error forms yield recoverable messages.
The route never saves, imports a party, creates Undo entries or changes gameplay state.

`scripts/build-guide.py` renders the editable Markdown, local screenshots and licensed fonts using
ReportLab. It checks version/source records, PDF navigation and embedded fonts with pypdf, then
writes a manifest of inputs and output bytes. Python is an authoring dependency only. The existing
docs allowlist includes the PDF and source; QA logs/renders remain in ignored output directories.
`build/before-pack.cjs` verifies the manifest, version and hashes for every builder entry point.
Drafts cannot enter ordinary release output; the explicit no-publish testing exception is confined
to testing folders. Final guides require an all-page, coverage, walkthrough, navigation, two-viewer
and offline-install review bound to that exact PDF. CI skips release artifacts while it is Draft.

The `guide` native scenario tests the real bridge/UI, keyboard and duplicate activation, faults,
retry, sender/argument rejection, license and backup controls using isolated data. `guide-capture`
creates synthetic screenshot assets and records source hashes/version/scaling for author review.
The full illustrated manuscript and final installation/viewer certification are later milestones.

## Passive ability foundation

Format 11 adds shared `behavior` (`active`, `passive`, or `hybrid`), `trackPassive` (boolean),
and `passiveDescription` (plain text, at most 40,000 characters). These fields also belong to
character-only definitions. The primary `description` retains its text through behavior changes;
it describes the passive for passive-only entries and the active effect for hybrids. Existing
entries default to Active, no manual tracking, and blank passive text; normalization never infers
behavior from names, Type, free turn cost, or descriptive rules. Invalid supplied values fail
validation before saving, while omitted fields receive defaults.

`passiveActive` belongs to the assignment and defaults false. Shared definition edits never
overwrite it; it remains stored when behavior or tracking changes. Creating or duplicating an
assignment starts Inactive. The existing Make local copies and delete operation retains the
assignment and its state. Rests, turns, concentration changes, remove/rejoin, and backup round
trips preserve the reminder. Shared definitions do not contain any character's reminder state.

`setPassiveActive` accepts an explicit boolean for an assigned passive/hybrid with tracking on.
It changes no statistics, turn controls, costs, conditions, or concentration. The checked HUD
`passive` command additionally requires an active-party character and a visible, expanded,
interactive HUD. The existing main-process approval service owns serialization, deduplication,
saving, failures, stale-editor merging, and ordinary Undo. This assignment field is deliberately
outside the approval definition fingerprint, so switching a hybrid reminder does not invalidate
its pending active use or targeted refund.

`hasActiveEffect` guards availability/spending and concentration selection. Passive-only abilities
cannot request or perform use, even with dormant cost/concentration settings. An existing binding
to a newly passive-only ability fails normalization with an instruction to end/change concentration
first, including for inactive players. Hybrid active use keeps normal costs and approval behavior.
No automatic statistics, rules, or conditions are derived from either description.

The shared/local editor exposes Behavior beside Turn cost, below Name and Type. Type never
restricts detail fields or cost choices. Passive-only hides the turn-cost label without disabling
or clearing its input, so FormData and changed-field merging preserve dormant values. Other cost
fields remain editable with an explanation that they apply only to active effects. New entries
default to Active, except Create new from the DM Passives tab defaults to Passive. Shared/local
editors expose `trackPassive` for passive and hybrid entries and `passiveDescription` for hybrids.
Hidden inputs keep their values, and the boolean tracking field is saved separately from text.

`passives-ui.js` implements the DM tab, independent reminder switches, and passive details.
The DM uses `setPassiveActive` through ordinary `commit`, so hidden/collapsed/click-through HUDs
do not prevent DM reminder edits. Passive views have no Use, availability, or cost controls;
hybrid text navigation is read-only and leaves every HUD alone. Active views retain their normal
spending path. Passive-only metadata omits casting/slot/concentration/resource costs; hybrid
passive views show their separate text and reference. User text is escaped throughout.

The library Passives filter includes hybrids and searches their passive text. Pure-passive
assignment omits spending controls. Character Type/cost lists exclude pure passives; `panelItems`
includes passive/hybrid assignments only when `hud.panel` is `passive`. This existing saved panel
also selects the effect for `hud.detailId`; `hudDetailEffect` supplies it consistently to the shared
`abilityTextPages`, HUD renderer and DM Currently displayed preview. No extra saved effect field
or format change beyond 11 is needed. `detail` accepts an explicit `effect`, validates it before
showing a HUD, and selects Passives or the hybrid's active economy when switching effects.
Normalization clears detail selection if its effect is removed and clamps invalid pages after
text/list edits, preserving other players, valid reading pages, placement, scale and rotation.

The expanded HUD adds Passives next to Features without changing its fixed width or introducing
scrollbars. Passive views omit ordinary Use controls and cost labels. Interactive HUDs decorate
conditional reminder text with explicit desired-state commands; click-through and layout previews
keep readable status text. The DM can explicitly show a passive on TV or navigate its pages and
effects through Currently displayed, including when player interaction is disabled. DM modal
View passive/active effect links remain read-only. Stale concentration-use prompts close when
the player switches to the passive side of the same hybrid.
The `passives` desktop scenario verifies real IPC, editor preservation, all Type/Behavior
combinations, cancel/Undo, concentration conversion errors, minimum-window layout, disk saving,
and renderer reload with isolated data. Unit coverage includes formats 1–10, local copies, save failures,
pending requests, targeted refunds, dormant state, invalid inputs, and previous-save recovery.
The `passives-dm` scenario covers creation, assignment, search, reminders, mixed-effect text,
stale edits, local copies, remove/delete/Undo, backups/reload, and long text at minimum size.
The `passives-hud` scenario exercises actual player/DM controls, matching effect pages, reminders
alongside pending requests, click-through controls, maximum text, zero/one/many assignments,
reload, and 30 combinations of rotation/scale/interaction with fixed widths and no scrollbars.

## Conditions and concentration

Condition definitions contain `id`, `name`, and `description`. Characters store unique `conditionIds`; normalization resolves `appliedConditions` for rendering. Backups strip these resolved copies and retain definitions once. The overlay receives only active characters' resolved conditions. Shared editing, assignment, removal, and protected deletion work across both player collections. Names and descriptions render as escaped text, with native title tooltips. There are bounds of 5,000 definitions, 500 assignments per character, 300 characters per name, and 40,000 characters per description.

The DM Add dialog searches existing entries or creates and assigns a definition in a single undoable commit. The TV's Add menu uses an overlay-authenticated, read-only `hud:conditions` query while HUD controls are enabled. Queries return at most 100 alphabetical name/description matches, with a total count; they do not include character data. Its bounded `condition-add` command accepts only existing IDs and active party members, preventing creation from the TV. The menu shows five matches per page, uses bounded description excerpts with full hover text, preserves its search and page during state updates, ignores stale search responses, and closes when its HUD is hidden, collapsed, or made click-through. The summary grows to contain transient forms, and frame positioning and native hit regions refresh after picker results change its height.

Formats 1–3 migrate automatically. A legacy character condition note becomes one complete definition, retaining punctuation and qualifiers; identical notes share an entry. Formats 4–5 require a condition library array and reject missing references or duplicate definition IDs.

Ability definitions include a shared `requiresConcentration` boolean, defaulting to false for every kind and economy. The DM and TV selectors filter the character's resolved items by that flag, with name/description search. They include spent or disabled entries because tracking concentration does not itself spend costs. Selecting sends a character-specific item ID; validation rejects unassigned or unflagged abilities and free-text requests.

Concentration uses `concentrating`, `concentrationItemId`, and a resolved `concentration` display name. These are additive fields in save format 4. Normalization resolves the selected binding after applying shared definitions, follows name edits, and ends concentration if the binding is removed or its flag is cleared. Ending concentration and long rest clear all three fields. Legacy active notes without an item ID remain visible until the user ends concentration or selects an ability; migration never guesses flags or matches abilities by name. Picker searches survive unrelated updates. Conditions are never removed automatically by rests or turns.

The shared `spend` path validates availability, any required slot choice, and acknowledgement of the current concentration warning before changing concentration or costs. A flagged use calls `setConcentration` for the acting character's assigned ability; an invalid assignment fails before spending. DM uses spend immediately; HUD requests spend only when approved. The service saves each use's concentration and costs together. Unflagged uses leave concentration unchanged. Manual concentration selection continues to spend no costs.

## Roster and party

Each player exists exactly once, either in `characters` or `roster`. IDs must be unique across both collections. `characters` has a hard maximum of eight; `roster` has no fixed count limit. `allCharacters` and `findCharacter` supply shared-library and editing operations across both collections. `addToParty` and `removeFromParty` move the same character object without resetting live values or HUD settings. Joining appends to initiative order; removing the current player selects the next remaining player without starting their turn. Removing the final party member clears activeId.

The controller stores the complete roster in memory for editing and atomic saving, but renders only active players in the session console, initiative editor, and layout preview. The sidebar's Party section uses the characters array in order. Its All characters section independently sorts inactive roster entries alphabetically, without mutating either stored collection. Both the sidebar saved list and roster management render twelve searchable rows per page. Party and saved lists scroll independently, and controller rerenders preserve scroll and sidebar search focus. Sidebar buttons reuse the existing membership and deletion handlers. Full state and forty Undo snapshots still consume memory proportional to roster size; unlimited means no fixed player count, not unbounded hardware capacity. The former 80 MB import guard is removed, so large backups are subject to the runtime's JSON/string and available-memory limits.

Main uses `overlayState` for both initial overlay loading and later broadcasts. Only the active party is sent, with resolved ability text. The inactive roster, unused shared library, and private DM notes are omitted. HUD commands continue to reject IDs outside the active party. Whole-party rests, automatic layout, and turn traversal operate only on `characters`.

Versions 1 and 2 migrate with an empty inactive roster and keep existing characters in the active party. Versions 3 and 4 require a roster array, and invalid collections or duplicate IDs reject the save rather than dropping players. `toBackup` strips repeated definition metadata from both player collections, preserving references and individual resource bindings.

## Session controls

Library spell levels may be null (None), zero (Cantrip), or 1–9. Non-spell definitions normalize to null. Slot spending only applies to leveled spells with standard slot use enabled.

Saving throw expertise is an additive saveExpertise array alongside the legacy saves array. Expertise implies proficiency. Skill ranks remain 0/1/2. All training controls use the same rank and bonus helpers; editor merges preserve unrelated live changes.

characters array order is the displayed initiative order, persisted without changing HUD placements. Older saves migrate once to their previously calculated initiative order. settings.partyOrderVersion marks that migration; subsequent manual orders are authoritative. The shared panelChoices list supplies both TV and DM navigation. Currently displayed reads the selected character’s HUD panel, detail ID, and page so either screen can control the same content.

## DM approval queue

`approval-session.js` implements request accounting; `approval-service.js` owns it in the main
process and serializes edits, HUD commands, approvals, and ordinary Undo. It is also available
beside `TL` for the browser preview. Approval session data stays outside the party save format.

The model owns a normalized party state plus separate session-only pending requests, five resolved
History records, counter revision markers, and command receipts. Requests reserve costs in a copied
character projection. `playerView` uses the existing overlay filter to exclude DM notes and returns
only the selected character's pending uses. The complete snapshot is for the trusted controller;
it must never be broadcast directly to players.

Commands run serially and identify their session and unique operation ID. Repeated successful
commands return their original result without spending twice; small command receipts remain after
History eviction. Approval uses the existing spending rules and captures actual deductions plus
concentration before/after. A supplied save adapter receives only authoritative party data and must
resolve after the write succeeds. A rejected write leaves the session, reservations, and counters
unchanged for retry. The main process validates the sender on DM and overlay IPC endpoints. HUD
responses expose only command results, and broadcasts omit private notes, unused library entries,
and other characters' pending-use records within each character's view. A pre-update flush writes
the authoritative state even if unchanged, and failure prevents installation.

Trusted synchronous `change` callbacks edit a normalized draft. Dependent changes produce a preview
that must be confirmed against the same session revision before saving and resolving affected
requests. Cancel discards the preview. A later successful mutation makes that preview stale.
Callers must assign a fresh command ID to each distinct edit; a retry must identify the same edit.
Explicit new-turn, rest, and adjustment events record resets even when counters end up equal.
Tracked spending updates counter ownership while external corrections advance an invalidation
marker. Targeted undo requires every recorded cost epoch to match and every refund to fit its
counter. Later tracked deductions retain the epoch and survive additive refunds. Concentration
also checks ownership and its exact after-state; restoring an old focus requires its assignment
to remain available. Validation precedes every mutation, so a blocked component prevents the
entire refund. Counter-changing refunds guard dependent pending requests before applying.

The service attaches read-only undo/reconsider reasons to each History entry. Reconsider validates
the current character assignment, selected slot, reservation projection, and queue cap, creates a
new request ID, and marks the prior entry with that ID. Stable priority insertion keeps reactions
first and reconsidered requests ahead of existing ordinary requests after subsequent arrivals.
Recorded definitions and cost labels remain available even after the library entry is edited.

Ordinary Undo records before-state plus the operation kind, request ID, and prior History entry.
`Session.undoChange` applies the inverse party state and updates only that operation’s surviving
History entry: undoing approval marks it Undone; undoing a targeted refund restores Allowed.
It never revives evicted History or old pending requests. Tracked inverses preserve cost epochs
without rolling back intervening invalidations; concentration restoration establishes a new
ownership marker. Costless approvals and refunds also enter the ordinary Undo stack so their
labels remain reversible. Party data, markers, and History publish only after a successful save.

The service merges only changed editor fields into current state, including assignment ownership
and explicit party ordering. Dependency previews belong to their originating screen and become
stale after another session mutation. `approval-ui.js` overlays confirmations without replacing
the editor DOM; cancel preserves values and focus. Requests quietly queue behind any open popup
or minimized request. The bottom-right list marks reactions Urgent and preserves focused rows
on refresh. Resolution closes the current review without advancing to another.

`hud.js` renders each character's pending uses and cancellation controls in a separate far-right HUD column. `overlay.js` handles player cancellation and in-HUD prompts.
Turn Restore controls carry their displayed intended value so restoring a reserved action does
not accidentally spend the still-available actual action. Pending reservations never change
concentration. The request popup and existing View share `HUD.renderAbilityDetails`.

Window reloads reattach to the main-process session and its ordinary Undo stack. App exit clears
requests and internal History; saved costs remain. Explicit backup restore confirms any affected
requests before replacing the state, then starts a fresh request session. The restore itself can
still be reversed with ordinary Undo. `history-ui.js` supplies the bottom-left list, historical
detail view, Reconsider, and Undo this use. Buttons show current reasons when blocked. Both queue
icons respect open editors and become inert behind dependency confirmations. Reconsider opens
its new request only if the initiating History view is still open, preserving a later editor.

## Ability images

`ability-icon.js` loads before `core.js` in both windows. It validates bounded base64 PNGs,
dimensions, chunk structure, CRCs, and the total image budget. New saves contain only static
8-bit RGBA PNG icons up to 256 pixels per edge and 300 KiB each. The 8 MiB aggregate counts
each shared definition once, plus each independent character-only definition. Linked display
copies do not consume the budget again. Icons participate in exact-definition migration and
copying; resource shape icons remain separate. Small bounded caches avoid repeating checks
for every shared assignment or stat update.

`image-import.js` checks source signatures, container boundaries, animation markers, and edges
before decoding PNG, JPEG, or WebP files, with a bounded 5 MiB read and 4,096-pixel source edges.
The authenticated, DM-only `file:ability-icon` bridge opens the file chooser and serializes imports.
It converts pixels in a temporary hidden, sandboxed browser window: nativeImage cannot decode
WebP in the current runtime. This window has no Node access or preload, uses a nonpersistent
session, blocks navigation/new windows, and permits only local script and image data through
its CSP. It times out and is destroyed after conversion or failure. No dependency was added.

The renderer honors image orientation, fits the entire image to a 256-pixel longest edge,
retains transparency, does not enlarge small artwork, and exports PNG without source metadata.
The main process validates the returned PNG, including bounded decompression and scanline
filters, before accepting it. `Store.validate` applies the same pixel checks during load, save,
and backup import, before any existing save is replaced. The previous-valid-save fallback
also validates pixels.

`library-ui.js` keeps uploads/removals in the current editor draft until Save. Upload failure
retains the previous image; Cancel abandons the draft. Saving is blocked during conversion,
and a completion from a closed editor cannot change a later editor. Shared image edits use
the existing changed-field merge; character-only copies retain independent images and bindings.

`HUD.abilityThumbnail` supplies the same fixed square and neutral backing in library/picker,
character, detail, and TV views. Images use `object-fit: contain`; the type symbol remains
visible until an image loads and returns if it fails. Document capture listeners handle
load/error without inline handlers. Thumbnail dimensions do not depend on image dimensions.
The existing HUD fitting, rotation, hit regions, and resource icons remain in use.

`TL.clone` copies plain JSON containers while retaining immutable strings. Structural equality
avoids repeatedly serializing image data for comparisons and stale-editor merges. Approval
definition snapshots and Undo replay signatures also retain strings instead of embedding PNGs
inside generated JSON keys. Saves serialize each shared definition only once, now in format 11.

The shared codec in `preload.js` boxes each distinct PNG string once per outgoing message;
Electron's structured-clone reference table then transmits repeated image references cheaply.
It unboxes images to ordinary strings before either renderer or the authoritative state sees
them. The codec is shared with main from the preload file because sandboxed preloads cannot
require local helper modules. Sender checks, validation, privacy filtering, and backup format
remain in their existing layers. This is a per-message table with no persistent asset IDs/cache.

Run `node --expose-gc scripts/benchmark-ability-icons.cjs` for the synthetic 5,000-definition,
8-player, 100-inactive-character, 40-Undo stress check. It records save, wire-codec, and memory
measurements under ignored `test-results/`, then checks all 40 undos restore the original state.
The `ability-icons-performance` native scenario additionally measures both real window updates.

## Class overlay palettes

`hud-themes.js` contains the immutable palette registry, stable identifiers, safe Default
fallback, and DOM application helper. `hud-themes.css` loads after the existing HUD styles in
both windows; every rule is scoped to `.hud-position[data-hud-theme]`. `HUD.mount` applies the
character's theme after decorating controls. Missing/unknown themes add no styling, and
returning to Default removes only the module's variables, attribute, and resource-icon frames.
`TL.character` defaults `theme` to `default`. Character normalization preserves nonblank string
identifiers (up to 300 characters), including unknown choices; missing, blank, or malformed
values use Default. The optional field travels in both character collections; it first shipped
with format 10 and is retained in format 11 alongside the passive foundation.

Create and Edit use the same palette registry for the Theme dropdown. An unknown identifier
gets an escaped selected option labeled "Default (saved theme unavailable)" so saving unrelated
fields does not erase it. Explicitly selecting Default replaces it. Theme and free-form class
name are separate fields. The existing changed-field merge includes `theme`, preserving later
HUD spending and other characters' settings; theme edits do not invalidate pending requests.
Only Save commits the choice. Existing Undo, roster membership, and backup paths retain it.

Each class uses the planned dark surface/highlight pair, derived panel/control/hover/border
colors, and common readable text/semantic colors. The outer frame uses the existing background
opacity setting; reading areas and controls stay opaque. Spent and disabled states retain text
contrast using dashed borders and the existing labels, rather than fading the whole subtree.
The class-theme damage/concentration reminder stays fully visible instead of pulsing dimmer.
Default continues using the original styles, including the original animation and opacity.

Player accent values and portrait rings are untouched; themed initials use readable text.
Ability images keep their pixels and neutral backing. Resource shapes retain their stored
color/clip path inside the same 16-pixel footprint, with a 14-pixel shape on a one-pixel black or
white backing chosen for contrast. Default removes that frame. Borders, backings and focus
outlines do not change HUD sizing, position, scale, rotation, or hit regions.

`docs/theme-preview.html` renders synthetic expanded/collapsed examples of all 14 choices,
using the real HUD renderer and styles, with map/opacity/view controls and no app bridge or
saved state. Native theme checks inspect computed/composited text and control colors in both
windows, compare Default with the theme sheet disabled, and check independent themes, geometry,
artwork, resource colors, hover/focus, warnings, and click-through. Physical TV viewing distance
is outside automated coverage. Message UI tests also check text/control contrast in all 14 palettes.

## Player-message delivery

`message-service.js` owns a separate main-process session, instantiated beside the approval service.
It retains at most one message per active character ID, independent of name, initiative, theme,
resource values, and placement. Bodies are plain text, nonblank, limited to 2,000 Unicode code
points, and preserved verbatim. Sending into an occupied slot requires the exact previous message
ID. Closing retains the message and opened history; dismissal deletes it. There is no inbox or expiry.

`messages:snapshot` and `messages:state` contain metadata only: session/global revision, transport
availability, character/message IDs, command revision, presentation ID, sent/delivered/opened times,
requesting actor, unread, open, current indicator/body visibility, page/count, scroll sequence/direction,
and stacking order. These are separate from party,
approval, backup, and HUD payloads. No message body enters gameplay Undo or the save format.

`messages:command` validates the actual top-level sender frame and window. The DM may send, force
open, close, and dismiss; the overlay may open, close, and acknowledge indicator/body display.
Both roles have page/scroll commands, with player reading commands rejected in click-through.
Each command carries a session ID, unique request ID, and character ID. Existing-message operations
also require the exact message ID, revision, and presentation ID. Same-request retries return a
receipt without repeating effects. Session-long replay records store a digest and result metadata,
never the command text, so delayed retries after dismissal or removal cannot resurrect messages.
Unknown windows, wrong-role operations, stale sessions/views, and inactive recipients are rejected.

The DM may explicitly retrieve a selected body through `messages:body`. The overlay can retrieve
only a current, open message for a visible character in a connected, visible TV window. Responses
carry all view identifiers; renderer code must discard a response whose identifiers no longer match
the current metadata. A player body response also carries a per-presentation body token. Neither
an open request nor fetching its body marks it read. An `ack-opened` must return that token for the
same current visible presentation. First indicator acknowledgement records delivery; each new
acknowledged opening records the latest opened time and whether the player or DM requested it.
Unread becomes false after an acknowledged opening and stays false until replacement.

The service reconciles active membership after successful approval-service state changes. Removal
deletes the recipient's message; Undo/rejoining cannot recover it. Successful backup restore emits
`change.restored`, including confirmed restores, and starts a new message session. Cancelled or failed
restores do not. Ordinary saves, theme changes, spending, and gameplay Undo retain other messages.
App restart creates an empty service. No message bodies or command text are written to logs.

Hiding a character or the TV, changing collapsed/expanded state, changing displays, and renderer
reload/loss close exposed text and invalidate presentation tokens, retaining historical read status.
Metadata resync never automatically reopens a body. Force open rejects unavailable recipients rather
than queuing future exposure. Click-through keeps its existing native mode: player open/close are
rejected, while DM operations, body fetches, and renderer acknowledgements remain available.

`message-client.js` supplies lossless bounded text pages and an ordered metadata subscriber in both
renderers. A late initial snapshot cannot overwrite a newer session event; retired sessions cannot
be resurrected by delayed responses. Page changes invalidate the presentation/body token while
retaining read history; new page acknowledgements record the latest display. Scroll commands are
deduplicated within the current presentation. Reopening retains the selected page; changing
interaction mode retains the current page. Repeated open requests raise only that card.

`message-dm.js` implements the Messages sidebar page. Drafts, confirmation targets, retry request
IDs, and explicit laptop-review text are separate from party state. Recipient changes retain the
corresponding draft; removal never selects a different recipient silently. Replacements bind to
the reviewed message ID. Errors retain draft text; successful session reset clears drafts. Only
the selected note's explicit laptop-review request retrieves its body, without a TV read receipt.

`message-overlay.js` adds a fixed-size envelope within existing bubble/HUD bounds and renders text
through `textContent`. It discards stale body responses and acknowledges the current presentation
after two animation frames and a visible, connected, on-screen DOM check. Unread badges have a
five-second pulse with a reduced-motion override. Metadata and party updates do not remount the
reading area, preserving the current page and keyboard focus. Failed loads remain unread and offer retry.

Reading cards use the character palette with an opaque surface, including Default, and inherit the
character's rotation and scale. They are at most 480 × 320 CSS pixels before scale, reducing their
own dimensions for small viewports without rewriting HUD settings. Expanded messages sit visually
inside the existing HUD frame; collapsed cards fit independently around the saved center. No
full-screen backdrop or saved section/detail/page change is needed. `messages.css` enables pointer
input on the card only when HUD controls are enabled; DM controls remain usable in click-through.

The separate message layer publishes additional native regions only for collapsed cards. The
validated maximum is 17 frames (eight HUDs, eight cards, one notice); Windows receives every rotated
frame. Expanded cards stay within their existing HUD region. Mail controls cannot initiate a HUD
gesture. Starting a TV HUD drag closes that character's message before the gesture completes,
and the existing gesture cleanup restores normal map-input regions. A dismissed/hidden/closed card
is removed immediately and publishes updated regions. DM layout previews add disabled badges only.

All players share one renderer and TV: recipient targeting is not a private-device security boundary.
An opened message is visible to nearby people; the composer states this next to Force open.

## Tests

The installed-update harness additionally checks format 11 passive/hybrid definitions,
independent reminder and personal cost settings, local/unused passives, and HUD scale/rotation.
It verifies replacement of an intentionally different old PDF and the installed Help-to-guide
path before and after the update. Its viewer callback is simulated; interactive reader and
offline installer checks are tracked separately in
[the passive/guide release check record](PASSIVES_AND_GUIDE_RELEASE_CHECKS.md).

`installed-party-fixture.js` shares the synthetic party and its assertions between the real
installer harness and `upgrade-data-native.js`. The latter uses two separate Electron processes
to check save/restart independently of installer availability. It also verifies personal reminder
changes/Undo, passive-use rejection, the guide bridge and cleared transient messages. It does not
pretend that restarting the app proves an installation. `wait-installed-result.cjs` retains an
early process-launch rejection and distinguishes it from a normal old-process exit; focused
tests cover that failure, successful restart reporting and missing-result timeout.

Unit tests cover cost spending, migration, linked definitions, independent bindings, save recovery, geometry, command validation, and stale-editor merging. Native scenarios exercise the real renderer and Electron windows using synthetic state, capture screenshots, and verify persistence. Run them with `npm run test:native` in a Windows desktop session. The native harness creates a unique user-data directory per scenario and never reads the normal party file.

`visual-improvements-native.js` combines artwork, independent themes, message cards and pending
approvals in one session. It exercises real editor upload, simultaneous player HP commands,
an older theme editor, definition-change and restore guards, and native backup export/import.
Shared definition edits, including icon edits, retain the existing pending-use review; theme
changes do not invalidate ability reservations. Cancelling either guard leaves messages intact;
only a successful restore resets their session.

The combined scenario records connected display bounds and scale factors, plus separate simulated
1280 × 720, 1920 × 1080 and 2560 × 1440 viewports. It preserves saved HUD settings for mixed
40–250% scales and five rotations. Interaction-mode changes keep the existing addition/removal
of HUD editing controls; the inner collapsed bubble remains 78 × 78. Automated results and the
remaining physical TV checklist are recorded in [the visual review](VISUAL_IMPROVEMENTS_REVIEW.md).
