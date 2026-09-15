# Tablelight roadmap

The initial ideas were collected on September 11, 2026; class overlay themes and an illustrated
PDF guide were added on September 13, 2026. This document tracks planning and agreed implementation
progress; entries do not assign a release version or authorize implementation.

- **Planned candidate:** The requested direction is clear enough to outline. Details and priority
  still need agreement before development.
- **Considering:** The idea needs more design discussion before choosing an approach.
- **Additional suggestion:** An optional idea proposed during planning, not an accepted requirement.
- **Agreed design:** The behavior is agreed and awaits implementation and testing.
- **Foundation ready:** The supporting logic is tested locally; the visible feature is not connected.
- **In progress:** An approved part is implemented; remaining milestones still need approval.
- **Implemented locally:** The agreed change is in the source and awaits testing and release.
- **Merged; release pending:** The change is in `main`; a public app release is still pending.
- **Released:** The change is available in a public stable app release.

The identifiers below are references within this document, not GitHub issue numbers. When work is
scheduled, create a focused issue with its decisions and completion checklist, then link it here.
Keep completed changes in `CHANGELOG.md` once they have actually been made.

## Ideas at a glance

| ID  | Idea                                          | Status                  |
| --- | --------------------------------------------- | ----------------------- |
| F01 | Passive abilities section                     | Considering             |
| F02 | Messages sent to individual player overlays   | Considering             |
| F03 | Visible application version on the DM screen  | Released                |
| F04 | Launch update prompt and Windows installer    | Released                |
| F05 | Source reference on abilities                 | Merged; release pending |
| F06 | Concentration reminder when applying damage   | Released                |
| F07 | Manual ability fields (revised scope)         | Merged; release pending |
| F08 | Upcast and level-based upgrade text           | Merged; release pending |
| F09 | Uploaded icons for abilities                  | Planned candidate       |
| F10 | DM approval queue, History, and targeted undo | Merged; release pending |
| F12 | Class overlay color themes                    | Planned candidate       |
| F13 | Bundled illustrated PDF user guide            | Planned candidate       |

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

**Agreed design:** Show **Tablelight [version] — DM Console** in the native DM window title bar.
Keep the existing sidebar version label below Setup & help and read both from the running app's
package version. The HTML title must not replace the native title with an unversioned label.
Browser-only development previews identify themselves as previews instead of claiming a version.

**Status:** Merged with F04 in [PR #3](https://github.com/Rouster67/Tablelight/pull/3).
The title and sidebar were verified in the native tests and working program. Released in
[1.10.0](https://github.com/Rouster67/Tablelight/releases/tag/v1.10.0).

## F04 — Launch update prompt and Windows installer

**Agreed scope:** Expand the original notification-only idea into an installer-based Windows
updater using GitHub Releases and established Electron update tooling. Start with an unsigned
installer and existing GitHub account; no paid service or new account is required for development.
Code signing remains a separate distribution decision. The source repository and GitHub Desktop
commit/push workflow stay in place. Existing portable users need a one-time manual installation
of the first updater-enabled release.

**Launch and update behavior:**

- Enable automatic checks by default and check for a newer stable release in the background on
  every launch, after opening the DM screen. Do not repeatedly poll during play.
- When a newer release exists, show one DM prompt with **Update and restart** and **Later**.
  Current versions and offline launches open normally without a popup or startup delay.
- Update and restart downloads the installer with progress feedback, verifies the download,
  waits for successful saving, closes Tablelight, installs, and relaunches. Downloading or
  installation must not happen merely because an update was found or Later was selected.
- Later dismisses the launch prompt and leaves a subtle update control beside the sidebar
  version label. It lets the DM return to the update offer. Keep an official release-page link
  available for release notes and manual downloads:
  [Tablelight releases](https://github.com/Rouster67/Tablelight/releases/latest).
- Put the automatic-check setting and **Check now** in Setup & help. Manual checks work even
  when automatic checks are disabled. Show manual status there; automatic check failures stay
  quiet. Failed downloads leave the current app usable and allow a retry.
- Preserve the existing `%APPDATA%\Tablelight` save location and user-authored data. Test on
  isolated data first, then back up the real saved data before updating the working program.

**Internet requests:** Checks retrieve public release information and update metadata
from GitHub. After the user chooses Update and restart, the app downloads release files from
GitHub and its release-asset hosting. Opening the release-page link launches the user's browser.
GitHub receives ordinary connection information such as the public IP address and request
headers. No characters, parties, portraits, notes, messages, or library content are sent. No
Tablelight account, analytics, or telemetry is added. Local play and saves remain available
without internet. [Network use](UPDATES.md) documents the requests and controls.

**Status:** Merged in [PR #3](https://github.com/Rouster67/Tablelight/pull/3). The Windows NSIS installer, stable-release checker, DM
offer, sidebar icon, manual check, disable setting, progress, cancellation, save barrier, and
restart flow are in place. Source runs and unpacked previews do not check or install updates.
Unit, native UI, and real transport tests cover version filtering, opt-out, failures, and request
privacy. An actual update between two isolated installed versions verifies install/relaunch,
byte-for-byte save preservation, and the retained opt-out; test uninstall also preserves saves.
The final redirect fix passed the transport tests and GitHub checks. Release verification for
1.10.0 passed the full desktop suite, installation into the working folder, and the redirected
download/install/relaunch regression test. Saved data and settings were preserved. Windows
Application Control blocked earlier unsigned builds, so retain the compatibility warning: unsigned
installers can still be blocked on some computers.

Released in [1.10.0](https://github.com/Rouster67/Tablelight/releases/tag/v1.10.0).
The follow-up in [PR #5](https://github.com/Rouster67/Tablelight/pull/5) pins updates to the running
installation folder, including custom locations when Windows installation-path records are
missing. It was released in [1.10.1](https://github.com/Rouster67/Tablelight/releases/tag/v1.10.1). The real installer test
verifies active and saved players, assigned and unused ability and condition libraries, portraits,
resources, slots, concentration, notes, settings, the previous save, and the update preference.
The working-program update also passed: closing and reopening the same shortcut retained the new
version, and the current party file was unchanged.

**Uninstaller follow-up (September 13, 2026):** Add an unchecked Remove all saved data option to
the existing Windows uninstaller. Keeping saves is the default; deleting them requires a separate
confirmation defaulting to No. Both choices remove the installed program, its shortcuts, and update
cache. Confirmed removal includes all characters, ability and condition libraries, resources, notes,
settings, and the previous save for the current Windows user. Exported backups outside Tablelight's
folders remain.
Updates always preserve data and skip this choice; silent uninstalls keep saves. Implemented,
tested, and released in [1.10.2](https://github.com/Rouster67/Tablelight/releases/tag/v1.10.2).
The preceding 1.10.0-to-1.10.1 user test passed:
newly created character, ability, condition, and resource data survived updating and another restart.

**Release boundary:** A push or merge alone never publishes an application update. Publish a
versioned stable GitHub Release with its installer and metadata deliberately. The first
updater-enabled release was 1.10.0. Code signing and automatic
rollback are not included. See [network use](UPDATES.md) and [release instructions](RELEASING.md).

## F05 — Source reference on abilities

**Requested:** Add an optional source field when creating or editing a spell, action, or feature.
For example, a user could enter `PHB pg. 284`.

**Implemented design (September 13, 2026):** One shared Reference text field, up to 300
characters, displayed with ability details on the DM screen, in the assignment preview, and on
the player HUD. Library search includes references. Empty sources are hidden and long references
wrap inside the fixed HUD. Source text does not change costs, personal bindings, or availability.
Links remain outside this first milestone.

**Status:** Merged in [PR #10](https://github.com/Rouster67/Tablelight/pull/10); included in the
prepared 1.11.0 release, pending publication. Reference
retains the original source data and stays below Description at the bottom right. Current saves
use format 9 and accept formats 1–8. Regression checks cover migration,
active and inactive characters, persistence, text escaping, fixed rotated HUDs, and shared-editor
saves after later HUD spending. See [the ability details plan](ABILITY_DETAILS_PLAN.md).

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
and rotation, and reduced motion. Merged in [PR #2](https://github.com/Rouster67/Tablelight/pull/2)
and released in [1.10.0](https://github.com/Rouster67/Tablelight/releases/tag/v1.10.0).

**Agreed follow-up (September 12, 2026):** Before using any flagged concentration ability while
already concentrating, show a warning naming the old ability, with Cancel and Use ability.
Show it on the initiating screen; the TV warning stays inside the acting character's rotated HUD.
Cancel spends nothing. Continuing rechecks availability and concentration before spending the
normal costs, including when using the same ability again. The warning-only change was committed
and pushed separately before starting automatic concentration selection.

**Automatic selection:** A successful use of any flagged ability now starts or switches
concentration to that character's ability assignment. Cancel, unavailable abilities, and failed
uses preserve concentration and costs. Unflagged uses preserve existing concentration. The
change uses the existing save format and updates both screens; Undo restores concentration and
costs together. This follow-up was also released in 1.10.0.

## F07 — Manual ability fields (revised scope)

**User correction (September 13, 2026):** Replace the proposed attack/DC calculation controls with
manual fields. Do not calculate ability values. Every type must offer Trigger, Duration, Range,
Area, Casting Time, Spell Level, Components, School, Attack, Save, On Save, Damage / Healing,
Upcast / Upgrades, Name, Type, standard-slot and Concentration checkboxes, Reference, Description,
linked resource pool, charges per use, Requirements, and Special.

**Merged in PR #10; prepared for 1.11.0:** Attack, Save, and On Save are plain text. Type keeps
its dropdown; Spell Level is available on all types. Casting Time is free text alongside the
existing explicit Turn cost selector. Resource links and charge costs remain character-specific.
Upcast / Upgrades stays below Damage / Healing, and Reference replaces the Source label below
Description, at the bottom right. All fields can be left blank. Shared text appears consistently
on DM details, assignment previews, and the expanding, rotatable player HUD.

Save format 9 imports formats 1–8 and preserves existing text and character state. Fixed values
entered in the earlier preview are retained as manual text; differing personal exceptions become
separate library variants. No automatic ability calculation remains. F10 approval, History, and
targeted undo are tracked separately below.

**Approved duplication follow-up:** Duplicate creates a numbered library version. Duplicate
locally only, available in each character ability row, creates an independently editable ability
on that character without adding it to the library. This supports special-resource variants of
slot-based spells. Copies retain every manual field and cost setting; local copies survive saves,
backups, inactive-party moves, and Undo. Local names have a person icon. The character Add dialog
also offers smaller buttons to create a blank local ability or copy directly from the library
without a shared link. Hover text explains each choice. Merged in PR #10 with the manual fields.

**Approved library deletion follow-up:** Assigned abilities show a warning with all affected
characters and choices to edit, remove every assignment and delete, or keep selected local copies
before deleting the library entry. The checklist defaults to all assigned characters, including
inactive players. Kept assignments preserve their names and independent costs; unchecked ones
are removed. The operation supports ordinary Undo, and changed assignments require another review.

## F08 — Upcast and level-based upgrade text

**Requested:** Add a section for what changes when a spell is cast with a higher-level slot, or
when a cantrip or feature improves as the character levels up.

**Merged in PR #10; prepared for 1.11.0:** One shared multiline **Upcast / upgrades** field sits
directly beneath Damage / healing in the editor. It accepts 40,000 characters for spells, cantrips,
actions, and features. DM details, assignment previews, and HUD details show populated upgrades
after the description, with Reference last at the bottom right. Library search includes the text.
Long sections page with repeated headings inside the fixed HUD frame; shorter edits clamp only
invalid page selections. Version 1.11.0 saves retain upgrades in format 9 and import formats 1–8.

This milestone uses user-authored text only. Per-level rows, matching-text highlights, automatic
damage calculations, and applied effects remain outside this feature.

## F09 — Uploaded icons for abilities

**Requested:** Let users upload a custom image for a spell, action, or feature.

**Suggested approach:** Keep the icon with the shared library entry and show a thumbnail alongside
the ability on both screens. Provide replace/remove controls and a sensible fallback when no image
is supplied. Keep icons in exported backups so entries remain portable between computers.

**Open decisions:** Which image formats, size limits, and cropping controls should be offered?
Reuse the portrait upload approach where practical and resize images to avoid large libraries
making saves or HUD updates slow. Users supply the images; no spell art is bundled.

## F10 — DM approval queue, History, and targeted undo

**Milestones 1–3 implemented:** Player requests now reserve costs on the HUD and enter the DM queue.
The DM can review full details, approve, deny, minimize, and view the character. Conflicting edits
and new turns require confirmation. Window reloads retain pending requests; app exit clears them.
The request flow and growing HUD are committed as `d6ae50e`. The new bottom-left History list,
current-definition Reconsider, and targeted undo are committed as `e38b6b1`. Refunds
preserve unrelated later work, block unsafe counter/concentration changes, and coordinate with
ordinary Undo. All 155 unit tests and 21 desktop scenarios pass after the final combined review.
The review also fixed focus leaving History after an action or canceled dependency warning.
The final review and History placement fixes are committed. The installed-program walkthrough
passed on the separate DM and player monitors, including later spending, targeted undo, queue
limits, rotation, and restart behavior; test edits were restored to the original saved data.
Merged in [PR #11](https://github.com/Rouster67/Tablelight/pull/11); prepared for 1.11.0,
pending publication.

**HUD layout amendment:** The player HUD grows taller to keep the entire character column and
Smaller/Larger controls visible. Pending requests appear in a separate column to the right of
the ability browser, preserving its width and each character’s chosen scale and rotation.

**Agreed design:** Overlay uses request approval before spending actual costs. Pending requests
reserve costs only on the player's display. The DM sees full ability details and can Allow,
Deny, View character, or Minimize. Direct DM-console uses retain their existing behavior.

The DM Queue icon sits at bottom right, pulses with an exclamation mark when items are waiting,
and opens a brief list. At most three ordinary ability requests may be pending across all players.
Reactions are red, Urgent, listed first, and exempt from that cap; normal reaction availability
still applies. Future request types can share the queue without using the ability limit.
Incoming requests never replace an open popup or interrupt a minimized review. Resolving a request
does not automatically open another; the DM can review and approve in any order.

A separate History icon just to the right of the sidebar's bottom edge retains five resolved requests. Denied/canceled requests
can be reconsidered using current ability data; approved uses support targeted undo. Undone uses
cannot be reconsidered. Pending requests, History, and reservations clear on app exit, while
approved spending remains saved.

Dependency-changing edits warn before proceeding and deny affected pending requests when confirmed.
New turns use a small warning before expiring that character's requests. Targeted undo preserves
unrelated changes and is disabled after conflicting resource, turn, or concentration changes.

See [DM approval queue and History](DM_APPROVAL_QUEUE_PLAN.md) for the complete agreed behavior,
implementation recommendations, milestone checks, and final walkthrough on
`codex/dm-approval-queue`. The agreed feature work is implemented; release is pending.

## F12 — Class overlay color themes

**Requested (September 13, 2026):** Add a Theme dropdown to the character creator that changes
that character's overlay appearance through recoloring. Include one theme per class, including
Artificer, built into the program.

**Built-in class themes:** Artificer, Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin,
Ranger, Rogue, Sorcerer, Warlock, and Wizard.

**Suggested approach:**

- Offer the same Theme dropdown in Edit character so an existing character's theme can be changed.
  Keep the choice per character, independent of the entered class, so multiclass and homebrew
  characters can choose whichever palette they prefer.
- Recolor the collapsed bubble and expanded HUD using coordinated background, panel, border,
  text, and highlight colors. Keep the current layout, dimensions, position, rotation, and
  interactions intact. The DM's HUD preview should show the selected colors too.
- Include a Default option that preserves the existing appearance and existing character colors.
  Older saves without a theme should keep that appearance when loaded.
- Save the selected theme with the character and include it in exported backups. Supply all
  palettes with the app so they work offline without downloading assets.
- Keep text readable at TV viewing distances and retain clear warning, concentration, unavailable,
  and resource states across every palette.

**Open decisions:** Choose the colors for each class and decide how class themes interact with
the existing Player color setting and custom resource colors. This feature is scoped to recoloring;
custom theme editors, class artwork, and layout changes would be separate ideas.

**Completion checks:** Verify all 13 class choices and Default, creation and editing, independent
themes on several characters, matching previews, save/backup round trips, older saves, and readable
controls in collapsed, expanded, rotated, and click-through HUDs without changing their geometry.

## F13 — Bundled illustrated PDF user guide

**Requested (September 13, 2026):** In Setup & help on the DM console, remove the following
three headings and their explanatory paragraphs:

- Use the HUDs directly
- Concentration & conditions
- Rests & corrections

Replace those sections with a clearly labeled link that opens an extensive illustrated how-to
PDF stored inside the installed program files. The guide should walk through every section and
available feature, show pictures as examples, and explain the intended use through practical
workflows. Keep the remaining Setup & help content and controls in place, including backups,
update controls, keyboard shortcuts, and display tips.

**Suggested guide coverage:**

- Installation, first launch, extending the Windows display, choosing the TV, and arranging the
  overlay for the table.
- Every DM console section: saved players and active party membership, character creation and
  editing, stats, skills and saves, portraits, spell slots, and custom resources and reset rules.
- Ability and condition libraries: creating, finding, editing, assigning, removing, and deleting
  entries; shared definitions and each character's individual costs and availability.
- Running a session: initiative order, turns, movement, actions, bonus actions, reactions, ability
  use and resource spending, HP and temporary HP, concentration, conditions, rests, and corrections.
- Player HUDs and the DM's Currently displayed controls: opening and reading abilities, navigating
  sections, moving, rotating, resizing, collapsing and hiding HUDs, and using click-through mode
  and shortcuts.
- Setup & help, local saving, exporting and restoring backups, updates, uninstall save choices,
  and common setup or display problems.
- New roadmap features as they become available in the version being documented, including
  ability references and upgrades, calculated values, use notices, icons, themes, messages, and
  passives. Describe the behavior actually shipped with that version.

**Examples and presentation:** Include a guided first-session walkthrough and focused examples
that explain when to use a feature, which controls to choose, and what changes on each screen.
Use readable screenshots of the actual app with sample characters and user-authored example
abilities, numbered steps, captions, and callouts. Include a searchable text layer, a linked table
of contents, PDF bookmarks, and the applicable app version. Keep the guide's editable source and
example assets available for updates alongside the app.

**Bundling and opening:** Ship the PDF with the installed application and keep it available
offline. The Setup & help link should open that installed copy in the user's default PDF viewer,
including when Tablelight is installed in a custom folder. Include the guide in packaged updates
and report a clear, recoverable error if the file or a PDF viewer cannot be opened.

**Open decisions:** Choose the link label, PDF filename, and page design. Plan the full contents
early, then capture final screenshots and verify instructions against the app version being
released. Keep the PDF and existing written user guide consistent when behavior changes.

**Completion checks:** Verify that exactly the three named help sections are replaced, remaining
Setup & help controls still work, and the link opens the bundled PDF offline from a fresh install
and a custom installation folder. Render and inspect every PDF page for readable screenshots,
text, and unclipped content; check navigation links and walk through the examples in the matching
app version. Verify that a packaged update includes the correct guide.

## Additional suggestions for discussion

These suggestions are not part of the accepted feature list.

- **DM activity history:** Keep recent player uses and their actual costs in a small history view
  so a dismissed F10 notice can be reopened. This would also give targeted undo a predictable home.
- **Hide all message text:** Provide one DM control that immediately closes every open F02 message
  while retaining unread indicators. This helps the DM manage a shared screen during interruptions.

## Suggested sequencing

This is a discussion aid, not a release schedule.

The version display, installer/updater, and concentration reminder (F03, F04, F06) were released
in 1.10.0. The update-folder fix was released in 1.10.1, and the uninstaller data-choice follow-up
was released in 1.10.2.

1. Consider the remaining source, upgrade-text, and icon changes (F05, F08, F09).
2. Choose and preview the class color palettes and their interaction with existing character and
   resource colors before implementing the Theme dropdown (F12).
3. Design passive abilities and character-based calculations together where they affect the shared
   library and character assignments (F01, F07).
4. Prototype messages and player-use review with the actual TV setup (F02, F10). Agree on privacy
   expectations, undo behavior, and popup placement before coding.
5. Outline the illustrated guide (F13), then finish screenshots and walkthroughs against the
   features included in its release. Bundle the PDF and replace the three named help sections
   with its link as one complete change.

For future implementation, preserve existing saves and user-authored content, keep calculations
and resources specific to each character, and preserve chosen HUD scale and rotation while
allowing its frame to grow for the full character summary. Each feature
should have its own agreed completion checklist and appropriate verification before release.
