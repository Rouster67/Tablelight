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

Expanded containers are fixed at 880×650 CSS pixels before scaling: 50px reserved for the toolbar and a 600px card. The card uses a 344px summary column and a flexible section browser on the right. Both columns have bounded scrolling; navigation stays above the section scroll area. The reserved toolbar space keeps dimensions stable when interaction is disabled. Collapsed portraits retain their existing dimensions.

`HUD.mount` applies the stored scale exactly and uses `fitHud` only to adjust position. Oversized axes are centered instead of silently shrinking. It restores per-character summary scroll on redraw and section scroll when panel/detail/page are unchanged. The DM preview shares the rendering path. Currently displayed resizing uses the same bounded placement command as other controls. Its scroll buttons wait for pending saves, then use DM-authenticated `hud:scroll` messages to scroll one active character's named column. These transient scroll messages do not write game state or create Undo entries.

Custom resource counters retain their IDs and bindings. Additive `icon` and `color` fields normalize to one of six CSS shapes and a six-digit hex color; legacy pools default to a circle in the character color. Reset values are short, long, turn, or manual. `startTurn` restores turn controls and per-turn counters; both next-turn traversal and the TV turn command use it. Rests preserve per-turn and manual counters; short-rest pools also recover on long rest. Manual reset is a bounded command. `resource-ui.js` renders inline resource drafts in the character editor; save uses the existing ID-aware merge so appearance edits preserve concurrent spending. All resources render as stacked rows under slots, with matching counters in the paged Resources section.

The controller owns edits. UI changes run through `commit`, normalize the state, add an Undo snapshot, and enqueue saves in order. The main process validates and atomically saves to disk before broadcasting state to the overlay. Overlay controls send bounded commands through main to the controller. Pointer gestures use document capture listeners, including when a pointer leaves a transparent region.

On Windows, `window-shape.js` converts each rotated HUD into horizontal rectangles for Electron's native `BrowserWindow.setShape`. The renderer reports validated HUD frames through overlay-only `hud:regions` messages after painting. Windows routes input directly to those areas; gaps pass through to the map. During a gesture, `hud:dragging` temporarily restores the full window region so movement can continue across gaps, then reinstates the HUD regions on completion or cancellation. This avoids relying on forwarded hover events to switch mouse ignoring, which could leave a HUD unreachable. Full click-through mode still uses `setIgnoreMouseEvents(true)`. The renderer publishes regions only when HUD frames or viewport dimensions change. Ordinary stat saves do not rebuild native regions; interaction-mode switches still update immediately. New geometry is validated and calculated once before applying it. The TV window accepts keyboard focus only when HUD controls are on, allowing picker searches.

Only the main process accesses the file system. `storage.js` writes a temporary file, flushes it, preserves a valid previous save, then renames the temporary file over the current save. On load, a corrupt current save falls back to the previous save with a warning. If both fail, they remain intact and the app reports an error.

## Shared library

Save format version 9 keeps `library` and `conditionLibrary` alongside `characters` (active
party), `roster` (inactive saved players), `settings`, and `activeId`. Library entries own
`name`, `kind`, `economy`, `level`, `usesSlot`, `requiresConcentration`, and the manual text
fields: `trigger`, `duration`, `range`, `area`, `castingTime`, `components`, `school`,
`attack`, `save`, `onSave`, `damage`, `upgrades`, `requirements`, `special`, `description`,
and `source`. The visible Reference label retains the existing `source` storage key.
Library-linked assignments serialize only `id`, `libraryId`, `resourceId`, `resourceCost`, and `disabled`.
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
definitions. Position, scale, rotation, fixed 880 × 650 frame, and internal scrolling stay intact.
Library search and exact-content matching include every new text field.

`normalize` resolves library definitions into character items in memory. `toBackup` removes
repeated definition fields before serialization. Shared edits reach active and inactive players;
changed-field merging preserves concurrent HUD spending. Untouched inputs retain their original
text, including legacy whitespace or line breaks that a single-line input cannot display.
DM details refresh when shared text changes.

Formats 1–8 import into format 9. Older missing fields become blank; legacy unlinked items match
by their full normalized definition content. Different same-name definitions remain separate.
Missing references and duplicate definition IDs remain errors. IDs, selections, resources, and
all character state are preserved. Older readers reject format 9 rather than promote local copies
into the shared library. Inactive roster, overlay rendering, resource spending, concentration,
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
the party, roster, and both libraries. Existing snapshot Undo behavior is unchanged; targeted use
undo and notices remain a separate, unimplemented milestone.

## Conditions and concentration

Condition definitions contain `id`, `name`, and `description`. Characters store unique `conditionIds`; normalization resolves `appliedConditions` for rendering. Backups strip these resolved copies and retain definitions once. The overlay receives only active characters' resolved conditions. Shared editing, assignment, removal, and protected deletion work across both player collections. Names and descriptions render as escaped text, with native title tooltips. There are bounds of 5,000 definitions, 500 assignments per character, 300 characters per name, and 40,000 characters per description.

The DM Add dialog searches existing entries or creates and assigns a definition in a single undoable commit. The TV's Add menu uses an overlay-authenticated, read-only `hud:conditions` query while HUD controls are enabled. Queries return at most 100 alphabetical name/description matches, with a total count; they do not include character data. Its bounded `condition-add` command accepts only existing IDs and active party members, preventing creation from the TV. The menu preserves its search and internal scroll during state updates, ignores stale search responses, and closes when its HUD is hidden, collapsed, or made click-through. Summary scrolling is restored after transient forms mount so their added height remains available.

Formats 1–3 migrate automatically. A legacy character condition note becomes one complete definition, retaining punctuation and qualifiers; identical notes share an entry. Formats 4–5 require a condition library array and reject missing references or duplicate definition IDs.

Ability definitions include a shared `requiresConcentration` boolean, defaulting to false for every kind and economy. The DM and TV selectors filter the character's resolved items by that flag, with name/description search. They include spent or disabled entries because tracking concentration does not itself spend costs. Selecting sends a character-specific item ID; validation rejects unassigned or unflagged abilities and free-text requests.

Concentration uses `concentrating`, `concentrationItemId`, and a resolved `concentration` display name. These are additive fields in save format 4. Normalization resolves the selected binding after applying shared definitions, follows name edits, and ends concentration if the binding is removed or its flag is cleared. Ending concentration and long rest clear all three fields. Legacy active notes without an item ID remain visible until the user ends concentration or selects an ability; migration never guesses flags or matches abilities by name. Picker searches and scroll positions survive unrelated updates. Conditions are never removed automatically by rests or turns.

The shared `spend` path validates availability, any required slot choice, and acknowledgement of the current concentration warning before changing concentration or costs. A flagged use calls `setConcentration` for the acting character's assigned ability; an invalid assignment fails before spending. Both DM and HUD uses run inside one controller `commit`, so the selected ability and its costs share a save and an Undo snapshot. Unflagged uses leave concentration unchanged. Manual concentration selection continues to spend no costs.

## Roster and party

Each player exists exactly once, either in `characters` or `roster`. IDs must be unique across both collections. `characters` has a hard maximum of eight; `roster` has no fixed count limit. `allCharacters` and `findCharacter` supply shared-library and editing operations across both collections. `addToParty` and `removeFromParty` move the same character object without resetting live values or HUD settings. Joining appends to initiative order; removing the current player selects the next remaining player without starting their turn. Removing the final party member clears activeId.

The controller stores the complete roster in memory for editing and atomic saving, but renders only active players in the session console, initiative editor, and layout preview. The sidebar's Party section uses the characters array in order. Its All characters section independently sorts inactive roster entries alphabetically, without mutating either stored collection. Both the sidebar saved list and roster management render twelve searchable rows per page. Party and saved lists scroll independently, and controller rerenders preserve scroll and sidebar search focus. Sidebar buttons reuse the existing membership and deletion handlers. Full state and forty Undo snapshots still consume memory proportional to roster size; unlimited means no fixed player count, not unbounded hardware capacity. The former 80 MB import guard is removed, so large backups are subject to the runtime's JSON/string and available-memory limits.

Main uses `overlayState` for both initial overlay loading and later broadcasts. Only the active party is sent, with resolved ability text. The inactive roster, unused shared library, and private DM notes are omitted. HUD commands continue to reject IDs outside the active party. Whole-party rests, automatic layout, and turn traversal operate only on `characters`.

Versions 1 and 2 migrate with an empty inactive roster and keep existing characters in the active party. Versions 3 and 4 require a roster array, and invalid collections or duplicate IDs reject the save rather than dropping players. `toBackup` strips repeated definition metadata from both player collections, preserving references and individual resource bindings.

## Session controls

Library spell levels may be null (None), zero (Cantrip), or 1–9. Non-spell definitions normalize to null. Slot spending only applies to leveled spells with standard slot use enabled.

Saving throw expertise is an additive saveExpertise array alongside the legacy saves array. Expertise implies proficiency. Skill ranks remain 0/1/2. All training controls use the same rank and bonus helpers; editor merges preserve unrelated live changes.

characters array order is the displayed initiative order, persisted without changing HUD placements. Older saves migrate once to their previously calculated initiative order. settings.partyOrderVersion marks that migration; subsequent manual orders are authoritative. The shared panelChoices list supplies both TV and DM navigation. Currently displayed reads the selected character’s HUD panel, detail ID, and page so either screen can control the same content.

## Tests

Unit tests cover cost spending, migration, linked definitions, independent bindings, save recovery, geometry, command validation, and stale-editor merging. Native scenarios exercise the real renderer and Electron windows using synthetic state, capture screenshots, and verify persistence. Run them with `npm run test:native` in a Windows desktop session. The native harness creates a unique user-data directory per scenario and never reads the normal party file.
