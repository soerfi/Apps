import React, { useRef, useEffect, useCallback } from 'react';
import { Layer, Preset } from '../types';
import { EditorAction } from '../hooks/useImageEditorState';
import { UploadIcon, ResetIcon, UndoIcon, RedoIcon } from './icons';

interface CanvasProps {
    layers: Layer[];
    preset: Preset;
    activeLayerId: string | null;
    dispatch: React.Dispatch<EditorAction>;
    undoStack: Layer[][];
    redoStack: Layer[][];
    drawLayer: (ctx: CanvasRenderingContext2D, layer: Layer, canvasWidth: number, canvasHeight: number) => void;
}

const Canvas: React.FC<CanvasProps> = ({ layers, preset, activeLayerId, dispatch, undoStack, redoStack, drawLayer }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDraggingOverCanvas, setIsDraggingOverCanvas] = React.useState(false);
    
    const isPanning = useRef(false);
    const lastPosition = useRef({ x: 0, y: 0 });
    const isInteractingRef = useRef(false);

    const activeLayer = layers.find(l => l.id === activeLayerId);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);

        layers.forEach(layer => {
            drawLayer(context, layer, preset.width, preset.height);
        });

    }, [layers, preset, drawLayer]);

    const applySnapping = useCallback((x: number, y: number, scale: number, ctrlKey: boolean) => {
        if (!activeLayer || ctrlKey || !activeLayer.image) {
          return { x, y };
        }
        
        const snapThreshold = 10;
        const { image } = activeLayer;
        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;
      
        const left = x - scaledWidth / 2;
        const right = x + scaledWidth / 2;
        const top = y - scaledHeight / 2;
        const bottom = y + scaledHeight / 2;
          
        let snappedX = x;
        let snappedY = y;
      
        if (Math.abs(left) < snapThreshold) snappedX = scaledWidth / 2;
        if (Math.abs(right - preset.width) < snapThreshold) snappedX = preset.width - scaledWidth / 2;
        if (Math.abs(top) < snapThreshold) snappedY = scaledHeight / 2;
        if (Math.abs(bottom - preset.height) < snapThreshold) snappedY = preset.height - scaledHeight / 2;
      
        return { x: snappedX, y: snappedY };
      }, [activeLayer, preset.width, preset.height]);
    
    const handlePanMouseMove = useCallback((e: MouseEvent) => {
        if (!isPanning.current || !activeLayerId) return;
        const dx = e.clientX - lastPosition.current.x;
        const dy = e.clientY - lastPosition.current.y;
        lastPosition.current = { x: e.clientX, y: e.clientY };

        dispatch({
            type: 'UPDATE_LAYER_TRANSFORM_RELATIVE',
            payload: {
                layerId: activeLayerId,
                delta: { dx, dy, dScale: 0, dRotation: 0 },
                options: { isSnapping: !e.ctrlKey }
            }
        });

    }, [activeLayerId, dispatch]);

    const handlePanMouseUp = useCallback(() => {
        isPanning.current = false;
        isInteractingRef.current = false;
        window.removeEventListener('mousemove', handlePanMouseMove);
        window.removeEventListener('mouseup', handlePanMouseUp);
    }, [handlePanMouseMove]);
    
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!activeLayerId) return;
        e.preventDefault();
        dispatch({ type: 'INTERACTION_START' });
        isPanning.current = true;
        lastPosition.current = { x: e.clientX, y: e.clientY };
        window.addEventListener('mousemove', handlePanMouseMove);
        window.addEventListener('mouseup', handlePanMouseUp);
    }, [activeLayerId, handlePanMouseMove, handlePanMouseUp, dispatch]);
    
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || !activeLayerId) return;

        dispatch({ type: 'INTERACTION_START' });

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        const dScale = 1 - e.deltaY * 0.001;

        dispatch({
            type: 'UPDATE_LAYER_SCALE_FROM_POINT',
            payload: {
                layerId: activeLayerId,
                point: { x: mouseX, y: mouseY },
                dScale: dScale,
                options: { isSnapping: !e.ctrlKey }
            }
        });
    }, [activeLayerId, dispatch]);

    useEffect(() => {
        const canvasElement = canvasRef.current;
        if (!canvasElement) return;

        const wheelHandler = (e: WheelEvent) => handleWheel(e);
        canvasElement.addEventListener('wheel', wheelHandler, { passive: false });

        return () => {
            canvasElement.removeEventListener('wheel', wheelHandler);
        };
    }, [handleWheel]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activeLayerId) return;
    
            const target = e.target as HTMLElement;
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    
            if (e.key.startsWith('Arrow')) {
                e.preventDefault();
                dispatch({ type: 'MOVE_ACTIVE_LAYER_WITH_KEYBOARD', payload: { key: e.key, shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey } });
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    dispatch({ type: 'REDO' });
                } else {
                    dispatch({ type: 'UNDO' });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeLayerId, dispatch]);

    const handleCanvasDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => e.preventDefault(), []);
    const handleCanvasDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingOverCanvas(true); }, []);
    const handleCanvasDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingOverCanvas(false); }, []);
    const handleCanvasDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOverCanvas(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            dispatch({ type: 'ADD_IMAGE_LAYERS', payload: { files: Array.from(files) }});
        }
    }, [dispatch]);
    
    return (
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
            <div className="w-full flex items-center justify-center gap-3 bg-gray-800 p-2 rounded-lg">
                 <button onClick={() => dispatch({ type: 'UNDO' })} disabled={undoStack.length === 0} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"><UndoIcon className="w-5 h-5" /> Undo</button>
                 <button onClick={() => dispatch({ type: 'REDO' })} disabled={redoStack.length === 0} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"><RedoIcon className="w-5 h-5" /> Redo</button>
                 <button onClick={() => dispatch({ type: 'RESET_ACTIVE_LAYER' })} disabled={!activeLayerId} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"><ResetIcon className="w-5 h-5" /> Reset Layer</button>
                 <button onClick={() => dispatch({ type: 'RESET_STATE' })} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition" title="Start over"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg> Start Over</button>
            </div>
            <div className="w-full flex-grow flex items-center justify-center bg-gray-900/50 rounded-lg p-2 shadow-inner relative" onDragEnter={handleCanvasDragEnter} onDragLeave={handleCanvasDragLeave} onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}>
                <canvas ref={canvasRef} width={preset.width} height={preset.height} className="max-w-full max-h-[80vh] object-contain shadow-2xl bg-checkered-pattern" style={{ aspectRatio: `${preset.width} / ${preset.height}`, backgroundSize: '30px 30px', backgroundImage: 'linear-gradient(45deg, #2d3748 25%, transparent 25%), linear-gradient(-45deg, #2d3748 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2d3748 75%), linear-gradient(-45deg, transparent 75%, #2d3748 75%)', cursor: activeLayerId ? (isPanning.current ? 'grabbing' : 'grab') : 'default' }} onMouseDown={handleMouseDown} />
                {isDraggingOverCanvas && (<div className="absolute inset-0 bg-blue-500/50 border-4 border-dashed border-blue-300 rounded-lg flex flex-col items-center justify-center pointer-events-none"><UploadIcon className="w-16 h-16 text-white" /><p className="text-xl font-bold text-white mt-2">Drop image to add new layer</p></div>)}
            </div>
        </div>
    );
};

export default Canvas;
