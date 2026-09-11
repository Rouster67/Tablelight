# Contributing to Tablelight

Use Node.js 24+ and Windows for desktop development. Run `npm ci`, then `npm start`. Keep changes focused and describe the problem and resulting behavior in your pull request.

Before a pull request, run `npm run format`, `npm run check`, and `npm run format:check`. Run `npm run test:native` for changes to controls, shared state, persistence, or native windows. State which display configurations you checked and any checks you could not run. Add meaningful regression tests for behavior changes.

The project uses plain JavaScript and DOM/CSS; no UI framework or build transpiler is required. Prefer small functions and explicit state transitions. Render user text through the existing escaping helpers. Keep file access in the main process and expose narrow, sender-checked IPC methods through the preload bridge. Keep Electron sandboxing, context isolation, and the Content Security Policy enabled.

Library definitions are shared; resource pools and spent state are per-character. Do not reset live player state when saving an editor that was opened earlier. Preserve migration from older backups. Keep DM notes off the player overlay.

Use synthetic text and portraits in tests and screenshots. Do not contribute rulebook passages, copied game art, personal saved parties, account data, or secrets. The project intentionally ships without spells or class feature text.

Contributions are accepted under GPL-3.0-or-later, the project's license. Preserve existing notices and document user-visible changes in CHANGELOG.md. Be respectful, explain tradeoffs, and provide reproducible steps when reporting issues.
