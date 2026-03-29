import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  openAudioFile: () => ipcRenderer.invoke('open-audio-file'),
  saveFile: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => 
    ipcRenderer.invoke('save-file', options)
});
