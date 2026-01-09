/**
 * Background Service Worker for Console Logger
 * Handles debugger attachment, log capture, storage, and file downloads.
 * 
 * Uses Runtime.consoleAPICalled (not deprecated Console domain) for deep logging.
 */

// --- Configuration ---
const MAX_OBJECT_DEPTH = 10; // Configurable depth for object serialization
const MAX_ARRAY_ITEMS = 100; // Max array items to serialize
const MAX_STRING_LENGTH = 10000; // Truncate very long strings

// --- State Variables ---
let capturedTabId = null;
let currentFilename = 'console-logs.txt';
let saveIntervalSeconds = 30;
let autoSaveEnabled = false;
let lastSavedLength = 0; // Track optimization for auto-save
let savedPath = ''; // User's last saved path (for display)

// --- Initialization ---

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
    await chrome.storage.local.set({
        logs: [],
        settings: {
            filename: 'console-logs.txt',
            interval: 30,
            autoSave: false,
            isCapturing: false,
            savePath: '' // User's last saved path
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
        savedPath = result.settings.savePath || '';

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
        // Use Runtime domain (not deprecated Console) for deeper logging
        await chrome.debugger.sendCommand({ tabId: tabId }, 'Runtime.enable');
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
    // Clear auto-save alarm when capture stops
    chrome.alarms.clear('autoSave');
    console.log(`Detached debugger from tab ${wasTab}`);
    return { success: true };
}

/**
 * Handles debugger events (Console messages).
 */
chrome.debugger.onEvent.addListener(async (source, method, params) => {
    if (source.tabId !== capturedTabId) return;

    // Runtime.consoleAPICalled provides deeper object data than Console.messageAdded
    if (method === 'Runtime.consoleAPICalled') {
        await appendLog(params);
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
 * Serializes a RemoteObject to a readable string with configurable depth.
 */
function serializeRemoteObject(obj, depth = 0) {
    if (depth > MAX_OBJECT_DEPTH) return '[Max depth exceeded]';
    if (!obj) return 'undefined';

    const type = obj.type;
    const subtype = obj.subtype;

    // Primitives
    if (type === 'string') {
        const val = obj.value || '';
        return val.length > MAX_STRING_LENGTH
            ? val.substring(0, MAX_STRING_LENGTH) + '...[truncated]'
            : val;
    }
    if (type === 'number' || type === 'boolean') return String(obj.value);
    if (type === 'undefined') return 'undefined';
    if (type === 'symbol') return obj.description || 'Symbol()';
    if (subtype === 'null') return 'null';

    // Functions
    if (type === 'function') {
        return obj.description || '[Function]';
    }

    // Objects with preview (provides nested structure)
    if (obj.preview) {
        return serializeObjectPreview(obj.preview, depth);
    }

    // Fallback to description
    return obj.description || `[${type}]`;
}

/**
 * Serializes an ObjectPreview with full property enumeration.
 */
function serializeObjectPreview(preview, depth = 0) {
    if (depth > MAX_OBJECT_DEPTH) return '[Max depth exceeded]';
    if (!preview) return '{}';

    const subtype = preview.subtype;
    const properties = preview.properties || [];

    // Arrays
    if (subtype === 'array') {
        const items = properties.slice(0, MAX_ARRAY_ITEMS).map(prop => {
            if (prop.valuePreview) {
                return serializeObjectPreview(prop.valuePreview, depth + 1);
            }
            return prop.value !== undefined ? String(prop.value) : prop.type;
        });
        const suffix = properties.length > MAX_ARRAY_ITEMS ? ', ...' : '';
        return `[${items.join(', ')}${suffix}]`;
    }

    // Regular objects
    const pairs = properties.map(prop => {
        let value;
        if (prop.valuePreview) {
            value = serializeObjectPreview(prop.valuePreview, depth + 1);
        } else {
            value = prop.value !== undefined ? JSON.stringify(prop.value) : prop.type;
        }
        return `${prop.name}: ${value}`;
    });

    const overflow = preview.overflow ? ', ...' : '';
    return `{${pairs.join(', ')}${overflow}}`;
}

/**
 * Formats a stack trace from Runtime.consoleAPICalled.
 */
function formatStackTrace(stackTrace) {
    if (!stackTrace || !stackTrace.callFrames || stackTrace.callFrames.length === 0) {
        return '';
    }

    // Format top frame (most relevant)
    const frame = stackTrace.callFrames[0];
    const funcName = frame.functionName || '(anonymous)';
    const location = `${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
    return `\n    at ${funcName} (${location})`;
}

/**
 * Formats and appends a log message to storage.
 * Uses Runtime.consoleAPICalled params for deep serialization.
 */
async function appendLog(params) {
    const timestamp = new Date().toISOString();
    const level = (params.type || 'log').toUpperCase();

    // Serialize all arguments with deep object support
    const args = (params.args || []).map(arg => serializeRemoteObject(arg));
    const message = args.join(' ');

    // Build log line with optional stack trace
    let logLine = `[${timestamp}] [${level}] ${message}`;
    logLine += formatStackTrace(params.stackTrace);

    // Get existing logs and append
    const result = await chrome.storage.local.get(['logs']);
    const logs = result.logs || [];
    logs.push(logLine);

    // Limit log size to prevent storage quota issues
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
        // Note: Chrome's filename param only works within Downloads folder.
        // If user has set a custom path (outside Downloads), we save there 
        // by simply using the filename - Chrome remembers Last Used folder
        // when saveAs was used, but for auto-save we use Downloads folder.
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
        // Only auto-save if capture is currently active
        if (capturedTabId !== null) {
            saveLogs();
        } else {
            console.log('Auto-save skipped: No active capture session.');
        }
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
                    sendResponse({ success: true, savePath: savedPath });
                    break;

                case 'setSaveLocation':
                    // Trigger a save with saveAs: true to let user pick location
                    // Then capture the resulting path
                    const logs = (await chrome.storage.local.get(['logs'])).logs || [];
                    if (logs.length === 0) {
                        // Create a placeholder file so user can pick location
                        const placeholder = '[Console Logger will save logs here]';
                        const blob = new Blob([placeholder], { type: 'text/plain' });
                        const reader = new FileReader();
                        reader.onload = function () {
                            chrome.downloads.download({
                                url: reader.result,
                                filename: currentFilename,
                                saveAs: true
                            }, (downloadId) => {
                                if (downloadId && !chrome.runtime.lastError) {
                                    // Listen for the download to complete to get the path
                                    chrome.downloads.search({ id: downloadId }, (items) => {
                                        if (items && items[0] && items[0].filename) {
                                            const fullPath = items[0].filename;
                                            // Extract directory from full path
                                            const lastSlash = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
                                            const directory = lastSlash > 0 ? fullPath.substring(0, lastSlash) : '';
                                            savedPath = directory;
                                            updateSettingsState({ savePath: directory });
                                            sendResponse({ success: true, savePath: directory, fullPath: fullPath });
                                        } else {
                                            sendResponse({ success: false, error: 'Could not get path' });
                                        }
                                    });
                                } else {
                                    sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Cancelled' });
                                }
                            });
                        };
                        reader.readAsDataURL(blob);
                    } else {
                        // Save existing logs with saveAs
                        const fileContent = logs.join('\n');
                        const blob = new Blob([fileContent], { type: 'text/plain' });
                        const reader = new FileReader();
                        reader.onload = function () {
                            chrome.downloads.download({
                                url: reader.result,
                                filename: currentFilename,
                                saveAs: true
                            }, (downloadId) => {
                                if (downloadId && !chrome.runtime.lastError) {
                                    chrome.downloads.search({ id: downloadId }, (items) => {
                                        if (items && items[0] && items[0].filename) {
                                            const fullPath = items[0].filename;
                                            const lastSlash = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
                                            const directory = lastSlash > 0 ? fullPath.substring(0, lastSlash) : '';
                                            savedPath = directory;
                                            updateSettingsState({ savePath: directory });
                                            lastSavedLength = logs.length;
                                            sendResponse({ success: true, savePath: directory, fullPath: fullPath });
                                        } else {
                                            sendResponse({ success: false, error: 'Could not get path' });
                                        }
                                    });
                                } else {
                                    sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Cancelled' });
                                }
                            });
                        };
                        reader.readAsDataURL(blob);
                    }
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
