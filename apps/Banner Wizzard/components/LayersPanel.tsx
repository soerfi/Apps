import React, { useState, useRef, useCallback } from 'react';
import { Layer } from '../types';
import { EditorAction } from '../hooks/useImageEditorState';
import { PlusIcon, EyeOpenIcon, EyeClosedIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from './icons';

interface LayersPanelProps {
    layers: Layer[];
    activeLayerId: string | null;
    dispatch: React.Dispatch<EditorAction>;
}

const LayersPanel: React.FC<LayersPanelProps> = ({ layers, activeLayerId, dispatch }) => {
    const addLayerInputRef = useRef<HTMLInputElement>(null);
    const draggedLayerId = useRef<string | null>(null);
    const layerBounds = useRef<{ id: string; top: number; bottom: number }[]>([]);
    const [dropTarget, setDropTarget] = useState<{ layerId: string; position: 'above' | 'below' } | null>(null);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [customColor, setCustomColor] = useState('#5e55e3');

    const handleAddLayerClick = () => addLayerInputRef.current?.click();

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            dispatch({ type: 'ADD_IMAGE_LAYERS', payload: { files: Array.from(files) }});
        }
        e.target.value = '';
    };

    const handleAddColorLayer = (color: string, name: string) => {
        dispatch({ type: 'ADD_COLOR_LAYER', payload: { color, name }});
    };

    const handleLayerDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, id: string) => {
        draggedLayerId.current = id;
        e.dataTransfer.effectAllowed = 'move';
        
        const container = e.currentTarget.parentElement?.parentElement;
        if (!container) return;
        
        const layerElements = Array.from(container.querySelectorAll('[data-layer-id]')) as HTMLElement[];
        layerBounds.current = layerElements.map(el => {
            const rect = el.getBoundingClientRect();
            return { id: el.dataset.layerId!, top: rect.top, bottom: rect.bottom };
        });

    }, []);

    const handleLayerContainerDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const draggedId = draggedLayerId.current;
        if (!draggedId) return;

        const dropTargetCandidate = layerBounds.current.find(bounds => {
            if (bounds.id === draggedId) return false;
            const middle = bounds.top + (bounds.bottom - bounds.top) / 2;
            return e.clientY < middle;
        });

        const reversedLayers = [...layers].reverse();
        const lastVisibleLayerId = reversedLayers.find(l => l.id !== draggedId)?.id;

        const newTargetId = dropTargetCandidate ? dropTargetCandidate.id : (lastVisibleLayerId ?? null);
        const newPosition = dropTargetCandidate ? 'above' : 'below';

        if (newTargetId && (newTargetId !== dropTarget?.layerId || newPosition !== dropTarget?.position)) {
            setDropTarget({ layerId: newTargetId, position: newPosition });
        } else if (!newTargetId && dropTarget) {
            setDropTarget(null);
        }
    }, [dropTarget, layers]);

    const handleLayerDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const draggedId = draggedLayerId.current;
        const targetId = dropTarget?.layerId;

        if (draggedId && targetId && draggedId !== targetId) {
            dispatch({ type: 'REORDER_LAYER', payload: { draggedId, targetId, position: dropTarget.position }});
        }
        
        draggedLayerId.current = null;
        setDropTarget(null);
        layerBounds.current = [];
    }, [dispatch, dropTarget]);

    const handleLayerDragEnd = useCallback(() => {
        draggedLayerId.current = null;
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
                        <div className="flex gap-4 w-full">
                            <button onClick={() => setIsColorPickerOpen(false)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition">Cancel</button>
                            <button onClick={() => { handleAddColorLayer(customColor, 'Color Layer'); setIsColorPickerOpen(false); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition">Add Layer</button>
                        </div>
                    </div>
                </div>
            )}
            <h3 className="text-xl font-semibold my-3 text-center text-gray-200">2. Layers</h3>
            <div className="flex flex-col gap-2">
                <button onClick={handleAddLayerClick} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition"><PlusIcon className="w-5 h-5" /> Add Image</button>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleAddColorLayer('#FFFFFF', 'White Layer')} className="bg-gray-200 hover:bg-white text-black font-bold py-2 px-2 rounded-md transition text-sm">White</button>
                    <button onClick={() => handleAddColorLayer('#000000', 'Black Layer')} className="bg-black hover:bg-gray-800 text-white font-bold py-2 px-2 rounded-md transition text-sm">Black</button>
                    <button onClick={() => setIsColorPickerOpen(true)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-2 rounded-md transition text-sm">Custom...</button>
                </div>
                <input type="file" accept="image/*" multiple ref={addLayerInputRef} onChange={handleFileSelected} className="hidden" />
                <div 
                    className="bg-gray-700/50 p-2 rounded-lg flex flex-col min-h-[200px] max-h-[40vh] overflow-y-auto" 
                    onDragOver={handleLayerContainerDragOver} 
                    onDrop={handleLayerDrop} 
                    onDragLeave={handleLayerContainerDragLeave}
                >
                    {layers.length === 0 && <p className="text-gray-400 text-center p-4">Add a layer to start.</p>}
                    {[...layers].reverse().map((layer, index, reversedArray) => (
                        <div key={layer.id} className="relative py-1">
                            {dropTarget?.layerId === layer.id && dropTarget.position === 'above' && <div className="absolute top-[-2px] left-0 right-0 h-1.5 bg-blue-500 rounded-full" />}
                            <div 
                                data-layer-id={layer.id} 
                                draggable 
                                onDragStart={(e) => handleLayerDragStart(e, layer.id)} 
                                onDragEnd={handleLayerDragEnd} 
                                onClick={() => dispatch({ type: 'SET_ACTIVE_LAYER', payload: layer.id })}
                                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-200 ${activeLayerId === layer.id ? 'bg-blue-500/30 ring-2 ring-blue-400' : 'bg-gray-900/50 hover:bg-gray-900/80'} ${draggedLayerId.current === layer.id ? 'opacity-30' : ''}`}
                            >
                                <div className="flex flex-col">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_LAYER', payload: { layerId: layer.id, direction: 'up' } })}} 
                                        disabled={index === 0} 
                                        className="p-0.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                                        title="Move layer up"
                                    >
                                        <ChevronUpIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_LAYER', payload: { layerId: layer.id, direction: 'down' } })}} 
                                        disabled={index === reversedArray.length - 1}
                                        className="p-0.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                                        title="Move layer down"
                                    >
                                        <ChevronDownIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                {layer.image ? <img src={layer.image.src} alt={layer.name} className="w-12 h-12 object-cover rounded-md bg-checkered-pattern flex-shrink-0" /> : <div className="w-12 h-12 rounded-md flex-shrink-0 border border-gray-500" style={{ backgroundColor: layer.color }}></div>}
                                <span className="flex-grow text-sm font-medium truncate" title={layer.name}>{layer.name}</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={(e) => {e.stopPropagation(); dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', payload: layer.id })}} className="p-1 rounded-full hover:bg-gray-600">{layer.visible ? <EyeOpenIcon className="w-5 h-5 text-green-400"/> : <EyeClosedIcon className="w-5 h-5 text-gray-500"/>}</button>
                                    <button onClick={(e) => {e.stopPropagation(); dispatch({ type: 'DELETE_LAYER', payload: layer.id })}} className="p-1 rounded-full hover:bg-gray-600"><TrashIcon className="w-5 h-5 text-red-400"/></button>
                                </div>
                            </div>
                            {dropTarget?.layerId === layer.id && dropTarget.position === 'below' && <div className="absolute bottom-[-2px] left-0 right-0 h-1.5 bg-blue-500 rounded-full" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LayersPanel;