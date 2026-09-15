# Changelog

## Unreleased

- Add a combined desktop regression for icons, themes, player messages, pending approvals, and backup restores, using isolated one-, two-, and eight-player parties. Correct the guide to describe save format 10 and consolidate the release review checklist.

- Add Messages to the DM sidebar, with independent player drafts, recipient portraits, explicit replacement, and sent/delivered/opened status. Players receive an envelope without a text preview and can open, page, scroll, and close the note; the DM can force open, page, scroll, close, or dismiss it while click-through remains enabled.
- Render messages in the recipient's theme and orientation, inside expanded HUD frames or temporary cards for collapsed players. Preserve saved HUD settings and map-input gaps, support eight simultaneous messages, and show only notification state in DM layout previews. Unread envelopes pulse for five seconds and stay steady with reduced motion. Opened text is visible on the shared TV.
- Retain one plain-text message per active character, with explicit replacement, separate sent/delivered/opened receipts, and checked DM/player commands. Messages stay out of saves, backups, and gameplay Undo; hiding or reloading closes text, while removal, successful restore, and app restart clear the appropriate messages.
- Add Theme to Create and Edit character, with Default plus all 13 class palettes, including Artificer. Each choice is independent of the entered class and other players and applies to the bubble, expanded HUD, and DM preview. Preserve choices through saves, backups, remove/rejoin, and Undo; changing a theme leaves live spending and pending approvals intact.
- Keep Default for older saves and retain unknown theme identifiers while displaying Default until a replacement is chosen. Class themes keep reading surfaces opaque over maps and preserve player rings, ability artwork, resource colors, and HUD geometry.
- Add a local class-palette review page under `docs/theme-preview.html`, with bright/dark/patterned maps, frame opacity, and ability/detail/sheet views. The page uses synthetic characters and does not save changes.
- Add custom ability images: Upload, Replace, Remove, and preview controls for shared and character-only spells, actions, and features. PNG/JPEG/static WebP imports fit within 256 pixels without cropping and travel with party backups. Cancel and failed imports preserve the current image.
- Show matching fixed-size thumbnails in the DM library, assignment picker/preview, character lists/details, and TV HUDs. Keep the usual ability symbol when artwork is absent or cannot load, alongside visible names and availability labels.
- Keep shared image edits synchronized across active and inactive characters while preserving individual resource settings and live spending. Reuse immutable image data in Undo snapshots and send each distinct PNG once per window update to avoid repeated image copies in large parties.
- Save format 10 preserves ability images with shared definitions and existing character-only copies, imports formats 1–9, and rejects damaged icon data before replacing valid saves.

## 1.11.0 — 2026-09-14

- Move the History icon to the right of the DM sidebar so Add character and Setup & help remain visible and clickable on wide and narrow windows.
- Keep keyboard focus inside History when its actions or list refresh, and restore focus to the underlying dialog after canceling a dependency warning.
- Add History beside the bottom of the DM sidebar for the five most recent resolved requests, with recorded ability details, outcomes, and actual costs. Reconsider opens a new request using current ability details and costs while preserving urgent priority and preventing duplicate attempts.
- Add Undo this use to refund only an approved use’s recorded costs and concentration change. Preserve later tracked spending and unrelated work; block the complete refund after relevant resets, corrections, capacity changes, or concentration changes. Warn before denying pending requests that depend on refunded counters.
- Coordinate ordinary Undo with History and targeted refunds, including costless uses, so labels and counters agree and refunds cannot be duplicated. Save failures preserve the prior state for retry.

- Grow the player HUD vertically to keep its entire character summary, spell slots, conditions, resource list, and Smaller/Larger buttons visible without scrolling. Put pending approvals in a separate far-right column without narrowing the ability browser. Preserve chosen scale and rotation, update the TV preview, and adapt native click regions to the taller frame.

- Add DM approval for player-overlay ability uses. Pending requests reserve costs only on the player's HUD; the DM reviews full details and can Allow use, Deny use, View character, or Minimize. Direct DM-console uses remain immediate.
- Add the bottom-right DM queue, a three-request limit for ordinary abilities, and red Urgent reactions outside that cap. Incoming requests wait quietly while a popup or earlier request is open. Players can cancel each pending use; a full queue displays a small popup.
- Warn before applying changes that affect pending requests. Continue denies those requests, or expires them for a new turn; Cancel keeps the draft, requests, and counters intact. Concentration switches on approval. Save failures leave requests available for retry.
- Keep queue state in memory across window reloads and clear it on app exit. Existing saves remain format 9. History, reservations, spending receipts, and dependency markers are session-only and stay out of backups.
- Replace blocked deletion of assigned abilities with a warning listing every affected character, a white Edit instead button to the left of the yellow Make local copies and delete button, and a Remove and delete choice. The local-copy checklist defaults to everyone, includes inactive characters, and preserves each kept assignment's name, costs, HUD selection, and concentration. Confirmed deletion supports Undo and requires another review if assignments change while the dialog is open.
- Mark local ability names with a small person icon on the character screen and HUD. Add smaller Create new local ability and Create local-only copy buttons beneath the shared Add choices, with hover explanations. New local abilities and direct library copies belong only to the selected character.
- Add Duplicate to the ability library and a compact copy icon between Use and Edit on character ability rows, with the tooltip Duplicate locally only. Copies receive numbered names and open for editing. Character-only copies keep independent details, slot settings, and resource costs without entering the shared library.
- Keep local copies through saves, exports, inactive-party moves, and Undo. Save format 9 imports formats 1–8 and prevents older readers from converting local copies into shared entries.
- Add manual Trigger, Area, Casting Time, School, On Save, Requirements, and Special fields to every ability type. Keep Attack and Save as user-written text, with no automatic ability calculations. Keep the existing Type dropdown and explicit turn-cost tracking, and allow Spell Level on every type.
- Label the checkbox Concentration and rename Source to Reference. Keep Reference beneath Description at the bottom right and Upcast / Upgrades directly beneath Damage / Healing. Fields can be left blank.
- Show consistent manual details on the DM screen, assignment previews, and player HUDs. Search the new fields and page long Description, Upgrades, Requirements, and Special sections while preserving the chosen HUD scale and rotation.
- Preserve shared-library behavior, each character's resource links and charge costs, existing text, and later resource spending when saving an open editor.
- Add shared source references and upcast/upgrade text. Blank details stay hidden; upgrades describe improvements without calculating or applying damage, healing, or effects.
- Preserve manually entered fixed values from the earlier calculation preview as text, with separate library variants for personal exceptions. Remove its automatic modes and numeric controls.

## 1.10.2 — 2026-09-13

- Add an optional Remove all saved data choice to the Windows uninstaller, unchecked by default and requiring a separate confirmation. Ordinary uninstalls keep saves; confirmed removal clears characters, ability and condition libraries, portraits, resources, notes, settings, and the previous save. Both choices clean up the installed program, shortcuts, and update cache. Updates preserve saved data and their download cache, and command-line deletion cannot bypass the choice.
- Uninstall the copy that was launched, including custom folders with missing or stale Windows installation records, and refuse cleanup from an unidentified folder.

## 1.10.1 — 2026-09-13

- Keep in-app updates in the running application's installation folder, including custom folders and missing Windows installation-path records. This prevents a second copy from leaving the usual launch stuck on the old version.
- Expand the real installer regression test to verify preservation of players, assigned and unused ability and condition libraries, portraits, resources, slots, concentration, notes, settings, the previous save, and the update preference.

## 1.10.0 — 2026-09-13

- Contain rejected update redirects as ordinary download failures and limit redirect loops, keeping the app open and allowing a retry.
- Added optional stable-release checks at launch, with a DM update offer, Later, a sidebar update icon, and manual Check now under Setup & help. Checks run in the background; offline failures do not interrupt play. No character, party, or library content is sent.
- Added a Windows installer and consent-based Update and restart, including download progress, cancellation, verified downloads, and a successful-save requirement before installation. Existing portable users install this version once; saved data stays in the existing folder and is preserved on uninstall. The automatic-check preference is separate from party backups and Undo. Installers remain unsigned.
- The DM title bar now shows the application version. Both the title bar and existing sidebar version label read the running app's package version automatically.
- Using an ability marked Requires concentration now automatically starts concentration on that ability or switches to it after confirming the existing warning. This works for every flagged ability type on the DM screen and player HUD. Cancel and failed uses preserve the previous concentration and costs; Undo restores both together.
- Added a confirmation warning when using an ability marked Requires concentration while already concentrating, on both the DM screen and the player HUD. Cancel spends nothing; continuing spends the normal costs. The warning names the old ability and checks the current concentration again before spending.
- Added a gently pulsing concentration icon beside the DM Damage button, the damage dialog's Apply button, and the player HUD's HP decrease buttons. Hovering shows the selected ability when available. The icon follows live concentration changes and Undo, keeps the controls in place, and stays steady with reduced motion enabled. Damage does not automatically end concentration or roll a saving throw.

## 1.9.2 — 2026-09-10

- Avoid rebuilding Windows HUD click regions for ordinary HP, resource, and menu-text updates. Geometry changes and interaction-mode switches still update immediately; new geometry is validated and calculated once.
- Verified the complete app workflows and release archives, including a fresh source install and Windows build. Added a native regression check that live HP updates leave unchanged click regions alone.

## 1.9.1 — 2026-09-10

- Added Remove from character beside the existing controls in every DM ability list, including actions, bonus actions, reactions, spells, and features. Removal keeps the shared definition, asks for confirmation, and supports Undo. The four controls fit together in two compact rows.

## 1.9.0 — 2026-09-10

- Added a shared Requires concentration checkbox to every ability type, including actions, spells, and features with any turn cost. Existing entries default to off.
- Replaced concentration text entry with searchable DM and TV lists containing only the selected character's assigned, flagged abilities. Choosing an ability lights the icon and sets its hover name; Cancel leaves concentration unchanged. The DM can change the selected ability.
- Saved concentration by character ability ID so shared renames update the display. Removing the selected ability or clearing its flag ends concentration. Selection does not spend costs; existing manual notes remain visible until replaced or cleared.

## 1.8.1 — 2026-09-10

- Replaced the DM's Assign / remove condition picker with Add. Search existing conditions or choose Create new; Save & add creates the shared definition and applies it to the selected character together.
- Added Add beside Conditions on interactive TV HUDs. Search and apply existing library conditions, with already-applied entries marked Added. The TV cannot create definitions.
- Kept condition menus inside each HUD's fixed size and rotation. Search focus, text, and scrolling survive live updates, and the menu reflects shared-library edits.

## 1.8.0 — 2026-09-10

- Fixed Windows input routing for moving and rotating individual TV HUDs. Native window regions follow each rotated HUD; empty map areas stay click-through, and dragging continues across gaps. HUD controls also allow keyboard focus for text entry.
- Added a lit Concentrating toggle on the expanded HUD, with an optional note, hover text, and Save or Skip controls. The DM can toggle concentration and edit its note. Blank notes remain active; turning concentration off clears the note.
- Added a searchable Condition library with user-entered names and descriptions, shared editing, character assignment, and Delete beside Edit. Assigned conditions appear in a Conditions table with hover descriptions and individual removal controls on the DM screen and interactive TV.
- Added save format 4. Existing condition text and concentration notes migrate automatically. Both libraries and all character assignments are included in backups; assigned library entries are protected from deletion, and changes support Undo.

## 1.7.1 — 2026-09-10

- Added Delete directly beside Edit in every Ability library row. The buttons stay together on smaller windows. Deletion uses the existing confirmation, Undo, and protection for entries assigned to characters.

## 1.7.0 — 2026-09-10

- Fixed expanded HUDs at a consistent frame size across all sections, ability details, pages, live updates, and interaction modes. The chosen scale is applied exactly; display fitting only adjusts position. Long content scrolls inside the two columns.
- Added a 40–250% size slider, Smaller, Larger, and 100% controls to Currently displayed, plus separate TV scroll controls for vitals/resources and section details. Reading position survives live updates.
- Moved custom resource creation, editing, and removal into Edit character, below spell slots. Each counter has a name, maximum, available amount, one of six shape icons, and a color. Existing resource IDs, counts, reset rules, and ability links are retained.
- Added per-turn resource recovery to Start turn and Next turn. Short-rest pools also recover on long rest; long-rest pools only recover on long rest. Manual counters have Reset buttons on the DM screen and interactive TV HUD.
- Stacked every custom resource beneath spell slots, with wrapped names, counts, and spending controls. The Resources section retains paging. Cancel and Undo cover editor changes; saving preserves concurrent TV spending.

## 1.6.0 — 2026-09-10

- Changed expanded HUDs to a wide, two-column layout. Portrait, HP, turn controls, stats, slots, and charge summaries stay on the left; navigation and the selected section's data sit on the right.
- Moved sheet skills and saving throws, option lists, full descriptions, resource controls, and pagination below the right-hand navigation. Overview now includes the character's class, species, level, and proficiency.
- Kept both columns inside the same rotated character container, with matching laptop previews and automatic fitting to the display. Collapsed portraits retain their small size.
- Kept section labels and selected-section data visible in click-through mode while disabling direct interaction.

## 1.5.0 — 2026-09-10

- Removed the round counter and automatic round counting; Next turn still follows the party order and wraps to its beginning.
- Added two separate lists to the left sidebar: Party in the DM's initiative order, then All characters for saved characters outside the party in alphabetical order.
- Added Remove from party and Delete character to every party entry, and Add to party and Delete character to every saved entry. New party members append to the bottom of initiative order.
- Added independent list scrolling and saved-character search and paging. Renaming or removing a character refreshes alphabetical placement; live updates preserve search focus and list scroll positions.
- Kept the party filter in Players & party in initiative order. Both sidebar deletion controls use confirmation and session Undo.

## 1.4.0 — 2026-09-10

- Added Players & party: a searchable, paginated saved roster with no fixed player limit and an active party of up to eight.
- Added Add to party, Remove from party, and Delete player controls. Removal keeps the complete character and HUD setup; deletion retains shared library entries and can be undone during the session.
- New characters can be saved outside the party, including when all eight seats are occupied. Saved players can be edited without joining the party.
- Kept session controls, initiative, rests, table layout, and TV data limited to the active party. TV messages exclude inactive players and private DM notes.
- Extended automatic seating to seven or eight players. Shared library changes also update players outside the party.
- Added save format version 3 with automatic migration from older saves. Full backups include every saved player and party membership. Removed the old 80 MB import ceiling so larger roster backups can be restored, subject to available memory.

## 1.3.0 — 2026-09-10

- Added None as the default spell level, distinct from Cantrip; actions and features do not require a spell level.
- Added visible temporary HP controls beside HP on the DM screen and the interactive TV HUD.
- Added separate P (proficiency) and E (expertise) bubbles for skills and saving throws in the editor and both character sheets.
- Added sidebar drag-and-drop and arrow controls, plus an initiative editor with sorting. Next turn follows the visible party sequence; reordering retains TV seating and the current player.
- Added Action, Bonus action, Reaction, and Free / other tabs to the overlay, including all matching spells and features.
- Added Currently displayed to the DM screen, with matching tabs, the current list or description, and page controls synchronized with the TV.
- Fixed ordinary editor buttons inadvertently submitting their forms. Saving an open character editor preserves other saving throws changed directly from the TV.

## 1.2.0 — 2026-09-10

- Added a shared, searchable ability library with type filters and shared editing.
- Added Create new and Choose existing when adding abilities to a character.
- Kept resource bindings, charge costs, and unavailable flags independent for each character.
- Migrated old character abilities into library definitions, deduplicating exact content and preserving same-name variations.
- Added save format version 2 with definitions stored once and character references stored separately.
- Added a clean source distribution, GPL-3.0-or-later licensing, development documentation, reproducible dependency lockfile, Windows packaging script, and GitHub CI configuration.

## 1.1.0 — 2026-09-10

- Added direct TV interaction, independent bubble drag and rotation handles, and a full click-through toggle.
- Allowed multiple expanded HUDs by default, retaining separate position and rotation.
- Preserved live HUD changes when saving an already-open character editor.

## 1.0.0 — 2026-09-10

- Initial local character tracker, manual abilities and resources, transparent TV HUD, editable layouts, portraits, and party backup support.
