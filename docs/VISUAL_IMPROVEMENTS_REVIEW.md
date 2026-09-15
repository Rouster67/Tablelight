# Ability icons, class themes, and player messages — final review

Reviewed September 15, 2026 on `codex/ability-icons-class-themes-player-messages`. The automated
review was committed as `8c34da4`; release preparation follows that commit. This is the seventh
milestone from the [implementation plan](VISUAL_IMPROVEMENTS_PLAN.md).

**Status:** Feature implementation and combined automated coverage are complete. The actual
laptop/TV walkthrough below remains open. Version 1.12.0 and its release documents are prepared;
merge and publication remain with the user. The user commits and pushes each milestone.

## Automated review

**Passed:** JavaScript syntax checks, all 194 unit tests, all 29 native desktop scenarios
(245 check groups, including fresh-process restart checks), repository formatting and diff
whitespace checks. No application behavior changes were needed during this combined review.

The combined native scenario uses entirely synthetic artwork, messages, names and saved data.
It never loads the normal party. Existing focused scenarios provide the deeper checks listed below.

| Area                    | Completion checks                                                                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image handling          | PNG, JPEG and static WebP; source byte/dimension limits; no-crop resizing; malformed, animated and oversized input; transparent art; missing/broken-image fallback; failed and cancelled uploads leave prior art intact.                                                                              |
| Shared content          | Real editor replacement reaches active and inactive assignments; shared definitions export once; local artwork, independent costs and unused entries remain intact. Both ability and condition libraries survive export/import.                                                                       |
| Save compatibility      | Formats 1–9 migrate into format 10. Prior manual fields, local abilities, notes, resources, unknown theme IDs and roster state survive. Corrupt images cannot replace valid saves; previous-save recovery and restart tests preserve artwork/themes.                                                  |
| Theme readability       | All 13 class palettes: rendered text/control contrast at least 4.5:1 and control borders at least 3:1 over light/dark/patterned maps, with hover/focus and resource backings. Default retains its original appearance and contrast limitations; message cards pass contrast checks in all 14 choices. |
| Live edits              | Simultaneous player HP changes and pending resource reservations survive an older theme editor being saved. Shared definition changes keep the existing approval warning; cancelling retains art, pending requests and messages.                                                                      |
| Message ownership       | One retained message per active character ID; duplicate names, independent drafts, replacement confirmation, delayed replies/retries, removal/rejoin, hidden/reloaded overlays, wrong-window requests and restart. No body in ordinary party/preview payloads, saves, backups or Undo.                |
| Reading and interaction | Notification-only badges; player open/close; DM force open/page/scroll/close/dismiss in click-through; retained read status; plain-text long/Unicode content; reduced motion; eight cards; real Windows hit regions, rotated gaps and drag cleanup.                                                   |
| Combined layout         | Empty, one-, two- and eight-player parties; shared/local art and themes with open messages; long manual details and ten resources; mixed hidden/collapsed/expanded HUDs; 40%, 100% and 250% scale; 0°, 90°, 180°, 270° and 35° rotation.                                                              |
| Restore with messages   | A cancelled guarded restore retains current messages and settings. A successful restore restores complete saved content and clears message bodies, indicators, drafts and receipts. Current, previous and exported saves exclude message text.                                                        |

The added scenario is `tests/visual-improvements-native.js`. Run it alone with
`node scripts/test-native.cjs visual-improvements`; it also runs in the complete native suite.
It records display measurements, simulated viewports, six combined check groups and screenshots
under its unique `test-results/visual-improvements-*` directory. Those local artifacts are ignored
by Git; test source and this checklist are tracked.

## Display coverage and its limits

Connected desktop configuration observed during automation:

| Display                      | Desktop size | Windows scale | Display rotation | Desktop position |
| ---------------------------- | ------------ | ------------- | ---------------- | ---------------- |
| Primary                      | 2560 × 1440  | 100%          | 0°               | 0, 0             |
| Additional landscape display | 1920 × 1080  | 100%          | 0°               | −1920, 0         |
| Additional portrait display  | 1440 × 2560  | 100%          | 270°             | 2560, −510       |

The combined test targets the primary display and resizes only its isolated overlay window to
1280 × 720, 1920 × 1080 and 2560 × 1440. These are **simulated viewport checks**, not evidence of
playing on every connected screen. The intended laptop/TV pairing, non-100% Windows scaling,
TV processing and readability from the players' seats have not been confirmed.

HUD widths remain 880 pixels normally and 1150 with the pending column before scaling. The
collapsed bubble remains 78 × 78. HUD controls add their existing editing controls when enabled;
switching modes can therefore change the outer frame. Messages never rewrite character scale,
position, rotation, expansion, detail selection or ability page. Message paging leaves HUD
geometry alone within the selected interaction mode.

A 250% expanded HUD can exceed the display, especially with many resources. It keeps the chosen
scale and centers oversized axes, as before. An envelope outside the viewport does not claim
delivery. Use a comfortable HUD scale on the physical TV; boundary tests do not imply that eight
large expanded HUDs fit or are readable together.

## Physical TV walkthrough — still to complete

Use disposable characters or a separate exported test party; preserve a backup before replacing
any normal party. Opened message text is visible to everyone near the TV. Use synthetic notes.

Record the test date, laptop and TV resolutions, Windows scaling for each screen, Extend/Duplicate
mode, approximate TV size, viewing distance and pointing device here before release:

- **Setup:** awaiting the user's actual table configuration.
- **Observed results:** not yet recorded; the following boxes deliberately remain unchecked.

1. [ ] Open the updated program through the normal desktop shortcut. With the player map on the
       TV and the DM console on the laptop, verify the selected screen, initial hidden overlay and
       Show/Hide controls. Confirm DM notes remain on the laptop.
2. [ ] Compare Default and all 13 class palettes over light, dark and busy map areas from the
       players' seats. Check names, HP, resource labels, disabled abilities, warning/focus treatments
       and envelope indicators at a comfortable scale. Include Artificer and two different themes.
3. [ ] On two players sharing an ability, upload/replace/remove a synthetic image. Confirm both
       screens update, a local copy keeps its own art, and names remain useful without artwork.
4. [ ] Send distinct notes to two players, including a collapsed and a hidden recipient. Check
       the intended envelope only, no text preview, recipient rotation, player Open/Close and DM
       Force open/Page/Scroll/Close/Dismiss. Showing a hidden player must not expose text automatically.
5. [ ] With HUD controls both on and off, click, drag and scroll the actual map in gaps and empty
       corners of rotated cards. Read a message while another player has a pending use. Move a HUD,
       close its card and confirm the map remains reachable.
6. [ ] Check one, two and eight players with mixed expansion/visibility. Try screen edges and
       an arbitrary rotation, briefly test 40% and 250%, then return to comfortable sizes. Check
       long details and message pages, overlapping cards and the matching DM layout preview.
7. [ ] Export a disposable test party, restart, and restore it. Images, themes, local abilities
       and saved player settings return; session messages do not. Confirm ordinary app reopening
       leaves the TV hidden and the normal working installation remains the one launched.

## Documentation and release handoff

The ability-details and approval/History work is already in the 1.11.0 baseline. This branch
continues its manual field renderer, local/shared definitions, live-state merges, approval guards
and growing HUD. It writes format 10 for images and themes, with messages remaining session-only.
The user guide now explicitly distinguishes this from released 1.11.0's format 9. Keep a backup
made before updating if returning to 1.11.0 may be necessary.

The changelog, architecture, roadmap and implementation plan describe the implemented features;
outdated references to the message interface being a future milestone have been removed.

## Release 1.12.0 preparation

The package and lockfile now use 1.12.0. The README and bundled user guide describe format 10,
the changelog has a dated release section, and [the release notes](releases/1.12.0.md) cover all
three features, image limits, message lifetime and the shared-TV visibility boundary.
The installer regression now includes shared/local artwork, independent active/inactive themes,
and a pending session message that must disappear on relaunch while both save files remain intact.

The expanded installer/update/restart test passed all five checks with its isolated 0.0.1/0.0.2
packages. Its scripted uninstall checks also passed for missing/stale installation records,
blocked deletion flags, linked directories, held-open files and missing caches. These are tests
of the current updater and packaging with synthetic state; they do not replace testing a
download from the published 1.12.0 release after publication.

After the physical walkthrough passes:

1. Commit and push these release-preparation changes, then merge into `main` once checks pass.
2. Use the **Tablelight-Windows** artifact from the successful **Check and build** run for that
   merged `main` commit, or rebuild exactly that commit. This avoids publishing an older local
   build if the merge changed anything.
3. Create release **v1.12.0** targeting the reviewed merged commit. Copy the prepared release notes
   and attach these three files from the same build:
   - `Tablelight-Setup-1.12.0-x64.exe`
   - `Tablelight-Setup-1.12.0-x64.exe.blockmap`
   - `latest.yml`
4. Publish as the latest stable release only after all three assets are attached. Follow
   [the release procedure](RELEASING.md) for metadata verification and the post-publication check.

Do not upload the earlier 1.11.0 development installer, the isolated 0.0.1/0.0.2 installer-test
packages, or files from different build runs. This preparation does not create a tag, merge,
push changes or publish a release.
