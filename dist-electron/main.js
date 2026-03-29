import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        backgroundColor: '#0f0f0f',
        show: false,
        icon: path.join(__dirname, 'icon.ico')
    });
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.on('ready-to-show', () => {
        mainWindow?.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};
ipcMain.handle('open-audio-file', async () => {
    if (!mainWindow)
        return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Audio Files', extensions: ['wav', 'mp3', 'flac', 'aac', 'ogg', 'wma'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});
ipcMain.handle('save-file', async (event, options) => {
    if (!mainWindow)
        return null;
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: options?.defaultPath || 'untitled.txt',
        filters: options?.filters || [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (result.canceled) {
        return null;
    }
    return result.filePath;
});
app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
