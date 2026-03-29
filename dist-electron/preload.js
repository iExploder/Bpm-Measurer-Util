import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electron', {
    openAudioFile: () => ipcRenderer.invoke('open-audio-file'),
    saveFile: (options) => ipcRenderer.invoke('save-file', options)
});
