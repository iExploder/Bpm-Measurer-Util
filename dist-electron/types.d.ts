export interface AudioData {
    buffer: AudioBuffer;
    peaks: Float32Array;
    duration: number;
}
export interface TimingPoint {
    id: string;
    beatIndex: number;
    bpm: number;
    time: number;
}
export interface ViewState {
    zoom: number;
    scrollLeft: number;
}
//# sourceMappingURL=types.d.ts.map