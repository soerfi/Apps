import React, { useState } from 'react';
import { AnimationSettings, TextOverlay, FONTS } from '../types';
import { 
  Play, Pause, Square, Settings2, Download, RefreshCw, 
  ChevronDown, ChevronUp, Type, Crop, Sliders, Copy, Check, Shuffle
} from 'lucide-react';

interface ControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  settings: AnimationSettings;
  onUpdateSettings: (settings: AnimationSettings) => void;
  onExport: (format: 'webp' | 'gif') => void;
  isExporting: boolean;
  totalDuration: number;
  onApplyCropToAll: () => void;
  isCropMode: boolean;
  onToggleCropMode: () => void;
}

const Section: React.FC<{ 
  title: string; 
  icon?: React.ReactNode; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  onOpen?: () => void;
}> = ({ title, icon, children, defaultOpen = false, onOpen }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const handleToggle = () => {
      const newState = !isOpen;
      setIsOpen(newState);
      if (newState && onOpen) {
          onOpen();
      }
  };

  return (
    <div className="border-b border-slate-800 last:border-0">
      <button 
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-2.5 font-semibold text-sm text-slate-200">
          {icon}
          {title}
        </div>
        {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>
      {isOpen && <div className="p-4 space-y-5 bg-slate-900">{children}</div>}
    </div>
  );
};

const InputGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
        {children}
    </div>
);

const NumberInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { suffix?: string }> = ({ suffix, className, ...props }) => (
    <div className={`flex items-center bg-slate-950 border border-slate-800 rounded-md focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all ${className}`}>
        <input 
            type="number"
            className="w-full bg-transparent text-xs p-2 text-white placeholder-slate-600 focus:outline-none"
            {...props} 
        />
        {suffix && <span className="text-[10px] text-slate-500 pr-2 select-none">{suffix}</span>}
    </div>
);

const RangeSlider: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { labelValue?: string | number }> = ({ labelValue, ...props }) => (
    <div className="space-y-2">
        {labelValue && (
            <div className="flex justify-between text-xs">
                 <span className="text-slate-400">Value</span>
                 <span className="text-brand-400 font-mono">{labelValue}</span>
            </div>
        )}
        <input
            type="range"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:accent-brand-400 transition-all"
            {...props}
        />
    </div>
);

const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onStop,
  settings,
  onUpdateSettings,
  onExport,
  isExporting,
  totalDuration,
  onApplyCropToAll,
  isCropMode,
  onToggleCropMode
}) => {
  const [hasAutoEnabledText, setHasAutoEnabledText] = useState(false);

  const updateSetting = <K extends keyof AnimationSettings>(key: K, value: AnimationSettings[K]) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  const updateTextOverlay = <K extends keyof TextOverlay>(key: K, value: TextOverlay[K]) => {
    onUpdateSettings({
      ...settings,
      textOverlay: { ...settings.textOverlay, [key]: value }
    });
  };

  const handleAspectRatioChange = (ratio: string) => {
     onUpdateSettings({ ...settings, aspectRatio: ratio });
  };

  const updateCustomRatio = (w: string, h: string) => {
    if (!w) w = "16";
    if (!h) h = "9";
    onUpdateSettings({ ...settings, aspectRatio: `${w}:${h}` });
  };

  const isStandardRatio = ['original', '16:9', '3:2', '1:1', '9:16', 'free'].includes(settings.aspectRatio);
  let customW = '';
  let customH = '';
  if (!isStandardRatio && settings.aspectRatio.includes(':')) {
      const parts = settings.aspectRatio.split(':');
      customW = parts[0];
      customH = parts[1];
  }

  return (
    <div className="bg-slate-900 border-l border-slate-800 w-80 flex flex-col h-full overflow-hidden select-none shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex flex-col gap-4 shadow-sm">
        
        <div className="flex items-center justify-between">
             <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings2 className="text-brand-400" size={16} />
                Editor
            </h2>
            <div className="text-[10px] text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
               Total: {totalDuration.toFixed(2)}s
            </div>
        </div>
        
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-semibold text-xs transition-all ${
                isPlaying 
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50 hover:bg-amber-500/20' 
                  : 'bg-brand-600 text-white hover:bg-brand-500 border border-brand-500 shadow-lg shadow-brand-500/10'
              }`}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : 'Play Preview'}
            </button>
            <button
              onClick={onStop}
              className="p-2 bg-slate-800 text-slate-400 rounded-md hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors"
              title="Stop and Rewind"
            >
              <Square size={14} fill="currentColor" />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* 1. Global Settings */}
        <Section title="Settings" icon={<Sliders size={16} className="text-blue-400"/>} defaultOpen={true}>
            {/* Timing */}
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-3">
               <div className="flex items-center justify-between mb-1">
                 <span className="text-[10px] font-bold text-slate-400 uppercase">Frame Duration</span>
               </div>

               <RangeSlider 
                    min="50" max="10000" step="50" value={settings.frameDuration} 
                    onChange={(e) => updateSetting('frameDuration', Number(e.target.value))}
                    labelValue={`${settings.frameDuration} ms`}
               />
            </div>

            {/* Quality & File Size */}
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-3">
                <InputGroup label="Quality">
                    <RangeSlider 
                        min="1" max="100" value={settings.quality}
                        onChange={(e) => updateSetting('quality', Number(e.target.value))}
                        labelValue={`${settings.quality}%`}
                    />
                </InputGroup>
                
                <div className="pt-2 border-t border-slate-800/50">
                    <InputGroup label="Max File Size (KB)">
                        <NumberInput 
                            value={settings.maxFileSize > 0 ? settings.maxFileSize / 1024 : ''} 
                            placeholder="Unlimited"
                            onChange={(e) => {
                                const kb = Number(e.target.value);
                                updateSetting('maxFileSize', kb > 0 ? kb * 1024 : 0);
                            }} 
                            suffix="KB"
                        />
                        <p className="text-[9px] text-slate-500 leading-tight pt-1">
                           Auto-reduces quality to fit. Leave empty for max quality.
                        </p>
                    </InputGroup>
                </div>
            </div>

             {/* Dimensions */}
             <InputGroup label="Max Dimensions">
                <div className="grid grid-cols-2 gap-3">
                   <NumberInput 
                        value={settings.maxWidth} 
                        onChange={(e) => updateSetting('maxWidth', Number(e.target.value))} 
                        suffix="W"
                   />
                   <NumberInput 
                        value={settings.maxHeight} 
                        onChange={(e) => updateSetting('maxHeight', Number(e.target.value))} 
                        suffix="H"
                   />
                </div>
                <p className="text-[10px] text-slate-500 pt-1">Images upscale if smaller than output.</p>
             </InputGroup>
             
             <InputGroup label="Background">
                <div className="flex items-center gap-2">
                    <input 
                        type="color"
                        value={settings.backgroundColor}
                        onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-slate-950 border border-slate-700 p-0.5"
                    />
                    <span className="text-xs text-slate-400 font-mono">{settings.backgroundColor}</span>
                </div>
            </InputGroup>
        </Section>
        
        {/* 2. Transitions */}
        <Section title="Transitions" icon={<Shuffle size={16} className="text-pink-400"/>}>
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-4">
                <InputGroup label="Type">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => updateSetting('transitionType', 'none')}
                            className={`py-2 px-2 rounded text-xs font-medium border transition-all ${settings.transitionType === 'none' ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                        >
                            None
                        </button>
                        <button
                            onClick={() => updateSetting('transitionType', 'crossfade')}
                            className={`py-2 px-2 rounded text-xs font-medium border transition-all ${settings.transitionType === 'crossfade' ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                        >
                            Crossfade
                        </button>
                    </div>
                </InputGroup>

                {settings.transitionType === 'crossfade' && (
                    <InputGroup label="Transition Duration">
                        <RangeSlider 
                            min="100" max={settings.frameDuration} step="50"
                            value={settings.transitionDuration} 
                            onChange={(e) => updateSetting('transitionDuration', Math.min(settings.frameDuration, Number(e.target.value)))}
                            labelValue={`${settings.transitionDuration} ms`}
                        />
                         <p className="text-[9px] text-slate-500 leading-tight">
                           Duration of the fade between frames.
                        </p>
                    </InputGroup>
                )}
            </div>
        </Section>

        {/* 3. Crop Output */}
        <Section title="Crop" icon={<Crop size={16} className="text-emerald-400"/>}>
             <button 
                onClick={onToggleCropMode}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm mb-3
                    ${isCropMode 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 ring-2 ring-emerald-500/20' 
                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:border-slate-600'}
                `}
             >
                {isCropMode ? <Check size={14} /> : <Crop size={14} />}
                {isCropMode ? 'Finish Cropping' : 'Adjust Crop in Preview'}
             </button>

            <InputGroup label="Aspect Ratio">
                <div className="grid grid-cols-3 gap-2">
                    {['original', 'free', '1:1', '16:9', '9:16', '3:2'].map((ratio) => (
                        <button
                            key={ratio}
                            onClick={() => handleAspectRatioChange(ratio)}
                            className={`py-1.5 px-1 rounded text-[10px] font-medium border transition-all truncate ${
                                settings.aspectRatio === ratio 
                                ? 'bg-brand-600 border-brand-500 text-white shadow-sm' 
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                            }`}
                        >
                            {ratio === 'original' ? 'Full' : ratio.toUpperCase()}
                        </button>
                    ))}
                </div>
            </InputGroup>
            
            <div className="bg-slate-950/30 p-2 rounded border border-slate-800 mt-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">Custom</span>
                    <NumberInput 
                        value={customW} placeholder="W" min={1}
                        onChange={(e) => updateCustomRatio(e.target.value, customH || "9")}
                        className="!bg-slate-900"
                    />
                    <span className="text-slate-600 font-bold">:</span>
                    <NumberInput 
                        value={customH} placeholder="H" min={1}
                        onChange={(e) => updateCustomRatio(customW || "16", e.target.value)}
                        className="!bg-slate-900"
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-4">
                <button 
                    onClick={onApplyCropToAll}
                    className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                    <Copy size={12} />
                    Apply to All
                </button>
                <button 
                    onClick={() => handleAspectRatioChange('original')}
                    className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                    <RefreshCw size={12} />
                    Reset Crop
                </button>
            </div>
        </Section>

        {/* 4. Text Overlay */}
        <Section 
            title="Text Overlay" 
            icon={<Type size={16} className="text-purple-400"/>}
            onOpen={() => {
                if (!hasAutoEnabledText) {
                    if (!settings.textOverlay.enabled) {
                        updateTextOverlay('enabled', true);
                    }
                    setHasAutoEnabledText(true);
                }
            }}
        >
            <div className="flex items-center justify-between mb-4 bg-slate-950 p-2 rounded-lg border border-slate-800">
               <span className="text-xs font-medium text-slate-300 pl-1">Enable Text</span>
               <button 
                 onClick={() => updateTextOverlay('enabled', !settings.textOverlay.enabled)}
                 className={`w-9 h-5 rounded-full transition-colors relative ${settings.textOverlay.enabled ? 'bg-brand-500' : 'bg-slate-700'}`}
               >
                 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${settings.textOverlay.enabled ? 'left-5' : 'left-1'}`} />
               </button>
            </div>

            {settings.textOverlay.enabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <textarea
                        value={settings.textOverlay.content}
                        onChange={(e) => updateTextOverlay('content', e.target.value)}
                        placeholder="Type your text..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-xs text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none resize-none h-20 placeholder-slate-600"
                    />

                    <div className="grid grid-cols-5 gap-2">
                         <select 
                            value={settings.textOverlay.font}
                            onChange={(e) => updateTextOverlay('font', e.target.value)}
                            className="col-span-3 bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-white focus:outline-none"
                         >
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                         </select>
                         <div className="col-span-2 relative">
                             <input 
                                type="color" 
                                value={settings.textOverlay.color}
                                onChange={(e) => updateTextOverlay('color', e.target.value)}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            />
                            <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-md flex items-center gap-2 px-2 pointer-events-none">
                                <div className="w-3 h-3 rounded-full border border-slate-600" style={{ backgroundColor: settings.textOverlay.color }} />
                                <span className="text-[10px] text-slate-400">Color</span>
                            </div>
                         </div>
                    </div>

                    <div className="space-y-3 bg-slate-950/30 p-3 rounded border border-slate-800">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Font Size</span>
                            <span className="text-xs font-mono text-brand-400">{settings.textOverlay.fontSize}px</span>
                         </div>
                         <input
                             type="range"
                             min="10" max="200"
                             value={settings.textOverlay.fontSize}
                             onChange={(e) => updateTextOverlay('fontSize', Number(e.target.value))}
                             className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                         />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Spacing">
                             <input type="range" min="-5" max="20" value={settings.textOverlay.letterSpacing} onChange={(e) => updateTextOverlay('letterSpacing', Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"/>
                        </InputGroup>
                        <InputGroup label="Line Height">
                             <input type="range" min="0.5" max="3" step="0.1" value={settings.textOverlay.lineHeight} onChange={(e) => updateTextOverlay('lineHeight', Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"/>
                        </InputGroup>
                    </div>

                    {/* Effects Wrapper */}
                    <div className="space-y-3">
                        {/* Outline */}
                        <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                               <span className="text-xs text-slate-300 font-medium">Outline</span>
                               <input 
                                  type="checkbox"
                                  checked={settings.textOverlay.hasOutline}
                                  onChange={(e) => updateTextOverlay('hasOutline', e.target.checked)}
                                  className="accent-brand-500 w-3.5 h-3.5"
                               />
                            </div>
                            {settings.textOverlay.hasOutline && (
                                 <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={settings.textOverlay.outlineColor}
                                        onChange={(e) => updateTextOverlay('outlineColor', e.target.value)}
                                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                                    />
                                    <input
                                         type="range"
                                         min="0" max="20"
                                         value={settings.textOverlay.outlineWidth}
                                         onChange={(e) => updateTextOverlay('outlineWidth', Number(e.target.value))}
                                         className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                     />
                                 </div>
                            )}
                        </div>

                        {/* Shadow */}
                        <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                               <span className="text-xs text-slate-300 font-medium">Drop Shadow</span>
                               <input 
                                  type="checkbox"
                                  checked={settings.textOverlay.hasShadow}
                                  onChange={(e) => updateTextOverlay('hasShadow', e.target.checked)}
                                  className="accent-brand-500 w-3.5 h-3.5"
                               />
                            </div>
                            {settings.textOverlay.hasShadow && (
                                 <div className="space-y-3 pt-1">
                                     <div className="flex items-center gap-3">
                                        <input 
                                            type="color" 
                                            value={settings.textOverlay.shadowColor}
                                            onChange={(e) => updateTextOverlay('shadowColor', e.target.value)}
                                            className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                                        />
                                        <div className="flex-1 space-y-1">
                                             <div className="flex justify-between text-[9px] text-slate-500">
                                                <span>Opacity</span>
                                                <span>{Math.round(settings.textOverlay.shadowOpacity * 100)}%</span>
                                             </div>
                                             <input
                                                 type="range"
                                                 min="0" max="1" step="0.05"
                                                 value={settings.textOverlay.shadowOpacity}
                                                 onChange={(e) => updateTextOverlay('shadowOpacity', Number(e.target.value))}
                                                 className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                             />
                                        </div>
                                     </div>
                                     <InputGroup label="Blur">
                                         <input type="range" min="0" max="50" value={settings.textOverlay.shadowBlur} onChange={(e) => updateTextOverlay('shadowBlur', Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500" />
                                     </InputGroup>
                                     <div className="grid grid-cols-2 gap-3">
                                         <InputGroup label="Offset X">
                                            <input type="range" min="-20" max="20" value={settings.textOverlay.shadowOffsetX} onChange={(e) => updateTextOverlay('shadowOffsetX', Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500" />
                                         </InputGroup>
                                         <InputGroup label="Offset Y">
                                            <input type="range" min="-20" max="20" value={settings.textOverlay.shadowOffsetY} onChange={(e) => updateTextOverlay('shadowOffsetY', Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500" />
                                         </InputGroup>
                                     </div>
                                 </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Section>
      </div>

      {/* Export Section */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="grid grid-cols-2 gap-3">
            <button
            onClick={() => onExport('webp')}
            disabled={isExporting}
            className={`col-span-1 py-3 rounded-lg font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all group
                ${isExporting 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-br from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white transform hover:translate-y-[-1px]'}
            `}
            >
                <Download size={14} className="group-hover:animate-bounce" /> WebP
            </button>
            <button
            onClick={() => onExport('gif')}
            disabled={isExporting}
            className={`col-span-1 py-3 rounded-lg font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all group
                ${isExporting 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white transform hover:translate-y-[-1px]'}
            `}
            >
                <Download size={14} className="group-hover:animate-bounce" /> GIF
            </button>
        </div>
        <p className="text-center text-[10px] text-slate-500 mt-2 font-mono">
           {isExporting ? 'Processing...' : `${settings.width}px x ${settings.height}px`}
        </p>
      </div>
    </div>
  );
};

export default Controls;