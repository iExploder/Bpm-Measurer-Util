
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { AudioData, ViewState, TimingPoint } from '../types';
import { computeFFT, getSpectrogramColor, getHannWindow } from '../utils/audioUtils';
import { getPointAtTime } from '../utils/timingUtils';

interface VisualizerProps {
  audioData: AudioData | null;
  currentTime: number;
  viewState: ViewState;
  timingPoints: TimingPoint[];
  onUpdateBpm: (beatIndex: number, bpm: number) => void;
  onUpdateOffset: (offset: number) => void;
  onSeek: (time: number) => void;
  width: number;
  height: number;
  specLogBase: number; // New prop for logarithmic scaling
}

const FFT_SIZE = 1024; 
const TIMELINE_HEIGHT = 40; 

const Visualizer: React.FC<VisualizerProps> = ({
  audioData,
  currentTime,
  viewState,
  timingPoints,
  onUpdateBpm,
  onUpdateOffset,
  onSeek,
  width,
  height,
  specLogBase,
}) => {
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const spectrogramRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [dragging, setDragging] = useState<{ 
      type: 'offset' | 'bpm'; 
      pointIndex: number; 
      beatIndex: number; 
      startX: number; 
      initialVal: number; 
  } | null>(null);

  const intWidth = Math.floor(width);
  const intHeight = Math.floor(height);
  
  const availableHeight = Math.max(0, intHeight - TIMELINE_HEIGHT);
  const waveHeight = Math.floor(availableHeight * 0.5);
  const specHeight = availableHeight - waveHeight;

  const timeToX = (t: number) => (t * viewState.zoom) - viewState.scrollLeft;
  const xToTime = (x: number) => (x + viewState.scrollLeft) / viewState.zoom;

  const hannWindow = useMemo(() => getHannWindow(FFT_SIZE), []);

  // --- Draw Waveform ---
  useEffect(() => {
    const canvas = waveformRef.current;
    if (canvas && audioData && intWidth > 0 && waveHeight > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            canvas.style.width = `${intWidth}px`;
            canvas.style.height = `${waveHeight}px`;
            canvas.width = intWidth * dpr;
            canvas.height = waveHeight * dpr;
            ctx.scale(dpr, dpr);

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, intWidth, waveHeight);

            const startTime = Math.max(0, xToTime(0));
            const endTime = Math.min(audioData.duration, xToTime(intWidth));
            
            const rawData = audioData.buffer.getChannelData(0);
            const step = Math.ceil(audioData.buffer.sampleRate / viewState.zoom); 
            
            const centerY = waveHeight / 2;
            const ampScale = waveHeight / 2;

            ctx.beginPath();
            ctx.strokeStyle = '#1a1a1a';
            ctx.moveTo(0, centerY);
            ctx.lineTo(intWidth, centerY);
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 1;
            
            const startPixel = Math.floor(Math.max(0, timeToX(startTime)));
            const endPixel = Math.ceil(Math.min(intWidth, timeToX(endTime)));

            if (endPixel > startPixel) {
                for (let x = startPixel; x <= endPixel; x++) {
                    const t = xToTime(x);
                    const sampleIdx = Math.floor(t * audioData.buffer.sampleRate);
                    if (sampleIdx < 0 || sampleIdx >= rawData.length) continue;

                    let min = 1.0, max = -1.0;
                    const chunkEnd = Math.min(sampleIdx + step, rawData.length);
                    const stride = Math.max(1, Math.floor((chunkEnd - sampleIdx) / 10)); 
                    for (let i = sampleIdx; i < chunkEnd; i += stride) {
                        const val = rawData[i];
                        if (val < min) min = val;
                        if (val > max) max = val;
                    }
                    if (min > max) { min = 0; max = 0; }
                    ctx.moveTo(x, centerY + min * ampScale);
                    ctx.lineTo(x, centerY + max * ampScale);
                }
                ctx.stroke();
            }
        }
    }
  }, [audioData, viewState, intWidth, waveHeight]);

  // --- Draw Spectrogram ---
  useEffect(() => {
    const sCanvas = spectrogramRef.current;
    if (sCanvas && audioData && intWidth > 0 && specHeight > 0) {
        const ctx = sCanvas.getContext('2d');
        if (ctx) {
             const dpr = window.devicePixelRatio || 1;
             const fullWidth = Math.floor(intWidth * dpr);
             const fullHeight = Math.floor(specHeight * dpr);

             sCanvas.width = fullWidth;
             sCanvas.height = fullHeight;
             sCanvas.style.width = `${intWidth}px`;
             sCanvas.style.height = `${specHeight}px`;

             const imageData = ctx.createImageData(fullWidth, fullHeight);
             const buf32 = new Uint32Array(imageData.data.buffer);
             buf32.fill(0xFF000000);

             const rawData = audioData.buffer.getChannelData(0);
             const sampleRate = audioData.buffer.sampleRate;
             const input = new Float32Array(FFT_SIZE);

             for (let x = 0; x < fullWidth; x++) {
                 const t = xToTime(x / dpr);
                 if (t < 0 || t >= audioData.duration) continue;
                 const sampleIdx = Math.floor(t * sampleRate);
                 if (sampleIdx < 0 || sampleIdx + FFT_SIZE >= rawData.length) continue;

                 for (let i = 0; i < FFT_SIZE; i++) input[i] = rawData[sampleIdx + i] * hannWindow[i];
                 const magnitudes = computeFFT(input);

                 const numBins = magnitudes.length;
                 const base = specLogBase;

                 for (let y = 0; y < fullHeight; y++) {
                     const row = fullHeight - 1 - y;
                     
                     let binIdx;
                     if (base <= 1) {
                         // Linear fallback
                         binIdx = Math.floor((y / fullHeight) * (numBins - 1));
                     } else {
                         // Logarithmic mapping: k = (base^y_norm - 1) / (base - 1) * (N-1)
                         const yNorm = y / fullHeight;
                         binIdx = Math.floor(((Math.pow(base, yNorm) - 1) / (base - 1)) * (numBins - 1));
                     }
                     
                     // Safety check
                     binIdx = Math.max(0, Math.min(numBins - 1, binIdx));

                     const magnitude = magnitudes[binIdx];
                     const [r, g, b] = getSpectrogramColor(magnitude);
                     const pixelIndex = (row * fullWidth + x);
                     buf32[pixelIndex] = (255 << 24) | (b << 16) | (g << 8) | r; 
                 }
             }
             ctx.putImageData(imageData, 0, 0);
        }
    }
  }, [audioData, viewState, intWidth, specHeight, hannWindow, specLogBase]);

  // --- Draw Overlay ---
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || intWidth <= 0 || intHeight <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(intWidth * dpr);
    canvas.height = Math.floor(intHeight * dpr);
    canvas.style.width = `${intWidth}px`;
    canvas.style.height = `${intHeight}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, intWidth, intHeight);

    if (!audioData) return;

    const startTime = xToTime(0);
    const endTime = xToTime(intWidth);
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px sans-serif';

    for (let i = 0; i < timingPoints.length; i++) {
        const point = timingPoints[i];
        const nextPoint = timingPoints[i+1];
        const sectionEndTime = nextPoint ? nextPoint.time : audioData.duration;
        if (sectionEndTime < startTime) continue;
        if (point.time > endTime) break;

        const interval = 60 / point.bpm;
        const visibleStart = Math.max(startTime, point.time);
        const timeOffsetFromPoint = visibleStart - point.time;
        const beatsFromPointStart = timeOffsetFromPoint / interval;
        const startBeatRel = Math.ceil(beatsFromPointStart);

        let relIndex = startBeatRel;
        while (true) {
            const beatIndex = point.beatIndex + relIndex;
            const time = point.time + relIndex * interval;
            if (nextPoint && beatIndex >= nextPoint.beatIndex) break;
            if (time > Math.min(endTime, sectionEndTime)) break;

            const x = timeToX(time);
            const isSectionStart = relIndex === 0;
            
            const color = isSectionStart ? '#ef4444' : 'rgba(0, 242, 255, 0.6)';
            const lineWidth = isSectionStart ? 2 : 1;

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, waveHeight + specHeight);
            ctx.stroke();

            const arrowY = waveHeight + specHeight + 6;
            ctx.fillStyle = isSectionStart ? '#ef4444' : 'rgba(0, 242, 255, 0.8)';
            ctx.beginPath();
            ctx.moveTo(x, arrowY);
            ctx.lineTo(x - 5, arrowY + 8);
            ctx.lineTo(x + 5, arrowY + 8);
            ctx.fill();

            if (isSectionStart || relIndex % 4 === 0) {
                 ctx.fillStyle = isSectionStart ? '#ef4444' : '#00f2ff';
                 ctx.fillText(beatIndex.toString(), x, arrowY + 22);
            }
            relIndex++;
        }
    }

    const playheadX = timeToX(currentTime);
    if (playheadX >= -2 && playheadX <= intWidth + 2) {
        ctx.beginPath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, intHeight);
        ctx.stroke();
    }
  }, [audioData, viewState, timingPoints, currentTime, intWidth, intHeight, waveHeight, specHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!audioData) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseY > waveHeight + specHeight) {
        const mouseTime = xToTime(mouseX);
        let bestDist = Infinity;
        let bestPointIdx = -1;
        let bestBeatIndex = -1;
        let isSectionStart = false;

        for (let i = 0; i < timingPoints.length; i++) {
            const point = timingPoints[i];
            const nextPoint = timingPoints[i+1];
            const sectionEndTime = nextPoint ? nextPoint.time : audioData.duration;
            if (point.time > mouseTime + 1) break; 
            if (sectionEndTime < mouseTime - 1) continue;
            const interval = 60 / point.bpm;
            const diff = mouseTime - point.time;
            const beats = Math.round(diff / interval);
            const beatIndex = point.beatIndex + beats;
            const time = point.time + beats * interval;
            if (nextPoint && beatIndex >= nextPoint.beatIndex) continue;
            if (beatIndex < point.beatIndex) continue;
            const dist = Math.abs(timeToX(time) - mouseX);
            if (dist < 15 && dist < bestDist) {
                bestDist = dist;
                bestPointIdx = i;
                bestBeatIndex = beatIndex;
                isSectionStart = (beatIndex === point.beatIndex);
            }
        }

        if (bestPointIdx !== -1) {
            let type: 'offset' | 'bpm' = 'bpm';
            let targetIdx = bestPointIdx;
            if (isSectionStart) {
                if (bestPointIdx === 0) type = 'offset';
                else targetIdx = bestPointIdx - 1;
            }
            setDragging({
                type,
                pointIndex: targetIdx,
                beatIndex: bestBeatIndex,
                startX: mouseX,
                initialVal: type === 'offset' ? timingPoints[0].time : timingPoints[targetIdx].bpm
            });
            return;
        }
    }
    onSeek(xToTime(mouseX));
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!dragging || !audioData) return;
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseTime = xToTime(mouseX);

      if (dragging.type === 'offset') {
          const roundedOffset = Math.round(mouseTime * 1000) / 1000;
          onUpdateOffset(roundedOffset);
      } 
      else if (dragging.type === 'bpm') {
          const point = timingPoints[dragging.pointIndex];
          const beatsFromStart = dragging.beatIndex - point.beatIndex;
          if (beatsFromStart === 0) return; 
          const timeDiff = mouseTime - point.time;
          if (timeDiff <= 0.001) return; 
          const rawBpm = (beatsFromStart * 60) / timeDiff;
          const roundedBpm = Math.round(rawBpm * 100) / 100;
          if (roundedBpm > 10 && roundedBpm < 1000) onUpdateBpm(point.beatIndex, roundedBpm);
      }
  }, [dragging, audioData, viewState, timingPoints, onUpdateBpm, onUpdateOffset]); 

  const handleMouseUp = () => setDragging(null);

  useEffect(() => {
    if (dragging) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove]);

  return (
    <div className="relative select-none w-full h-full bg-black">
       <canvas ref={waveformRef} className="absolute top-0 left-0 pointer-events-none" />
       <canvas ref={spectrogramRef} className="absolute left-0 pointer-events-none" style={{ top: waveHeight }} />
       <canvas ref={overlayRef} className="absolute top-0 left-0 cursor-crosshair" onMouseDown={handleMouseDown} />
    </div>
  );
};

export default Visualizer;
