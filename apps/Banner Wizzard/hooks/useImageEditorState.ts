import { useReducer, useEffect, useCallback } from 'react';
import { Layer, LayerStyles, Transform, Preset } from '../types';

// State and Action Types
interface EditorState {
    layers: Layer[];
    activeLayerId: string | null;
    history: {
        past: Layer[][];
        present: Layer[];
        future: Layer[][];
    };
    preset: Preset;
}

export type EditorAction =
    | { type: 'ADD_IMAGE_LAYERS'; payload: { files: File[] } }
    | { type: 'ADD_COLOR_LAYER'; payload: { color: string; name: string } }
    | { type: 'DELETE_LAYER'; payload: string }
    | { type: 'SET_ACTIVE_LAYER'; payload: string | null }
    | { type: 'TOGGLE_LAYER_VISIBILITY'; payload: string }
    | { type: 'REORDER_LAYER'; payload: { draggedId: string; targetId: string; position: 'above' | 'below' } }
    | { type: 'MOVE_LAYER'; payload: { layerId: string; direction: 'up' | 'down' } }
    | { type: 'UPDATE_LAYER_PROPERTY'; payload: { layerId: string; prop: string; value: any } }
    | { type: 'UPDATE_LAYER_TRANSFORM_RELATIVE', payload: { layerId: string; delta: { dx: number, dy: number, dScale: number, dRotation: number }, options: { isSnapping: boolean } } }
    | { type: 'UPDATE_LAYER_SCALE_FROM_POINT', payload: { layerId: string; point: {x: number, y: number}, dScale: number, options: { isSnapping: boolean } } }
    | { type: 'MOVE_ACTIVE_LAYER_WITH_KEYBOARD', payload: { key: string, shiftKey: boolean, metaKey: boolean, ctrlKey: boolean } }
    | { type: 'RESET_ACTIVE_LAYER' }
    | { type: 'INTERACTION_START' }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'RESET_STATE' }
    | { type: '_SET_LAYERS'; payload: Layer[] }; // Internal action for async layer loading


const defaultStyles: LayerStyles = {
    dropShadow: { enabled: false, color: '#000000', blur: 10, offsetX: 5, offsetY: 5, opacity: 0.75 },
    outerGlow: { enabled: false, color: '#ffffff', blur: 20, opacity: 0.85, strength: 1 },
};

const loadImage = (file: File, preset: Preset): Promise<Layer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const newLayer: Omit<Layer, 'transform'> = {
                    id: `${file.name}-${new Date().getTime()}`,
                    image: img,
                    name: file.name,
                    visible: true,
                    hasTransparency: false,
                    opacity: 1,
                    blendMode: 'source-over',
                    styles: JSON.parse(JSON.stringify(defaultStyles)),
                };

                const tempCanvas = document.createElement('canvas');
                const size = Math.min(img.width, img.height, 100);
                tempCanvas.width = size; tempCanvas.height = size;
                const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                    ctx.drawImage(img, 0, 0, size, size);
                    try {
                        const imageData = ctx.getImageData(0, 0, size, size).data;
                        for (let i = 3; i < imageData.length; i += 4) {
                            if (imageData[i] < 255) {
                                newLayer.hasTransparency = true;
                                break;
                            }
                        }
                    } catch (e) { console.error("Could not check for transparency:", e); }
                }

                const scaleX = preset.width / img.width;
                const scaleY = preset.height / img.height;
                const initialScale = Math.max(scaleX, scaleY);
                const transform = { x: preset.width / 2, y: preset.height / 2, scale: initialScale, rotation: 0 };
                
                resolve({ ...newLayer, transform });
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const applySnapping = (layer: Layer, preset: Preset, ctrlKey: boolean): Transform => {
    const { transform } = layer;
    if (ctrlKey || !layer.image) return transform;

    const snapThreshold = 10;
    const { image } = layer;
    const scaledWidth = image.width * transform.scale;
    const scaledHeight = image.height * transform.scale;
  
    const left = transform.x - scaledWidth / 2;
    const right = transform.x + scaledWidth / 2;
    const top = transform.y - scaledHeight / 2;
    const bottom = transform.y + scaledHeight / 2;
      
    let snappedX = transform.x;
    let snappedY = transform.y;
  
    if (Math.abs(left) < snapThreshold) snappedX = scaledWidth / 2;
    if (Math.abs(right - preset.width) < snapThreshold) snappedX = preset.width - scaledWidth / 2;
    if (Math.abs(top) < snapThreshold) snappedY = scaledHeight / 2;
    if (Math.abs(bottom - preset.height) < snapThreshold) snappedY = preset.height - scaledHeight / 2;
  
    return { ...transform, x: snappedX, y: snappedY };
};

const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
    switch (action.type) {
        case '_SET_LAYERS':
            return { ...state, layers: action.payload, activeLayerId: action.payload[action.payload.length - 1]?.id || null };
        
        case 'ADD_COLOR_LAYER': {
            const newLayer: Layer = {
                id: `${action.payload.name}-${new Date().getTime()}`,
                name: action.payload.name, color: action.payload.color,
                visible: true, opacity: 1, blendMode: 'source-over',
                transform: { x: state.preset.width / 2, y: state.preset.height / 2, scale: 1, rotation: 0 },
                styles: JSON.parse(JSON.stringify(defaultStyles)),
            };
            return { ...state, layers: [...state.layers, newLayer], activeLayerId: newLayer.id };
        }
        
        case 'DELETE_LAYER': {
            const newLayers = state.layers.filter(l => l.id !== action.payload);
            let newActiveId = state.activeLayerId;
            if (state.activeLayerId === action.payload) {
                newActiveId = newLayers.length > 0 ? newLayers[newLayers.length - 1].id : null;
            }
            return { ...state, layers: newLayers, activeLayerId: newActiveId };
        }
        
        case 'SET_ACTIVE_LAYER':
            return { ...state, activeLayerId: action.payload };
        
        case 'TOGGLE_LAYER_VISIBILITY':
            return { ...state, layers: state.layers.map(l => l.id === action.payload ? { ...l, visible: !l.visible } : l) };

        case 'REORDER_LAYER': {
            const { draggedId, targetId, position } = action.payload;
            const layers = [...state.layers];
            const draggedIndex = layers.findIndex(l => l.id === draggedId);
            
            if (draggedIndex === -1) return state;

            const [draggedItem] = layers.splice(draggedIndex, 1);
            const newTargetIndex = layers.findIndex(l => l.id === targetId);
            
            if (newTargetIndex === -1) {
                // If target not found, it might be the last item, re-add dragged item to be safe
                return { ...state, layers: [...layers, draggedItem]};
            }
            
            // UI list is reversed. "above" means a higher index in the state array.
            if (position === 'above') {
                layers.splice(newTargetIndex + 1, 0, draggedItem);
            } else { // "below"
                layers.splice(newTargetIndex, 0, draggedItem);
            }
            return { ...state, layers };
        }

        case 'MOVE_LAYER': {
            const { layerId, direction } = action.payload;
            const layers = [...state.layers];
            const index = layers.findIndex(l => l.id === layerId);
            if (index === -1) return state;
        
            // 'up' in UI means higher index in state array (since UI is reversed)
            if (direction === 'up' && index < layers.length - 1) {
                [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
            } 
            // 'down' in UI means lower index in state array
            else if (direction === 'down' && index > 0) {
                [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
            }
        
            return { ...state, layers };
        }

        case 'UPDATE_LAYER_PROPERTY': {
            const { layerId, prop, value } = action.payload;
            return {
                ...state,
                layers: state.layers.map(layer => {
                    if (layer.id !== layerId) return layer;
                    const [p1, p2, p3] = prop.split('.');
                    if (p3) return { ...layer, [p1]: { ...(layer as any)[p1], [p2]: { ...((layer as any)[p1] as any)[p2], [p3]: value } } };
                    if (p2) return { ...layer, [p1]: { ...(layer as any)[p1], [p2]: value } };
                    return { ...layer, [p1]: value };
                })
            };
        }
        case 'UPDATE_LAYER_TRANSFORM_RELATIVE': {
            const { layerId, delta, options } = action.payload;
             return { ...state, layers: state.layers.map(l => {
                if (l.id !== layerId) return l;
                let newTransform = { ...l.transform, x: l.transform.x + delta.dx, y: l.transform.y + delta.dy };
                if (options.isSnapping) {
                    newTransform = applySnapping({ ...l, transform: newTransform }, state.preset, false);
                }
                return { ...l, transform: newTransform };
             })};
        }
        case 'UPDATE_LAYER_SCALE_FROM_POINT': {
            const { layerId, point, dScale, options } = action.payload;
            return { ...state, layers: state.layers.map(l => {
                if (l.id !== layerId) return l;
                const oldScale = l.transform.scale;
                const newScale = Math.max(0.01, oldScale * dScale);
                const worldX = (point.x - l.transform.x) / oldScale;
                const worldY = (point.y - l.transform.y) / oldScale;
                let newTransform = { ...l.transform, scale: newScale, x: point.x - worldX * newScale, y: point.y - worldY * newScale };
                if (options.isSnapping) {
                    newTransform = applySnapping({ ...l, transform: newTransform }, state.preset, false);
                }
                return { ...l, transform: newTransform };
            })};
        }
        case 'MOVE_ACTIVE_LAYER_WITH_KEYBOARD': {
            const { key, shiftKey, metaKey, ctrlKey } = action.payload;
            const isSnap = metaKey || ctrlKey;
            const step = shiftKey ? 10 : 1;

            return { ...state, layers: state.layers.map(l => {
                if (l.id !== state.activeLayerId) return l;
                if (isSnap) {
                    if (!l.image) return l;
                    const scaledWidth = l.image.width * l.transform.scale;
                    const scaledHeight = l.image.height * l.transform.scale;
                    let { x, y } = l.transform;
                    if (key === 'ArrowLeft') x = scaledWidth / 2;
                    if (key === 'ArrowRight') x = state.preset.width - scaledWidth / 2;
                    if (key === 'ArrowUp') y = scaledHeight / 2;
                    if (key === 'ArrowDown') y = state.preset.height - scaledHeight / 2;
                    return { ...l, transform: { ...l.transform, x, y } };
                } else {
                    let { x, y } = l.transform;
                    if (key === 'ArrowUp') y -= step;
                    if (key === 'ArrowDown') y += step;
                    if (key === 'ArrowLeft') x -= step;
                    if (key === 'ArrowRight') x += step;
                    return { ...l, transform: { ...l.transform, x, y } };
                }
            })};
        }
        case 'RESET_ACTIVE_LAYER': {
            return { ...state, layers: state.layers.map(l => {
                if (l.id !== state.activeLayerId) return l;
                let newTransform: Transform;
                if (l.image) {
                    const scaleX = state.preset.width / l.image.width;
                    const scaleY = state.preset.height / l.image.height;
                    newTransform = { x: state.preset.width / 2, y: state.preset.height / 2, scale: Math.max(scaleX, scaleY), rotation: 0 };
                } else {
                    newTransform = { x: state.preset.width / 2, y: state.preset.height / 2, scale: 1, rotation: 0 };
                }
                return { ...l, transform: newTransform, frame: undefined, styles: JSON.parse(JSON.stringify(defaultStyles)) };
            })};
        }

        default:
            return state;
    }
};

// Undo/Redo Reducer Wrapper
const undoable = (reducer: typeof editorReducer) => {
    const initialState: EditorState['history'] = { past: [], present: [], future: [] };

    return (state: EditorState, action: EditorAction): EditorState => {
        const { history } = state;
        const { past, present, future } = history;
        
        switch (action.type) {
            case 'UNDO': {
                if (past.length === 0) return state;
                const previous = past[past.length - 1];
                const newPast = past.slice(0, past.length - 1);
                return { ...state, layers: previous, history: { past: newPast, present: previous, future: [present, ...future] } };
            }
            case 'REDO': {
                if (future.length === 0) return state;
                const next = future[0];
                const newFuture = future.slice(1);
                return { ...state, layers: next, history: { past: [...past, present], present: next, future: newFuture } };
            }
            case 'INTERACTION_START':
            case 'ADD_COLOR_LAYER':
            case 'DELETE_LAYER':
            case 'TOGGLE_LAYER_VISIBILITY':
            case 'RESET_ACTIVE_LAYER':
            case 'RESET_STATE':
            case 'MOVE_LAYER':
            case 'REORDER_LAYER': {
                 const newState = reducer(state, action);
                 if (newState.layers === present) return newState; // No change
                 return { ...newState, history: { past: [...past, present], present: newState.layers, future: [] } };
            }
            case '_SET_LAYERS': { // Special case for initial load
                const newState = reducer(state, action);
                return { ...newState, history: { ...initialState, present: newState.layers } };
            }
            default: {
                const newState = reducer(state, action);
                // For continuous actions, don't push to history
                return { ...newState, history: { ...history, present: newState.layers } };
            }
        }
    };
};

const finalReducer = undoable(editorReducer);

// Custom Hook
interface UseImageEditorStateProps {
    file: File;
    preset: Preset;
    onReset: () => void;
    setErrorMessage: (message: string) => void;
}

export const useImageEditorState = ({ file, preset, onReset, setErrorMessage }: UseImageEditorStateProps) => {
    const initialState: EditorState = {
        layers: [],
        activeLayerId: null,
        history: { past: [], present: [], future: [] },
        preset: preset,
    };

    const [state, dispatch] = useReducer(finalReducer, initialState);

    // Initial layer loading
    useEffect(() => {
        if (file && state.history.past.length === 0 && state.history.present.length === 0) {
            loadImage(file, preset)
                .then(initialLayer => {
                    dispatch({ type: '_SET_LAYERS', payload: [initialLayer] });
                })
                .catch(err => {
                    console.error("Failed to load initial image:", err);
                    setErrorMessage("Could not load the provided image file.");
                });
        }
    }, [file, preset, setErrorMessage]); // Only run on initial file change

    useEffect(() => {
        if (state.preset !== preset) {
            // This is a bit tricky, might need to reset or adjust layers when preset changes.
            // For now, we'll just update the preset in the state.
            // A more complex implementation might adjust layer transforms.
        }
    }, [preset]);


    // Need to wrap dispatch to handle async actions
    const enhancedDispatch = useCallback((action: EditorAction) => {
        if (action.type === 'ADD_IMAGE_LAYERS') {
            Promise.all(action.payload.files.map(f => loadImage(f, state.preset)))
                .then(newLayers => {
                    const combinedLayers = [...state.layers, ...newLayers];
                    dispatch({ type: '_SET_LAYERS', payload: combinedLayers });
                    dispatch({ type: 'INTERACTION_START' });
                })
                .catch(err => {
                    console.error("Failed to load additional layers:", err);
                    setErrorMessage("Could not load one or more image files.");
                });
        } else if (action.type === 'RESET_STATE') {
             onReset();
        }
        else {
            dispatch(action);
        }
    }, [state.preset, state.layers, setErrorMessage, onReset]);

    return [
        { ...state, layers: state.history.present, undoStack: state.history.past, redoStack: state.history.future },
        enhancedDispatch
    ] as const;
};