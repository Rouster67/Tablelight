# Ability icons, class themes, and player messages — implementation plan

Status: implementation started at the user's request on September 14, 2026.
Milestones 1–6 are implemented and tested locally. Milestone 7's combined automated review is
implemented; the physical TV walkthrough remains before release. See the
[review record and completion checklist](VISUAL_IMPROVEMENTS_REVIEW.md).
Originally prepared September 13; refreshed against Tablelight 1.11.0 main at
`f29bc449327f0d9f204a1dcbbaa84fc39da17306`. The initial image/storage decisions below are
in use, and class themes include selection and persistence. Player-message delivery, the composer,
mail indicators, and reading controls are implemented. Release 1.12.0 is now prepared for the
user's commit, push, merge and publication; the physical TV check remains unconfirmed.

## Branch setup completed

1. On September 14, checked the normal source checkout, worktrees, branches, and uncommitted
   files. The earlier separate checkout and feature branch had been removed. Main contained
   the merged Tablelight 1.11.0 work, including character-only abilities and the DM approval queue.
2. Fetched GitHub and confirmed main matched origin/main at
   `f29bc449327f0d9f204a1dcbbaa84fc39da17306`. Preserved the existing release-note edit in
   `docs/releases/1.11.0.md` and made an additional copy in an ignored local backup folder.
3. Verified `codex/ability-icons-class-themes-player-messages` was active in the normal
   `D:\Repos\Tablelight-source` folder at that same commit. The name covers all three planned
   features. Work now appears in the repository already used by GitHub Desktop.
4. Published the branch, fetched it back, and configured upstream tracking. The branch and
   published starting commit matched before development. Milestone 1 was committed as
   `efbeef2` (Add ability icon storage foundation), and milestone 2 as `6bd094c`
   (Implement ability image editing and display). Milestone 3 was committed as `6302224`
   (Add class palette themes and previews). Milestone 4 was committed as `a5d9ff8`
   (Add character theme selection and persistence).
   Milestone 5 was committed as `9b3340b` (Implement session-only player messaging).
   Milestone 6 was committed as `49aa3f3` (Add player messages UI, overlay, and service).
   Milestone 7's automated review was committed as `8c34da4` (Add combined native visual regression).

GitHub branch: [codex/ability-icons-class-themes-player-messages](https://github.com/Rouster67/Tablelight/tree/codex/ability-icons-class-themes-player-messages).
The normal source folder is now the working location; the previous separate-folder instructions
are superseded. Branch setup itself did not change the installed program or saved party.

## Local development installation — standing workflow

The user explicitly requires `D:\Programs\Tablelight` to contain the latest completed work.
The normal **Tablelight** desktop shortcut must open that updated application. The separate
development-preview shortcut created during troubleshooting is superseded; its copied saves
are retained separately. This local installation is part of finishing each development step,
including steps awaiting the user's commit. Publishing a public release remains a separate task
after all seven milestones.

After the relevant checks pass:

1. Preserve a dated copy of the installed program and the current and previous party saves in
   the source folder's ignored `backups` directory. Close the relevant Tablelight windows normally
   before taking the final save snapshot and updating. Never force-close an editor with unsaved work.
2. Build the current checkout using `node scripts/build-windows.cjs`. The build uses
   `publish: 'never'`; it does not publish a release. Install that newly built installer into
   `D:\Programs\Tablelight`, retaining the normal save location and shortcut.
3. Verify the installed application files match the built payload and the current source,
   check the executable and application version, and confirm the original party saves were
   preserved. Run relevant desktop checks against the installed executable with synthetic test
   data in an isolated folder, never against the real saved party.
4. Open `D:\Programs\Tablelight\Tablelight.exe` through the normal shortcut and verify the new
   controls. Report the installation update alongside the milestone's completion checks.

The displayed version remained 1.11.0 through the feature milestones and moves to 1.12.0 during
release preparation. Verify the actual installed files and features to identify current work;
the version number alone does not identify a build. Keep a local installation record containing
the branch, commit, uncommitted status, build time, and backup location.

## What the current project already provides

- [Roadmap](ROADMAP.md): F09 storage, editing, and display are implemented on this branch;
  F12 class themes and F02 delivery/reading controls are implemented. Physical TV review remains.
  These identifiers are roadmap references, not GitHub issue numbers. The roadmap calls for
  focused issues with decisions and completion checklists when implementation is scheduled.
- [Core state](../core.js): shared definitions supply each character's ability display fields.
  Backups store definitions once and retain separate assignment IDs, resource links, costs,
  and availability. The 1.11.0 baseline uses format 9; the icon foundation writes format 10 and accepts formats 1–9. Up to eight players can be active;
  inactive characters remain in the saved roster. Existing character-only abilities retain
  independent definitions, including copied images.
- [Portrait upload](../main.js): the DM can choose PNG/JPEG/WebP files, currently limited to
  25 MiB and resized to a 512-pixel longest edge. Images are saved as embedded PNG data. Icons
  can reuse the checked file-selection pattern with smaller limits and additional validation.
- [Library editor](../library-ui.js) and [controller](../controller.js): shared edits reach
  active and inactive characters. Character editing merges changed fields while preserving
  concurrent spending. The generic library-field loop assumes ordinary text, so image fields
  need separate handling without the current text-length truncation.
- [HUD rendering](../hud.js) and [styles](../styles.css): the TV and DM preview share rendering.
  Each character has independent position, rotation, scale, visibility, section, and detail
  selection. Expanded HUDs are 880 pixels wide with a growing summary and a 600-pixel minimum
  card height plus toolbar. Pending requests add a separate column, making them 1150 pixels
  wide. Bubbles are 78 × 78. Preserve this merged behavior rather than restoring the old fixed
  height. Many appearance colors are currently hard-coded.
- [Overlay](../overlay.js) and [window shapes](../window-shape.js): all players share one TV
  window. Rotated input regions let map clicks through the gaps. Full click-through disables
  player controls, while DM controls use a separate checked route. The current geometry limit
  is 17 frames, covering eight HUDs, eight collapsed-message cards, and a transient notice.
- [Storage](../storage.js): saving is atomic and preserves the previous valid save. The
  main-process approval service keeps up to 40 Undo snapshots. Image size affects memory, saving, and
  repeated TV updates as well as disk space.

The initial baseline of 155 unit tests passed. After milestone 1, all 165 unit tests and all
22 Windows desktop scenarios passed, including the new image-import scenario. Tests used
isolated synthetic data.

## Recommended order and milestones

Use F09 → F12 → F02. F09 establishes bounded image storage and common thumbnail rendering.
F12 then supplies coordinated character colors and readable surfaces. F02 can reuse those
surfaces while adding separately tested delivery, message state, and rotated reading controls.
Ability calculations, player-use review, and a new resources layout are outside this plan.

The ability-details work is now merged. Build on its common details renderer, main-process
approval service, character-only definitions, and growing HUD layout. Format 10 extends its
format 9 saves. Recheck main before later milestones and coordinate future format changes.

### Milestone 1 — F09 image storage and compatibility

Completed locally September 14, 2026. The importer and save support are connected; visible
upload controls and thumbnails remain milestone 2. No new dependency was needed.

Add an optional image to the shared library definition. Recommend static PNG, JPEG/JPG, and
WebP uploads, limited to 5 MiB and 4,096 pixels on either source edge. Reject SVG, GIF, animation,
corrupt files, and disguised unsupported content. Validate dimensions and animation before
unrestricted decoding, then validate the decoded result. Keep file access in the main process.

Resize to a 256-pixel longest edge without enlarging small images. Preserve aspect ratio and
transparency, honor source orientation, and re-encode to PNG without original metadata. Retain
only the converted image; leave the user's source file alone. Proposed stored limits are
300 KiB per icon and 8 MiB across the library and character-only abilities, counting each
stored definition once before base64 overhead.
Exceeding a limit produces an error without deleting existing artwork or partially importing.

Save each shared image once, including unused library entries. Include artwork in exact-content
migration comparisons so different images are not silently merged. Extend validation,
normalization, and backups together; never pass image data through an ordinary text-field limit.
Keep character assignment IDs and resource settings separate from shared artwork.

Save format 10 extends the merged format 9. Tablelight 1.11.0 would discard unknown image
fields in format 9, so a new version prevents silent loss in older apps. Formats 1–9 remain
readable, including legacy manual-field migration and existing character-only copies.

Completion and tests:

- Accept PNG/JPEG/WebP fixtures, including transparent, tiny, non-square, noisy, and oriented
  images. Check exact source-byte, dimension, and converted-byte boundaries.
- Reject empty, corrupt, truncated, disguised, oversized, and animated files, including animated
  PNG/WebP. Apply the same validation to saves and backup imports, not just the upload dialog.
- Save, restart, export, and restore in a fresh data folder after source images are unavailable.
  Compare converted image bytes and verify shared definitions are stored only once.
- Preserve unused library entries, inactive characters, distinct same-name definitions, legacy
  portraits, assignments, conditions, notes, resources, and HUD settings. Verify previous-save
  recovery and rejection before replacing valid data.
- Update reader/writer version guards together, including condition-library requirements for
  formats newer than 9. Coordinate with any newer format already shipped by the other branch.

### Milestone 2 — F09 editing and shared display

Implemented September 14. Upload/Replace/Remove previews are draft-only until Save, handle
failure/cancellation and late completion, and retain shared versus character-only ownership.
All listed views now use the same fixed thumbnail/fallback. Desktop checks cover two linked
active players plus an inactive player, then eight visible players and DM previews at four
orientations and several scales. Existing geometry, map regions, and click-through controls remain.

The stress fixture contains 5,000 definitions, 8,137,593 bytes of PNG data, eight active players
each using all 31 large images, and 100 inactive players. Before optimizing snapshots, two
service-only updates took about 1.6–1.7 seconds each and sampled up to 1.24 GiB of heap.
After retaining immutable strings and using structural comparisons, 40 service-only updates
averaged 267 ms with about 98 MiB retained after collection. The full disk-save/wire-codec
benchmark averaged 490 ms per update, retained 102 MiB with 40 Undo entries, and restored the
original state through all 40 undos. Packed messages were 12.09 MiB versus 94.86 MiB with repeated
strings. These are local synthetic measurements, not a hardware-independent speed guarantee.
The separate native stress scenario checks actual DM/TV rendering and live updates; observed
update-to-render checks took 620–914 ms for this deliberately large fixture. Sampled peak heap
in the full disk/wire benchmark was 764 MiB, distinct from the 102 MiB retained after collection.

Validation: 168 unit tests, syntax/format checks, and all 24 desktop scenarios passed.
One existing native mouse test timed out at a DM preview rotation click during the first run;
the unchanged test passed on retry, and the remaining scenarios passed. Screenshots were checked
for the editor, library, rotated TV details/list, and eight-player DM preview. Test data stayed in
isolated folders; no installed program or real party was modified.

Add Upload/Replace, Remove, image preview, and Cancel to the shared entry editor. Explain that
the image changes for every character using the entry. Initially fit the whole picture inside
a fixed square with a neutral backing; do not add a crop editor or per-assignment image
overrides. Existing independent character-only abilities still retain their own image.

Use one thumbnail renderer in the DM library, assignment picker/preview, character ability
lists/details, and TV lists/details. Retain the current spell/action/feature symbols as
fallbacks for missing or unrenderable images. Keep ability names and availability labels
visible. Reserve image space so loading cannot shift controls or change the configured HUD size.

Completion and tests:

- Create, replace, remove, cancel, and undo an icon edit. A failed upload leaves the old image
  intact. Delayed or broken image rendering retains a fixed frame and usable fallback.
- Edit one shared entry assigned to two active characters and an inactive character. All get
  the new image while keeping their separate costs, availability, resources, and HUD selections.
- Save an editor opened before a player spends a resource; preserve the intervening use.
- Verify matching thumbnails in every listed DM/TV view at different rotations and scales.
- Exercise 5,000 definitions within the proposed image budget, eight active users sharing
  entries, a large inactive roster, 40 Undo snapshots, and rapid HP/resource changes. Measure
  save/broadcast time and peak memory against baseline. If repeated image copies make play
  unresponsive, settle immutable image references/cache and serialization before expanding limits.

### Milestone 3 — F12 palettes and matching previews

Implemented September 14. The [palette review page](theme-preview.html) uses the actual HUD
renderer with synthetic characters and no saved changes. It includes Default, every class,
bright/dark/patterned maps, frame opacity, and ability/detail/sheet views. `hud-themes.js` owns
the palette registry and per-HUD variables; `hud-themes.css` opts in only known class themes.
Default is compared against the original stylesheet and restored exactly after switching back.

All proposed surface/highlight pairs passed the color checks. Rendered class text in the main
fixture had a minimum contrast of 6.73:1 across map backgrounds at 40%, 94%, and 100% frame opacity;
the test also checks 4.5:1 for sheet/detail text and 3:1 control boundaries. Reading surfaces remain
opaque while outer frame gaps retain the opacity preference. Spent/disabled states keep labels
and dashed boundaries; semantic HP, damage, temporary HP and concentration colors stay consistent.
Resource shapes use contrasting black/white backing without changing saved colors or layout.

Known limits: Default intentionally retains existing dimmed spent labels and low-opacity text
over bright maps, which do not meet the class-theme contrast targets. Physical TV viewing-distance
review still needs the intended display and seats. Unread message indicator checks wait for
milestone 6. Character dropdowns, normalization and saved theme identifiers remain milestone 4;
the palette review page and tests exercise renderer choices without editing real saves.

Validation: all 171 unit tests and 25 native desktop scenarios pass, along with syntax,
formatting and whitespace checks. The theme scenario measures 117 palette/map/opacity
combinations plus sheet/details, hover/focus, warnings, independent bubbles, and Default
restoration. Reviewed screenshots cover all 14 choices and a full-size Wizard details view.
Desktop checks used a 1440 × 950 DM window and the configured 1440 × 2560 overlay display.

Introduce per-character HUD color variables and the 13 built-in class palettes listed below.
Recolor bubble backing, panels, borders, text, and navigation highlights. Scope colors to each
HUD and its DM preview; preserve the existing Default colors and layout exactly.

Keep Player color as the portrait identity ring and DM identity markers. Preserve custom
resource colors and shape icons, including existing resources that inherited Player color.
Themes never rewrite those saved choices or tint uploaded artwork. Keep damage, HP,
concentration, warnings, and unavailable states recognizable through consistent labels,
shapes, and outlines as well as color.

Use opaque reading/control backings where class themes need them over arbitrary maps while
retaining the outer opacity preference. Default keeps its present opacity behavior. Review
the proposed palette samples before freezing the colors; their hex values are starting choices,
not a claim that every finished control already passes contrast checks.

Completion and tests:

- Compare all 13 class palettes and Default in collapsed bubbles, expanded HUDs, and matching
  DM previews. Verify one character's palette cannot affect another HUD or the entire console.
- Check normal, muted, hovered, selected, focused, spent, damage, concentration, and unread
  states over bright, dark, and patterned maps at low, default, and full opacity.
- Target 4.5:1 for ordinary text and 3:1 for meaningful control/icon boundaries, using final
  composited colors. Large text has a 3:1 minimum, but prefer the ordinary-text target for TV use.
  Follow [W3C text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
  and [W3C non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Inspect at actual TV viewing distance. Keep labels legible with light/dark artwork and custom
  resource colors; use supporting outlines without changing saved colors. Report existing
  Default low-opacity limitations separately.
- Confirm identical dimensions, scale, position, rotation, scrolling, and map interaction.

### Milestone 4 — F12 character selection and persistence

Implemented September 15. Create and Edit share the Theme dropdown with all 14 choices.
The optional `theme` field uses the branch's existing unreleased save format 10. Missing,
blank, or malformed values become Default; unknown string identifiers are retained while
the HUD displays Default. An unavailable saved choice appears separately in the editor,
allowing unrelated edits to preserve it and an explicit Default selection to replace it.

Validation covers all 14 choices with Create/Edit/Cancel/Undo, eight same-class players with
independent palettes, all four orientations, hidden and collapsed bubbles, hidden TV windows,
and click-through mode. Theme-only edits preserve the other characters, shared artwork,
resource colors/counts, placement, later spending, and pending ability requests. Native export
and restore retain active/inactive choices and store shared artwork once; a second desktop
process verifies restart persistence. All 175 unit tests and 26 desktop scenarios pass. Existing palette contrast checks
remain in place; physical TV viewing-distance review remains an external check.

The new backup test exercises the existing confirmation for discarding pending requests during
restore. Test automation confirms this synthetic restore rather than leaving that dialog waiting.
The earlier overlay-size readiness fix is retained so palette comparisons begin at final display
bounds. Update `D:\Programs\Tablelight` as part of completing this milestone.

Add the same Theme dropdown to Create character and Edit character: Default plus all 13 classes,
including Artificer. Store a stable theme identifier with the character, independently of the
free-form class/subclass field. Multiclass and homebrew characters can choose any palette.

Missing themes in older saves use Default. Preserve an unrecognized theme identifier while
displaying Default so a future choice is not silently erased. Ship every palette with the app.
Extend character normalization, editing, changed-field merging, and backups together.

Completion and tests:

- Create, edit, cancel, and undo selections for all 14 choices. Class-name changes never select
  another theme automatically. Switching to Default restores the existing appearance.
- Give eight characters different themes, including characters with the same entered class.
  Changing one leaves the other seven and their resources, colors, and placement unchanged.
- Save a theme edit after concurrent HUD spending and preserve those live changes.
- Verify restart, export/import, older saves, unknown identifiers, and remove/rejoin preserve
  each active or inactive character's independent settings.

### Milestone 5 — F02 recipient state and delivery

Completed locally September 15, 2026. `message-service.js` owns the ephemeral message session;
the preload exposes sender-checked commands, metadata subscriptions, and explicit body requests.
One retained message per active character, the 2,000 Unicode-code-point limit, explicit replacement,
and the lifetime table below are adopted. No saved-party schema changes are needed.

Messages are addressed by character ID. Session/request/message/view identifiers reject stale
requests and make retries harmless, even after dismissal or removal. Only metadata is broadcast.
Fetching text does not mark it opened: the overlay must acknowledge the current open presentation
using its fetched-body token. Opened records the latest confirmed display and its requesting actor;
it never claims the player actually read the text. Reopening does not reset the unread state.

Main-process hooks reconcile membership after successful state changes and close exposed text
on hide, expansion changes, display changes, or renderer reload/loss. Successful backup restore
starts a new session, including after the existing pending-request confirmation. Cancelled and
failed restores retain messages. DM controls remain available while click-through stays enabled.

Checks cover 15 message unit/integration tests and a Windows desktop scenario with eight same-name
players, mixed visibility/expansion, request retries, wrong-window/role rejection, read receipts,
click-through, native export/import, removal/Undo, and a second-process restart. Desktop reload is
real; display-loss and renderer-exit events are simulated. The desktop checks explicitly exercise
renderer acknowledgements; actual visible text, envelope rendering, rotation, paging, and input
regions belong to milestone 6. All 190 unit tests and 27 Windows desktop scenarios pass, along with
syntax and formatting checks. Update `D:\Programs\Tablelight` with this milestone and record the
installed-payload checks and preserved-save hashes locally.

Before adding the reading interface, create a session-only message store in the main process,
separate from saved party state and gameplay Undo. Recommend one current message per active
character, retained until dismissed, with a 2,000-character plain-text limit. Reject blank
messages. Use stable recipient IDs, message IDs/revisions, and request IDs.

Provide narrow DM-only send, force-open, close, and dismiss operations, and overlay-only open,
close, and visible-render acknowledgements. Validate the current recipient and message on every
operation. Unopened bodies stay out of the TV payload; only notification metadata is published.
Reconcile membership after each saved state update and apply the lifecycle policy below.

Distinguish Sent, indicator delivered, and Opened. Sent means accepted into the session store;
a hidden or disconnected overlay is still pending. Opened means visibly rendered, not proof
that someone read it. Record whether the player or DM requested opening. Failed requests retain
the draft or pending state for retry, without treating a retry as another message.

Completion and tests:

- Send to same-name characters and reorder initiative after composing; routing still follows
  the selected character ID. Check rapid sends to several players and recipient removal mid-send.
- Test duplicate requests, explicit replacements, and delayed old open/close/dismiss/acknowledgement
  events. None may affect a replacement message or a different player.
- Verify every lifecycle row below, including hidden overlays, inactive/deleted recipients,
  display disconnection, overlay reload, app restart, and backup restore.
- Ensure ordinary saving does not erase pending messages. Gameplay Undo must not replay sends,
  restore dismissed messages, or resurrect a message when restoring a removed character.
- Check that message bodies never enter normal party state, backups, logs, another character's
  HUD, or DM layout previews. An unopened message sends metadata only.

### Milestone 6 — F02 composer, mail indicator, and reading controls

Implemented locally September 15, 2026. **Messages** in the sidebar provides the recipient selector,
name/portrait confirmation, independent drafts, Send/Replace, status, Force open, Close, Dismiss,
page controls, and text scrolling from the laptop. The shared-TV notice appears beside the reading
controls. Reviewing sent text on the laptop never counts as a TV opening. Failed sends keep their
draft and retry request; stale text responses cannot appear after replacement or dismissal.

Envelopes remain inside existing bubble/HUD bounds and contain no message text. They pulse for
five seconds before remaining steady; reduced motion starts steady. The TV reading area uses
plain text, fixed Close/page controls, and scrolling for long words and line breaks. It uses the
recipient's palette and orientation, with an opaque surface for every theme including Default.
Collapsed cards fit around the saved center; expanded cards stay within the existing HUD frame.
Their own dimensions fit small viewports without changing character scale or saved placement.

The message service now owns the reading page, deduplicated scroll sequence, and temporary card
stacking order. Opening an already-open card brings it to the front. Interaction-mode changes
retain the message page and scroll; normal HUD detail/section state remains unchanged. Native
region validation now supports 17 frames, including eight HUDs, eight cards, and the notice.
Closing, hiding, and starting a TV HUD drag remove the relevant card region.

The new desktop scenario checks actual UI delivery/open acknowledgements, per-recipient drafts,
explicit replacement/cancel, failed send/body retry, stale-response rejection, same-name players,
eight simultaneous cards, hidden/removed recipients, click-through, and notification-only previews.
It also checks all 14 palettes for text/control contrast of at least 4.5:1 and borders of at least
3:1; 0°, 90°, 180°, 270°, arbitrary rotation, edge fitting, and 40%/250% expanded frames; reduced
motion and pulse duration; overlapping-card order; and the regions Windows actually applies,
including empty rotated corners and cleanup after native dragging. Physical TV viewing distance
and the full combined walkthrough remain milestone 7. All 194 unit tests and 28 Windows desktop
scenarios pass, along with syntax and formatting checks. Update `D:\Programs\Tablelight` with
this milestone and verify the installed executable using isolated synthetic parties.

Add a DM recipient selector with the chosen player's name and portrait beside Send. Show status,
Force open, Close, and Dismiss controls for that recipient. Replacing the current message must
be an explicit action that identifies the recipient and loss of the old message. Preserve
draft text while editing or after a failed request. No attachments, rich text, sound, or inbox.

Sending shows an envelope with an unread dot/label, without text previews in the HUD, tooltips,
accessible labels, or toasts. Use a gentle pulse for five seconds, then a steady unread indicator;
reduced motion starts steady. Keep the badge within the existing collapsed bubble or a reserved
expanded-HUD corner so it does not enlarge either frame.

Open text inside the expanded HUD's current frame without changing its existing sizing rules. For a collapsed bubble, use a temporary card
up to 480 × 320 CSS pixels before character scale, anchored at the saved center and using that
character's rotation and scale. Fit it using existing display-edge behavior without rewriting
saved position. Preserve section, detail page, scroll, expansion, and other placement settings.
Wrap and scroll long messages, with fixed Close and paging controls.

The card's input region must follow its rotated visible shape. Avoid a full-screen backdrop,
invisible input-blocking rectangle, or movement gesture triggered by clicking mail. Eight
bubbles plus eight message cards and the existing notice can exceed today's 16-frame limit:
represent the geometry within a supported model or deliberately extend the validated bound and
tests. Never drop a region. An opened overlapping card can come to the front temporarily without
moving another player or opening their text.

In click-through mode, keep click-through enabled. The DM can still force open, page, close,
and dismiss messages, including for collapsed recipients. Players regain those controls when
HUD controls are enabled. Switching modes does not change ownership or reset the reading page.

Completion and tests:

- Verify recipient selection, draft retention, explicit replacement, send/status, open, close,
  reopen, and dismiss. An unread badge contains no text preview.
- Test one, two, and eight simultaneous recipients with mixed collapsed, expanded, and hidden
  HUDs. Repeated opening or dismissal affects only the intended current message.
- Check 0°, 90°, 180°, 270°, and an arbitrary angle, including screen edges and overlapping
  cards. Long text and long words remain readable, pageable, and closable.
- With click-through on, use every DM reading control; with it off, open/close from the mail
  indicator. Toggle interaction while reading and verify the page and ownership remain intact.
- Test map clicks, drags, and wheel input outside rotated HUD/card regions, including their
  empty corners. Closing, hiding, dragging, display changes, and errors must not leave a
  full-window input region active.
- Verify reduced motion, the unread-to-opened transition, and notification-only DM previews.

### Milestone 7 — combined regression and review

The combined automated scenario and documentation review are implemented. The
[review record](VISUAL_IMPROVEMENTS_REVIEW.md) separates verified behavior from the remaining
physical TV checks; do not treat viewport simulations as a completed HDMI/table walkthrough.

Run project syntax, unit, and formatting checks and the relevant native scenarios, then the full
required Windows native suite before a pull request. Use isolated synthetic saves and artwork.
Confirm migrations from formats 1–9, both libraries, inactive roster, previous-save recovery,
independent settings, stale editors, and simultaneous player actions.

Check one, two, and eight players with mixed visibility and expansion at the supported 40–250%
scale range. Preserve the existing growing HUD, its 880-pixel normal/1150-pixel pending widths,
the 78 × 78 bubble, stored placement and rotation, display-edge fitting, section scroll, and
DM preview. Exercise icons, themes, and
messages together while the map remains usable in both interaction modes.

Completion and tests:

- Complete the image, theme, message, compatibility, and input checks in the preceding milestones.
  Include empty parties, many resources, long names/descriptions, and shared entries in active
  and inactive characters.
- Test the actual laptop/TV setup and record resolutions, Windows scaling, viewing distance,
  and configurations checked. Separate automated results from manual observations.
- Reconcile shared rendering and save-format changes with merged ability-details work.
- Update architecture, user guide, roadmap progress, and changelog to describe implemented
  behavior. Update the working installation after each completed step using the standing workflow
  above. Publish an application release separately after all seven milestones are complete.

## Class palettes and existing colors — implemented rendering policy

Use these coordinated surface/highlight directions. Default retains the current appearance.
The class palettes use near-white main text (`#F3F5F7`) and readable secondary text, with panel,
border, hover, selected, and focus colors derived and checked during Milestone 3.

| Theme     | Main surface    | Highlight             | Character                 |
| --------- | --------------- | --------------------- | ------------------------- |
| Default   | Existing colors | Existing Player color | Current appearance        |
| Artificer | `#18272B`       | `#E8B777`             | Workshop slate and brass  |
| Barbarian | `#2B191D`       | `#F29A83`             | Dark burgundy and ember   |
| Bard      | `#281E35`       | `#DDB0EF`             | Plum and lilac            |
| Cleric    | `#242A32`       | `#E9D9A2`             | Slate and ivory gold      |
| Druid     | `#192B23`       | `#ADD095`             | Forest and sage           |
| Fighter   | `#202833`       | `#B7CADA`             | Steel and silver          |
| Monk      | `#29251C`       | `#E4C57F`             | Earth and saffron         |
| Paladin   | `#1C2540`       | `#E6CC84`             | Midnight blue and gold    |
| Ranger    | `#242B1D`       | `#C0CD88`             | Woodland and olive        |
| Rogue     | `#22232C`       | `#BCBAD3`             | Charcoal and smoke violet |
| Sorcerer  | `#301D29`       | `#F0A3CF`             | Wine and rose             |
| Warlock   | `#241E35`       | `#BDB0F3`             | Deep violet and lavender  |
| Wizard    | `#192B3C`       | `#94CDF0`             | Ink blue and arcane blue  |

A theme controls the character's overlay surfaces and decorative highlights. Player color
continues identifying the character, and each resource keeps its own color and icon. Semantic
states retain their labels and recognizable treatments across palettes. Theme changes affect
appearance only; they never rewrite game values or other characters' settings.

Concrete acceptance example: two characters share a spell icon but choose Wizard and Barbarian.
Replacing the spell's image updates both. Changing the first character to Artificer changes only
that character's bubble, HUD, and preview. Their Player color, resource colors, spent charges,
and HUD placement remain intact. Returning to Default restores their original appearance.

## Message lifetime and visibility — adopted delivery policy

Use one retained message per active character. Closing hides text; dismissing clears it.
Messages have no automatic expiry during the session and are excluded from saved parties,
backups, and gameplay Undo.

| Event                                        | Proposed result                                                                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Send                                         | Accept into the session store; publish only the recipient's notification metadata.                                                                          |
| Replace an existing message                  | Explicit Replace action identifies the recipient and loss of the old message; close old text and make the replacement unread. Never overwrite silently.     |
| Player opens                                 | Reveal that message in that character's orientation and acknowledge it after the TV renders it visibly.                                                     |
| DM Force open                                | Reveal only the selected recipient's message. Record Opened by DM after visible-render acknowledgement.                                                     |
| Player or DM Close                           | Hide text, retain the message and its opened status; a steady envelope can reopen it.                                                                       |
| DM Dismiss                                   | Clear both the text and indicator for that recipient. Other messages remain intact.                                                                         |
| Character bubble or entire TV overlay hidden | Keep the message pending, close any exposed text, and report Hidden to the DM. Sending never unhides anything.                                              |
| Force open while hidden                      | Require the existing Show control first; disable Force open with an explanation. Do not secretly queue text to open when the TV later becomes visible.      |
| Collapse or expand while a message is open   | Close text and retain status. Reopening uses the newly appropriate message presentation.                                                                    |
| Remove from party or delete character        | Clear their session message and open panel. Rejoining starts without an old message. Reject sends to inactive/deleted recipients.                           |
| App restart, backup restore, or new session  | Clear messages, open panels, and receipts. Backups never contain them. An overlay-only reload within the running app resyncs indicators with bodies closed. |

After hiding or display disconnection, restore notification metadata without automatically
reopening text. A rejected or unacknowledged request does not claim that a player saw it.
Ordinary saves retain session messages, while party removal clears the affected recipient's
message. Undoing that removal must not bring the old message back.

Concrete acceptance example: send a note to a collapsed player while another HUD is expanded.
Only the recipient gains an unread envelope. Force open displays the note in that player's
orientation; Close returns to the same bubble with an opened message available to reopen.
A replacement starts unread even if the previous note was open. A late Close for the old
message cannot dismiss the replacement. Repeat with click-through enabled and use DM controls.

An opened message is visible to everyone near the shared TV. Show “Opened messages are visible
on the shared TV” beside the composer/Force open control. Recipient targeting separates where
text appears; the shared renderer is not a private device or per-player security boundary.
The DM layout preview shows notification state without automatically exposing the body or
counting it as opened. Private delivery to personal devices is outside this plan.

## Implementation decisions and remaining proposals

1. **Images — adopted for milestone 1:** use static PNG/JPEG/WebP, a 5 MiB source limit and 4,096-pixel edges, a fitted
   256-pixel PNG, 300 KiB per stored icon, and an 8 MiB budget including character-only images.
   Start without a crop
   editor or personal icon overrides; confirm performance before increasing the budget.
2. **Themes — implemented in milestones 3–4:** all 13 palettes and Default are chosen independently
   of entered class. Player color identifies the character, resources retain custom colors, and
   class reading surfaces stay opaque without changing the outer opacity preference.
3. **Message scope — adopted in milestone 5:** one retained plain-text message per active character,
   a 2,000 Unicode-code-point limit, explicit replacement, visible-render Opened status, and the
   lifecycle table above. Milestone 6 connects acknowledgements to current visible rendering.
4. **Reading controls — implemented in milestone 6:** temporary rotated cards for collapsed players,
   a reading area inside expanded HUD frames, and DM open/page/scroll/close/dismiss controls in
   click-through. Sending does not unhide players or expose text; the shared-TV notice is included.
5. **Lifetime — implemented in milestone 5:** session-only messages end at restart, successful backup restore, or recipient
   removal. Keep them out of backups and gameplay Undo. Closing retains a message for reopening;
   dismissing clears it. An inbox or persistent history would require a different storage policy.
6. **Save compatibility — implemented in milestone 1:** write format 10 while accepting formats
   1–9, preserving merged ability-details and character-only behavior. If a
   newer format has already shipped, extend from that format and bump again where required.
   Old saves must load without loss; older apps should reject newer-format saves clearly.

Across every milestone, keep artwork in the shared library, appearance choices on each character,
and transient messages outside gameplay saves. Extend validation, migration, serialization, and
changed-field merging together. Preserve existing user content, resource bindings, current HUD
sizing rules, map input, escaped text, checked window communication, and save recovery.

Completed: **Milestones 1–6 — F09 icons, F12 class themes, and F02 messages**. The next milestone is
**Milestone 7 — combined regression and review**: exercise all three features together, review the
actual laptop/TV arrangement, and finish documentation for the separate release step.
One milestone remains before the next release, as requested.
