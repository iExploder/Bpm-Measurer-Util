export interface AudioData {
  buffer: AudioBuffer;
  peaks: Float32Array;
  duration: number;
}

export interface TimingPoint {
  id: string;
  beatIndex: number; // The global beat count where this section starts
  bpm: number;       // The tempo of this section
  time: number;      // Calculated absolute time (seconds)
}

export interface ViewState {
  zoom: number; // Pixels per second
  scrollLeft: number; // Pixels
}