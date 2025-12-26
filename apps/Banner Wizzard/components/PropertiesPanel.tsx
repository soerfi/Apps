import React, { useState, useCallback } from 'react';
import { Layer, BlendMode } from '../types';
import { EditorAction, EditorState } from '../hooks/useImageEditorState';
import { SparklesIcon, ChevronDownIcon, ShadowIcon, GlowIcon } from './icons';

interface PropertiesPanelProps {
    activeLayer: Layer | undefined;
    dispatch: React.Dispatch<EditorAction>;
    brushSettings: EditorState['brushSettings'];
    onSaveToAssets: (layer: Layer) => void;
}

const BLEND_MODES: { value: BlendMode; name: string }[] = [
    { value: 'source-over', name: 'Normal' }, { value: 'multiply', name: 'Multiply' },
    { value: 'screen', name: 'Screen' }, { value: 'overlay', name: 'Overlay' },
    { value: 'darken', name: 'Darken' }, { value: 'lighten', name: 'Lighten' },
    { value: 'color-dodge', name: 'Color Dodge' }, { value: 'color-burn', name: 'Color Burn' },
    { value: 'hard-light', name: 'Hard Light' }, { value: 'soft-light', name: 'Soft Light' },
    { value: 'difference', name: 'Difference' }, { value: 'exclusion', name: 'Exclusion' },
    { value: 'hue', name: 'Hue' }, { value: 'saturation', name: 'Saturation' },
    { value: 'color', name: 'Color' }, { value: 'luminosity', name: 'Luminosity' },
];

// FIX: Correctly destructure all props and add `children` to the type definition.
const StyleAccordion = ({ styleKey, title, children, openStyle, setOpenStyle }: { styleKey: string, title: string, children: React.ReactNode, openStyle: string | null, setOpenStyle: (s: string | null) => void }) => (
    <div className="border-t border-gray-600 pt-3">
        <button onClick={() => setOpenStyle(openStyle === styleKey ? null : styleKey)} className="w-full flex justify-between items-center text-left">
            <h5 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                {styleKey === 'dropShadow' ? <ShadowIcon className="w-4 h-4" /> : <GlowIcon className="w-4 h-4" />} {title}
            </h5>
            <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${openStyle === styleKey ? 'rotate-180' : ''}`} />
        </button>
        {openStyle === styleKey && <div className="mt-3 flex flex-col gap-3 pl-2">{children}</div>}
    </div>
);

const ToggleSwitch = ({ id, checked, onChange }: { id: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <label htmlFor={id} className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" id={id} checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </label>
);

const HexColorInput = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
    const [inputValue, setInputValue] = useState(value);

    React.useEffect(() => {
        setInputValue(value);
    }, [value]);

    const handleBlur = () => {
        let hex = inputValue;
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            onChange(hex);
        } else {
            setInputValue(value);
        }
    };

    return (
        <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">#</span>
            <input
                type="text"
                value={inputValue.replace('#', '')}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleBlur}
                className="bg-gray-600 border border-gray-500 text-white text-xs rounded-lg block w-full pl-5 pr-2 py-1.5 font-mono"
                placeholder="000000"
            />
        </div>
    );
};

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ activeLayer, dispatch, brushSettings, onSaveToAssets }) => {
    const [openStyle, setOpenStyle] = useState<string | null>(null);
    const isInteractingWithSlider = React.useRef(false);

    const handlePropertyChange = useCallback((prop: string, value: any) => {
        if (!activeLayer) return;
        dispatch({ type: 'UPDATE_LAYER_PROPERTY', payload: { layerId: activeLayer.id, prop, value } });
    }, [dispatch, activeLayer]);

    const handleSliderChange = useCallback((prop: string, value: any) => {
        if (!isInteractingWithSlider.current) {
            dispatch({ type: 'INTERACTION_START' });
            isInteractingWithSlider.current = true;
            const resetFlag = () => {
                isInteractingWithSlider.current = false;
                window.removeEventListener('mouseup', resetFlag);
            };
            window.addEventListener('mouseup', resetFlag);
        }
        handlePropertyChange(prop, value);
    }, [dispatch, handlePropertyChange]);

    const handleUndoableChange = useCallback((prop: string, value: any) => {
        dispatch({ type: 'INTERACTION_START' });
        handlePropertyChange(prop, value);
    }, [dispatch, handlePropertyChange]);

    if (!activeLayer) {
        return (
            <div className="flex-grow">
                <h3 className="text-xl font-semibold mb-3 text-center text-gray-200">3. Layer Properties</h3>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-sm text-gray-400 text-center italic py-4">Select a layer to adjust properties.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-grow">
            <h3 className="text-xl font-semibold mb-3 text-center text-gray-200">3. Layer Properties {activeLayer.type === 'mask' && '(Mask)'}</h3>
            <div className="bg-gray-700/50 p-4 rounded-lg flex flex-col gap-3">
                {activeLayer.type === 'mask' && (
                    <div className="border-b border-gray-600 pb-3 mb-1 flex flex-col gap-3">
                        <h5 className="text-sm font-semibold text-blue-400">Brush Settings</h5>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-medium text-gray-400">Size</label>
                                <span className="text-xs font-mono">{brushSettings.size}px</span>
                            </div>
                            <input type="range" min="1" max="200" value={brushSettings.size} onChange={(e) => dispatch({ type: 'UPDATE_BRUSH_SETTINGS', payload: { size: parseInt(e.target.value, 10) } })} className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        </div>
                        <div className="flex gap-2">
                            {(['move', 'pencil', 'rect', 'circle'] as const).map(tool => (
                                <button
                                    key={tool}
                                    onClick={() => dispatch({ type: 'UPDATE_BRUSH_SETTINGS', payload: { tool } })}
                                    className={`flex-1 py-1 px-2 rounded-md text-xs font-medium transition ${brushSettings.tool === tool ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                                    title={tool === 'move' ? 'Move Tool (Drag to reposition mask)' : tool.charAt(0).toUpperCase() + tool.slice(1)}
                                >
                                    {tool === 'move' ? 'Move' : tool.charAt(0).toUpperCase() + tool.slice(1)}
                                </button>
                            ))}
                        </div>
                        {brushSettings.tool !== 'move' && (
                            <>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs font-medium text-gray-400">Softness</label>
                                        <span className="text-[10px] text-gray-500">{brushSettings.blur}px</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={brushSettings.blur} onChange={(e) => dispatch({ type: 'UPDATE_BRUSH_SETTINGS', payload: { blur: parseInt(e.target.value, 10) } })} className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                </div>
                                <h5 className="text-sm font-semibold text-blue-400 mt-2">Mask Mode (Power)</h5>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => dispatch({ type: 'UPDATE_BRUSH_SETTINGS', payload: { opacity: 0 } })}
                                        className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold transition ${brushSettings.opacity === 0 ? 'bg-black text-white ring-1 ring-gray-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    >
                                        Conceal
                                    </button>
                                    <button
                                        onClick={() => dispatch({ type: 'UPDATE_BRUSH_SETTINGS', payload: { opacity: 0.5 } })}
                                        className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold transition ${brushSettings.opacity === 0.5 ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    >
                                        Soft
                                    </button>
                                    <button
                                        onClick={() => dispatch({ type: 'UPDATE_BRUSH_SETTINGS', payload: { opacity: 1 } })}
                                        className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold transition ${brushSettings.opacity === 1 ? 'bg-white text-black' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    >
                                        Reveal
                                    </button>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs font-medium text-gray-400">Custom Opacity</label>
                                        <span className="text-[10px] text-gray-500">{Math.round(brushSettings.opacity * 100)}%</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.01" value={brushSettings.opacity} onChange={(e) => dispatch({ type: 'UPDATE_BRUSH_SETTINGS', payload: { opacity: parseFloat(e.target.value) } })} className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                </div>
                            </>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => dispatch({ type: 'INVERT_MASK', payload: { layerId: activeLayer.id } })}
                                className="flex-1 py-1.5 bg-gray-600 hover:bg-gray-500 text-gray-300 text-xs rounded-md transition border border-gray-500"
                            >
                                Invert Mask
                            </button>
                            <button
                                onClick={() => {
                                    if (!activeLayer.maskCanvas) return;
                                    const ctx = activeLayer.maskCanvas.getContext('2d');
                                    ctx?.clearRect(0, 0, activeLayer.maskCanvas.width, activeLayer.maskCanvas.height);
                                    dispatch({ type: 'UPDATE_MASK_CANVAS', payload: { layerId: activeLayer.id, canvas: activeLayer.maskCanvas } });
                                }}
                                className="flex-1 py-1.5 bg-gray-600 hover:bg-gray-500 text-gray-300 text-xs rounded-md transition border border-gray-500"
                            >
                                Clear Mask
                            </button>
                        </div>
                        {activeLayer.maskCanvas && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.download = `mask-${activeLayer.id}.png`;
                                        link.href = activeLayer.maskCanvas!.toDataURL('image/png');
                                        link.click();
                                    }}
                                    className="flex-1 py-1.5 bg-gray-600 hover:bg-gray-500 text-gray-300 text-xs rounded-md transition border border-gray-500"
                                >
                                    Download PNG
                                </button>
                                <button
                                    onClick={() => onSaveToAssets(activeLayer)}
                                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition shadow-sm"
                                >
                                    Save to Library
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <div>
                    <label className="text-sm font-medium text-gray-300">Opacity: {Math.round(activeLayer.opacity * 100)}%</label>
                    <input type="range" min="0" max="1" step="0.01" value={activeLayer.opacity} onChange={(e) => handleSliderChange('opacity', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500" />
                </div>

                {activeLayer.type !== 'mask' && (
                    <div>
                        <label className="text-sm font-medium text-gray-300">Blend Mode</label>
                        <select value={activeLayer.blendMode || 'source-over'} onChange={(e) => handleUndoableChange('blendMode', e.target.value as BlendMode)} className="bg-gray-600 border border-gray-500 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 mt-1">
                            {BLEND_MODES.map(mode => (<option key={mode.value} value={mode.value}>{mode.name}</option>))}
                        </select>
                    </div>
                )}

                <div>
                    <label className="text-sm font-medium text-gray-300">Rotation: {Math.round(activeLayer.transform.rotation || 0)}°</label>
                    <input type="range" min="-180" max="180" step="1" value={activeLayer.transform.rotation || 0} onChange={(e) => handleSliderChange('transform.rotation', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500" />
                </div>

                {activeLayer.type !== 'mask' && (
                    <div className="border-t border-gray-600 pt-3 flex flex-col gap-3">
                        <h5 className="text-sm font-semibold text-gray-300">Frame</h5>
                        <div className="grid grid-cols-[1fr,2fr,1fr] gap-2 items-center">
                            <input type="number" min="0" value={activeLayer.frame?.width || 0} onChange={(e) => handleUndoableChange('frame.width', parseFloat(e.target.value) || 0)} className="bg-gray-600 border border-gray-500 text-white text-sm rounded-lg block w-full p-1.5" placeholder="Size" />
                            <HexColorInput value={activeLayer.frame?.color || '#000000'} onChange={(val) => handleUndoableChange('frame.color', val)} />
                            <input type="color" value={activeLayer.frame?.color || '#000000'} onChange={(e) => handleUndoableChange('frame.color', e.target.value)} className="bg-gray-600 border border-gray-500 rounded-lg block w-full p-1 h-9 cursor-pointer" />
                        </div>
                    </div>
                )}

                <StyleAccordion styleKey="dropShadow" title="Drop Shadow" openStyle={openStyle} setOpenStyle={setOpenStyle}>
                    <div className="flex items-center justify-between py-1">
                        <label htmlFor="ds-enabled" className="text-sm font-medium text-gray-300 cursor-pointer">Enable</label>
                        <ToggleSwitch id="ds-enabled" checked={activeLayer.styles?.dropShadow?.enabled ?? false} onChange={(e) => handleUndoableChange('styles.dropShadow.enabled', e.target.checked)} />
                    </div>
                    {activeLayer.styles?.dropShadow?.enabled && (
                        <div className="flex flex-col gap-3 mt-2 pt-3 border-t border-gray-600/50">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-sm font-medium text-gray-400">Color</label>
                                <div className="flex-grow">
                                    <HexColorInput value={activeLayer.styles?.dropShadow?.color ?? '#000000'} onChange={(val) => handleUndoableChange('styles.dropShadow.color', val)} />
                                </div>
                                <input type="color" value={activeLayer.styles?.dropShadow?.color ?? '#000000'} onChange={(e) => handleUndoableChange('styles.dropShadow.color', e.target.value)} className="p-1 h-8 w-10 block bg-gray-600 border border-gray-500 cursor-pointer rounded-lg" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1"><label className="text-sm font-medium text-gray-400">Opacity</label><span className="text-xs font-mono px-2 py-0.5 bg-gray-900 rounded-md">{Math.round((activeLayer.styles?.dropShadow?.opacity ?? 0) * 100)}%</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={activeLayer.styles?.dropShadow?.opacity ?? 0} onChange={(e) => handleSliderChange('styles.dropShadow.opacity', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1"><label className="text-sm font-medium text-gray-400">Blur</label><span className="text-xs font-mono px-2 py-0.5 bg-gray-900 rounded-md">{activeLayer.styles?.dropShadow?.blur ?? 0}px</span></div>
                                <input type="range" min="0" max="50" value={activeLayer.styles?.dropShadow?.blur ?? 0} onChange={(e) => handleSliderChange('styles.dropShadow.blur', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1"><label className="text-sm font-medium text-gray-400">Offset X</label><span className="text-xs font-mono px-2 py-0.5 bg-gray-900 rounded-md">{activeLayer.styles?.dropShadow?.offsetX ?? 0}px</span></div>
                                <input type="range" min="-50" max="50" value={activeLayer.styles?.dropShadow?.offsetX ?? 0} onChange={(e) => handleSliderChange('styles.dropShadow.offsetX', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1"><label className="text-sm font-medium text-gray-400">Offset Y</label><span className="text-xs font-mono px-2 py-0.5 bg-gray-900 rounded-md">{activeLayer.styles?.dropShadow?.offsetY ?? 0}px</span></div>
                                <input type="range" min="-50" max="50" value={activeLayer.styles?.dropShadow?.offsetY ?? 0} onChange={(e) => handleSliderChange('styles.dropShadow.offsetY', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500" />
                            </div>
                        </div>
                    )}
                </StyleAccordion>

                <StyleAccordion styleKey="outerGlow" title="Outer Glow" openStyle={openStyle} setOpenStyle={setOpenStyle}>
                    <div className="flex items-center justify-between py-1">
                        <label htmlFor="og-enabled" className="text-sm font-medium text-gray-300 cursor-pointer">Enable</label>
                        <ToggleSwitch id="og-enabled" checked={activeLayer.styles?.outerGlow?.enabled ?? false} onChange={(e) => handleUndoableChange('styles.outerGlow.enabled', e.target.checked)} />
                    </div>
                    {activeLayer.styles?.outerGlow?.enabled && (
                        <div className="flex flex-col gap-3 mt-2 pt-3 border-t border-gray-600/50">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-sm font-medium text-gray-400">Color</label>
                                <div className="flex-grow">
                                    <HexColorInput value={activeLayer.styles?.outerGlow?.color ?? '#ffffff'} onChange={(val) => handleUndoableChange('styles.outerGlow.color', val)} />
                                </div>
                                <input type="color" value={activeLayer.styles?.outerGlow?.color ?? '#ffffff'} onChange={(e) => handleUndoableChange('styles.outerGlow.color', e.target.value)} className="p-1 h-8 w-10 block bg-gray-600 border border-gray-500 cursor-pointer rounded-lg" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1"><label className="text-sm font-medium text-gray-400">Opacity</label><span className="text-xs font-mono px-2 py-0.5 bg-gray-900 rounded-md">{Math.round((activeLayer.styles?.outerGlow?.opacity ?? 0) * 100)}%</span></div>
                                <input type="range" min="0" max="1" step="0.01" value={activeLayer.styles?.outerGlow?.opacity ?? 0} onChange={(e) => handleSliderChange('styles.outerGlow.opacity', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1"><label className="text-sm font-medium text-gray-400">Blur</label><span className="text-xs font-mono px-2 py-0.5 bg-gray-900 rounded-md">{activeLayer.styles?.outerGlow?.blur ?? 0}px</span></div>
                                <input type="range" min="0" max="100" value={activeLayer.styles?.outerGlow?.blur ?? 0} onChange={(e) => handleSliderChange('styles.outerGlow.blur', parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1"><label className="text-sm font-medium text-gray-400">Strength</label><span className="text-xs font-mono px-2 py-0.5 bg-gray-900 rounded-md">{activeLayer.styles?.outerGlow?.strength ?? 0}</span></div>
                                <input type="range" min="1" max="10" step="1" value={activeLayer.styles?.outerGlow?.strength ?? 0} onChange={(e) => handleSliderChange('styles.outerGlow.strength', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500" />
                            </div>
                        </div>
                    )}
                </StyleAccordion>

                {/* Legacy File Mask Section Removed */}
            </div>
        </div>
    );
};

export default PropertiesPanel;