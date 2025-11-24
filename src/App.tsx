import React, { useState, useEffect, useCallback, useRef } from 'react';
import DropZone from './components/DropZone';
import Timeline from './components/Timeline';
import Preview from './components/Preview';
import Controls from './components/Controls';
import { getDefaultSettings, type Frame, type AnimationSettings } from './types';
import { generateId } from './utils/id';
import { calculateAutoCrop } from './utils/image';
import { exportAnimation } from './utils/export';
import { Film } from 'lucide-react';

const App: React.FC = () => {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  
  const openFileDialogRef = useRef<(() => void) | null>(null);
  const [settings, setSettings] = useState<AnimationSettings>(getDefaultSettings());

  const handleFilesDropped = useCallback((files: File[]) => {
    const loadPromises = files.map(file => {
        return new Promise<Frame>((resolve) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const crop = calculateAutoCrop(img.width, img.height, settings.aspectRatio);
                resolve({
                    id: generateId(),
                    file,
                    previewUrl: url,
                    durationMultiplier: 1.0,
                    crop
                });
            };
            img.src = url;
        });
    });

    Promise.all(loadPromises).then(newFrames => {
        setFrames(prev => [...prev, ...newFrames]);
    });
  }, [settings.aspectRatio]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (frames.length === 0) return;
      const tagName = (e.target as HTMLElement).tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
      
      if (e.key === 'ArrowLeft') {
          setCurrentFrameIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
          setCurrentFrameIndex(prev => Math.min(frames.length - 1, prev + 1));
      } else if (e.key === ' ') {
          e.preventDefault();
          setIsPlaying(prev => !prev);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (frames.length > 0) {
              handleRemoveFrame(frames[currentFrameIndex]?.id);
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [frames, currentFrameIndex]);

  // Cleanup Object URLs
  useEffect(() => {
      return () => frames.forEach(f => URL.revokeObjectURL(f.previewUrl));
  }, []);

  // Sync settings frame count
  useEffect(() => {
    setSettings(prev => {
        if (frames.length > prev.textOverlay.endFrame) {
            return { ...prev, textOverlay: { ...prev.textOverlay, endFrame: frames.length } };
        }
        return prev;
    });
  }, [frames.length]);

  // Ensure current index is valid
  useEffect(() => {
      if (frames.length === 0) {
          setCurrentFrameIndex(0);
      } else if (currentFrameIndex >= frames.length) {
          setCurrentFrameIndex(frames.length - 1);
      }
  }, [frames.length]);

  // Initial Settings from first frame
  useEffect(() => {
    if (frames.length === 0) return;
    const masterFrame = frames[0];
    if (!masterFrame) return;
    const { width: cropW, height: cropH } = masterFrame.crop;
    const scaleW = settings.maxWidth > 0 ? settings.maxWidth / cropW : 1;
    const scaleH = settings.maxHeight > 0 ? settings.maxHeight / cropH : 1;
    const scale = Math.min(scaleW, scaleH);
    setSettings(prev => ({ ...prev, width: Math.round(cropW * scale), height: Math.round(cropH * scale) }));
  }, [frames, settings.maxWidth, settings.maxHeight]); 

  const handleUpdateSettings = (newSettings: AnimationSettings) => {
     if (newSettings.aspectRatio !== settings.aspectRatio) {
         const updateFramesAsync = async () => {
             const newFrames = await Promise.all(frames.map(async (f) => {
                 return new Promise<Frame>(resolve => {
                     const img = new Image();
                     img.onload = () => resolve({ ...f, crop: calculateAutoCrop(img.width, img.height, newSettings.aspectRatio) });
                     img.src = f.previewUrl;
                 });
             }));
             setFrames(newFrames);
         };
         updateFramesAsync();
     }
     setSettings(newSettings);
  };

  const handleApplyCropToAll = () => {
      if (frames.length === 0) return;
      const currentCrop = frames[currentFrameIndex].crop;

      const updateAsync = async () => {
          const currentImg = new Image();
          await new Promise(r => { currentImg.onload = r; currentImg.src = frames[currentFrameIndex].previewUrl; });
          
          const pctCenterX = (currentCrop.x + currentCrop.width/2) / currentImg.width;
          const pctCenterY = (currentCrop.y + currentCrop.height/2) / currentImg.height;
          const pctWidth = currentCrop.width / currentImg.width;
          const pctHeight = currentCrop.height / currentImg.height;

          const newFrames = await Promise.all(frames.map(async (f) => {
              return new Promise<Frame>(resolve => {
                  const img = new Image();
                  img.onload = () => {
                      const newW = pctWidth * img.width;
                      const newH = pctHeight * img.height;
                      resolve({ ...f, crop: { x: (pctCenterX * img.width) - newW/2, y: (pctCenterY * img.height) - newH/2, width: newW, height: newH, isCustom: true } });
                  };
                  img.src = f.previewUrl;
              });
          }));
          setFrames(newFrames);
      };
      updateAsync();
  };

  const handleRemoveFrame = (id: string | undefined) => {
      if (!id) return;
      const f = frames.find(fr => fr.id === id);
      if(f) URL.revokeObjectURL(f.previewUrl);
      setFrames(prev => prev.filter(fr => fr.id !== id));
  };

  const handleDuplicateFrame = (id: string) => {
      const index = frames.findIndex(f => f.id === id);
      if (index === -1) return;
      
      const frameToCopy = frames[index];
      const newFrame: Frame = {
          ...frameToCopy,
          id: generateId(),
          crop: { ...frameToCopy.crop }
      };
      
      setFrames(prev => {
          const newFrames = [...prev];
          newFrames.splice(index + 1, 0, newFrame);
          return newFrames;
      });
      setCurrentFrameIndex(index + 1);
  };

  const handleReverseFrames = () => {
      setFrames(prev => [...prev].reverse());
      setCurrentFrameIndex(0);
  };

  const handleClearAll = () => {
      if (window.confirm("Are you sure you want to remove all frames?")) {
          frames.forEach(f => URL.revokeObjectURL(f.previewUrl));
          setFrames([]);
          setCurrentFrameIndex(0);
          setIsPlaying(false);
      }
  };

  const handleExport = async (format: 'webp' | 'gif') => {
    if (frames.length === 0) return;
    setIsExporting(true);
    setIsPlaying(false);
    try {
        await exportAnimation(frames, settings, format);
    } catch (err) {
        console.error("Export failed:", err);
        alert(`Failed to export ${format.toUpperCase()}.`);
    } finally {
        setIsExporting(false);
    }
  };

  const totalDuration = frames.reduce((acc, frame) => acc + (settings.frameDuration * frame.durationMultiplier) / 1000, 0);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-brand-500/30">
      <div className="flex-1 flex flex-col h-full min-w-0">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-500 to-indigo-600 p-1.5 rounded-lg shadow-lg shadow-brand-500/20">
              <Film className="text-white" size={18} />
            </div>
            <h1 className="text-base font-bold tracking-tight text-white">
              WebP & GIF Animator <span className="text-slate-500 font-normal ml-2 text-xs">by Soerfi</span>
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {frames.length === 0 ? (
             <div className="h-[400px] flex flex-col">
                <DropZone onFilesDropped={handleFilesDropped} emptyState={true} className="flex-1 h-full rounded-2xl" />
             </div>
          ) : (
            <div className="h-full flex flex-col gap-6">
              <div className="flex-1 min-h-[300px]">
                <Preview 
                  frames={frames} settings={settings} isPlaying={isPlaying}
                  onFrameChange={setCurrentFrameIndex} currentFrameIndex={currentFrameIndex}
                  onUpdateCrop={(c) => setFrames(prev => prev.map((f, i) => i === currentFrameIndex ? { ...f, crop: c } : f))}
                  onUpdateTextPosition={(x, y) => setSettings(s => ({ ...s, textOverlay: { ...s.textOverlay, x, y } }))}
                  isCropMode={isCropMode}
                />
              </div>
              <div className="h-48 bg-slate-900/50 rounded-xl border border-slate-800 p-4 relative flex flex-col">
                 <DropZone onFilesDropped={handleFilesDropped} className="flex-1 h-full rounded-lg" openFileDialogRef={openFileDialogRef}>
                    <div className="h-full">
                        <Timeline 
                            frames={frames} currentFrameIndex={currentFrameIndex}
                            onReorder={(from, to) => {
                                const newFrames = [...frames];
                                const [moved] = newFrames.splice(from, 1);
                                newFrames.splice(to, 0, moved);
                                setFrames(newFrames);
                                setCurrentFrameIndex(to);
                            }}
                            onRemove={handleRemoveFrame}
                            onDuplicate={handleDuplicateFrame}
                            onReverse={handleReverseFrames}
                            onClear={handleClearAll}
                            onUpdateDuration={(id, mul) => setFrames(prev => prev.map(f => f.id === id ? { ...f, durationMultiplier: mul } : f))}
                            onSelect={setCurrentFrameIndex}
                            onAddFramesClick={() => openFileDialogRef.current?.()}
                        />
                    </div>
                 </DropZone>
              </div>
            </div>
          )}
        </div>
      </div>
      <Controls 
        isPlaying={isPlaying} onTogglePlay={() => setIsPlaying(!isPlaying)}
        onStop={() => { setIsPlaying(false); setCurrentFrameIndex(0); }}
        settings={settings} onUpdateSettings={handleUpdateSettings}
        onExport={handleExport} isExporting={isExporting}
        totalDuration={totalDuration} onApplyCropToAll={handleApplyCropToAll}
        isCropMode={isCropMode} onToggleCropMode={() => setIsCropMode(!isCropMode)}
      />
    </div>
  );
};

export default App;