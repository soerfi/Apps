import React, { useState, useRef, useCallback } from 'react';
import { EditorAction, Layer } from '../types';
import { PlusIcon, EyeOpenIcon, EyeClosedIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, MaskIcon, LinkIcon, LinkOffIcon, UndoIcon, RedoIcon, ResetLayerIcon, ShadowIcon, GlowIcon, InvertIcon, LockOpenIcon, LockClosedIcon } from './icons';

interface LayersPanelProps {
    layers: Layer[];
    activeLayerId: string | null;
    dispatch: React.Dispatch<EditorAction>;
    onOpenAssetLibrary: () => void;
}

const LayersPanel: React.FC<LayersPanelProps> = ({ layers, activeLayerId, dispatch, onOpenAssetLibrary }) => {
    const addLayerInputRef = useRef<HTMLInputElement>(null);
    const addMaskInputRef = useRef<HTMLInputElement>(null);
    const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
    const layerBounds = useRef<{ id: string; top: number; bottom: number }[]>([]);
    const [dropTarget, setDropTarget] = useState<{ layerId: string; position: 'above' | 'below' } | null>(null);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [customColor, setCustomColor] = useState('#5e55e3');
    const [hexInputValue, setHexInputValue] = useState(customColor);

    React.useEffect(() => {
        setHexInputValue(customColor);
    }, [customColor]);

    const handleHexBlur = () => {
        let hex = hexInputValue;
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            setCustomColor(hex);
        } else {
            setHexInputValue(customColor);
        }
    };

    const handleAddLayerClick = () => addLayerInputRef.current?.click();

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            dispatch({ type: 'ADD_IMAGE_LAYERS', payload: { files: Array.from(files) } });
        }
        e.target.value = '';
    };

    const handleAddColorLayer = (color: string, name: string) => {
        dispatch({ type: 'ADD_COLOR_LAYER', payload: { color, name } });
    };

    const handleLayerDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, id: string) => {
        setDraggedLayerId(id);
        e.dataTransfer.effectAllowed = 'move';
        // Make the drag ghost transparent
        e.dataTransfer.setDragImage(e.currentTarget, 0, 0); // Optional: customize if needed

        const container = e.currentTarget.closest('.overflow-y-auto');
        if (!container) return;

        // Capture bounds immediately, but we might need to refresh if scrolling happens
        const layerElements = Array.from(container.querySelectorAll('[data-layer-id]')) as HTMLElement[];
        layerBounds.current = layerElements.map(el => {
            const rect = el.getBoundingClientRect();
            return { id: el.dataset.layerId!, top: rect.top, bottom: rect.bottom };
        });

    }, []);

    const handleLayerContainerDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const draggedId = draggedLayerId; // Use state
        if (!draggedId) return;

        const containerRect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY;
        const reversedLayers = [...layers].reverse();

        // 1. Extreme Top Check: If hovering over the top padding/spacer
        if (y < containerRect.top + 40) { // Increased threshold for easier "Top" drop
            const topLayerId = reversedLayers.find(l => l.id !== draggedId)?.id;
            if (topLayerId) {
                setDropTarget({ layerId: topLayerId, position: 'above' });
                return;
            }
        }

        // 2. Extreme Bottom Check: If hovering over the bottom padding/spacer
        if (y > containerRect.bottom - 40) {
            const bottomLayerId = [...reversedLayers].reverse().find(l => l.id !== draggedId)?.id;
            if (bottomLayerId) {
                setDropTarget({ layerId: bottomLayerId, position: 'below' });
                return;
            }
        }

        // 3. Middle Item Logic
        const dropTargetCandidate = layerBounds.current?.find(bounds => {
            if (bounds.id === draggedId) return false;
            // Expand the hit area to include gaps? 
            // Actually, we just need to see if we are in the upper or lower half of an item
            return y >= bounds.top && y <= bounds.bottom;

            // Wait, this only allows dropping ON an item layer. What about gaps?
            // Previous logic: `y < middle`. This implicitly covers everything ABOVE middle as "Top Half".
            // Let's stick to the "Top Half / Bottom Half" of the HOVERED element logic.
        });

        // Better Loop: Find the *closest* layer to Y
        // This is more robust than "is strictly inside bounds"
        // But for now, let's restore the straightforward "Find item under cursor" logic

        let foundTarget = layerBounds.current?.find(bounds => y >= bounds.top && y <= bounds.bottom);

        if (foundTarget) {
            if (foundTarget.id === draggedId) return;
            const middle = foundTarget.top + (foundTarget.bottom - foundTarget.top) / 2;
            const position = y < middle ? 'above' : 'below';
            setDropTarget({ layerId: foundTarget.id, position });
        }

    }, [draggedLayerId, layers]);

    const handleLayerDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const draggedId = draggedLayerId;
        const targetId = dropTarget?.layerId;

        if (draggedId && targetId && draggedId !== targetId) {
            dispatch({ type: 'REORDER_LAYER', payload: { draggedId, targetId, position: dropTarget.position } });
        }

        setDraggedLayerId(null);
        setDropTarget(null);
        layerBounds.current = [];
    }, [dispatch, dropTarget, draggedLayerId]);

    const handleLayerDragEnd = useCallback(() => {
        setDraggedLayerId(null);
        setDropTarget(null);
        layerBounds.current = [];
    }, []);

    const handleLayerContainerDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropTarget(null);
        }
    }, []);

    return (
        <div>
            {isColorPickerOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setIsColorPickerOpen(false)}>
                    <div className="bg-gray-800 p-8 rounded-lg shadow-xl flex flex-col items-center gap-6 w-72" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-2xl font-semibold text-white">Choose a Fill Color</h3>
                        <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-gray-600">
                            <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer" style={{ transform: 'scale(3)' }} />
                        </div>
                        <div className="w-full">
                            <label className="text-xs font-medium text-gray-400 mb-1 block">Hex Code</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">#</span>
                                <input
                                    type="text"
                                    value={hexInputValue.replace('#', '')}
                                    onChange={(e) => setHexInputValue(e.target.value)}
                                    onBlur={handleHexBlur}
                                    className="bg-gray-700 border border-gray-600 text-white text-base rounded-lg block w-full pl-7 pr-3 py-2 font-mono focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="000000"
                                />
                            </div>
                        </div>
                        <div className="flex gap-4 w-full">
                            <button onClick={() => setIsColorPickerOpen(false)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition">Cancel</button>
                            <button onClick={() => { handleAddColorLayer(customColor, 'Color Layer'); setIsColorPickerOpen(false); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition">Add Layer</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between my-3 px-1">
                <h3 className="text-xl font-semibold text-gray-200">2. Layers</h3>
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <button
                        onClick={onOpenAssetLibrary}
                        className="flex-grow flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2.5 px-4 rounded-md transition shadow-md"
                    >
                        <PlusIcon className="w-5 h-5" /> Add Image / Stickers
                    </button>
                    <button
                        onClick={handleAddLayerClick}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-2.5 rounded-md transition shrink-0"
                        title="Direct Upload"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleAddColorLayer('#FFFFFF', 'White Layer')} className="bg-gray-200 hover:bg-white text-black font-bold py-2 px-2 rounded-md transition text-sm">White</button>
                    <button onClick={() => handleAddColorLayer('#000000', 'Black Layer')} className="bg-black hover:bg-gray-800 text-white font-bold py-2 px-2 rounded-md transition text-sm">Black</button>
                    <button onClick={() => setIsColorPickerOpen(true)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-2 rounded-md transition text-sm">Custom...</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => activeLayerId && dispatch({ type: 'ADD_MASK', payload: { layerId: activeLayerId } })}
                        disabled={!activeLayerId || layers.find(l => l.id === activeLayerId)?.type === 'mask'}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-2 rounded-md transition text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <MaskIcon className="w-4 h-4" /> Add Mask
                    </button>
                    <button
                        onClick={() => activeLayerId && addMaskInputRef.current?.click()}
                        disabled={!activeLayerId || layers.find(l => l.id === activeLayerId)?.type === 'mask'}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-2 rounded-md transition text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <MaskIcon className="w-4 h-4 rotate-12" /> From File...
                    </button>
                </div>
                <input type="file" accept="image/*" multiple ref={addLayerInputRef} onChange={handleFileSelected} className="hidden" />
                <input
                    type="file"
                    accept="image/*"
                    ref={addMaskInputRef}
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && activeLayerId) {
                            dispatch({ type: 'ADD_MASK_FILE', payload: { layerId: activeLayerId, file } });
                        }
                        e.target.value = '';
                    }}
                />
                <div
                    className="bg-gray-700/50 p-2 rounded-lg flex flex-col min-h-[200px] max-h-[40vh] overflow-y-auto relative"
                    onDragOver={handleLayerContainerDragOver}
                    onDrop={handleLayerDrop}
                    onDragLeave={handleLayerContainerDragLeave}
                >
                    {/* Absolute Top Drop Zone */}
                    <div className="h-6 w-full shrink-0" />

                    {layers.length === 0 && <p className="text-gray-400 text-center p-4">Add a layer to start.</p>}
                    {[...layers].reverse().map((layer, index, reversedArray) => {
                        const isMask = layer.type === 'mask' || layer.isClippingMask;
                        const isMaskerAbove = index > 0 && (reversedArray[index - 1].type === 'mask' || reversedArray[index - 1].isClippingMask);

                        return (
                            <div key={layer.id} className="relative py-1">
                                {dropTarget?.layerId === layer.id && dropTarget.position === 'above' && <div className="absolute top-[-2px] left-0 right-0 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.9)] z-10 ring-1 ring-blue-200" />}
                                <div className="flex items-center">
                                    {(layer.isMaskChild || isMaskerAbove) && (
                                        <div
                                            className="w-8 h-12 flex items-center justify-center -mr-2 cursor-pointer group/elbow"
                                            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_MASK_CHILD', payload: layer.id }); }}
                                            title={layer.isMaskChild ? "Unlink from group" : "Link to mask above"}
                                        >
                                            <div className={`w-4 h-6 border-l-2 border-b-2 rounded-bl-lg ml-3 mt-[-12px] transition-all duration-300 ${layer.isMaskChild ? 'border-blue-500 scale-100' : 'border-gray-700 scale-90 group-hover/elbow:border-blue-400 group-hover/elbow:scale-100 opacity-50 group-hover/elbow:opacity-100'}`}></div>
                                        </div>
                                    )}
                                    <div
                                        data-layer-id={layer.id}
                                        draggable
                                        onDragStart={(e) => handleLayerDragStart(e, layer.id)}
                                        onDragEnd={handleLayerDragEnd}
                                        onClick={() => dispatch({ type: 'SET_ACTIVE_LAYER', payload: layer.id })}
                                        className={`flex-grow min-w-0 flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-200 ${activeLayerId === layer.id ? 'bg-blue-600/40 ring-1 ring-blue-400/50' : 'bg-gray-900/40 hover:bg-gray-900/60'} ${draggedLayerId === layer.id ? 'opacity-30' : ''} ${layer.isMaskChild ? 'ml-1 border-l border-blue-500/30' : ''}`}
                                    >
                                        <div className="flex flex-col">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_LAYER', payload: { layerId: layer.id, direction: 'up' } }) }}
                                                disabled={index === 0}
                                                className="p-0.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                                                title="Move layer up"
                                            >
                                                <ChevronUpIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_LAYER', payload: { layerId: layer.id, direction: 'down' } }) }}
                                                disabled={index === reversedArray.length - 1}
                                                className="p-0.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                                                title="Move layer down"
                                            >
                                                <ChevronDownIcon className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {isMask ? (
                                            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-black rounded p-1 border border-gray-600 relative overflow-hidden group/thumb">
                                                {layer.type === 'mask' && (
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:scale-110 transition-transform">
                                                        {layer.thumbnailUrl ? (
                                                            <img src={layer.thumbnailUrl} className="w-8 h-8 rounded-sm object-contain bg-gray-900 shadow-sm" alt="Mask preview" />
                                                        ) : (
                                                            <div className="w-8 h-8 bg-gray-900 rounded-sm" />
                                                        )}
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                    <MaskIcon className="w-6 h-6 text-white" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                {layer.image ? <img src={layer.image.src} alt={layer.name} className="w-12 h-12 object-cover rounded-md bg-checkered-pattern flex-shrink-0" /> : <div className="w-12 h-12 rounded-md flex-shrink-0 border border-gray-500" style={{ backgroundColor: layer.color }}></div>}
                                                {layer.isClippingMask && (
                                                    <div className="absolute -left-1 -top-1 bg-blue-500 rounded-full p-0.5 shadow-sm" title="Clipping Mask Active">
                                                        <LinkIcon className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <span className="flex-grow text-sm font-medium truncate" title={layer.name}>
                                            {isMask && 'Mask: '}
                                            {layer.name}
                                        </span>

                                        <div className="flex items-center gap-1">
                                            {layer.type !== 'mask' && (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_CLIPPING_MASK', payload: layer.id }) }}
                                                        className="p-1 rounded-full hover:bg-gray-700 transition"
                                                        title={layer.isClippingMask ? "Disable Clipping Mask" : "Enable Clipping Mask"}
                                                    >
                                                        {layer.isClippingMask ? <LinkIcon className="w-4 h-4 text-blue-400" /> : <LinkOffIcon className="w-4 h-4 text-gray-500" />}
                                                    </button>
                                                    {layer.isClippingMask && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_MASK_INVERSION', payload: layer.id }) }}
                                                            className="p-1 rounded-full hover:bg-gray-700 transition"
                                                            title={layer.isInverted ? "Disable Invert Mask" : "Invert Mask"}
                                                        >
                                                            <InvertIcon className={`w-4 h-4 ${layer.isInverted ? 'text-yellow-400' : 'text-gray-500'}`} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_LOCK', payload: layer.id }) }} className="p-1 rounded-full hover:bg-gray-600" title={layer.isLocked ? "Unlock Layer" : "Lock Layer"}>{layer.isLocked ? <LockClosedIcon className="w-4 h-4 text-red-400" /> : <LockOpenIcon className="w-4 h-4 text-gray-500" />}</button>
                                            <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', payload: layer.id }) }} className="p-1 rounded-full hover:bg-gray-600">{layer.visible ? <EyeOpenIcon className="w-5 h-5 text-green-400" /> : <EyeClosedIcon className="w-5 h-5 text-gray-500" />}</button>
                                            <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_LAYER', payload: layer.id }) }} className="p-1 rounded-full hover:bg-gray-600"><TrashIcon className="w-5 h-5 text-red-400" /></button>
                                        </div>
                                    </div>
                                </div>
                                {dropTarget?.layerId === layer.id && dropTarget.position === 'below' && <div className="absolute bottom-[-2px] left-0 right-0 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.9)] z-10 ring-1 ring-blue-200" />}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default LayersPanel;