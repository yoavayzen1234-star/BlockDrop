const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Main Process - SurferPlan Desktop
 * Handles lifecycle, windows, and native file system dialogs.
 */

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            devTools: true // Set to false for production
        },
        title: "SurferPlan Desktop",
        backgroundColor: '#f0f4f8'
    });

    // Remove menu bar for production
    // mainWindow.setMenu(null);

    mainWindow.loadFile('index.html');
}

// Security: No remote content allowed
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        event.preventDefault();
    });
    contents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for File System
ipcMain.handle('save-file', async (event, data) => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'Save Project',
        defaultPath: path.join(app.getPath('documents'), 'project.spp'),
        filters: [
            { name: 'SurferPlan Project', extensions: ['spp', 'json'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (filePath) {
        fs.writeFileSync(filePath, data, 'utf8');
        return { success: true, filePath };
    }
    return { success: false };
});

ipcMain.handle('load-file', async () => {
    const { filePaths } = await dialog.showOpenDialog({
        title: 'Open Project',
        filters: [
            { name: 'SurferPlan Project', extensions: ['spp', 'json'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
        const content = fs.readFileSync(filePaths[0], 'utf8');
        return { success: true, content, filePath: filePaths[0] };
    }
    return { success: false };
});

// Hardware ID (Basic Fingerprint)
ipcMain.handle('get-hwid', () => {
    // In a real app, use a lib like 'node-machine-id'
    // For now, return a platform-based unique-ish string
    return `${process.platform}-${process.arch}-${require('os').hostname()}`;
});
