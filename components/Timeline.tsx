import React, { useRef, useState } from 'react';
import { Frame } from '../types';
import { Trash2, Clock, GripVertical, Plus, Copy, ArrowLeftRight, X } from 'lucide-react';

interface TimelineProps {
  frames: Frame[];
  currentFrameIndex: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUpdateDuration: (id: string, multiplier: number) => void;
  onSelect: (index: number) => void;
  onAddFramesClick: () => void;
  onReverse: () => void;
  onClear: () => void;
}

const Timeline: React.FC<TimelineProps> = React.memo(({ 
  frames, 
  currentFrameIndex, 
  onReorder, 
  onRemove,
  onDuplicate,
  onUpdateDuration,
  onSelect,
  onAddFramesClick,
  onReverse,
  onClear
}) => {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    e.preventDefault();
    dragOverItem.current = position;
    setDropIndicator(position);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
        onReorder(dragItem.current, dragOverItem.current);
    }
    
    dragItem.current = null;
    dragOverItem.current = null;
    setDropIndicator(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
  };

  if (frames.length === 0) return null;

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 px-1 flex-shrink-0">
        <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Timeline Sequence</h3>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">{frames.length} frames</span>
        </div>
        <div className="flex items-center gap-1">
            <button 
                onClick={onReverse}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Reverse Frames"
            >
                <ArrowLeftRight size={14} />
            </button>
            <button 
                onClick={onClear}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                title="Clear All"
            >
                <X size={14} />
            </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar">
        <div className="flex gap-3 px-2 h-full items-start">
          {frames.map((frame, index) => (
            <div key={frame.id} className="relative h-[90%] min-h-[140px]">
                {/* Drop Indicators */}
                {dropIndicator === index && dragItem.current !== index && dragItem.current !== null && dragItem.current > index && (
                     <div className="absolute -left-2 top-0 bottom-0 w-1 bg-brand-500 rounded z-30 animate-pulse" />
                )}
                {dropIndicator === index && dragItem.current !== index && dragItem.current !== null && dragItem.current < index && (
                     <div className="absolute -right-2 top-0 bottom-0 w-1 bg-brand-500 rounded z-30 animate-pulse" />
                )}

                <div 
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                className={`
                    group relative flex-shrink-0 w-28 h-full bg-slate-800 rounded-lg border-2 transition-all duration-200 cursor-grab active:cursor-grabbing flex flex-col
                    ${currentFrameIndex === index ? 'border-brand-500 shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/50' : 'border-slate-700 hover:border-slate-500'}
                `}
                onClick={() => onSelect(index)}
                >
                    {/* Header */}
                    <div className="flex-shrink-0 flex items-center justify-between px-2 py-1.5 border-b border-slate-700/50 bg-slate-800/80 rounded-t-lg">
                        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-300">
                            <GripVertical size={8} className="text-slate-500" />
                            #{index + 1}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="flex-1 w-full p-1 overflow-hidden relative min-h-0 bg-slate-900/30">
                         <div className="w-full h-full flex items-center justify-center rounded overflow-hidden">
                            <img 
                                src={frame.previewUrl} 
                                alt={`Frame ${index + 1}`} 
                                className="max-w-full max-h-full object-contain" 
                            />
                         </div>
                    </div>

                    {/* Footer */}
                    <div className="flex-shrink-0 p-1.5 border-t border-slate-700/50 bg-slate-800/50 rounded-b-lg">
                        <div className="flex items-center gap-1 bg-slate-900 rounded px-1 py-0.5 border border-slate-700" title="Frame duration multiplier">
                            <Clock size={10} className="text-slate-500" />
                            <input
                                type="number"
                                min="0.1"
                                max="10"
                                step="0.1"
                                value={frame.durationMultiplier}
                                onChange={(e) => onUpdateDuration(frame.id, parseFloat(e.target.value) || 1)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-transparent text-[10px] text-center focus:outline-none text-slate-300 font-mono"
                            />
                            <span className="text-[9px] text-slate-600">x</span>
                        </div>
                    </div>

                    {/* Actions Overlay */}
                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex flex-col gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemove(frame.id); }}
                            className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm transform hover:scale-110 transition-transform"
                            title="Remove Frame"
                        >
                            <Trash2 size={10} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDuplicate(frame.id); }}
                            className="p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-sm transform hover:scale-110 transition-transform"
                            title="Duplicate Frame"
                        >
                            <Copy size={10} />
                        </button>
                    </div>
                </div>
            </div>
          ))}

          {/* ADD BUTTON */}
          <div className="h-[90%] min-h-[140px] flex items-center justify-center">
             <button 
                onClick={onAddFramesClick}
                className="w-12 h-full rounded-lg border-2 border-dashed border-slate-700 hover:border-brand-500 hover:bg-slate-800/50 text-slate-500 hover:text-brand-400 transition-all flex flex-col items-center justify-center gap-2 group"
                title="Add more frames"
             >
                <div className="bg-slate-800 group-hover:bg-brand-500/20 p-2 rounded-full transition-colors">
                    <Plus size={20} />
                </div>
                <span className="text-[10px] font-medium">Add</span>
             </button>
          </div>
          
          <div className="w-4 flex-shrink-0"></div>
        </div>
      </div>
    </div>
  );
});

export default Timeline;