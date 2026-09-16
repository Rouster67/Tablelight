# Tablelight 2.0.0

Release notes prepared for the future GitHub release. This version has not been published;
see [release readiness](RELEASE_2.0.0.md) before using these notes for a stable release.

## Passive abilities for the DM and players

Create Active, Passive, or Passive + active abilities in the shared library or for one character.
The DM console and expanded player HUD both have a Passives section. Passive effects have no
Use button or action cost. Mixed abilities keep their written passive effect alongside their
normal active use.

Optional Active / Inactive reminders belong to each character independently. Sharing an ability
shares its definition while preserving individual reminder states, resource settings and HUD
placement. Reminders do not automatically change statistics or apply conditions.

Type chooses where an ability appears. Turn cost separately supports Action, Bonus action,
Reaction, or Free / other; any type can use slots, resources and the available detail fields.

## A complete illustrated manual

Setup & help opens the bundled offline PDF, covering every app section in 17 chapters with
37 real screenshots, step-by-step procedures, practical examples, linked contents and bookmarks.
It includes characters, shared and personal abilities, passives, resources, combat controls,
approval requests, History, HUD layout, messages, backups, updates and troubleshooting.

## Before upgrading

Export a party backup from Setup & help and keep it outside the installation folder.
Tablelight 2.0.0 imports save formats 1–10 and writes format 11. Version 1.12.1 and earlier
cannot read format 11, so retain a pre-upgrade backup if you may need an older version.

The Windows x64 download is `Tablelight-Setup-2.0.0-x64.exe`. Use the installer for a first
installation or the app's update controls after this release is published. The installer offers
a folder choice and keeps saved data by default. Existing portable users need a one-time
installation to enable in-app updates.
