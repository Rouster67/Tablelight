# Tablelight roadmap

These ideas were collected on September 11, 2026. This document tracks planning and agreed
implementation progress; entries do not assign a release version or authorize implementation.

- **Planned candidate:** The requested direction is clear enough to outline. Details and priority
  still need agreement before development.
- **Considering:** The idea needs more design discussion before choosing an approach.
- **Additional suggestion:** An optional idea proposed during planning, not an accepted requirement.
- **Implemented locally:** The agreed change is in the source and awaits testing and release.

The identifiers below are references within this document, not GitHub issue numbers. When work is
scheduled, create a focused issue with its decisions and completion checklist, then link it here.
Keep completed changes in `CHANGELOG.md` once they have actually been made.

## Ideas at a glance

| ID  | Idea                                               | Status              |
| --- | -------------------------------------------------- | ------------------- |
| F01 | Passive abilities section                          | Considering         |
| F02 | Messages sent to individual player overlays        | Considering         |
| F03 | Visible application version on the DM screen       | Planned candidate   |
| F04 | Quiet check for new releases at launch             | Planned candidate   |
| F05 | Source reference on abilities                      | Planned candidate   |
| F06 | Concentration reminder when applying damage        | Implemented locally |
| F07 | Character-based attack bonuses and save DCs        | Considering         |
| F08 | Upcast and level-based upgrade text                | Planned candidate   |
| F09 | Uploaded icons for abilities                       | Planned candidate   |
| F10 | DM notice and targeted undo for player ability use | Considering         |
| F11 | Easier access to spell slots and custom resources  | Considering         |

## F01 — Passive abilities section

**Requested:** Give characters a section for abilities that work passively, rather than being used
as an action. The presentation and behavior need brainstorming.

**Suggested approach:**

- Keep passive definitions in the shared ability library so they can be created once and assigned
  to several characters.
- Give them a Passives section on the DM screen and expanded HUD. Passive entries should not imply
  an action cost or offer an ordinary Use button.
- Start with readable, user-authored descriptions. Automatically changing character statistics
  based on those descriptions would be a separate feature.

**Open decisions:** Should Passive be an ability category, a separate behavior flag, or both? How
should an ability with both passive and active effects appear? Would an optional active/inactive
toggle help for conditional passives, and how should those differ from conditions?

## F02 — Messages sent to individual player overlays

**Requested:** The DM selects a player, writes a message, and sends it to that player's overlay.
Sending displays a blinking mail icon on the collapsed bubble or in a corner of the expanded HUD.
The player can click the icon to open the message. The DM also has a Force open button. This is
intended for notes such as "You are the imposter" without immediately exposing the text to the table.

**Suggested approach:**

- Keep the message text hidden until opened; the notification should contain no preview.
- Open it in the selected character's orientation, including when their bubble is collapsed.
  Keep the configured HUD position, size, and rotation intact.
- Provide an obvious Close control and allow the DM to dismiss it. In click-through mode, the DM
  must still be able to open and close the message.
- Use a readable unread badge alongside any blinking effect, with reduced motion as an option.

**Privacy boundary:** A shared TV cannot make an opened message private from nearby people. This
design delays its exposure and makes casual glances less likely. Per-player private devices would
be a separate idea if actual private viewing is needed. Message text should not appear in other
characters' HUDs or ordinary ability descriptions.

**Open decisions:** One pending message or an inbox? Should messages expire after reading? Should
they survive app restarts or be included in backups? What happens when the recipient leaves the
party or their overlay is hidden? Should the DM see sent/opened status? If a popup changes which
screen area is interactive, how should it preserve map interaction outside that area?

## F03 — Visible application version on the DM screen

**Requested:** Make the current version easy to find on the DM screen, potentially in the title bar.

**Already present:** The DM sidebar footer displays `Tablelight 1.9.2`. That label is currently
written separately from the version in `package.json`.

**Suggested approach:** Use one consistent, unobtrusive location, such as the sidebar footer or an
About area. Read the version from the app's package metadata so it stays correct when releasing an
update. Keep this information on the DM screen.

**Open decision:** Decide whether to make the existing footer label more visible or move it.
This could share a small area with F04.

## F04 — Quiet check for new releases at launch

**Requested:** On launch, compare the installed version with the latest GitHub release. If a newer
release exists, show a subtle icon on the DM screen. Clicking it opens the latest release page:
[Tablelight releases](https://github.com/Rouster67/Tablelight/releases/latest).

**Suggested approach:**

- Check in the background without delaying startup or showing an error popup when offline.
- Compare version numbers correctly and use published stable releases by default.
- Show an accessible label such as "Update available: vX.Y.Z" and open the official release page
  when clicked. The requested scope is a notification and download link; automatic installation
  would require a separate proposal.
- Offer a setting to disable checks. Send no party, character, message, or library content.

**Open decisions:** How long should results be cached? Should there also be a Check now control?
Where should the indicator sit alongside F03?

**Existing behavior to account for:** Tablelight currently makes no external network requests.
Before implementing this idea, update its privacy and offline documentation to describe the new
GitHub request. Play and local saves must continue working without internet access.

## F05 — Source reference on abilities

**Requested:** Add an optional source field when creating or editing a spell, action, or feature.
For example, a user could enter `PHB pg. 284`.

**Suggested approach:** Store this reference in the shared library definition and display it with
the ability's details on both screens. Keep it free-form so it supports homebrew, different books,
and a user's own notes. Consider including it in library search.

**Open decision:** Is a single text field enough, or would an optional link be useful later?

## F06 — Concentration reminder when applying damage

**Agreed design (September 12, 2026):** Show a gently pulsing amber concentration icon beside
damage controls whenever that character is concentrating: the DM's Damage button, Apply in the
damage dialog, and one shared icon beside the interactive HUD's HP −1 / −5 buttons. Hovering shows
the selected ability name when available, with a generic Concentrating label otherwise.

**Behavior:** The icon follows the character's current concentration, including changes from the
other screen and Undo. It reserves a fixed space and uses a steady icon with reduced motion.
It adds no popup, dismissal, confirmation, roll, difficulty calculation, or automatic outcome.
Temporary HP, zero damage, and canceled damage need no special reminder event: the icon remains
visible for as long as concentration is active. Healing, temporary HP adjustments, and movement
controls do not get this icon.

**Completion checks:** Verify all three locations, live changes while the damage dialog is open,
ability names and generic labels, normal damage and Undo, per-character behavior, fixed HUD size
and rotation, and reduced motion. Implementation is recorded under Unreleased in `CHANGELOG.md`.

## F07 — Character-based attack bonuses and save DCs

**Requested:** Derive an ability's attack bonus and save DC from the character using it. Add a
Spellcasting ability dropdown to the character editor. Default applicable values to Auto while
allowing manual overrides. Separately, provide a dropdown for the ability the target must save
with, such as Dexterity.

**Already present:** The character editor has a Spellcasting ability dropdown and automatic spell
attack/DC values with optional numeric overrides. Individual library abilities still use shared
free-form attack and save text. The missing work is connecting structured ability fields to those
character values and separating the target's saving throw ability from the save DC.

**Suggested approach:**

- Separate three concepts: the user's attack bonus, the user's save DC, and the target's saving
  throw ability. Include None where an attack or save does not apply.
- Store calculation choices in the shared ability definition, then resolve numbers for the
  assigned character. One shared entry must be able to show different values for different users.
- Support the character's selected spellcasting ability, a specifically chosen ability, and a
  fixed override. Decide how proficiency and additional bonuses are configured.
- Put character-specific exceptions on that character's assignment so an override does not
  accidentally change every character using the library entry.
- Show the resolved value and an understandable breakdown on the DM side. In the standalone
  library, display Auto rather than inventing a value without a character.
- Preserve existing manual attack/save text when migrating saved abilities. Also allow abilities
  that require neither an attack roll nor a saving throw.

**Open decisions:** How should weapon attacks, multiple casting abilities on one character,
features using a different stat, and homebrew formulas work? Should shared fixed values and
per-character overrides both be available? Clarify which parts of the current free-form attack
and save fields remain as descriptive text.

## F08 — Upcast and level-based upgrade text

**Requested:** Add a section for what changes when a spell is cast with a higher-level slot, or
when a cantrip or feature improves as the character levels up.

**Suggested approach:** Begin with a separate user-authored Upcast / upgrades text field in the
shared library, displayed with the full ability description on both screens. Support spells,
cantrips, and other features without shipping any rules text.

**Open decisions:** Is one text field enough, or would optional rows for each slot level or character
level be easier to read? Should a chosen casting level highlight matching text? Automatically
calculating damage or applying effects is a separate scope from documenting the upgrade.

## F09 — Uploaded icons for abilities

**Requested:** Let users upload a custom image for a spell, action, or feature.

**Suggested approach:** Keep the icon with the shared library entry and show a thumbnail alongside
the ability on both screens. Provide replace/remove controls and a sensible fallback when no image
is supplied. Keep icons in exported backups so entries remain portable between computers.

**Open decisions:** Which image formats, size limits, and cropping controls should be offered?
Reuse the portrait upload approach where practical and resize images to avoid large libraries
making saves or HUD updates slow. Users supply the images; no spell art is bundled.

## F10 — DM notice and targeted undo for player ability use

**Requested:** When a player casts or uses an ability from the overlay, open a notice on the DM
screen containing the ability so the DM can read it. Show what that use spent, such as an action,
a level 2 spell slot, and a custom resource charge. Include an Undo button for that use if the
player made a mistake or the DM needs to correct it.

**Suggested approach:**

- Show the acting character, full ability details, selected casting level, and costs actually
  spent. Use the same event for the cost summary and undo record.
- Keep the initial flow as the player using an ability followed by DM review. Requiring DM
  permission before every cast would be a separate interaction choice.
- Queue notices when several players act close together. Avoid replacing an unfinished character
  edit or losing earlier notices.
- Make Undo specific to the reported use. Tablelight already has session Undo, but reverting a
  whole previous session snapshot could also undo unrelated changes made after that use.
- Do not imply that reading the notice validates the game's rules or that undo can reverse
  physical dice rolls or effects the DM applied outside that tracked use.

**Open decisions:** How should undo work after later spending, a rest, or a resource edit? Prevent
double undo and clearly explain when exact restoration is no longer safe. Decide whether closing
the popup acknowledges it, whether notices survive a restart, and whether DM-triggered uses should
also appear in the same history. F07, F08, and F09 should feed the same ability details view.

## F11 — Easier access to spell slots and custom resources

**Requested:** Reduce the need to scroll the expanded HUD's left side to find custom resources
beneath spell slots. Consider moving slots and resources into a third column on either side.

**Options to explore:**

- A dedicated resources column on the far right, with vitals on the left and abilities in the
  middle. This separates the frequently used resource controls from the description being read.
- A resources column on the far left, next to the character's vitals.
- A configurable compact layout with counters or a small grid, plus the option to pin frequently
  used resources first.

**Constraints:** The configured HUD size must remain fixed when changing sections from either
screen, and expansion must preserve position and rotation. A third column must fit inside that
size rather than silently enlarging it. Long names need readable wrapping. Many resources cannot
all be readable at once in a fixed-size frame, so define an intentional overflow behavior.

**Open decisions:** Prototype both column placements before selecting one. Decide whether this
should be a per-character layout choice or a single default. Compare portraits, descriptions,
and resources with both short and long names, small and large resource counts, and several HUD
rotations at realistic TV sizes. Compact resource controls still need usable click targets.

## Additional suggestions for discussion

These suggestions are not part of the accepted feature list.

- **DM activity history:** Keep recent player uses and their actual costs in a small history view
  so a dismissed F10 notice can be reopened. This would also give targeted undo a predictable home.
- **Hide all message text:** Provide one DM control that immediately closes every open F02 message
  while retaining unread indicators. This helps the DM manage a shared screen during interruptions.
- **Layout preview:** Let the DM preview candidate F11 layouts with long names and many resources
  before changing the live table. This could begin as design mockups rather than a product feature.

## Suggested sequencing

This is a discussion aid, not a release schedule.

1. Clarify the desired location of the version display (F03), then consider the smaller source,
   upgrade-text, icon, and concentration-reminder changes (F05, F08, F09, F06).
2. Decide the update-check behavior and document its network use before implementing F04.
3. Design passive abilities and character-based calculations together where they affect the shared
   library and character assignments (F01, F07).
4. Prototype messages, player-use review, and the resources layout with the actual TV setup
   (F02, F10, F11). Agree on privacy expectations, undo behavior, and space limits before coding.

For future implementation, preserve existing saves and user-authored content, keep calculations
and resources specific to each character, and retain fixed HUD sizing and rotation. Each feature
should have its own agreed completion checklist and appropriate verification before release.
