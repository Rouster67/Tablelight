# Reading the guide

This is a **development draft for Tablelight {{version}}**. It proves the offline guide link,
page layout, real screenshots, searchable text and PDF navigation. It is not the complete
illustrated manual and must not be released as one. The remaining chapters and walkthroughs
are tracked in COVERAGE.md. The installed START HERE.md remains the wider written companion.

Use the linked contents page or your PDF viewer's bookmarks to move between topics. These
pages, images and links work without internet access. Each numbered walkthrough starts from
the screen named in its first step. The example players and ability text are original test data.

## Open the guide again

1. Open **Setup & help** in the DM window.
2. Choose **Open illustrated user guide (PDF, offline)**. Windows opens this installed copy in
   your default PDF viewer. If nothing appears, choose a default PDF app in Windows and retry.
3. Leave the guide open beside Tablelight while you follow an example. Opening it does not
   change a character, spend a resource, or add an Undo step.

![Choose this button in Setup & help to open the local PDF.](images/help-link.png)

If the PDF is missing or unreadable, reinstall the same Tablelight version and try again.
Your saved party is stored separately from the program. Export a backup before changing PCs
or making major edits; see **Keep a backup** in Setup & help.

# Use the player HUD

**Purpose:** Let a player read their own character and make tracked changes while the DM
keeps the session on the laptop. Start with an active player and a connected TV selected in
**TV & layout**. Tablelight is a manual tracker; it does not change D&D Beyond.

## Expand and navigate

1. Choose **Show TV overlay**, then ensure **HUD controls: on** is selected in the DM window.
2. Click the player's portrait to expand the HUD. Choose a section, such as Features,
   Passives, Sheet, or Resources. **View** opens an ability; Previous and Next page long text.
3. Use the controls for HP, temporary HP, movement, turn costs, training, slots and charges
   only when the table agrees the corresponding change should happen.
4. Use **Start turn** for that player when their turn begins. It restores action, bonus action,
   reaction, movement and resources configured to reset Per turn.

Drag the portrait or Move handle to position that player's HUD. Drag the rotation handle to
face the player; hold Shift to snap rotation to 15 degrees. Smaller and Larger change scale.
Collapse returns to the portrait. Empty space outside the HUD passes input to the map.

## Request an ability use

1. Open the active effect of an ability and choose **Use ability**, or a **Cast L...** slot.
2. Review any concentration warning. Confirm to request the use, or cancel to leave it alone.
3. The DM reviews the request in the bottom-right queue and chooses **Allow use** or **Deny use**.
   Until then, costs are reserved on the player's HUD. **Cancel** withdraws that request.
4. After approval, the recorded costs are spent. Apply damage, healing and other rule effects
   yourself. An Inactive passive reminder does not block the ability's active effect.

DM **Use** applies tracked costs immediately. Up to three ordinary player requests can wait;
reactions use the urgent queue. **History** holds the five most recent decisions. The DM can
reconsider a denied use or choose **Undo this use** when its exact costs can still be restored.
A disabled control explains a conflicting change. Ordinary **Undo** reverses the last saved
Tablelight change and is a different control.

**Click-through:** Ctrl + Alt + I switches player interaction off or on. Text remains visible
with interaction off. Use the DM's **Currently displayed** controls to select sections, pages,
visibility, expansion and size. Ctrl + Alt + H hides the whole overlay from any app.

# Read and track passives

**Purpose:** Keep an owned ability's reminder visible without treating it as an action or
condition. Start with a passive assigned through the DM's Passives tab or Ability library.

## Try a conditional reminder

1. In an ability editor, select **Behavior: Passive**, enter your own description, and enable
   **Track whether the passive applies**. Save the shared entry and assign it to Mira and Rowan.
2. Expand Mira's player HUD, choose **Passives**, then **View** beside Lantern sense.
3. Click **Inactive** to mark Mira's reminder Active. Rowan's reminder stays unchanged.
4. Choose **Back to list** to return, or use the page arrows for a longer description.

![Mira's passive details, reminder switch, and list navigation on the real player HUD.](images/passive-detail.png)

The switch records a reminder only. It does not alter HP, AC, statistics, actions, slots,
charges or conditions. New tracked assignments begin Inactive. Without optional tracking,
the entry reads **Always applies** and has no switch. Turns and rests do not reset reminders.

For **Passive + active**, enter separate passive and active descriptions. **View active effect**
opens the ordinary use controls; **View passive effect** returns to the reminder. The passive
side never has a Use button or spending cost, even when its active side is spent.

In click-through mode, the player still sees the text and status. The DM can change the reminder
and pages in **Currently displayed**, or choose **Show passive effect on TV** from DM details.

# Concentration and conditions

**Purpose:** Record a current concentration ability and applied statuses. These are separate
from owned passive abilities. No description is parsed into automatic statistic changes.

## Choose concentration

1. On the DM screen, edit an assigned ability and enable **Concentration**. Save it.
2. On the expanded player HUD, click **Concentrating** and choose that ability. The DM can also
   use **Choose ability / Change ability**. Manual selection spends no costs.
3. The indicator lights while concentrating. Hover to read the ability name; click to end it.
4. Using a flagged ability starts concentration after a successful use or DM approval. If one
   is already selected, confirm the warning before switching. Cancel leaves costs and the
   current concentration unchanged. Undo restores the recorded change and costs together.

Damage controls show a concentration reminder when appropriate. Roll and adjudicate any required
check yourself, then clear concentration if the table's result requires it. Tablelight does
not roll the check. End or change concentration before converting its ability to passive-only.

## Apply a condition

1. On the DM character page, choose **Add** beside Conditions. Search saved definitions, or
   choose **Create new**, enter your own name and description, then **Save & add**.
2. The definition is saved in Condition library and applied to this character. On the TV,
   **Add** chooses existing entries only; it cannot create shared definitions.
3. Applied entries show **Added** in the picker. Hover a condition for its description, and
   use its remove control when it ends. Conditions page six at a time on the HUD.
4. Edit the shared definition in **Condition library** to update all assigned characters.
   Remove assignments before deleting the shared entry.

A passive can remain owned while Inactive. A condition records an applied status until removed.
Neither creates or removes the other, and neither changes statistics automatically.

# Rests and corrections

**Purpose:** Restore exactly the counters your table intends. Start on the DM character page
with the correct player selected. Export a backup before major changes.

## Apply a rest

1. Choose **Short rest** or **Long rest** from the DM controls.
2. Review the scope: one character or the whole active party. Saved players outside the party
   are not included in a whole-party rest.
3. Apply the rest and compare the counters with your table's expected result.

**Short rest** restores pools configured for Short rest. Apply any healing manually.
**Long rest** restores HP, standard slots, turn controls and both Short rest and Long rest pools;
it clears temporary HP and concentration. Per turn and Manual resource pools keep their current
values through either rest. Conditions, unavailable ability flags and passive reminders remain
as you set them. Resolve any pending-request warning before proceeding.

## Correct a mistake

1. Use **Undo** for the most recent saved Tablelight change. Ctrl + Z works when you are not
   typing in a field. Undo history lasts for the current app session.
2. For a single counter, use its **+**, **Restore**, or edit control. Check the player and pool
   before making the correction. Resolve any warning about pending requests.
3. For an approved ability use, open **History**, then **Undo this use**. It targets that use's
   recorded costs; conflicting later corrections can prevent a safe refund. Read the reason
   and make the correction manually if appropriate.

Keep backups outside the installation folder. **Export party backup** saves all characters,
shared libraries, images and settings. **Restore backup** replaces that saved collection after
confirmation and can be undone during the same session. It is not an import of one extra player.

Return to [Use the player HUD](#use-the-player-hud) for turn and approval controls, or
[Read and track passives](#read-and-track-passives) for reminder behavior.
