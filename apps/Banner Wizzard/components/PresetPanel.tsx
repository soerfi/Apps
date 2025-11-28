import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Preset } from '../types';
import { PRESET_CATEGORIES } from '../constants';
import { ChevronDownIcon } from './icons';

interface PresetPanelProps {
    preset: Preset;
    setPreset: (preset: Preset) => void;
    setErrorMessage: (message: string) => void;
}

const PresetPanel: React.FC<PresetPanelProps> = ({ preset, setPreset, setErrorMessage }) => {
    const [openPresetCategory, setOpenPresetCategory] = useState<string | null>(null);
    const [customWidth, setCustomWidth] = useState<string>(preset.width.toString());
    const [customHeight, setCustomHeight] = useState<string>(preset.height.toString());
    const presetContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setCustomWidth(preset.width.toString());
        setCustomHeight(preset.height.toString());
    }, [preset]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (presetContainerRef.current && !presetContainerRef.current.contains(event.target as Node)) {
                setOpenPresetCategory(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleApplyCustomPreset = useCallback(() => {
        const width = parseInt(customWidth, 10);
        const height = parseInt(customHeight, 10);

        if (width > 0 && height > 0) {
            setPreset({ name: 'Custom', width, height });
            setOpenPresetCategory(null);
        } else {
            setErrorMessage("Please enter valid width and height values greater than 0.");
        }
    }, [customWidth, customHeight, setPreset, setErrorMessage]);

    return (
        <div ref={presetContainerRef}>
            <h3 className="text-xl font-semibold mb-3 text-center text-gray-200">1. Canvas Size</h3>
            <div className="flex flex-col gap-2">
                {PRESET_CATEGORIES.map(category => (
                    <div key={category.name} className="relative">
                        <button onClick={() => setOpenPresetCategory(prev => prev === category.name ? null : category.name)} className="w-full flex justify-between items-center p-3 rounded-lg border-2 transition text-left bg-gray-700 border-gray-600 hover:bg-gray-600">
                            <span className="font-bold text-white">{category.name}</span>
                            <ChevronDownIcon className={`w-5 h-5 text-gray-300 transition-transform duration-200 ${openPresetCategory === category.name ? 'rotate-180' : ''}`} />
                        </button>
                        {openPresetCategory === category.name && (
                            <div className="mt-1 bg-gray-800 border border-gray-600 rounded-lg p-2 z-20 shadow-lg">
                                <div className="grid grid-cols-2 gap-2">
                                    {category.presets.map(p => (
                                        <button key={p.name} onClick={() => { setPreset(p); setOpenPresetCategory(null); }} className={`p-3 rounded-md border-2 transition text-center ${preset.name === p.name && preset.width === p.width && preset.height === p.height ? 'bg-blue-600 border-blue-400' : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600'}`}>
                                            <span className="font-bold text-white block text-sm">{p.name}</span>
                                            <span className="text-xs text-gray-300">{p.width} x {p.height}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                <div className="relative">
                    <button onClick={() => setOpenPresetCategory(prev => prev === 'Custom' ? null : 'Custom')} className={`w-full flex justify-between items-center p-3 rounded-lg border-2 transition text-left bg-gray-700 ${preset.name === 'Custom' ? 'border-blue-400' : 'border-gray-600'} hover:bg-gray-600`}>
                        <span className="font-bold text-white">Custom Size</span>
                        <ChevronDownIcon className={`w-5 h-5 text-gray-300 transition-transform duration-200 ${openPresetCategory === 'Custom' ? 'rotate-180' : ''}`} />
                    </button>
                    {openPresetCategory === 'Custom' && (
                        <div className="mt-1 bg-gray-800 border border-gray-600 rounded-lg p-4 z-20 shadow-lg">
                            <div className="flex items-center gap-2">
                                <input type="number" min="1" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="bg-gray-700 border-gray-600 text-white text-sm rounded-lg block w-full p-2" placeholder="W" />
                                <span className="text-gray-400">x</span>
                                <input type="number" min="1" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className="bg-gray-700 border-gray-600 text-white text-sm rounded-lg block w-full p-2" placeholder="H" />
                                <button onClick={handleApplyCustomPreset} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition">Set</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PresetPanel;
