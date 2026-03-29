export interface AudioFileOptions {
  defaultPath?: string;
  filters: Array<{ name: string; extensions: string[] }>;
}

declare global {
  interface Window {
    electronAPI?: {
      openAudioFile: () => Promise<string | null>;
      saveFile: (options?: AudioFileOptions) => Promise<string | null>;
      onAudioFileProcessed: (callback: (data: any) => void) => () => void;
    };
  }
}

export {};
