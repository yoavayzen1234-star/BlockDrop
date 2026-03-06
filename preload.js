const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script - SurferPlan Desktop
 * Securely exposes only necessary APIs to the renderer process.
 */

contextBridge.exposeInMainWorld('api', {
    /**
     * Save project data to a local file
     * @param {string} data - JSON stringified project
     */
    saveFile: (data) => ipcRenderer.invoke('save-file', data),

    /**
     * Load project data from a local file
     * @returns {Promise<{success: boolean, content?: string}>}
     */
    loadFile: () => ipcRenderer.invoke('load-file')
});
