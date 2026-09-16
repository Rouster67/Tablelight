# Full manual coverage and verification

Release candidate: branch `codex/passives-and-illustrated-guide`, based on commit `827c03e`, app
2.0.0 with format 11. No gameplay behavior changes are part of version preparation.
The manuscript covers every app section. Capture provenance is
in `captures.json`; exact PDF/page certification is in `review.json`.

## Control inventory

Each row lists the actual controls/fields reviewed, their guide location, and relevant test
scenarios. This is a control inventory, not a claim that a chapter heading alone proves coverage.
The native scenarios exercise the real app with isolated synthetic data. Source inspection checks
labels, limits and effects not visible in a particular screenshot. Ordinary install/uninstall
screens are described in text; final release-viewer/installation certification stays separate.

| Controls or fields reviewed                                                                                            | Guide chapter / capture                        | Verification source or native scenario                        |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Installer folder/shortcuts, launch/version, Extend, Display, Refresh, Show/Hide TV overlay                             | 1, 12, 15; tv-layout, updates                  | installed-update, layout, updates; main/controller            |
| Sidebar DM console, TV & layout, Messages, Ability library, Condition library, Players & party, Setup & help           | 1; dm-console                                  | sidebar, visual-improvements                                  |
| Party selection, current-turn marker, drag order, up/down, Initiative order                                            | 3, 9; initiative                               | guide-manual, session, sidebar                                |
| All characters search, alphabetical list, Previous/Next, + Add character                                               | 3; players-party                               | roster, sidebar                                               |
| Roster Search saved players, Show players (all/active/outside), Create player, pagination                              | 3; players-party                               | roster, guide-manual                                          |
| Add to active party checkbox, Add to party, Remove from party, Delete character, cancel/confirm/Undo                   | 3, 4; players-party                            | roster, sidebar; roster-ui                                    |
| Character name, Class / subclass, Species, Level, Player color, Theme                                                  | 4; character-identity                          | guide-manual, character-themes                                |
| Upload portrait, Remove image, preview, Save character, Cancel/close/Escape                                            | 4; character-identity                          | session, roster; controller/main                              |
| Armor class, Speed, Current/Maximum/Temporary HP, Proficiency bonus, Initiative order value                            | 4; character-identity                          | guide-manual, session                                         |
| STR/DEX/CON/INT/WIS/CHA, save P/E, skill P/E and exact skill override                                                  | 4, 12; character-training, player-sheet        | session, interactive; session-ui/core                         |
| Spellcasting ability, Spell DC override, Spell attack override, level 1-9 slot maxima                                  | 4, 8; spell-fields                             | guide-manual, session                                         |
| DM notes field and DM-only Sheet display                                                                               | 4, 14; player-sheet                            | approval-queue, standard; overlayState strips notes           |
| + Add, Create new, Choose existing, Create new local ability, Create local-only copy, Cancel                           | 5; add-choices                                 | guide-manual, library, duplicates                             |
| Library + Create new, search, all Type/turn/passive filters, match limit, assignment list                              | 5; ability-library                             | library, passives-dm, ability-fields                          |
| Add to character, Character chooser, Continue, preview, personal link, Add to name, Already added                      | 5; ability-library                             | guide-manual, library                                         |
| Library Duplicate, character copy icon, local person indicator, immediate copy/Cancel/Undo                             | 5                                              | duplicates, library-deletion                                  |
| Edit, Save shared entry, Save to library, Save & add, Save character ability, Save to character                        | 5, 6                                           | guide-manual, library, duplicates, ability-fields             |
| Remove from character, confirmation/Undo                                                                               | 5                                              | library, duplicates, passives-dm                              |
| Delete library entry, Edit instead, Remove and delete, Make local copies and delete, character checklist, Go back      | 5                                              | library-deletion                                              |
| Ability Name, Type, Behavior, Turn cost                                                                                | 6, 7; ability-editor-top, passive-editor       | ability-fields, passives-dm, guide-manual                     |
| Trigger, Duration, Range, Area, Casting Time, Spell Level (None/Cantrip/1-9)                                           | 6                                              | ability-fields                                                |
| Components, School, Attack, Save, On Save, Damage / Healing                                                            | 6                                              | ability-fields                                                |
| Upcast / Upgrades, Requirements, Special, Description / Active effect, Passive effect, Reference                       | 6, 7; passive-detail, hybrid-active/passive    | ability-fields, upgrades, source-references, passives-dm      |
| Spend a standard spell slot, Concentration                                                                             | 6, 8, 11; cast-slot                            | guide-manual, concentration-use                               |
| Linked resource pool, Charges spent per use, Mark unavailable for this character                                       | 5, 6, 8; ability-editor-costs                  | library, resources, guide-manual                              |
| Ability image Upload/Replace/Remove, preview, Cancel/Save, failure handling, image limits                              | 5                                              | ability-icons, ability-icons-ui, ability-icons-performance    |
| Track whether passive applies, Always applies, Active/Inactive on DM list/View and player list/detail                  | 7; passive-editor, dm-passives, passive-detail | guide-manual, passives-dm, passives-hud                       |
| View passive effect / View active effect, Show passive/active effect on TV, Passives filter                            | 7; hybrid-active/passive                       | passives-dm, passives-hud                                     |
| Custom resources Add, + Add resource, name/max/available/reset/icon/color, Remove resource, Add/Save/Cancel            | 8; resource-editor                             | guide-manual, fixed-resources, session; resource-ui           |
| Slots minus/plus, Spend a spell slot selector, Cast & spend, player Cast L choices                                     | 8; cast-slot                                   | guide-manual, interactive, concentration-use                  |
| Pool minus/plus, Manual Reset, TV Previous/Next, linked-removal guard                                                  | 8, 12                                          | fixed-resources, resources, session                           |
| Start turn, Next turn, initiative rolls, Sort highest first, dialog arrows, Save order                                 | 9; initiative                                  | guide-manual, session, approval-queue                         |
| Action/Bonus/Reaction Spend/Restore/Show options, movement minus5/plus5/Set                                            | 9; combat-controls                             | session, interactive                                          |
| Damage/Heal dialogs, Amount/Apply/Cancel, Temp HP exact entry, TV HP/temp increments                                   | 9; damage                                      | guide-manual, session, concentration-reminder                 |
| Short/Long rest, selected/whole-party scope, Apply rest/Cancel, exact reset table                                      | 8, 9; long-rest                                | guide-manual, session, core                                   |
| Top-bar Undo, Ctrl+Z when not typing, session history limits                                                           | 9, 10, 17                                      | core, session, history                                        |
| DM View/Use/Edit, TV View/Use ability/Cast, reservation/cancel card                                                    | 6, 9, 10; active-detail, player-pending        | guide-manual, approval-queue                                  |
| DM queue icon/list, Urgent order, Allow/Deny, View character, Minimize/close/Escape, dependency warning                | 10; approval-review                            | approval-queue, guide-manual                                  |
| History list/details, Reconsider, Undo this use, disable reasons, View character/back to History                       | 10; history                                    | history                                                       |
| Concentrating toggle, Choose/Change ability, picker search/Cancel, existing-concentration warning                      | 11; concentration-picker                       | concentration, concentration-use                              |
| Damage amber reminder and hover, manual outcome, reduced motion                                                        | 9, 11; damage                                  | concentration-reminder                                        |
| Condition library Create/search/Edit/Assign/Delete, Name/Description, Save/Cancel                                      | 11; condition-library, condition-editor        | conditions, guide-manual                                      |
| Character condition Add/search/Create new/Save & add/Done/Remove, TV existing-only picker/Added/Done                   | 11; conditions-concentration                   | condition-picker, conditions, guide-manual                    |
| Character Hide/Show bubble, Position & rotate, Edit, Remove/Delete, Expand/Collapse, Show full sheet                   | 3, 4, 12; dm-console                           | session, layout, roster                                       |
| DM ability tabs Actions/Bonus/Reactions/Spells/Features/Passives/Other/Sheet, Find, + Add, Show on TV                  | 5-7, 12                                        | ability-fields, passives-dm, wide-hud                         |
| HUD Overview/Action/Bonus action/Reaction/Free-other/Spells/Features/Passives/Sheet/Resources                          | 12; player-overview, player-sheet              | wide-hud, interactive, passives-hud                           |
| HUD detail/list Previous/Next/Back to list, condition/resource pages, 15/6/3 limits                                    | 6, 11, 12                                      | wide-hud, fixed-resources, ability-fields, passives-hud       |
| Currently displayed matching tabs/pages/effects/reminders, size slider/Smaller/100%/Larger, Collapse/Expand, Hide/Show | 7, 12; currently-displayed                     | wide-hud, passives-hud                                        |
| TV layout preview, Arrange around TV, Player placement selector, Visible on TV, X/Y, rotation field/slider/presets     | 12; tv-layout, placement                       | layout, interactive                                           |
| Portrait/Move drag, rotation handle, Shift snapping, rotation arrows, collapse/hide, scale fixed through rotation      | 12; rotated-player                             | layout, interactive, wide-hud                                 |
| HUD controls / Click-through, interaction checkbox, one-player expansion, opacity, HUD scale                           | 12; placement, tv-layout                       | layout, interactive, standard                                 |
| Message Player selector/drafts/Send, recipient identity/count, replacement Keep previous/Replace                       | 13; messages                                   | guide-manual, player-messages-ui                              |
| Envelope/unread/reduced motion, Force open, Previous/Next, Close on TV, Dismiss, View sent text, Retry                 | 13; player-message                             | player-messages, player-messages-ui, guide-manual             |
| Message Sent/Delivered/Opened, hidden states, lifetime/restore/removal, shared TV visibility                           | 13                                             | player-messages restart, player-messages-ui                   |
| Guide link, pending/keyboard focus, missing/read/viewer error, retry, Read license                                     | 14, 15; help-link                              | guide, guide.test                                             |
| Export party backup, Restore backup, file dialog/cancel/replace/Undo, Saved party folder/status                        | 14                                             | guide, standard, visual-improvements; storage                 |
| Check for updates at launch, Check now, offer Update and restart/Later/Release notes, sidebar arrow, Cancel download   | 15; updates                                    | updates, updates-transport, installed-update                  |
| Uninstaller preserve/default, Remove all saved data/second warning/cancel, locked/link failures                        | 15                                             | existing installed-update matrix; final release rerun pending |
| Ctrl+Alt+H/O/I, Ctrl+Z, Escape                                                                                         | 17                                             | standard, interactive; main/controller                        |

## Worked-example record

`guide-manual` starts with an empty synthetic state and uses the actual renderer forms for
Mira/Rowan/Ash, resource creation, Lantern flare, conditional Lantern sense, Rowan assignment,
initiative, condition creation, slot use, damage, approval, rest and message controls.
It asserts saved values and captures the corresponding screens. Watchkeeper and Guiding glow
are seeded synthetic definitions to stage the focused effect/concentration examples; the UI
creation routes are covered by passives-dm/ability-fields. No user saves are touched.

Review found and fixed a capture-fixture mistake: pure-passive text must be entered through the
visible relabeled Description field, not the hidden hybrid-only field. The harness now checks
that Lantern sense's saved text and reminder state are correct before capturing it. This was a
fixture correction; the application already handled the fields correctly. Captures wait for
notifications to disappear and use field-group crops for readable labels.

The first-session and focused procedures are cross-checked against the scenarios above, including
shared/local copying/deletion, safe refunds, concentration cancellation, rest reset rules,
message replacement/restart, backup export/restore, and save compatibility. See the current-turn
ignored native/unit logs for execution results. Screenshot provenance remains committed so a
later release can reproduce or replace the examples after UI changes.

## Acceptance boundary

- Manuscript and control coverage: complete for this development interface.
- All-page visual review, exact hash, bookmark/link and font results: recorded in review.json.
- Local testing installation: updated with the same PDF and checked against the built payload;
  the installation backup and hash records live in ignored backups/work/test-results.
- For 2.0.0, the owner explicitly waived the remaining offline/two-reader, physical TV and
  real installer/upgrade/uninstall checks. These remain untested, not inferred from renderer
  tests or copied folders. The final version, PDF review and hash-bound waiver are recorded
  in `review.json`; the normal release gate accepts that documented owner decision.
