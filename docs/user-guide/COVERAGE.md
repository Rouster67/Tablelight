# Illustrated user guide — working coverage checklist

Started September 15, 2026 for F13 while implementing the passive data foundation. This is an
outline, not the PDF or a claim that its workflows have been verified. Baseline: package 1.12.1
plus merged UI changes at `2c583f9`. The final release version and screenshot freeze are pending.

DM milestone update: Behavior/Turn cost, the DM Passives tab, conditional reminder switches,
and separate mixed-effect descriptions are implemented. Include their creation, assignment,
independent reminders, shared/local editing, and read-only effect navigation in the guide.
Player Passives navigation is now implemented: cover list/detail reminder switches, Back to list,
mixed-effect links, DM Show on TV and Currently displayed controls, and read-only click-through
status. Development test captures are not final guide images; final captures still wait for the
finished Setup & help interface and the release version.

Use synthetic players Mira and Rowan, their original Lantern sense / Watchkeeper examples from
the [implementation plan](../PASSIVES_AND_ILLUSTRATED_GUIDE_PLAN.md), and a saved inactive player.
Record each procedure's prerequisites, exact controls, expected DM/HUD result, correction path,
final screenshot IDs, and verification against the release build. Add one checkbox per actual
control when writing each chapter; these topic groups are not a substitute for that inventory.

- [ ] Installation and first launch: default/custom folder, shortcuts, Windows Extend, choose
      TV, scale, show/hide overlay, disconnect/reconnect, and offline use.
- [ ] Guided first session: create players, shared ability and passive, resource, rotated HUDs,
      initiative, an approved player use, reminder change, correction, export, close/reopen.
- [ ] Sidebar and party: search/filter/page saved players, create/edit/delete, add/remove/rejoin,
      active-party limit, initiative sorting/reordering, private notes, and preserved settings.
- [ ] Character and Sheet: every editor field, portrait/theme, HP/temp HP/AC/speed, ability
      scores, proficiency/skills/saves/expertise/overrides, casting settings, and spell slots.
- [ ] Ability library: all current manual fields including Reference/Upgrades, icon controls,
      shared and local creation, duplication, assignment, independent costs/unavailable flag,
      removing, and deletion with the keep-local-copies and remove choices. No automatic F07
      attack/DC calculations: that proposal was replaced by manual ability fields.
- [ ] Passives after UI completion: Active/Passive/Hybrid, always versus conditional, personal
      reminder state, mixed-effect navigation, absence of passive use/costs, manual statistics,
      and differences from conditions/concentration. The passive feature is implemented.
- [ ] Resources: standalone Add and full editing, maximum/current counts, icon/color, every reset
      rule, links/costs, removal guards, manual correction, slots and custom spell pools.
- [ ] Session: initiative, Start/Next turn, movement, action/bonus/reaction, damage/temp HP/healing,
      direct DM use, player requests/reservations, cancellation, ordinary and urgent queues,
      allow/deny, dependency warnings, five-entry History, reconsider, targeted and ordinary Undo.
- [ ] Concentration and conditions: shared creation/edit/search, assigning/removing, concentration
      selection/use warnings/automatic selection, damage reminder/manual outcomes, and exact
      behavior through turns/rests. Describe condition paging and TV selection of existing entries.
- [ ] HUD/Currently displayed/TV layout: every section and navigation control, fifteen-entry
      ability pages, six-condition pages, three-resource pages, no HUD scrollbars, content-driven
      height, pending-approval column, independent scale/rotation, themes, opacity, collapse/hide,
      arrangement, preview, multiple HUDs, click-through and input outside HUDs.
- [ ] Messages: DM drafts, recipient selection, replacement, sent/delivered/opened status,
      notification, force open, page/scroll/close/dismiss, reduced motion, click-through controls,
      shared-screen visibility and session-only lifetime. Distinguish message reading scroll from
      the removed HUD content scrollbars.
- [ ] Setup & help: retained content/controls and the future local PDF link, license, shortcuts,
      save location, backups/restore, updates, and display tips. Include every topic removed from
      the three help paragraphs in its corresponding guide chapter.
- [ ] Saving, updates and uninstall: full backup contents, previous-save recovery, moving PCs,
      format compatibility, update/Later/cancel/opt-out/errors/custom-folder retention, offline
      behavior, uninstall default preservation and explicit deletion using synthetic examples.
- [ ] Troubleshooting/reference: wrong display, covered/hidden/oversized HUD, unreadable scaling,
      unavailable abilities, passive reminders, shared edits, save/update/guide-opening problems,
      viewer recovery, glossary, shortcut table and session checklist.

## Final capture and acceptance record — pending

- [ ] Recheck all chapters against the final release feature set and every visible control.
- [ ] Freeze interface/labels/version, including the final Setup & help link; record source
      revision, sample fixture version, window sizes/scaling and original screenshot IDs.
- [ ] Capture real-app readable overviews/details; replace affected shots after any UI change.
- [ ] Verify each walkthrough from its stated starting point, recording actual results.
- [ ] Generate a version-matched searchable PDF with linked contents and nested bookmarks.
- [ ] Render and inspect every page individually; correct clipping, small text and poor captions.
- [ ] Check every navigation destination and inspect in two local viewers, including the default.
- [ ] Verify offline opening from fresh ordinary and custom installs (spaces/non-ASCII/another
      drive), different working directories, and a custom-folder update. Compare installed hash.
- [ ] Verify missing/unreadable guide and viewer errors are recoverable; reconcile the Markdown
      companion; record tests and guide source/build instructions with the release checklist.

Milestone 4 adds the guide link, authoring pipeline and packaging checks. The seven-page Draft
proves linked contents/bookmarks, embedded fonts and local opening; its two screenshots use the
real finished help/passive interfaces with synthetic data. All prototype pages were inspected.
These are prototype assets, not the final screenshot freeze. The full manuscript, per-control
inventory, every walkthrough, two-viewer review and full ordinary/custom installation matrix
remain milestones 5/6. The guide is explicitly blocked from ordinary release packaging.
