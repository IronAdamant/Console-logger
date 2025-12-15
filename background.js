/**
 * Background Service Worker for Console Logger
 * Handles debugger attachment, log capture, storage, and file downloads.
 */

// --- State Variables ---
let capturedTabId = null;
let currentFilename = 'console-logs.txt';
let saveIntervalSeconds = 30;
let autoSaveEnabled = false;
let lastSavedLength = 0; // Track optimization for auto-save

// --- Initialization ---

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
    await chrome.storage.local.set({
        logs: [],
        settings: {
            filename: 'console-logs.txt',
            interval: 30,
            autoSave: false,
            isCapturing: false
        }
    });
    console.log("Console Logger installed and initialized.");
});

// Restore state on startup (if service worker wakes up)
chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
        currentFilename = result.settings.filename || 'console-logs.txt';
        saveIntervalSeconds = result.settings.interval || 30;
        autoSaveEnabled = result.settings.autoSave || false;

        // Note: capturedTabId is lost on service worker termination,
        // so we check if we're still attached to anything via debugger API query
        // but simplest is to reset capture state to false if we lost memory state
        // or rely on chrome.debugger.getTargets to rebuild state (advanced).
        // For this version, we'll reset capture state to clean on restart.
        chrome.storage.local.set({
            settings: { ...result.settings, isCapturing: false }
        });
    }
});

// --- Debugger & Log Capture ---

/**
 * Attaches the debugger to the specified tab.
 */
async function attachDebugger(tabId) {
    if (capturedTabId) {
        await detachDebugger();
    }

    try {
        await chrome.debugger.attach({ tabId: tabId }, '1.3');
        await chrome.debugger.sendCommand({ tabId: tabId }, 'Console.enable');
        capturedTabId = tabId;

        await updateSettingsState({ isCapturing: true });
        // Reset tracking on new attach
        lastSavedLength = 0;
        console.log(`Attached debugger to tab ${tabId}`);
        return { success: true };
    } catch (err) {
        console.error("Debugger attach failed:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Detaches the debugger from the current tab.
 */
async function detachDebugger() {
    if (!capturedTabId) return { success: true };

    try {
        await chrome.debugger.detach({ tabId: capturedTabId });
    } catch (err) {
        // Ignore detach errors (e.g., tab already closed)
        console.warn("Detach warning:", err);
    }

    const wasTab = capturedTabId;
    capturedTabId = null;
    await updateSettingsState({ isCapturing: false });
    console.log(`Detached debugger from tab ${wasTab}`);
    return { success: true };
}

/**
 * Handles debugger events (Console messages).
 */
chrome.debugger.onEvent.addListener(async (source, method, params) => {
    if (source.tabId !== capturedTabId) return;

    if (method === 'Console.messageAdded') {
        const msg = params.message;
        await appendLog(msg);
    }
});

/**
 * Handles debugger detachment (external, e.g. user closed tab or banner).
 */
chrome.debugger.onDetach.addListener(async (source, reason) => {
    if (source.tabId === capturedTabId) {
        console.log("Debugger detached externally:", reason);
        capturedTabId = null;
        await updateSettingsState({ isCapturing: false });
    }
});

// --- Log Management ---

/**
 * Formats and appends a log message to storage.
 */
async function appendLog(msg) {
    // Format timestamp
    const timestamp = new Date().toISOString();
    const level = (msg.level || 'INFO').toUpperCase();
    const text = msg.text || '';

    // Format: [TIMESTAMP] [LEVEL] Message
    const logLine = `[${timestamp}] [${level}] ${text}`;

    // Get existing logs and append
    // Optimization: In a high-volume production ext, we'd batch these.
    // For this assignment, simple append is capable enough.
    const result = await chrome.storage.local.get(['logs']);
    const logs = result.logs || [];
    logs.push(logLine);

    // Limit log size to prevent storage quota issues (optional but good practice)
    // 5MB limit ~ appx 50,000 lines. Let's keep last 10,000 to be safe.
    if (logs.length > 10000) {
        logs.splice(0, logs.length - 10000);
    }

    await chrome.storage.local.set({ logs });
}

/**
 * Clears all logs from memory and storage.
 */
async function clearLogs() {
    await chrome.storage.local.set({ logs: [] });
    lastSavedLength = 0;
    console.log("Logs cleared.");
}

// --- Auto-Save & Downloads ---

/**
 * Saves current logs to a file.
 */
async function saveLogs() {
    const result = await chrome.storage.local.get(['logs']);
    const logs = result.logs || [];

    if (logs.length === 0) {
        console.log("No logs to save.");
        return;
    }

    // Optimization: Only save if new logs exist since last save
    // (Only applies to auto-save logic usually, but efficient for manual too unless forced)
    // We'll allow manual overrides if needed, but for now apply globally as per request.
    if (logs.length <= lastSavedLength) {
        console.log("No new logs detected. Skipping save.");
        return;
    }

    const fileContent = logs.join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const reader = new FileReader();

    // Convert Blob to data URL because createObjectURL isn't fully supported 
    // in service workers in all versions (though it is in modern MV3 usually).
    // Using data URL is safer for specific worker contexts.
    reader.onload = function () {
        const url = reader.result;
        chrome.downloads.download({
            url: url,
            filename: currentFilename,
            conflictAction: 'overwrite',
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("Download failed:", chrome.runtime.lastError);
            } else {
                console.log(`Saved logs to ${currentFilename} (ID: ${downloadId})`);
                lastSavedLength = logs.length; // Update tracker on success
            }
        });
    };
    reader.readAsDataURL(blob);
}

/**
 * Updates the auto-save alarm.
 */
function updateAlarm() {
    chrome.alarms.clear('autoSave');
    if (autoSaveEnabled) {
        console.log(`Scheduling auto-save every ${saveIntervalSeconds}s`);
        chrome.alarms.create('autoSave', {
            periodInMinutes: saveIntervalSeconds / 60
        });
    }
}

// Handle Alarm trigger
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'autoSave') {
        saveLogs();
    }
});

// --- Message Handling ---

/**
 * Helper to update specific settings in storage
 */
async function updateSettingsState(updates) {
    const result = await chrome.storage.local.get(['settings']);
    const newSettings = { ...result.settings, ...updates };
    await chrome.storage.local.set({ settings: newSettings });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        try {
            switch (request.action) {
                case 'startCapture':
                    const result = await attachDebugger(request.tabId);
                    sendResponse(result);
                    break;

                case 'stopCapture':
                    const detResult = await detachDebugger();
                    sendResponse(detResult);
                    break;

                case 'saveLogs':
                    await saveLogs();
                    sendResponse({ success: true });
                    break;

                case 'clearLogs':
                    await clearLogs();
                    sendResponse({ success: true });
                    break;

                case 'updateSettings':
                    // Update internal variables
                    if (request.filename) currentFilename = request.filename;
                    if (request.interval) saveIntervalSeconds = Math.max(5, parseInt(request.interval));
                    if (typeof request.autoSave !== 'undefined') autoSaveEnabled = request.autoSave;

                    // Update persistent storage
                    await updateSettingsState({
                        filename: currentFilename,
                        interval: saveIntervalSeconds,
                        autoSave: autoSaveEnabled
                    });

                    // Update alarm
                    updateAlarm();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: "Unknown action" });
            }
        } catch (err) {
            sendResponse({ success: false, error: err.message });
        }
    })();
    return true; // Keep message channel open for async response
});
