import React, { useRef, useEffect, useCallback } from 'react';
import { Layer, Preset, EditorAction, EditorState } from '../types';
import { UploadIcon, ResetLayerIcon, UndoIcon, RedoIcon, EditIcon } from './icons';

interface CanvasProps {
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
    drawLayer: (ctx: CanvasRenderingContext2D, layer: Layer, canvasWidth: number, canvasHeight: number) => void;
    renderLayers: (ctx: CanvasRenderingContext2D, layerList: Layer[], canvasWidth: number, canvasHeight: number) => void;
}

const Canvas: React.FC<CanvasProps> = ({ state, dispatch, drawLayer, renderLayers }) => {
    const { layers, preset, activeLayerId, history, brushSettings } = state;
    const { past: undoStack, future: redoStack } = history;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDraggingOverCanvas, setIsDraggingOverCanvas] = React.useState(false);

    const isPanning = useRef(false);
    const isDrawing = useRef(false);
    const lastPosition = useRef({ x: 0, y: 0 });
    const isInteractingRef = useRef(false);
    const [previewPos, setPreviewPos] = React.useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);
    const { size: brushSize, tool: brushTool, opacity: brushOpacity, blur: brushBlur } = brushSettings;

    const activeLayer = layers.find(l => l.id === activeLayerId);
    const isMask = activeLayer?.type === 'mask';

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);
        try {
            renderLayers(context, layers, preset.width, preset.height);
        } catch (err) {
            console.error("Render failed:", err);
        }

        // Draw preview for shapes
        if (previewPos && (brushTool === 'rect' || brushTool === 'circle')) {
            context.save();

            context.setLineDash([5, 5]);
            context.strokeStyle = 'white';
            context.lineWidth = 2;
            const x = Math.min(previewPos.start.x, previewPos.end.x);
            const y = Math.min(previewPos.start.y, previewPos.end.y);
            const w = Math.abs(previewPos.start.x - previewPos.end.x);
            const h = Math.abs(previewPos.start.y - previewPos.end.y);

            if (brushTool === 'rect') {
                context.strokeRect(x, y, w, h);
            } else {
                const radius = Math.sqrt(Math.pow(previewPos.end.x - previewPos.start.x, 2) + Math.pow(previewPos.end.y - previewPos.start.y, 2));
                context.beginPath();
                context.arc(previewPos.start.x, previewPos.start.y, radius, 0, Math.PI * 2);
                context.stroke();
            }
            context.restore();
        }

    }, [layers, preset, renderLayers, previewPos, brushTool]);

    const handlePanMouseMove = useCallback((e: MouseEvent) => {
        if (!isPanning.current || !activeLayerId) return;
        if (activeLayer?.isLocked) return; // Lock guard
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
        if (!activeLayerId || !activeLayer) return;
        if (activeLayer.isLocked) return; // Lock guard - prevent all interactions
        e.preventDefault();

        if (isMask && brushTool !== 'move') {
            isDrawing.current = true;
            dispatch({ type: 'INTERACTION_START' });

            const rect = canvasRef.current!.getBoundingClientRect();
            const scaleX = canvasRef.current!.width / rect.width;
            const scaleY = canvasRef.current!.height / rect.height;
            const worldX = (e.clientX - rect.left) * scaleX;
            const worldY = (e.clientY - rect.top) * scaleY;

            const getLocalPos = (wx: number, wy: number) => {
                const { x: tx, y: ty, scale, rotation } = activeLayer.transform;
                const dx = wx - tx;
                const dy = wy - ty;
                const rad = -(rotation || 0) * Math.PI / 180;
                const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
                const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
                return { lx: rx / scale, ly: ry / scale };
            };

            const startLocal = getLocalPos(worldX, worldY);
            lastPosition.current = { x: startLocal.lx, y: startLocal.ly };

            const canvas = activeLayer.maskCanvas || document.createElement('canvas');
            const layerWidth = activeLayer.image ? activeLayer.image.width : preset.width;
            const layerHeight = activeLayer.image ? activeLayer.image.height : preset.height;

            if (!activeLayer.maskCanvas) {
                canvas.width = layerWidth;
                canvas.height = layerHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Dispatch immediately so we have a state reference for the RAF loop to render
                dispatch({ type: 'UPDATE_MASK_CANVAS', payload: { layerId: activeLayerId, canvas: canvas } });
            }

            const ctx = canvas.getContext('2d');
            if (ctx) {
                const setupCtx = () => {
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.lineWidth = brushSize / activeLayer.transform.scale;

                    // Handle Eraser (Conceal) vs Paint (Reveal/Grey)
                    if (brushOpacity === 0) {
                        ctx.globalCompositeOperation = 'destination-out';
                        ctx.globalAlpha = 1;
                    } else {
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.globalAlpha = brushOpacity;
                    }

                    if (brushBlur > 0) {
                        // Use ctx.filter for superior softness on both strokes and shapes
                        const blurVal = (brushBlur * 0.5) / activeLayer.transform.scale;
                        ctx.filter = `blur(${blurVal}px)`;
                    } else {
                        ctx.filter = 'none';
                    }
                    ctx.shadowBlur = 0; // Clear legacy shadowBlur
                    ctx.strokeStyle = 'white';
                    ctx.fillStyle = 'white';
                };

                const halfW = canvas.width / 2;
                const halfH = canvas.height / 2;

                if (brushTool === 'pencil') {
                    setupCtx();
                    ctx.beginPath();
                    ctx.moveTo(startLocal.lx + halfW, startLocal.ly + halfH);
                    ctx.lineTo(startLocal.lx + halfW, startLocal.ly + halfH);
                    ctx.stroke();
                    // Initial render for click-dots
                    requestAnimationFrame(() => {
                        const c = canvasRef.current;
                        const cx = c?.getContext('2d');
                        if (c && cx) {
                            cx.clearRect(0, 0, c.width, c.height);
                            renderLayers(cx, layers, preset.width, preset.height);
                        }
                    });
                }

                const handleMouseMove = (me: MouseEvent) => {
                    if (!isDrawing.current) return;
                    const rectM = canvasRef.current!.getBoundingClientRect();
                    const scaleXM = canvasRef.current!.width / rectM.width;
                    const scaleYM = canvasRef.current!.height / rectM.height;
                    const mWX = (me.clientX - rectM.left) * scaleXM;
                    const mWY = (me.clientY - rectM.top) * scaleYM;
                    const mLocal = getLocalPos(mWX, mWY);

                    if (brushTool === 'pencil') {
                        setupCtx();
                        ctx.beginPath();
                        ctx.moveTo(lastPosition.current.x + halfW, lastPosition.current.y + halfH);
                        ctx.lineTo(mLocal.lx + halfW, mLocal.ly + halfH);
                        ctx.stroke();
                        lastPosition.current = { x: mLocal.lx, y: mLocal.ly };

                        // Optimize: Use RAF instead of dispatch
                        requestAnimationFrame(() => {
                            const c = canvasRef.current;
                            const cx = c?.getContext('2d');
                            if (c && cx) {
                                cx.clearRect(0, 0, c.width, c.height);
                                renderLayers(cx, layers, preset.width, preset.height);
                            }
                        });

                    } else if (brushTool === 'rect' || brushTool === 'circle') {
                        setPreviewPos({ start: { x: worldX, y: worldY }, end: { x: mWX, y: mWY } });
                    }
                    // REMOVED dispatch from loop
                };

                const handleMouseUp = (me: MouseEvent) => {
                    isDrawing.current = false;
                    setPreviewPos(null);
                    window.removeEventListener('mousemove', handleMouseMove);
                    window.removeEventListener('mouseup', handleMouseUp);

                    if (brushTool === 'rect' || brushTool === 'circle') {
                        const rectU = canvasRef.current!.getBoundingClientRect();
                        const scaleXU = canvasRef.current!.width / rectU.width;
                        const scaleYU = canvasRef.current!.height / rectU.height;
                        const mWX = (me.clientX - rectU.left) * scaleXU;
                        const mWY = (me.clientY - rectU.top) * scaleYU;
                        const mLocal = getLocalPos(mWX, mWY);

                        setupCtx();
                        if (brushTool === 'rect') {
                            const lx1 = Math.min(startLocal.lx, mLocal.lx) + halfW;
                            const ly1 = Math.min(startLocal.ly, mLocal.ly) + halfH;
                            const lw = Math.abs(mLocal.lx - startLocal.lx);
                            const lh = Math.abs(mLocal.ly - startLocal.ly);
                            ctx.fillRect(lx1, ly1, lw, lh);
                        } else {
                            // Center-based circle
                            const centerX = startLocal.lx + halfW;
                            const centerY = startLocal.ly + halfH;
                            const radius = Math.sqrt(Math.pow(mLocal.lx - startLocal.lx, 2) + Math.pow(mLocal.ly - startLocal.ly, 2));

                            ctx.beginPath();
                            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    // Final commit
                    dispatch({ type: 'UPDATE_MASK_CANVAS', payload: { layerId: activeLayerId, canvas: canvas } });
                };

                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);
            }

        } else {
            dispatch({ type: 'INTERACTION_START' });
            isPanning.current = true;
            lastPosition.current = { x: e.clientX, y: e.clientY };
            window.addEventListener('mousemove', handlePanMouseMove);
            window.addEventListener('mouseup', handlePanMouseUp);
        }
    }, [activeLayerId, activeLayer, preset, dispatch, handlePanMouseMove, handlePanMouseUp, brushSize, brushTool, brushOpacity, brushBlur]);
    // Track mouse for custom cursor using Ref for performance (avoid re-renders)
    const cursorRef = useRef<HTMLDivElement>(null);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!activeLayer) return;

        // Update visual cursor position directly
        if (cursorRef.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            cursorRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;

            // Toggle visibility based on tool
            const shouldShow = isMask && (brushTool === 'pencil' || brushTool === 'eraser');
            cursorRef.current.style.display = shouldShow ? 'block' : 'none';
        }
    }, [activeLayer, isMask, brushTool]);

    const handleCanvasMouseLeave = useCallback(() => {
        if (cursorRef.current) cursorRef.current.style.display = 'none';
    }, []);

    // Width/Height logic for cursor
    useEffect(() => {
        if (!cursorRef.current || !activeLayer || !canvasRef.current) return;
        // Check visibility again on sizing update
        if (!isMask || (brushTool !== 'pencil' && brushTool !== 'eraser')) {
            cursorRef.current.style.display = 'none';
            return;
        }

        const rect = canvasRef.current.getBoundingClientRect();
        const globalScale = rect.width / preset.width;
        // Cursor shows fixed brush size, only scaled by viewport (not layer zoom)
        const diameter = brushSize * globalScale;

        cursorRef.current.style.width = `${diameter}px`;
        cursorRef.current.style.height = `${diameter}px`;
    }, [brushSize, activeLayer, preset.width, isMask, brushTool]); // Update size when these change

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || !activeLayerId) return;
        if (activeLayer?.isLocked) return; // Lock guard

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
                if (e.shiftKey) dispatch({ type: 'REDO' });
                else dispatch({ type: 'UNDO' });
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

        const assetData = e.dataTransfer.getData('application/x-banner-wizzard-asset');
        if (assetData) {
            try {
                const asset = JSON.parse(assetData);
                dispatch({ type: 'ADD_IMAGE_FROM_URL', payload: { url: asset.url, name: asset.name } });
                return;
            } catch (err) {
                console.error("Failed to parse dropped asset data:", err);
            }
        }

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            dispatch({ type: 'ADD_IMAGE_LAYERS', payload: { files: Array.from(files) } });
        }
    }, [dispatch]);

    // Correct CSS Cursor Logic: 
    // Move Tool -> 'move'
    // Mask Brush/Eraser -> 'none' (we use custom cursor)
    // Mask Shapes -> 'crosshair'
    // Default Panning -> 'grab'/'grabbing'
    const getCanvasCursor = () => {
        if (!activeLayerId) return 'default';
        if (brushTool === 'move') return 'move';
        if (isMask) {
            if (brushTool === 'pencil' || brushTool === 'eraser') return 'none'; // Custom cursor
            return 'crosshair'; // Shapes
        }
        return isPanning.current ? 'grabbing' : 'grab';
    };

    return (
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
            {/* ... buttons ... */}
            <div className="w-full flex items-center justify-center gap-3 bg-gray-800 p-2 rounded-lg">
                <button onClick={() => dispatch({ type: 'UNDO' })} disabled={undoStack.length === 0} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"><UndoIcon className="w-5 h-5" /> Undo</button>
                <button onClick={() => dispatch({ type: 'REDO' })} disabled={redoStack.length === 0} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"><RedoIcon className="w-5 h-5" /> Redo</button>
                <button onClick={() => dispatch({ type: 'RESET_ACTIVE_LAYER' })} disabled={!activeLayerId} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"><ResetLayerIcon className="w-5 h-5" /> Reset Layer</button>
                <button onClick={() => dispatch({ type: 'RESET_STATE' })} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition" title="Start over"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg> Start Over</button>
            </div>
            <div className="w-full flex-grow flex items-center justify-center bg-gray-900/50 rounded-lg p-2 shadow-inner relative overflow-hidden" onDragEnter={handleCanvasDragEnter} onDragLeave={handleCanvasDragLeave} onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop} onMouseMove={handleCanvasMouseMove} onMouseLeave={handleCanvasMouseLeave}>
                {/* Visual Cursor Element - Positioned via Ref */}
                <div
                    ref={cursorRef}
                    className="absolute pointer-events-none border border-white rounded-full shadow-[0_0_2px_rgba(0,0,0,0.5)] z-50"
                    style={{ position: 'absolute', top: 0, left: 0, display: 'none' }} // Initial hidden state
                />
                <canvas ref={canvasRef} width={preset.width} height={preset.height} className="max-w-full max-h-[80vh] object-contain shadow-2xl bg-checkered-pattern" style={{ aspectRatio: `${preset.width} / ${preset.height}`, backgroundSize: '30px 30px', backgroundImage: 'linear-gradient(45deg, #2d3748 25%, transparent 25%), linear-gradient(-45deg, #2d3748 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2d3748 75%), linear-gradient(-45deg, transparent 75%, #2d3748 75%)', cursor: getCanvasCursor() }} onMouseDown={handleMouseDown} />
                {layers.length === 0 && !isDraggingOverCanvas && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-500">
                        <UploadIcon className="w-12 h-12 mb-2 opacity-50" />
                        <p className="text-lg font-medium">Drop or Paste Image to begin</p>
                        <p className="text-sm opacity-70">or add a color layer from the right</p>
                    </div>
                )}
                {isDraggingOverCanvas && (<div className="absolute inset-0 bg-blue-500/50 border-4 border-dashed border-blue-300 rounded-lg flex flex-col items-center justify-center pointer-events-none"><UploadIcon className="w-16 h-16 text-white" /><p className="text-xl font-bold text-white mt-2">Drop image to add new layer</p></div>)}
            </div>
        </div>
    );
};

export default Canvas;
