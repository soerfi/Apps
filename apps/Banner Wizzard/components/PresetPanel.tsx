import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Preset, PresetCategory } from '../types';
import { PRESET_CATEGORIES } from '../constants';
import { ChevronDownIcon, PlusIcon, TrashIcon, EditIcon, CheckIcon, CloseIcon, SettingsIcon } from './icons';

const STORAGE_KEY = 'banner-wizzard-presets';

interface PresetPanelProps {
    preset: Preset;
    setPreset: (preset: Preset) => void;
    setErrorMessage: (message: string) => void;
}

const PresetPanel: React.FC<PresetPanelProps> = ({ preset, setPreset, setErrorMessage }) => {
    const [categories, setCategories] = useState<PresetCategory[]>([]);
    const [openPresetCategory, setOpenPresetCategory] = useState<string | null>(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [customWidth, setCustomWidth] = useState<string>(preset.width.toString());
    const [customHeight, setCustomHeight] = useState<string>(preset.height.toString());
    const presetContainerRef = useRef<HTMLDivElement>(null);

    // Editing State for Modal
    const [editingCategories, setEditingCategories] = useState<PresetCategory[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setCategories(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved presets", e);
                setCategories(PRESET_CATEGORIES);
            }
        } else {
            setCategories(PRESET_CATEGORIES);
        }
    }, []);

    const saveCategories = (newCategories: PresetCategory[]) => {
        setCategories(newCategories);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newCategories));
    };

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

    const handleOpenManageModal = () => {
        setEditingCategories(JSON.parse(JSON.stringify(categories)));
        setIsManageModalOpen(true);
    };

    const handleSaveManagedPresets = () => {
        saveCategories(editingCategories);
        setIsManageModalOpen(false);
    };

    const addCategory = () => {
        setEditingCategories([...editingCategories, { name: 'New Category', presets: [] }]);
    };

    const deleteCategory = (index: number) => {
        setEditingCategories(editingCategories.filter((_, i) => i !== index));
    };

    const updateCategoryName = (index: number, name: string) => {
        const newCats = [...editingCategories];
        newCats[index].name = name;
        setEditingCategories(newCats);
    };

    const addPreset = (catIndex: number) => {
        const newCats = [...editingCategories];
        newCats[catIndex].presets.push({ name: 'New Preset', width: 1000, height: 1000 });
        setEditingCategories(newCats);
    };

    const updatePreset = (catIndex: number, pIndex: number, field: string, value: string | number) => {
        const newCats = [...editingCategories];
        const p = newCats[catIndex].presets[pIndex];
        (p as any)[field] = value;
        setEditingCategories(newCats);
    };

    const deletePreset = (catIndex: number, pIndex: number) => {
        const newCats = [...editingCategories];
        newCats[catIndex].presets = newCats[catIndex].presets.filter((_, i) => i !== pIndex);
        setEditingCategories(newCats);
    };

    return (
        <div ref={presetContainerRef}>
            {isManageModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setIsManageModalOpen(false)}>
                    <div className="bg-gray-800 border border-gray-700 w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Manage Canvas Presets</h3>
                            <button onClick={() => setIsManageModalOpen(false)} className="text-gray-400 hover:text-white"><CloseIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                            {editingCategories.map((cat, catIndex) => (
                                <div key={catIndex} className="bg-gray-700/30 rounded-lg p-4 border border-gray-700">
                                    <div className="flex justify-between items-center mb-4 gap-4">
                                        <input
                                            value={cat.name}
                                            onChange={(e) => updateCategoryName(catIndex, e.target.value)}
                                            className="bg-gray-900 border border-gray-600 text-white font-bold p-2 rounded-md flex-grow"
                                        />
                                        <button onClick={() => deleteCategory(catIndex)} className="text-red-400 hover:text-red-300 p-2"><TrashIcon className="w-5 h-5" /></button>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {cat.presets.map((p, pIndex) => (
                                            <div key={pIndex} className="grid grid-cols-[2fr,1fr,1fr,auto] gap-2 items-center">
                                                <input
                                                    value={p.name}
                                                    onChange={(e) => updatePreset(catIndex, pIndex, 'name', e.target.value)}
                                                    className="bg-gray-900 border border-gray-600 text-white text-sm p-2 rounded-md"
                                                    placeholder="Name"
                                                />
                                                <input
                                                    type="number"
                                                    value={p.width}
                                                    onChange={(e) => updatePreset(catIndex, pIndex, 'width', parseInt(e.target.value))}
                                                    className="bg-gray-900 border border-gray-600 text-white text-sm p-2 rounded-md"
                                                    placeholder="W"
                                                />
                                                <input
                                                    type="number"
                                                    value={p.height}
                                                    onChange={(e) => updatePreset(catIndex, pIndex, 'height', parseInt(e.target.value))}
                                                    className="bg-gray-900 border border-gray-600 text-white text-sm p-2 rounded-md"
                                                    placeholder="H"
                                                />
                                                <button onClick={() => deletePreset(catIndex, pIndex)} className="text-gray-400 hover:text-red-400 p-2"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                        <button onClick={() => addPreset(catIndex)} className="flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 py-1 text-sm"><PlusIcon className="w-4 h-4" /> Add Preset</button>
                                    </div>
                                </div>
                            ))}
                            <button onClick={addCategory} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg border-2 border-dashed border-gray-500"><PlusIcon className="w-5 h-5" /> Add New Category</button>
                        </div>
                        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setIsManageModalOpen(false)} className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition">Cancel</button>
                            <button onClick={handleSaveManagedPresets} className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
            <h3 className="text-xl font-semibold mb-3 text-center text-gray-200">1. Canvas Size</h3>
            <div className="flex flex-col gap-2">
                {categories.map(category => (
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
                <button onClick={handleOpenManageModal} className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gray-800 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 transition text-sm italic">
                    <SettingsIcon className="w-4 h-4" /> Manage Presets...
                </button>
            </div>
        </div>
    );
};

export default PresetPanel;
