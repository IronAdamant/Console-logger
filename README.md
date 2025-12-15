# Console Logger - Edge Extension

A powerful Microsoft Edge (Chromium) extension that captures JavaScript console messages (log, warn, error, info) from any active tab, displays them live, and automatically saves them to a text file.

## 🚀 Key Features

- **Full Console Capture**: Uses `chrome.debugger` API to catch *all* messages, including native browser errors that content scripts miss.
- **Live Monitoring**: Real-time display of logs in the popup window.
- **Auto-Save**: Periodically saves captured logs to your Downloads folder without prompting.
- **Smart Overwrite**: Updates the same file (`console-logs.txt`) continuously, preventing file clutter (e.g., `file (1).txt`).
- **Persistent Storage**: Logs are stored locally and survive browser restarts.

---

## 📥 Installation (Sideloading)

Since this is a developer tool, you install it as an "unpacked" extension.

1. **Download/Clone** this project folder to your computer.
2. Open Microsoft Edge and go to `edge://extensions`.
3. Toggle **Developer mode** on (left sidebar or bottom corner).
4. Click **Load unpacked**.
5. Select the `Console logger` folder (the root folder containing `manifest.json`).
6. The extension icon (square box) will appear in your toolbar.

---

## 📖 How to Use

### 1. Start Capturing
1. Navigate to the website you want to debug.
2. Click the extension icon to open the popup.
3. Click **"Start Capturing"**.
4. **Important**: Edge will show a warning banner: *"Console Logger started debugging this browser"*. This is a security feature of the Debugger API. You must allow this for the extension to work.

### 2. Monitoring Logs
- Logs appear immediately in the black (dark mode) console area.
- Messages include unique timestamps: `[2025-12-15T12:00:00.000Z] [LOG] Message...`

### 3. Using Auto-Save
1. Check the **"Enable Auto-Save"** box.
2. Set the **Interval** (default 30 seconds). Minimum is 5 seconds.
3. Set a **Filename** (default `console-logs.txt`).
4. The extension will now silently overwrite this file in your Downloads folder at every interval.
   - *Tip*: Open this file in VS Code or Notepad++ which detects file changes to see a "live" stream on your disk.

### 4. Important Usage Note
- **Restricted Pages**: You cannot capture logs from browser internal pages (like `edge://extensions`, `chrome://settings`, or the New Tab page).
  - *Symptom*: You will see a red error **"Cannot access chrome:// and edge:// URLs"** in the popup.
  - *Fix*: Navigate to a normal website (e.g., google.com, localhost, or your web app) and try again.

### 5. Manual Controls
- **Save Now**: Immediately downloads the current log history.
- **Clear Logs**: Wipes the in-memory log history and clears the display.
- **Stop**: Detaches the debugger. The warning banner will disappear.

---

## ⚠️ Known Limitations & Behaviors

- **Security Warning**: The "started debugging" banner is enforced by the browser security model and cannot be hidden by the extension.
- **Downloads Folder**: For security reasons, extensions can only save files to your user "Downloads" folder (or subfolders within it). You cannot save to arbitrary system paths.
- **Storage Limit**: The extension stores up to ~10,000 log lines in local storage. Older logs are rotated out.

---

## 🛠️ Developer Wiki

This project includes a complete developer wiki in the `wiki-local/` folder.

- **[spec-project.md](wiki-local/spec-project.md)**: Technical architecture and design.
- **[funcs-background.md](wiki-local/funcs-background.md)**: Documentation for the background service worker.
- **[funcs-popup.md](wiki-local/funcs-popup.md)**: Documentation for the popup UI.

To view: Open `wiki-local/index.md` in any Markdown viewer.

---

## License

MIT License. Free to use and modify.
