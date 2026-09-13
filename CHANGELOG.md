# Changelog

## Unreleased

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
