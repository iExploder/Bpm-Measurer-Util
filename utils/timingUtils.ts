import { TimingPoint } from '../types';

export const recalculateTiming = (offset: number, points: Omit<TimingPoint, 'time'>[]): TimingPoint[] => {
  // Sort by beat index to ensure order
  const sorted = [...points].sort((a, b) => a.beatIndex - b.beatIndex);
  
  const result: TimingPoint[] = [];

  // The first point always starts at the global offset
  if (sorted.length > 0) {
    result.push({
      ...sorted[0],
      beatIndex: 0, // Force first point to be 0
      time: offset
    });
  } else {
      // Fallback default
      return [{ id: 'default', beatIndex: 0, bpm: 120, time: offset }];
  }

  // Calculate subsequent times based on previous section's duration
  for (let i = 1; i < sorted.length; i++) {
    const prev = result[i - 1];
    const curr = sorted[i];
    
    const beatDiff = curr.beatIndex - prev.beatIndex;
    const duration = beatDiff * (60 / prev.bpm);
    
    result.push({
      ...curr,
      time: prev.time + duration
    });
  }

  return result;
};

export const getPointAtTime = (time: number, points: TimingPoint[]): { point: TimingPoint, index: number } => {
  // Find the last point that has time <= query time
  for (let i = points.length - 1; i >= 0; i--) {
    if (time >= points[i].time) {
      return { point: points[i], index: i };
    }
  }
  return { point: points[0], index: 0 };
};

export const getBeatIndexAtTime = (time: number, points: TimingPoint[]): number => {
    const { point } = getPointAtTime(time, points);
    const timeDiff = time - point.time;
    const secondsPerBeat = 60 / point.bpm;
    return point.beatIndex + (timeDiff / secondsPerBeat);
};

export const getTimeAtBeatIndex = (beatIndex: number, points: TimingPoint[]): number => {
    // Find point where point.beatIndex <= beatIndex
    // We assume points are sorted
    let point = points[0];
    for(let i = points.length - 1; i >= 0; i--) {
        if (beatIndex >= points[i].beatIndex) {
            point = points[i];
            break;
        }
    }
    
    const beatDiff = beatIndex - point.beatIndex;
    return point.time + beatDiff * (60 / point.bpm);
};
