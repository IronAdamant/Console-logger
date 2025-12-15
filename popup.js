/**
 * Popup Logic for Console Logger Extension
 */

// UI Elements
const ui = {
    tabInfo: document.getElementById('tabInfo'),
    status: document.getElementById('status'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    autoSave: document.getElementById('autoSaveCheckbox'),
    interval: document.getElementById('intervalInput'),
    filename: document.getElementById('filenameInput'),
    saveBtn: document.getElementById('saveBtn'),
    clearBtn: document.getElementById('clearBtn'),
    logDisplay: document.getElementById('logDisplay')
};

let capturedTabId = null;

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        ui.tabInfo.textContent = tab.title || "Unknown Tab";
        ui.tabInfo.title = tab.url; // Tooltip for full URL
    } else {
        ui.tabInfo.textContent = "No active tab";
        ui.startBtn.disabled = true;
    }

    // 2. Load settings and logs
    const data = await chrome.storage.local.get(['settings', 'logs']);
    const settings = data.settings || {};

    // Proactive check for restricted URLs (cannot attach debugger to these)
    if (tab && (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('devtools://'))) {
        ui.status.textContent = "⚠️ Restricted page. Open a normal website.";
        ui.status.style.color = "#fde047"; // Warning yellow
        ui.startBtn.disabled = true;
        ui.startBtn.title = "Browser security prevents extensions from running on internal pages.";
        return; // Stop initialization of buttons
    }

    // Restore inputs
    ui.filename.value = settings.filename || 'console-logs.txt';
    ui.interval.value = settings.interval || 30;
    ui.autoSave.checked = settings.autoSave || false;

    // Restore capture state based on specific tab
    // Ideally we check if *this* tab is the captured one, but background handles single capture.
    if (settings.isCapturing) {
        setCapturingState(true);
    } else {
        setCapturingState(false);
    }

    // Toggle interval input based on autosave
    toggleIntervalInput(ui.autoSave.checked);

    // Initial log render
    if (data.logs) renderLogs(data.logs);
});

// --- Event Listeners ---

// 1. Start Capture
ui.startBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    ui.status.textContent = "Attaching debugger...";

    // User must define the tabId to attach to
    const response = await chrome.runtime.sendMessage({
        action: 'startCapture',
        tabId: tab.id
    });

    if (response.success) {
        setCapturingState(true);
        ui.status.textContent = "Capturing active";
    } else {
        ui.status.textContent = "Error: " + response.error;
        ui.status.style.color = "#ef4444";
    }
});

// 2. Stop Capture
ui.stopBtn.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ action: 'stopCapture' });
    if (response.success) {
        setCapturingState(false);
        ui.status.textContent = "Stopped";
    }
});

// 3. Settings Changes
function updateSettings() {
    chrome.runtime.sendMessage({
        action: 'updateSettings',
        filename: ui.filename.value,
        interval: ui.interval.value,
        autoSave: ui.autoSave.checked
    });
}

ui.filename.addEventListener('change', updateSettings);

ui.interval.addEventListener('change', () => {
    if (ui.interval.value < 5) ui.interval.value = 5; // Enforce min
    updateSettings();
});

ui.autoSave.addEventListener('change', () => {
    toggleIntervalInput(ui.autoSave.checked);
    updateSettings();
});

// 4. Manual Actions
ui.saveBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'saveLogs' });
    const oldText = ui.status.textContent;
    ui.status.textContent = "Saved!";
    setTimeout(() => ui.status.textContent = oldText, 2000);
});

ui.clearBtn.addEventListener('click', async () => {
    if (confirm("Clear all captured logs?")) {
        await chrome.runtime.sendMessage({ action: 'clearLogs' });
        ui.logDisplay.textContent = "";
        ui.status.textContent = "Logs cleared";
    }
});

// --- Live Updates ---

// Listen for new logs from background
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.logs) {
            renderLogs(changes.logs.newValue);
        }
        if (changes.settings && changes.settings.newValue) {
            // Update UI if background changes state (e.g. detach on tab close)
            const isCap = changes.settings.newValue.isCapturing;
            setCapturingState(isCap);
        }
    }
});

// --- Helpers ---

function setCapturingState(isCapturing) {
    ui.startBtn.disabled = isCapturing;
    ui.stopBtn.disabled = !isCapturing;
    ui.status.style.color = isCapturing ? "#4ade80" : "#9ca3af";
    ui.status.textContent = isCapturing ? "Capturing..." : "Ready";
}

function toggleIntervalInput(enabled) {
    ui.interval.disabled = !enabled;
    ui.interval.style.opacity = enabled ? "1" : "0.5";
}

function renderLogs(logs) {
    if (!logs || !logs.length) {
        ui.logDisplay.textContent = "";
        return;
    }

    // Join lines. Optionally we could do HTML formatting for colors here.
    // For performance with large logs, we'll stick to text content mostly,
    // but let's try a simple span injection for colors if valid format.

    // Simple approach: Clear and append spans for last N lines?
    // or just plain text for speed (requested requirements: "large scrollable pre").
    // Let's stick to textContent for pure speed and stability, 
    // unless user wanted colored internal lines. 
    // The CSS has definitions for .log-level-ERROR etc, implying we want HTML.

    // Parsing thousands of lines to HTML might be slow. 
    // Let's render the last 500 lines as HTML elements for coloring.
    // Or just simple text if it's too heavy. 
    // Let's do simple text content for robust handling of arbitrary content.
    ui.logDisplay.textContent = logs.join('\n');

    // Auto scroll to bottom
    ui.logDisplay.scrollTop = ui.logDisplay.scrollHeight;
}
