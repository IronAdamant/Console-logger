# Console Logger - Browser Extension

[![Open Source](https://img.shields.io/badge/Open%20Source-MIT-green.svg)](https://github.com/IronAdamant/Console-logger)
[![GitHub Release](https://img.shields.io/github/v/release/IronAdamant/Console-logger?include_prereleases)](https://github.com/IronAdamant/Console-logger/releases)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-blue.svg)](#installation)

A powerful Chromium browser extension that captures JavaScript console messages (log, warn, error, info) from any active tab, displays them live, and automatically saves them to a text file.

> 🔓 **100% Open Source** — Inspect the code yourself on [GitHub](https://github.com/IronAdamant/Console-logger)

## 🚀 Key Features

- **Full Console Capture**: Uses `chrome.debugger` API to catch *all* messages, including native browser errors that content scripts miss.
- **Deep Object Logging**: Captures nested objects, arrays, and stack traces — not just string representations.
- **Live Monitoring**: Real-time display of logs in the popup window.
- **Auto-Save**: Periodically saves captured logs to your Downloads folder without prompting.
- **Smart Overwrite**: Updates the same file (`console-logs.txt`) continuously, preventing file clutter.
- **Persistent Storage**: Logs are stored locally and survive browser restarts.
- **Cross-Platform**: Works on Windows, macOS, and Linux.

---

## 🌐 Browser Compatibility

| Browser | Support | Installation URL |
|---------|---------|------------------|
| **Microsoft Edge** | ✅ Full | `edge://extensions` |
| **Google Chrome** | ✅ Full | `chrome://extensions` |
| **Brave** | ✅ Full | `brave://extensions` |
| **Opera** | ✅ Full | `opera://extensions` |
| **Vivaldi** | ✅ Full | `vivaldi://extensions` |
| **Arc** | ✅ Full | `arc://extensions` |
| **Firefox** | ⚠️ Limited | Different API architecture |
| **Safari** | ❌ No | Incompatible extension model |

---

## 📥 Installation (Sideloading)

Since this is a developer tool, you install it as an "unpacked" extension.

1. **Download/Clone** this project folder to your computer.
2. Open your browser and go to the extensions page (see table above).
3. Toggle **Developer mode** on.
4. Click **Load unpacked**.
5. Select the `Console logger` folder (the root folder containing `manifest.json`).
6. The extension icon will appear in your toolbar.

---

## 📖 How to Use

### 1. Start Capturing
1. Navigate to the website you want to debug.
2. Click the extension icon to open the popup.
3. Click **"Start Capturing"**.
4. **Important**: Your browser will show a warning banner: *"Console Logger started debugging this browser"*. This is a security feature of the Debugger API.

### 2. Monitoring Logs
- Logs appear immediately in the dark-themed console area.
- Messages include timestamps and log levels: `[2025-12-15T12:00:00.000Z] [LOG] Message...`
- Objects are serialized with full depth (configurable).

### 3. Using Auto-Save
1. Check the **"Enable Auto-Save"** box.
2. Set the **Interval** (default 30 seconds, minimum 5 seconds).
3. Set a **Filename** (default `console-logs.txt`).
4. The extension will silently overwrite this file in your Downloads folder.
   - *Tip*: Open the file in VS Code or similar to see live updates.

### 4. Important Usage Note
- **Restricted Pages**: You cannot capture logs from browser internal pages (`chrome://`, `edge://`, `about:`, etc.).
  - *Symptom*: Warning message in the popup.
  - *Fix*: Navigate to a normal website and try again.

### 5. Manual Controls
- **Save Now**: Immediately downloads the current log history.
- **Clear Logs**: Wipes the in-memory log history.
- **Stop**: Detaches the debugger.

---

## ⚠️ Known Limitations

- **Security Warning**: The "started debugging" banner is enforced by the browser and cannot be hidden.
- **Downloads Folder**: Extensions can only save to your Downloads folder (browser security restriction).
- **Storage Limit**: Up to ~10,000 log lines are stored. Older logs are rotated out.

---

## 📁 Project Structure

```
Console logger/
├── manifest.json      # Extension configuration (MV3)
├── background.js      # Service worker (debugger, storage, downloads)
├── popup.html         # Popup UI structure
├── popup.js           # Popup logic
├── styles.css         # Dark theme styling
├── icons/             # Extension icons (16/48/128px)
└── README.md          # This file
```

---

## License

MIT License. Free to use and modify.
