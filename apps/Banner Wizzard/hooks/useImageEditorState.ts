import { useReducer, useEffect, useCallback } from 'react';
import { Layer, Preset, BrushTool, EditorState, EditorAction } from '../types';
import { editorReducer } from '../reducers/editorReducer';
import { loadImage } from '../utils/editorUtils';


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
            case 'INTERACTION_START': {
                // Optimize renderer with buffer caching.
                // Update thumbnails for all mask layers to reflect current state in LayersPanel
                const newStateWithThumbnails = {
                    ...state,
                    layers: state.layers.map(l => l.type === 'mask' && l.maskCanvas ? { ...l, thumbnailUrl: l.maskCanvas.toDataURL() } : l)
                };
                const newState = reducer(newStateWithThumbnails, action); // Call original reducer with updated state
                if (newState.layers === present) return newState; // No change
                return { ...newState, history: { past: [...past, present], present: newState.layers, future: [] } };
            }
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
    file: File | null;
    preset: Preset;
    onReset: () => void;
    onIsLoadingChange?: (isLoading: boolean, message: string) => void;
    setErrorMessage: (message: string) => void;
}

export const useImageEditorState = ({ file, preset, onReset, onIsLoadingChange, setErrorMessage }: UseImageEditorStateProps) => {
    const initialState: EditorState = {
        layers: [],
        activeLayerId: null,
        history: { past: [], present: [], future: [] },
        preset: preset,
        brushSettings: { size: 20, tool: 'pencil', opacity: 1, blur: 0 },
    };

    const [state, dispatch] = useReducer(finalReducer, initialState);

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
    }, [file, preset, setErrorMessage, state.history.past.length, state.history.present.length]);

    useEffect(() => {
        if (state.preset.width !== preset.width || state.preset.height !== preset.height) {
            dispatch({ type: 'UPDATE_PRESET', payload: preset });
        }
    }, [preset, state.preset.width, state.preset.height]);


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
            onReset();
        } else if (action.type === 'ADD_IMAGE_FROM_URL') {
            const { url, name } = action.payload;
            onIsLoadingChange?.(true, `Adding ${name}...`);
            fetch(url)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `${name}.png`, { type: 'image/png' });
                    return loadImage(file, state.preset);
                })
                .then(newLayer => {
                    const combinedLayers = [...state.layers, newLayer];
                    dispatch({ type: '_SET_LAYERS', payload: combinedLayers });
                    dispatch({ type: 'INTERACTION_START' });
                    onIsLoadingChange?.(false, "");
                })
                .catch(err => {
                    console.error("Failed to load image from URL:", err);
                    setErrorMessage("Could not load the requested image.");
                    onIsLoadingChange?.(false, "");
                });
        } else if (action.type === 'ADD_MASK_FILE') {
            const { layerId, file } = action.payload;
            onIsLoadingChange?.(true, "Loading mask...");
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    dispatch({ type: 'ADD_MASK', payload: { layerId, maskImage: img } });
                    dispatch({ type: 'INTERACTION_START' });
                    onIsLoadingChange?.(false, "");
                };
                img.onerror = () => {
                    setErrorMessage("Could not load mask image.");
                    onIsLoadingChange?.(false, "");
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        } else if (action.type === 'SET_LAYER_MASK_FILE') {
            const { layerId, file } = (action as any).payload;
            if (!file) {
                dispatch({ type: 'SET_LAYER_MASK', payload: { layerId, maskImage: null } });
                dispatch({ type: 'INTERACTION_START' });
                return;
            }

            onIsLoadingChange?.(true, "Loading mask...");
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    dispatch({ type: 'SET_LAYER_MASK', payload: { layerId, maskImage: img } });
                    dispatch({ type: 'INTERACTION_START' });
                    onIsLoadingChange?.(false, "");
                };
                img.onerror = () => {
                    setErrorMessage("Failed to load mask image.");
                    onIsLoadingChange?.(false, "");
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
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