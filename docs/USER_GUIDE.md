# Tablelight 1.10.2

A Windows app for a dungeon master’s laptop and a TV battle mat. Save as many players as you need and choose up to eight for the active party. All spells, actions, and features are entered by you; no rulebook content is bundled.

## Open the app

Run **Tablelight-Setup-[version]-x64.exe** to install Tablelight for your Windows account, then open its shortcut or **Tablelight.exe** in the chosen folder. No Tablelight account or Node.js is required. Once downloaded, the installer can run offline; local play and saves also work offline.

If you used an older portable copy on this computer, install this version once to enable in-app updates. It uses the same saved-party folder. When moving to another computer, install Tablelight there and transfer an exported party backup. Uninstalling keeps your saved data by default.

The DM window title shows **Tablelight [version] — DM Console**. The same version appears below **Setup & help** in the sidebar. Both show the running application's version, so you can identify which copy is open when testing or reporting a problem.

## Updates

After the DM screen opens, installed copies check GitHub for a newer stable release. A new version offers **Update and restart** and **Later**. The prompt waits until an existing editor or dialog closes. **Later** leaves a small download arrow beside the sidebar version; click it to reopen the offer. **Release notes** opens the official release page in your usual browser.

**Update and restart** downloads and verifies the installer, saves the latest party, installs, and reopens Tablelight. The TV overlay starts hidden again. **Cancel download** keeps the current version open. If downloading or saving fails, Tablelight stays open and lets you retry. It never installs merely because you close the app or dismiss the offer.

Under **Setup & help → Updates**, turn off **Check for updates at launch** to stop automatic checks. **Check now** still works when this is off. Current versions and offline launches show no update popup; manual results appear in this section. The setting belongs to this computer and is separate from party backups and Undo.

Checks request only public release information from GitHub. Choosing Update downloads program files; no characters, portraits, party information, notes, or libraries are uploaded. GitHub receives ordinary connection information such as your public IP address. Play and saves work without internet. See **docs/UPDATES.md** in the included source for details.

The installer is currently unsigned. Windows may show an unknown-publisher warning or block it under stricter device policies. Download only from the official Tablelight repository. If installation cannot finish, keep your saved data and run the official installer again.

## Uninstall Tablelight

Close Tablelight, then use **Windows Settings → Apps → Installed apps → Tablelight → Uninstall**,
or run **Uninstall Tablelight.exe** in the installation folder.

The wizard removes the installed program, its shortcuts, and cached update downloads. Leave
**Remove all saved data** unchecked to keep your content and settings for a later reinstall.

For a fresh start, select **Remove all saved data** and confirm the separate deletion warning.
This permanently removes this Windows user's Tablelight characters, active party, saved roster,
ability and condition libraries (including unused entries), portraits, resources, spell slots,
concentration, notes, settings, update preference, and previous save. Export a party backup first
if you want a recovery copy. Keep exported backups in a separate folder, such as Documents;
files stored inside the installation folder are removed with the program.

Canceling the warning returns to the choice without uninstalling or deleting data. Updates always
keep saved data and do not offer this deletion choice. The uninstaller works offline. If files
are locked or a data folder contains a directory link, it reports incomplete cleanup rather than
following that link or claiming everything was removed. Other Windows users' saves and separate
portable/source copies are not removed.

## Set up your first session

1. Connect the TV over HDMI. Press **Windows + P → Extend**.
2. Put your player’s D&D Beyond browser on the TV. Keep your DM browser and Tablelight on the laptop.
3. In Tablelight, choose **Create a character**. Add stats, HP, AC, ability scores, skills, spell-slot totals, and a portrait. Leave **Add to active party** checked to include this player in the session.
4. Add spells and other abilities with **+ Add → Create new** or **Choose existing**. New entries are saved to your shared library and added to this character. Choose the type and turn cost: action, bonus action, reaction, or free/other.
5. Create charge pools under **Resources**. Link an ability to a pool and choose how many charges each use spends.
6. Open **TV & layout** and select the TV. Choose **Arrange around TV**, then drag and rotate each player’s portrait as needed.
7. Click **Show TV overlay**. Each player’s bubble appears above the player browser. With HUD controls on, you can interact with the bubbles directly. Empty space passes clicks through to the map.

## Saved players and the active party

The left sidebar has two lists. **Party** shows active members in your chosen initiative order. **All characters**, underneath it, shows only saved characters outside the party in alphabetical order. Each list scrolls separately. The saved list includes search and page arrows for larger rosters, with twelve characters per page. Click a saved character's name to edit them without joining the party.

Every Party entry has **Remove from party** and **Delete character** buttons. Every All characters entry has **Add to party** and **Delete character** buttons. Adding a character places them at the bottom of party order; removing them returns them to alphabetical order below. The party supports up to eight characters.

You can also open **Players & party** for a larger management screen. Search by name, class, or species; filter to everyone, active party members, or saved players outside the party. The active-party filter follows initiative order. There is no fixed saved-player limit, subject to your laptop's memory and storage.

- **Create player / Add character:** save a new player. Uncheck **Add to active party** to save them for later. When all eight seats are taken, new players automatically stay outside the party.
- **Add to party:** load a saved player into the session. They join at the end of initiative order. If all eight seats are occupied, remove someone first.
- **Remove from party:** take them out of the DM console, turn order, table preview, and TV overlay. Their complete character, abilities, spent resources, portrait, and HUD position/rotation stay saved. Rejoining restores that setup without refreshing their resources.
- **Edit:** change a saved player's stats, portrait, skills, saves, and spell slots without joining the party. Use the shared library to assign entries to saved players; add them to the party for the full session and resource controls.
- **Delete character:** delete their saved character after confirming. This is available in both sidebar lists, on roster rows, and on the selected player's DM page. Shared library entries remain. **Undo** can restore the player during the current session.

Only active party members participate in **Next turn**, whole-party rests, and automatic TV arrangement. Each active player's Show/Hide bubble setting still applies. You can remove everyone to leave an empty party while keeping all players saved. Tablelight does not count rounds.

## Shared ability library

Open **Ability library** in the sidebar to create, search, filter, or edit your spells, actions, and features. You can build the library before adding characters. It starts empty; all text comes from you.

On a character, **+ Add → Create new** saves a new entry to the library and adds it to that character. **+ Add → Choose existing** searches the library and links an entry you already wrote. You can also use **Add to character** from the library.

Each Ability library row has **Delete** beside **Edit**. For an assigned ability, a warning lists every character using it, including characters outside the active party. Choose:

- **Edit instead** to open the shared editor. This white button sits immediately left of the yellow **Make local copies and delete…** button.
- **Remove and delete** to remove the ability from all assigned characters and delete it from the library.
- **Make local copies and delete…** to choose who keeps an independent copy. A second dialog lists every assigned character, all checked by default. Checked characters keep a local version with the same name and their own resource settings; unchecked characters lose the assignment. **Go back** returns to the warning. **Make local copies and delete** confirms the choices and deletes the library entry.

Existing local copies and spent resources remain unchanged. If assignments change while the warning is open, review the refreshed list before confirming. **Undo** restores a confirmed deletion and its assignments together during the current session.

**Duplicate abilities (unreleased):** Click **Duplicate** on an Ability library row to make a
separate library version. It gets a name such as **Guiding Bolt (1)**, then **Guiding Bolt (2)**
if the first name is taken. The copy opens for editing and is not assigned to anyone automatically.

On a character's ability tab, click the **copy icon** between Use and Edit. Hovering shows
**Duplicate locally only**. The row reads View, Use, copy icon, Edit, with Remove from character
underneath. This adds a separate copy
to that character and opens its editor. A small **person icon** before the name identifies local
abilities in the character list, details, and HUD; hover to see **Only on this character**. You can change all
its text and costs without changing the original or another character. It does not appear in the
ability library, and later library edits do not change it. Numbering checks the names already on
that character. Both duplicate buttons create the copy immediately; Cancel closes the editor and
keeps the copy, while Undo can reverse the duplication.

The character's **+ Add** dialog also has two smaller buttons:

- **Create new local ability**, below Create new, opens a blank editor and saves only to this character. Cancel leaves no new ability.
- **Create local-only copy**, below Choose existing, opens the library picker. Click **Copy locally** to make an independent character copy, even if the shared ability is already assigned. The name stays the same unless it is already on this character, in which case a number is added. The copy opens for editing immediately; Cancel keeps it, and Undo can remove it.

Hover over either smaller button for an explanation. These options never add to or edit the shared library.

For a spell with two special casts per long rest, keep the original linked spell for slot casting.
On the local copy, uncheck **Spend a standard spell slot**, link your special resource pool, and
set **Charges spent per use** to 1. Set that character's pool to a maximum of 2 and **Long rest**
recovery. The local version spends the pool; the original still spends spell slots.

Local copies stay with the character when moving out of the party, reopening Tablelight, and
exporting/restoring backups. **Remove from character** removes that local copy and supports Undo.

For library-linked abilities, the name, description, spell details, and turn cost are shared. Editing them updates every linked character. Each character keeps their own resource pool link, charges spent per use, remaining resources, and unavailable flag. The editor labels these character-only settings separately. Create a local copy when an ability needs different details or slot settings for just one character.

Every ability in the DM’s character lists has **Remove from character** alongside View, Use, and Edit. Confirming removes the ability from that character and keeps its library entry. **Undo** restores the assignment. Deleting a character also keeps the library. Deleting from the Ability library offers the removal and local-copy choices described above. Undo can reverse these changes during the current session.

Existing abilities from older saves move into the library automatically. Exact matches share an entry; different homebrew versions remain separate. Positions, rotations, resources, and selected descriptions are preserved.

**Source references (unreleased):** When creating or editing an ability, optionally enter a
reference such as **PHB pg. 284** or your homebrew notes in **Reference**. It is shared with every
character using that entry and appears in DM details, the Add to character preview, and player
HUD details. The Reference field is below the description, and references appear at the bottom right
of the opened ability's details. Library search also matches sources. Leave it blank to hide it. References are
plain text, up to 300 characters, and do not change any costs or character values.

**Upcast / upgrades (unreleased):** Write improvements from higher spell slots or character levels
in the multiline box directly below **Damage / healing**. This shared field works for spells,
cantrips, actions, and features and accepts up to 40,000 characters. Leave it blank to hide the
section. In an opened ability, upgrades follow the main description and Reference stays last at the
bottom right. Short descriptions and upgrades fit together on one HUD page; longer text uses
Previous and Next, repeating the upgrade heading on its pages. Shortening shared text moves an
out-of-range page to the last available page without changing anyone's HUD size or rotation.
Library search includes upgrade text. Choose the spell slot to spend as usual and apply any
damage, healing, or other improvements yourself; the text does not calculate or apply effects.

**Manual ability fields (unreleased):** Every ability type has Name, Type, Trigger, Duration,
Range, Area, Casting Time, Spell Level, Components, School, Attack, Save, On Save, Damage / Healing,
Upcast / Upgrades, Requirements, Special, Description, and Reference. Enter the text you want to
read at the table. For example, Save can say “DEX 15” and On Save can say “Half damage” or
“No damage.” Attack and Save stay exactly as entered when character statistics change.

Type keeps the existing dropdown. Spell Level offers None, Cantrip, and levels 1–9 for every
type. Casting Time is text; the separate Turn cost dropdown controls action, bonus action,
reaction, or free use. Check **Spend a standard spell slot** to spend a chosen slot for an ability
with a level above zero. Check **Concentration** to use the existing concentration tracker.
Damage, healing, improvements, and other effects remain user-written and manually applied.

All fields may be left blank. A blank Name saves as Unnamed ability. Linked resource pool and
Charges spent per use belong to each character; choose them when adding or editing that
character’s ability. With no character selected, these controls explain where to link a pool.
Shared edits preserve each character’s remaining resources and other independent settings.
For different manual text, create a separate library variant.

Requirements and Special accept long text and appear as labeled sections in DM and HUD details.
The HUD pages long descriptions, upgrades, requirements, and special notes within its fixed
frame. Reference stays last at the bottom right. Empty detail fields are hidden, and library
search includes all these text fields. Existing ability text remains intact.

## Move and rotate individual bubbles

Every character has their own position, rotation, size, and visibility. Moving one never moves another.

- **On the TV:** leave **HUD controls: on** enabled in the laptop’s top bar. Drag a character’s portrait to move their bubble. Drag their **⟳ handle** to rotate freely, or use **↶ / ↷** to rotate in 15° steps. Hold Shift while dragging the rotation handle to snap to 15° increments.
- **Expand:** click a TV portrait or its + button. Its HUD keeps the same rotation. Expanded HUDs have their own **Move** handle, rotation controls, collapse button, and hide button.
- **On the laptop:** use **Position & rotate** or **TV & layout**. Drag individual portraits and use their rotation controls in the preview. The right-hand panel still offers exact position, degrees, and size controls for the selected player.
- **Show or hide one player:** use **Show this bubble / Hide this bubble** on their laptop character page, their visibility checkbox in TV & layout, or the expanded HUD’s × button.

## Use the TV overlay directly

Expanded HUDs use a wide layout. Portrait, HP, AC, actions, movement, ability scores, slots, and all custom resource counters are on the left. Resources stack downward below slots; long names wrap. **Overview, Action, Bonus action, Reaction, Free / other, Spells, Features, Sheet, and Resources** are at the top of the right column, with the selected section's data directly underneath. Sheet shows skills and saves beside the main character controls instead of adding them below. Descriptions, resource controls, and page buttons stay in that same right column.

Expanded HUD dimensions stay fixed as you change sections, read descriptions, and update values. Long content scrolls inside each column. Both columns move, rotate, and resize together as one character HUD. Collapsing still returns to the small portrait bubble. The laptop's TV preview shows the same arrangement.

When HUD controls are on, expanded HUDs can show options and full descriptions, spend actions or bonus actions, adjust HP and movement, use spell slots or custom resource pools, and start a new turn. These actions also update your laptop and save to the same party.

Click an option to show its description. Use **Use ability**, or **Cast L…** for a spell, to spend its costs. Apply any additional ability effects yourself as before.

Only the bubbles and their panels receive clicks; blank map areas remain click-through. Use the laptop’s **HUD controls: on / Click-through** button, or **Ctrl + Alt + I**, to switch to full click-through mode. In that mode the section labels and current data remain visible, while interactive controls disappear and clicks on the HUD reach the map. All laptop controls continue to work.

## Proficiency and expertise

Skills and saving throws show two bubbles: **P** for proficiency and **E** for expertise. Click P to enable proficiency or clear training. Click E to enable expertise; click it again to return to proficiency. Expertise includes proficiency and uses twice the character’s proficiency bonus. A skill’s manual bonus override still takes priority.

Change training in **Edit character**, directly in the DM’s **Sheet** tab, or on the interactive TV **Sheet**. Old saving-throw proficiencies are kept when upgrading.

## Initiative order

The party list on the left is the turn order. Drag players to new positions or use their **↑ / ↓** arrows. Choose **Initiative order** to enter each roll, then **Sort highest first**, or arrange the order with the dialog’s arrows. Click **Save order** when ready.

**Next turn** advances through this visible order and wraps back to the top after the last character. Reordering keeps the active player’s turn, resources, and the TV’s separate positions and rotations. Use **Start turn** if you want to begin with a different player. Adding a party member puts them at the bottom; editing their name or initiative value does not automatically reorder the party.

## Currently displayed

The DM’s character page has a **Currently displayed** panel at the top of the right column. Its tabs match the expanded TV overlay: Overview, Action, Bonus action, Reaction, Free / other, Spells, Features, Sheet, and Resources.

Action-cost tabs include every matching ability, including spells and class features. For example, Bonus action includes your bonus-action spells. Click an ability in the DM panel to open its description on the TV. **Previous / Next** page through longer lists or descriptions. **Back to list** returns from a description. Clicking the TV tabs updates the DM panel too.

**HUD size** changes only this player’s size, from 40% to 250%. Use the slider, Smaller, Larger, or 100%. It stays in sync with TV & layout. The chosen scale stays exactly the same across menus and rotations. If a card is too large for the display, reduce its size yourself.

The **Vitals & resources** and **Section details** arrow buttons scroll the corresponding TV column, including in click-through mode. With HUD controls on, you can also scroll directly over a TV column. Live stat updates preserve reading position; choosing a different section or description page starts its details at the top.

The panel indicates whether the TV overlay, player, or expanded HUD is hidden. Choosing a tab expands that character’s HUD; the global Show TV overlay button still controls whether the TV window is visible.

## During play

- Select a player from the party list, then **Expand player HUD**. Each player expands independently by default, retaining their own rotation. Multiple expanded HUDs can remain visible together. Enable **Expand one player at a time** only if you prefer that behavior.
- **Show options** reveals actions, bonus actions, or reactions. **Show on TV** also reveals spells, features, and other options.
- **View** displays an ability’s full text. Long descriptions are paged; advance them with the controls on your laptop.
- **Use** spends the chosen turn cost and linked charges. For a leveled spell, choose which slot to spend. Spent or unavailable choices turn gray.
- **Spend / Restore** toggles action, bonus action, or reaction availability directly. Slot and resource **− / +** controls support corrections or unusual recovery rules.
- **Temp HP** is shown beside regular HP. On the DM screen, click **Temp HP: …** to set or clear it. The interactive TV HUD also has temporary HP adjustment buttons. **Damage** consumes temporary HP first; **Heal** caps regular HP at its maximum.
- **Start turn** restores that character’s action, bonus action, reaction, movement, and per-turn resource counters. **Next turn** follows the sidebar’s visible party order and starts the next character’s turn. Use **Initiative order** to sort or rearrange that sequence.
- **Undo** reverses the last change, including linked costs. The most recent 40 changes are available during the current session.
- **Collapse to portrait** puts a HUD away. Each player also has a visibility checkbox in TV & layout.

## Concentration and conditions

In an ability's editor, check **Concentration** for any action, spell, or feature that needs it. This checkbox applies to every turn cost and defaults off. It is part of the shared library entry, so edits apply to every character using that entry.

The expanded HUD has a **Concentrating** icon below the ability scores. With **HUD controls: on**, click the unlit icon to open a searchable list of this character's assigned abilities that are marked Concentration. Choose **Concentrate** beside an ability to light the icon. Hover over it to read the selected ability's name. Click the lit icon again to end concentration. **Cancel** closes the list without changing concentration. If the list is empty, flag the appropriate abilities in their editors on the DM screen.

The DM character page has the same toggle plus **Choose ability / Change ability**. Both screens include all flagged ability types, including bonus actions and reactions. Selecting one records concentration without spending an action, slot, or charge. Use the normal ability controls to spend costs separately.

The selected ability is saved by its character assignment, so renaming its shared entry updates the hover name. Removing that ability from the character or turning its concentration flag off ends concentration on it. Long rest ends concentration; short rest, Start turn, damage, and using abilities without the concentration flag leave it as set.

Using an ability marked **Concentration** automatically selects that ability in the concentration tracker after its use is validated. This applies to spells, actions, and features, including cantrips and abilities that use custom resources. If the character is already concentrating, an **End current concentration?** warning opens on the screen where you clicked Use. It names the old ability, or says **your current ability** when no name is recorded. **Cancel** preserves the old concentration and spends nothing; **Use ability** spends the normal action, slot, and resource costs and switches concentration to the used ability. This also applies when using the same concentration ability again. On the TV, the warning stays inside that character's rotated HUD. Failed uses leave concentration and costs unchanged. **Undo** restores the previous concentration and all costs from that use together. The manual Choose ability / Change ability controls remain available for corrections.

While a character is concentrating, an amber concentration icon pulses beside the DM's **− Damage** button, **Apply** in the damage dialog, and the interactive HUD's **HP −1 / −5** buttons. Hover over it to see **Concentrating: [ability name]**, or **Concentrating** when no name is recorded. The icon updates as concentration changes, including while the damage dialog is open. It is only a reminder: damage applies normally, with no additional confirmation, automatic roll, or change to concentration. The icon stays steady when reduced motion is enabled in your system.

Open **Condition library** in the sidebar to create, search, edit, or delete conditions. Each definition has only a name and description. The library starts empty. **Assign** adds a definition to an active or saved character.

On the DM character page, click **Add** beside Conditions. Search saved names or descriptions, then click **Add** beside an entry to apply it. **Create new** lets you write a new name and description; **Save & add** saves it to the shared library and applies it to this character together. **Cancel** leaves both unchanged.

With HUD controls on, the expanded TV HUD also has **Add** beside Conditions. Its searchable menu only offers existing library entries. It stays within the character's rotated HUD and keeps the same HUD size. Already-applied entries show **Added**. You can add several conditions, then choose **Done**. Create any new definitions from the DM screen.

Applied conditions appear under the **Conditions** heading on the expanded HUD. Hover over a name to read its description when HUD controls are on. Remove a condition using the DM's **Remove** button or the **×** beside its name on the interactive HUD. Removing an assignment keeps the definition in the library. Shared edits update every assigned character, including players outside the party. Remove all assignments before deleting a library definition; deletion supports confirmation and Undo.

Conditions remain until you remove them, including after rests. Upgrading preserves old condition text as one reusable entry per distinct note, so any qualifiers you wrote stay intact. You can edit or split that entry yourself in Condition library. Existing concentration notes remain visible until you end concentration or choose an ability; the app does not guess which abilities need a concentration flag.

## 2024 rules and homebrew

Tablelight tracks the values you enter. Using an ability spends its configured costs and updates concentration when you have marked **Concentration**. It does not adjudicate D&D rules or automatically apply damage, healing, movement effects, conditions, or spellcasting restrictions. Enter your chosen rules and apply those effects yourself; concentration saving throws and ending concentration after a failed save remain manual.

The spell-level dropdown defaults to **None**. Actions and features need no spell level. For spells, choose None, Cantrip, or a level from 1–9. None is distinct from Cantrip and does not automatically spend a standard slot. Standard leveled spells can spend one slot of the selected level; cantrips do not spend standard slots. For special spell pools, uncheck standard slot spending and link a custom resource instead.

Custom resource recovery is chosen by you. For rules that restore only some charges, choose Manual and use the + control.

Short rest restores short-rest pools and leaves healing to you. Long rest restores HP, standard slots, turn controls, and short/long-rest pools; it clears temporary HP and concentration. Manual and per-turn pools, conditions, and manually unavailable abilities stay as you set them. The rest dialog lets you choose the selected character or the full party.

## Custom resources

Open **Edit character** and scroll to **Custom resources**, immediately below spell slots. Click **+ Add resource**. Give it a name, maximum amount, available amount, reset rule, shape icon, and color. Choose a circle, square, diamond, triangle, hexagon, or star. Raising a maximum adds available charges; lowering it caps the available amount. You can enter an available amount directly.

| Reset rule | What refills it to the maximum                                            |
| ---------- | ------------------------------------------------------------------------- |
| Short rest | Short rest or Long rest                                                   |
| Long rest  | Long rest only                                                            |
| Per turn   | Start turn for that character, including Next turn when their turn begins |
| Manual     | Its Reset button on the DM screen or interactive TV HUD                   |

All counters appear in a vertical stack beneath spell slots on the overlay, with their icon, name, remaining/maximum amount, and reset rule. Use **− / +** to spend or restore a charge. Manual counters also have **Reset** beside these controls. Large lists scroll inside the HUD; use the DM's Vitals & resources arrows when controlling it from the laptop. The right-side Resources section also shows these counters with pages.

Edit names, amounts, reset rules, icons, or colors in **Edit character**. **Remove resource** removes a counter when you save the character. A resource linked to an ability must be unlinked from that ability first. **Cancel** discards your draft edits; **Undo** can reverse a saved change. Up to 60 counters can be stored on each character. Existing resource pools keep their counts and ability links after upgrading.

## Save and move your party

Changes save automatically in **%APPDATA%\Tablelight\party.json**, with a previous-save backup in the same folder. Portraits and the shared library are included. The library is independent of characters, with both saved together so backups stay complete. Closing Tablelight hides the TV overlay; it starts hidden next time.

Use **Setup & help → Export party backup** to save every player, active party membership, portraits, and the shared library together. Transfer that file to another laptop and use **Restore backup**. Restoring replaces the entire current roster, party, and library after confirmation. Export before restoring if you want to keep both collections.

Ability-details development builds write save format 9 and import formats 1–8. All manual fields, existing players, libraries, resources, and HUD choices are retained. If a save came from the earlier calculation preview, explicitly entered fixed numbers are retained as Attack/Save text and personal exceptions become separate library variants. Automatic modes are removed. Older builds cannot read format 9; keep a pre-update exported backup if you need to return to an older app.

## Keyboard shortcuts

| Shortcut       | What it does                                           |
| -------------- | ------------------------------------------------------ |
| Ctrl + Alt + H | Hide the overlay from any app                          |
| Ctrl + Alt + O | Toggle the overlay from any app                        |
| Ctrl + Alt + I | Switch between interactive HUDs and full click-through |
| Ctrl + Z       | Undo in Tablelight when you are not typing             |
| Esc            | Close a dialog                                         |

## Display notes

You can arrange a party with just one display connected. Select the TV after connecting HDMI. If the selected display is unplugged, the overlay hides; reconnect and show it again.

Positions and rotations are independent for each player and remain unchanged when expanding or collapsing. The HUD’s center is its placement point. Expanded HUDs move inward at screen edges while keeping the exact scale you chose. If a card is larger than the screen, it is centered rather than shrunk. Use HUD size in Currently displayed or TV & layout to fit it comfortably at your chosen rotation.

The overlay works independently of D&D Beyond and does not read or modify its pages. An exclusive-fullscreen application may cover the overlay; use a normal or borderless browser window in that case.

## Included source

The complete editable application source is in **resources/app**. It uses Electron 44.3.0, electron-updater, semver, and their production dependencies. The app has no analytics or telemetry; its optional update requests are described above. Tablelight is free software under GPL-3.0-or-later, with no warranty. Read the license in Setup & help, or in LICENSE.Tablelight.txt. Electron's license, runtime notices, and dependency licenses are included.
