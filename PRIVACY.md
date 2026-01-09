# Privacy Policy for Console Logger

**Last Updated:** January 10, 2026

## Overview

Console Logger is a browser extension that captures JavaScript console messages from browser tabs and saves them to local files. This privacy policy explains how the extension handles user data.

## Data Collection

**Console Logger does NOT collect, store, transmit, or share any personal data.**

### What the extension accesses:
- **Console messages**: JavaScript console output (log, warn, error, info) from tabs you explicitly choose to debug
- **Tab information**: The title and URL of the active tab (displayed locally in the popup only)

### What the extension stores locally:
- **Captured logs**: Stored in your browser's local storage until you clear them
- **User settings**: Filename, auto-save interval, and save location preferences

### What the extension does NOT do:
- ❌ No data is transmitted to external servers
- ❌ No analytics or tracking
- ❌ No cookies
- ❌ No user accounts or authentication
- ❌ No third-party services

## Data Storage

All data remains on your local device:
- Logs are stored in Chrome's `chrome.storage.local` API
- Saved files go to your Downloads folder or a location you choose
- No cloud sync, no external backups

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `debugger` | Capture console messages from tabs |
| `activeTab` | Access the current tab when you click "Start Capturing" |
| `storage` | Save logs and settings locally |
| `alarms` | Auto-save timer functionality |
| `downloads` | Save log files to your computer |

## Open Source

Console Logger is 100% open source. You can inspect the complete source code at:
https://github.com/IronAdamant/Console-logger

## Contact

For questions about this privacy policy, please open an issue on GitHub:
https://github.com/IronAdamant/Console-logger/issues

## Changes to This Policy

Any updates to this privacy policy will be reflected in this document with an updated "Last Updated" date.
