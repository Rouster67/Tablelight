# Security

Tablelight loads local application files with context isolation, Electron's renderer sandbox, and Node integration disabled in renderers. Navigation and popups are denied. The UI's Content Security Policy blocks external connections. Privileged operations require the DM window as sender; the overlay uses a narrower command channel.

The app is a local tracker, not a rules-content downloader. Treat imported party backups and portraits as untrusted data. Keep validation and text escaping in place. A backup can contain private notes and portraits: use synthetic data for public bug reports.

When this repository is published, report vulnerabilities through GitHub's **Security → Report a vulnerability** if private reporting is enabled. If that option is absent, open an issue requesting a private reporting channel without including exploit details or personal data. The maintainer should enable private vulnerability reporting before inviting public security reports.

Only the current application release is maintained. Keep Electron updated and run the tests after runtime changes. Portable builds are currently unsigned and do not auto-update. Download releases from the project owner's repository and retain a party backup when upgrading.
