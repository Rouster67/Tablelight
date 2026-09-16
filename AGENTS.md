# Tablelight working preferences

- The user tests the app in `D:\Programs\Tablelight`. After completing app changes,
  build and update that installation, then verify the installed files and relevant
  behavior. The user has authorized these routine testing-copy updates; do not leave
  finished changes only in the source checkout.
- Preserve the user's saved party, libraries, and settings. Back up the current
  installation and saves before replacing program files. Use isolated synthetic data
  for automated checks. Do not force-close a running session with unsaved drafts.
- The user controls branches, commits, and publishing. Do not create or switch branches,
  commit, push, or publish releases unless explicitly asked.
- Explain completed changes in plain language and distinguish the installed development
  build from a published release. Do not bump the release version just for a local update.
