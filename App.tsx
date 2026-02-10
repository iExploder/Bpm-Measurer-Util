import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { 
    Play, Pause, Square, ZoomIn, ZoomOut, Upload, Music, 
    Volume2, VolumeX, Plus, Trash2, Settings, 
    PanelRightClose, PanelRightOpen, Sliders, 
    Download, FileUp, Info, MousePointer2, Keyboard, HelpCircle
} from 'lucide-react';
import Visualizer from './components/Visualizer';
import { AudioData, ViewState, TimingPoint } from './types';
import { extractPeaks } from './utils/audioUtils';
import { recalculateTiming, getPointAtTime, getTimeAtBeatIndex } from './utils/timingUtils';

const MIN_ZOOM = 10;
const MAX_ZOOM = 1500;
const DEFAULT_ZOOM = 250; 

interface TimingRowProps {
    point: TimingPoint;
    index: number;
    totalCount: number;
    onUpdate: (id: string, field: 'bpm' | 'beatIndex', value: number) => void;
    onRemove: (id: string) => void;
}

const TimingRow: React.FC<TimingRowProps> = ({ point, index, totalCount, onUpdate, onRemove }) => {
    const [bpmStr, setBpmStr] = useState(point.bpm.toFixed(2));
    const [beatStr, setBeatStr] = useState(point.beatIndex.toString());

    useEffect(() => {
        if (Math.abs(parseFloat(bpmStr) - point.bpm) > 0.001) {
             setBpmStr(point.bpm.toFixed(2));
        }
    }, [point.bpm]);

    useEffect(() => {
        if (Math.abs(parseFloat(beatStr) - point.beatIndex) > 0.001) {
            setBeatStr(point.beatIndex.toString());
        }
    }, [point.beatIndex]);

    const handleBlurBpm = () => {
        const val = parseFloat(bpmStr);
        if (!isNaN(val) && val > 0) {
            const rounded = Math.round(val * 100) / 100;
            onUpdate(point.id, 'bpm', rounded);
            setBpmStr(rounded.toFixed(2));
        } else {
            setBpmStr(point.bpm.toFixed(2));
        }
    };

    const handleBlurBeat = () => {
        const val = parseFloat(beatStr);
        if (!isNaN(val) && val >= 0) {
             onUpdate(point.id, 'beatIndex', val);
             setBeatStr(val.toString());
        } else {
             setBeatStr(point.beatIndex.toString());
        }
    };

    const isStartAnchor = point.beatIndex === 0;

    return (
        <div className={`bg-gray-800/50 rounded-xl p-5 border-l-4 ${isStartAnchor ? 'border-red-500' : 'border-indigo-500'} group transition-all duration-200 shadow-lg`}>
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black text-gray-400 tracking-widest uppercase">
                    {isStartAnchor ? '起点锚点 (Offset)' : `变速段落 ${index}`}
                </span>
                {!isStartAnchor && (
                    <button onClick={() => onRemove(point.id)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1.5">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">拍索引 (Beat)</label>
                    <input 
                        type="number" 
                        disabled={isStartAnchor}
                        value={beatStr}
                        onChange={(e) => setBeatStr(e.target.value)}
                        onBlur={handleBlurBeat}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className={`w-full bg-gray-950 border border-gray-700/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500 ${isStartAnchor ? 'text-gray-600' : 'text-gray-200'}`}
                    />
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">BPM</label>
                    <input 
                        type="number" 
                        step="0.01"
                        value={bpmStr}
                        onChange={(e) => setBpmStr(e.target.value)}
                        onBlur={handleBlurBpm}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className="w-full bg-gray-950 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-cyan-400 font-mono focus:outline-none focus:border-cyan-500"
                    />
                </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-xs text-gray-500 font-mono">
                <span className="font-bold">起始时间</span>
                <span className="text-indigo-400 font-black">{point.time.toFixed(3)}s</span>
            </div>
        </div>
    );
};

const OffsetInput = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => {
    const [localVal, setLocalVal] = useState(value.toFixed(3));
    useEffect(() => {
        if (Math.abs(parseFloat(localVal) - value) > 0.0001) setLocalVal(value.toFixed(3));
    }, [value]);
    const handleBlur = () => {
        const val = parseFloat(localVal);
        if (!isNaN(val)) { 
            const rounded = Math.round(val * 1000) / 1000;
            onChange(rounded); 
            setLocalVal(rounded.toFixed(3)); 
        }
        else setLocalVal(value.toFixed(3));
    }
    return (
        <input 
            type="number" step="0.001" value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-base text-red-400 font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20"
        />
    )
}

function App() {
  const [audioContext] = useState(() => new (window.AudioContext || (window as any).webkitAudioContext)());
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [specLogBase, setSpecLogBase] = useState(50);
  const [showHelp, setShowHelp] = useState(false);
  
  const [globalOffset, setGlobalOffset] = useState(0);
  const [rawPoints, setRawPoints] = useState<Omit<TimingPoint, 'time'>[]>([
      { id: 'initial', beatIndex: 0, bpm: 120 }
  ]);
  
  const timingPoints = recalculateTiming(globalOffset, rawPoints);
  const [viewState, setViewState] = useState<ViewState>({ zoom: DEFAULT_ZOOM, scrollLeft: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0); 
  const startOffsetRef = useRef<number>(0); 
  const rafRef = useRef<number | null>(null);
  const lastScheduledIndexRef = useRef<number>(-Infinity);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const currentContainer = containerRef.current;
    setContainerWidth(currentContainer.clientWidth);
    setContainerHeight(currentContainer.clientHeight);
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(currentContainer);
    return () => observer.disconnect();
  }, [audioData]);

  useEffect(() => {
    if (!audioData || containerWidth === 0) return;
    const maxScroll = Math.max(0, audioData.duration * viewState.zoom - containerWidth);
    if (viewState.scrollLeft > maxScroll) {
       setViewState(v => ({ ...v, scrollLeft: maxScroll }));
    }
  }, [containerWidth, viewState.zoom, audioData]);
  
  useEffect(() => { lastScheduledIndexRef.current = -Infinity; }, [timingPoints]);

  const handleAddPoint = () => {
    setRawPoints(prev => {
        const sorted = [...prev].sort((a, b) => a.beatIndex - b.beatIndex);
        const lastPoint = sorted[sorted.length - 1];
        const newBeatIndex = lastPoint.beatIndex + 1;
        if (prev.some(p => p.beatIndex === newBeatIndex)) return prev;
        return [...sorted, { id: crypto.randomUUID(), beatIndex: newBeatIndex, bpm: lastPoint.bpm }];
    });
  };

  const handleUpdatePoint = useCallback((id: string, field: 'bpm' | 'beatIndex', value: number) => {
      setRawPoints(prev => prev.map(p => {
          if (p.id !== id) return p;
          if (p.beatIndex === 0 && field === 'beatIndex') return p; 
          return { ...p, [field]: value };
      }).sort((a, b) => a.beatIndex - b.beatIndex));
  }, []);

  const handleRemovePoint = useCallback((id: string) => {
      setRawPoints(prev => prev.filter(p => p.id !== id || p.beatIndex === 0));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const arrayBuffer = await file.arrayBuffer();
    try {
        if (audioContext.state === 'suspended') await audioContext.resume();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const peaks = extractPeaks(decodedBuffer);
        setAudioData({ buffer: decodedBuffer, peaks, duration: decodedBuffer.duration });
        setGlobalOffset(0.1);
        setRawPoints([{ id: 'initial', beatIndex: 0, bpm: 120 }]);
        setCurrentTime(0);
        setViewState({ zoom: DEFAULT_ZOOM, scrollLeft: 0 });
        setIsPlaying(false);
    } catch (err) { console.error(err); alert("音频解码出错，请检查文件格式。"); }
  };

  const handleExportJson = () => {
      const config = {
          version: "1.0",
          offset: globalOffset,
          points: rawPoints.map(p => ({ beatIndex: p.beatIndex, bpm: p.bpm }))
      };
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timing_config_${new Date().getTime()}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const config = JSON.parse(event.target?.result as string);
              if (typeof config.offset === 'number' && Array.isArray(config.points)) {
                  setGlobalOffset(config.offset);
                  setRawPoints(config.points.map((p: any) => ({
                      id: crypto.randomUUID(),
                      beatIndex: p.beatIndex,
                      bpm: p.bpm
                  })));
              } else {
                  alert("无效的配置文件格式。");
              }
          } catch (err) {
              alert("解析配置文件失败。");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  const play = useCallback(async () => {
    if (!audioData) return;
    if (audioContext.state === 'suspended') await audioContext.resume();
    const source = audioContext.createBufferSource();
    source.buffer = audioData.buffer;
    source.connect(audioContext.destination);
    const startOffset = Math.min(currentTime, audioData.duration);
    source.start(0, startOffset);
    sourceNodeRef.current = source;
    startTimeRef.current = audioContext.currentTime;
    startOffsetRef.current = startOffset;
    const { point } = getPointAtTime(startOffset, timingPoints);
    lastScheduledIndexRef.current = Math.floor(point.beatIndex + (startOffset - point.time) / (60 / point.bpm));
    setIsPlaying(true);
  }, [audioData, audioContext, currentTime, timingPoints]);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch(e) {} sourceNodeRef.current = null; }
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const togglePlay = useCallback(() => isPlaying ? stop() : play(), [isPlaying, play, stop]);

  const playClick = useCallback((time: number, isDownbeat: boolean) => {
    if (!isFinite(time)) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.type = 'square'; osc.frequency.value = isDownbeat ? 1500 : 1000;
    const startTime = Math.max(audioContext.currentTime, time);
    gain.gain.setValueAtTime(isDownbeat ? 0.5 : 0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);
    osc.start(startTime); osc.stop(startTime + 0.1);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }, [audioContext]);

  useEffect(() => {
    if (!isPlaying) return;
    const loop = () => {
        const currentAudioTime = audioContext.currentTime;
        const newTime = startOffsetRef.current + (currentAudioTime - startTimeRef.current);
        if (newTime >= (audioData?.duration || 0)) { setCurrentTime(audioData?.duration || 0); stop(); }
        else {
            setCurrentTime(newTime);
            if (isMetronomeOn) {
                const lookahead = 0.1;
                const horizonTime = newTime + lookahead;
                let nextBeatIndex = lastScheduledIndexRef.current + 1;
                const { point } = getPointAtTime(newTime, timingPoints);
                const currentBeatEstimate = point.beatIndex + (newTime - point.time) / (60 / point.bpm);
                if (nextBeatIndex < currentBeatEstimate - 1) nextBeatIndex = Math.floor(currentBeatEstimate);
                let iters = 0;
                while (iters < 50) { 
                   const beatTime = getTimeAtBeatIndex(nextBeatIndex, timingPoints);
                   if (beatTime > horizonTime) break;
                   const scheduleTime = startTimeRef.current + (beatTime - startOffsetRef.current);
                   if (scheduleTime >= currentAudioTime - 0.05) {
                       const isSectionStart = timingPoints.some(p => Math.abs(p.beatIndex - nextBeatIndex) < 0.001);
                       playClick(scheduleTime, isSectionStart || nextBeatIndex === 0);
                   }
                   lastScheduledIndexRef.current = nextBeatIndex;
                   nextBeatIndex++; iters++;
                }
            }
            rafRef.current = requestAnimationFrame(loop);
        }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, audioContext, audioData, stop, isMetronomeOn, timingPoints, playClick]);

  const handleSeek = (time: number) => {
    setCurrentTime(Math.max(0, Math.min(audioData?.duration || 0, time)));
    if (isPlaying) stop();
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
              e.preventDefault(); togglePlay();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  return (
    <div className="flex h-screen w-screen bg-black text-gray-200 font-sans overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 bg-gray-900 border-b border-white/5 flex items-center justify-between px-6 z-30 shrink-0 shadow-2xl">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 text-indigo-400 font-black text-xl tracking-tighter">
                    <Music size={28} />
                    <span>BPM 测速助手</span>
                </div>
                <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer transition text-sm font-black uppercase tracking-widest shadow-lg active:scale-95">
                    <Upload size={18} />
                    <span>导入音频</span>
                    <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                </label>
                {fileName && <span className="text-xs text-gray-500 truncate max-w-[200px] font-mono bg-white/5 px-3 py-1 rounded-full border border-white/10">{fileName}</span>}
            </div>
            <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowHelp(!showHelp)}
                  className={`p-2 rounded-lg transition-all ${showHelp ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  title="使用说明"
                >
                    <HelpCircle size={24} />
                </button>
                <span className="text-2xl font-mono font-black text-indigo-300 bg-black/40 px-4 py-1 rounded-lg border border-indigo-500/20">{currentTime.toFixed(3)}s</span>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white transition p-2 hover:bg-white/5 rounded-lg">
                    {isSidebarOpen ? <PanelRightClose size={24} /> : <PanelRightOpen size={24} />}
                </button>
            </div>
        </header>

        <main className="flex-1 relative overflow-hidden bg-black">
            {audioData ? (
                <div ref={containerRef} className="absolute inset-0 w-full h-full" 
                     onWheel={(e) => {
                        const maxScroll = Math.max(0, audioData.duration * viewState.zoom - containerWidth);
                        if (e.shiftKey) {
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            const mouseX = e.clientX - rect.left;
                            const timeAtMouse = (mouseX + viewState.scrollLeft) / viewState.zoom;
                            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewState.zoom * zoomFactor));
                            const newScrollLeft = timeAtMouse * newZoom - mouseX;
                            setViewState({ zoom: newZoom, scrollLeft: Math.max(0, Math.min(newScrollLeft, Math.max(0, audioData.duration * newZoom - containerWidth))) });
                        } else {
                            setViewState(p => ({...p, scrollLeft: Math.max(0, Math.min(p.scrollLeft + e.deltaY + e.deltaX, maxScroll))}));
                        }
                     }}>
                    {containerWidth > 0 && containerHeight > 0 && (
                        <Visualizer 
                            audioData={audioData} currentTime={currentTime} viewState={viewState}
                            timingPoints={timingPoints} onUpdateBpm={(idx, bpm) => handleUpdatePoint(timingPoints.find(p => p.beatIndex === idx)?.id || '', 'bpm', bpm)}
                            onUpdateOffset={setGlobalOffset} onSeek={handleSeek}
                            width={containerWidth} height={containerHeight}
                            specLogBase={specLogBase}
                        />
                    )}
                </div>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 p-12 text-center">
                    <Music size={80} className="mb-6 opacity-20 animate-pulse" />
                    <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest mb-4">开始使用</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl opacity-50">
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                            <Upload className="mx-auto mb-3 text-indigo-400" />
                            <p className="text-sm font-bold mb-2">1. 导入音频</p>
                            <p className="text-xs">支持大多数标准音频格式，系统会自动提取波形和频谱。</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                            <MousePointer2 className="mx-auto mb-3 text-red-400" />
                            <p className="text-sm font-bold mb-2">2. 调整起点</p>
                            <p className="text-xs">拖动最下方的红色指示器对齐音乐第一拍（Offset）。</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                            <Sliders className="mx-auto mb-3 text-cyan-400" />
                            <p className="text-sm font-bold mb-2">3. 测量 BPM</p>
                            <p className="text-xs">拖动后续的青色指示器对齐重音，自动计算段落 BPM。</p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Help Overlay Modal */}
            {showHelp && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full">
                        <div className="p-6 border-b border-white/5 bg-white/2 flex justify-between items-center">
                            <div className="flex items-center gap-3 text-indigo-400 font-black">
                                <HelpCircle size={24} />
                                <span className="uppercase tracking-[0.2em]">使用指南</span>
                            </div>
                            <button onClick={() => setShowHelp(false)} className="text-gray-500 hover:text-white transition">关闭</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            <section className="space-y-4">
                                <h4 className="flex items-center gap-2 text-indigo-300 font-bold"><MousePointer2 size={18}/> 交互技巧</h4>
                                <ul className="space-y-3 text-sm text-gray-400">
                                    <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold">•</span> <span><b className="text-gray-200">缩放时间轴：</b> 按住 <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-200">Shift</kbd> 并滚动鼠标滚轮，或使用右下角的按钮。</span></li>
                                    <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold">•</span> <span><b className="text-gray-200">移动时间轴：</b> 直接滚动滚轮（横向/纵向均可）。</span></li>
                                    <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold">•</span> <span><b className="text-gray-200">快速定位：</b> 点击波形图/频谱图区域可立即跳转播放位置。</span></li>
                                    <li className="flex items-start gap-2"><span className="text-indigo-500 font-bold">•</span> <span><b className="text-gray-200">动态调整：</b> 拖动视图底部刻度区域的三角形指示器可直接微调时间点。</span></li>
                                </ul>
                            </section>

                            <section className="space-y-4">
                                <h4 className="flex items-center gap-2 text-indigo-300 font-bold"><Keyboard size={18}/> 快捷键</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                        <span className="text-xs text-gray-500 uppercase font-black">播放 / 暂停</span>
                                        <kbd className="bg-gray-800 px-3 py-1 rounded text-gray-200 font-mono text-sm">Space</kbd>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                        <span className="text-xs text-gray-500 uppercase font-black">缩放辅助</span>
                                        <kbd className="bg-gray-800 px-3 py-1 rounded text-gray-200 font-mono text-sm">Shift + Scroll</kbd>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h4 className="flex items-center gap-2 text-indigo-300 font-bold"><Info size={18}/> 测速流程建议</h4>
                                <ol className="space-y-3 text-sm text-gray-400 list-decimal list-inside">
                                    <li>导入音频，观察波形或频谱（重音通常在频谱低频有明显的垂直亮线）。</li>
                                    <li>将时间轴缩放到合适比例，拖动红色 <b className="text-red-400">起点锚点</b> 到音乐第一拍。</li>
                                    <li>在右侧面板添加一个变速段落，跳到歌曲较后的位置，拖动对应的青色指示器对齐。</li>
                                    <li>如果歌曲中途有变节奏，点击“添加”创建新的时间段。</li>
                                    <li>开启 <b className="text-green-400">节拍器</b> 检查对齐情况。</li>
                                </ol>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </main>

        <footer className="h-20 bg-gray-950 border-t border-white/5 flex justify-center items-center gap-12 z-30 shrink-0 shadow-inner">
            <button onClick={stop} className="text-red-500/70 hover:text-red-500 transition-all hover:scale-110 active:scale-90" title="停止"><Square size={28} fill="currentColor"/></button>
            <button onClick={togglePlay} className="p-5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] active:scale-90 transition-all">
                {isPlaying ? <Pause size={32} fill="currentColor"/> : <Play size={32} fill="currentColor" className="ml-1"/>}
            </button>
            <button onClick={() => setIsMetronomeOn(p => !p)} className={`transition-all hover:scale-110 active:scale-90 ${isMetronomeOn ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'text-gray-600'}`} title="节拍器开关">
                {isMetronomeOn ? <Volume2 size={32}/> : <VolumeX size={32}/>}
            </button>
            <div className="flex items-center gap-6 bg-white/5 px-5 py-2 rounded-2xl border border-white/5">
                <button onClick={() => setViewState(s => ({...s, zoom: Math.max(MIN_ZOOM, s.zoom * 0.8)}))} className="text-gray-500 hover:text-white transition-colors" title="缩小"><ZoomOut size={22}/></button>
                <span className="text-sm text-gray-400 font-mono w-20 text-center font-bold" title="缩放比例">{Math.round(viewState.zoom)}px/s</span>
                <button onClick={() => setViewState(s => ({...s, zoom: Math.min(MAX_ZOOM, s.zoom * 1.2)}))} className="text-gray-500 hover:text-white transition-colors" title="放大"><ZoomIn size={22}/></button>
            </div>
        </footer>
      </div>

      <div className={`bg-gray-900 border-l border-white/10 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-40 transition-all duration-300 shrink-0 ${isSidebarOpen ? 'w-[320px]' : 'w-0 translate-x-full'}`}>
        <div className="p-6 border-b border-white/5 bg-black/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Settings size={20} className="text-indigo-400" /> 
                <h2 className="text-sm font-black text-gray-200 uppercase tracking-[0.2em]">配置面板</h2>
            </div>
            <div className="flex items-center gap-2">
                <label className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg cursor-pointer transition-all" title="导入 JSON 配置">
                    <FileUp size={18} />
                    <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
                </label>
                <button onClick={handleExportJson} className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all" title="导出 JSON 配置">
                    <Download size={18} />
                </button>
            </div>
        </div>
        
        <div className="p-6 border-b border-white/5 bg-white/2 space-y-4">
             <div>
                <label className="text-[10px] text-gray-400 block mb-2 uppercase font-black tracking-widest flex items-center gap-2">
                    全局起始偏移 (Offset)
                    <div className="group relative">
                        <Info size={12} className="text-gray-600" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-white/10 shadow-xl z-50">音乐第一拍对应的绝对时间点（秒）。</div>
                    </div>
                </label>
                <OffsetInput value={globalOffset} onChange={setGlobalOffset} />
             </div>
             
             <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] text-gray-400 block uppercase font-black tracking-widest">频谱图对数比例</label>
                    <span className="text-xs font-mono text-indigo-400 font-bold">{specLogBase.toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Sliders size={16} className="text-gray-600" />
                    <input 
                        type="range" min="1" max="200" step="1"
                        value={specLogBase}
                        onChange={(e) => setSpecLogBase(parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>
             </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-black/20">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400 font-black uppercase tracking-widest">变速段落</span>
                <button onClick={handleAddPoint} className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest border border-indigo-500/30">
                    <Plus size={14} /> 添加
                </button>
            </div>
            
            {timingPoints.length === 1 && (
                <div className="p-4 bg-indigo-400/5 rounded-xl border border-indigo-400/10 text-[11px] text-indigo-300/60 leading-relaxed italic">
                    提示：如果歌曲 BPM 恒定，只需调整起点和第一个 BPM。若有变速，请点击“添加”手动分段。
                </div>
            )}

            {[...timingPoints].reverse().map((point, revIdx) => {
                const originalIdx = timingPoints.length - 1 - revIdx;
                return (
                    <TimingRow 
                        key={point.id} 
                        point={point} 
                        index={originalIdx} 
                        totalCount={timingPoints.length}
                        onUpdate={handleUpdatePoint} 
                        onRemove={handleRemovePoint} 
                    />
                );
            })}
        </div>
      </div>
    </div>
  );
}

export default App;