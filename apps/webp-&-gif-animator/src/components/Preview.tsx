import React, { useRef, useEffect, useState } from 'react';
import type { Frame, AnimationSettings, CropSettings } from '../types';
import { drawFrameToCanvas } from '../utils/render';

interface PreviewProps {
  frames: Frame[];
  settings: AnimationSettings;
  isPlaying: boolean;
  onFrameChange: (index: number) => void;
  currentFrameIndex: number;
  onUpdateCrop: (crop: CropSettings) => void;
  onUpdateTextPosition: (x: number, y: number) => void;
  isCropMode: boolean;
}

const Preview: React.FC<PreviewProps> = ({ 
  frames, 
  settings, 
  isPlaying, 
  onFrameChange,
  currentFrameIndex,
  onUpdateCrop,
  onUpdateTextPosition,
  isCropMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);
  
  // Use a ref to track the "visual" index to prevent stutter when React state lags behind RAF
  const displayIndexRef = useRef(currentFrameIndex);
  
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [isResizingCrop, setIsResizingCrop] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const viewTransform = useRef({ scale: 1, offsetX: 0, offsetY: 0, minX: 0, minY: 0 });
  
  const currentFrame = frames[currentFrameIndex];
  const activeCrop = currentFrame?.crop || { x: 0, y: 0, width: 100, height: 100, isCustom: false };

  // Sync display index with prop
  useEffect(() => {
    displayIndexRef.current = currentFrameIndex;
  }, [currentFrameIndex]);

  // Observe Container Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update Canvas Size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isCropMode) {
        canvas.width = containerSize.width || 800;
        canvas.height = containerSize.height || 600;
    } else {
        canvas.width = settings.width;
        canvas.height = settings.height;
    }
  }, [settings.width, settings.height, isCropMode, containerSize]);

  const measureTextBounds = (ctx: CanvasRenderingContext2D, textOverlay: typeof settings.textOverlay) => {
      ctx.font = `bold ${textOverlay.fontSize}px "${textOverlay.font}", sans-serif`;
      const lines = textOverlay.content.split('\n');
      let maxWidth = 0;
      lines.forEach(line => {
          const metrics = ctx.measureText(line);
          if (metrics.width > maxWidth) maxWidth = metrics.width;
      });
      const lineHeightPx = textOverlay.fontSize * textOverlay.lineHeight;
      const totalHeight = lineHeightPx * lines.length;
      return { width: maxWidth, height: totalHeight };
  };

  const drawCropMode = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      const canvas = ctx.canvas;
      const minX = Math.min(0, activeCrop.x);
      const minY = Math.min(0, activeCrop.y);
      const maxX = Math.max(img.width, activeCrop.x + activeCrop.width);
      const maxY = Math.max(img.height, activeCrop.y + activeCrop.height);
      
      const boundW = maxX - minX;
      const boundH = maxY - minY;

      const scale = Math.min(canvas.width / boundW, canvas.height / boundH) * 0.9;
      
      const drawOffsetX = (canvas.width - boundW * scale) / 2 - (minX * scale);
      const drawOffsetY = (canvas.height - boundH * scale) / 2 - (minY * scale);

      viewTransform.current = { scale, offsetX: drawOffsetX, offsetY: drawOffsetY, minX, minY };

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cropScreenX = drawOffsetX + activeCrop.x * scale;
      const cropScreenY = drawOffsetY + activeCrop.y * scale;
      const cropScreenW = activeCrop.width * scale;
      const cropScreenH = activeCrop.height * scale;

      ctx.fillStyle = settings.backgroundColor;
      ctx.fillRect(cropScreenX, cropScreenY, cropScreenW, cropScreenH);

      const imgScreenX = drawOffsetX; 
      const imgScreenY = drawOffsetY;
      const imgScreenW = img.width * scale;
      const imgScreenH = img.height * scale;
      
      ctx.drawImage(img, imgScreenX, imgScreenY, imgScreenW, imgScreenH);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      
      ctx.fillRect(0, 0, canvas.width, cropScreenY);
      ctx.fillRect(0, cropScreenY + cropScreenH, canvas.width, canvas.height - (cropScreenY + cropScreenH));
      ctx.fillRect(0, cropScreenY, cropScreenX, cropScreenH);
      ctx.fillRect(cropScreenX + cropScreenW, cropScreenY, canvas.width - (cropScreenX + cropScreenW), cropScreenH);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cropScreenX + cropScreenW/3, cropScreenY); ctx.lineTo(cropScreenX + cropScreenW/3, cropScreenY + cropScreenH);
      ctx.moveTo(cropScreenX + 2*cropScreenW/3, cropScreenY); ctx.lineTo(cropScreenX + 2*cropScreenW/3, cropScreenY + cropScreenH);
      ctx.moveTo(cropScreenX, cropScreenY + cropScreenH/3); ctx.lineTo(cropScreenX + cropScreenW, cropScreenY + cropScreenH/3);
      ctx.moveTo(cropScreenX, cropScreenY + 2*cropScreenH/3); ctx.lineTo(cropScreenX + cropScreenW, cropScreenY + 2*cropScreenH/3);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8'; 
      ctx.lineWidth = 2;
      ctx.strokeRect(cropScreenX, cropScreenY, cropScreenW, cropScreenH);
      
      const handleSize = 8;
      ctx.fillStyle = '#fff'; 
      const drawHandle = (hx: number, hy: number) => {
          ctx.beginPath();
          ctx.arc(hx, hy, handleSize/2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
      };
      
      drawHandle(cropScreenX, cropScreenY); 
      drawHandle(cropScreenX + cropScreenW, cropScreenY); 
      drawHandle(cropScreenX, cropScreenY + cropScreenH); 
      drawHandle(cropScreenX + cropScreenW, cropScreenY + cropScreenH); 
  };

  // Main Render (Static view)
  useEffect(() => {
    if (isPlaying) return;

    if (frames.length === 0 || !currentFrame) {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#475569';
                ctx.font = '16px Inter sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('No frames loaded', canvas.width / 2, canvas.height / 2);
            }
        }
        return;
    }

    const url = currentFrame.previewUrl;
    let img = imageCache.current.get(url);

    if (img && img.complete) {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            if (isCropMode) {
                drawCropMode(ctx, img);
            } else {
                drawFrameToCanvas(
                    ctx, settings.width, settings.height, 
                    currentFrame, img, settings, 
                    undefined, 0, currentFrameIndex
                );
            }
        }
    } else {
        img = new Image();
        img.src = url;
        img.onload = () => {
            imageCache.current.set(url, img!);
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) {
                if (isCropMode) drawCropMode(ctx, img!);
                else drawFrameToCanvas(ctx, settings.width, settings.height, currentFrame, img!, settings, undefined, 0, currentFrameIndex);
            }
        };
    }
  }, [frames, currentFrameIndex, settings, isCropMode, activeCrop, containerSize, isPlaying]);

  // Animation Loop
  useEffect(() => {
    if (!isPlaying || frames.length === 0 || isCropMode) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = 0;
      accumulatedTimeRef.current = 0;
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      accumulatedTimeRef.current += deltaTime;

      // Safe access to frames using modulo to prevent out of bounds
      const idx = displayIndexRef.current % frames.length;
      const cf = frames[idx];
      
      // Safety check if frame is missing
      if (!cf) {
         requestRef.current = requestAnimationFrame(animate);
         return;
      }

      const frameDuration = settings.frameDuration * (cf.durationMultiplier || 1);
      
      const url = cf.previewUrl;
      let img = url ? imageCache.current.get(url) : null;
      if (url && !img) { img = new Image(); img.src = url; imageCache.current.set(url, img); }

      if (img && img.complete && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
              let nextImgData: { frame: Frame, image: HTMLImageElement } | undefined = undefined;
              let alpha = 0;
              const nextIndex = (idx + 1) % frames.length;

              if (settings.transitionType === 'crossfade' && settings.transitionDuration > 0) {
                  const fadeStart = Math.max(0, frameDuration - settings.transitionDuration);
                  if (accumulatedTimeRef.current > fadeStart) {
                      const progress = (accumulatedTimeRef.current - fadeStart) / settings.transitionDuration;
                      alpha = Math.max(0, Math.min(1, progress));
                      
                      const nextUrl = frames[nextIndex].previewUrl;
                      let nextImg = imageCache.current.get(nextUrl);
                      if (!nextImg) { nextImg = new Image(); nextImg.src = nextUrl; imageCache.current.set(nextUrl, nextImg); }
                      
                      if (nextImg) {
                          nextImgData = { frame: frames[nextIndex], image: nextImg };
                      }
                  }
              }

              drawFrameToCanvas(
                  ctx, settings.width, settings.height, 
                  cf, img, settings, 
                  nextImgData, alpha, 
                  idx, nextIndex
              );
          }
      }

      if (accumulatedTimeRef.current >= frameDuration) {
        accumulatedTimeRef.current -= frameDuration;
        let nextIndex = idx + 1;
        if (nextIndex >= frames.length) {
           nextIndex = settings.loop ? 0 : frames.length - 1;
        }
        displayIndexRef.current = nextIndex;
        onFrameChange(nextIndex);
      }
      
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, frames, settings, isCropMode, onFrameChange]); 

  // --- Interaction (Dragging/Resizing) ---
  const getEventCoords = (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      if (frames.length === 0) return;
      const { x, y } = getEventCoords(e);
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (isCropMode) {
         const transform = viewTransform.current;
         const scale = transform.scale;
         const cx = transform.offsetX + (activeCrop.x * scale);
         const cy = transform.offsetY + (activeCrop.y * scale);
         const cw = activeCrop.width * scale;
         const ch = activeCrop.height * scale;
         const handleSize = 20; 

         if (Math.abs(x - cx) < handleSize && Math.abs(y - cy) < handleSize) { setIsResizingCrop(true); setResizeHandle('tl'); setDragStart({x, y}); e.currentTarget.setPointerCapture(e.pointerId); return; }
         if (Math.abs(x - (cx + cw)) < handleSize && Math.abs(y - cy) < handleSize) { setIsResizingCrop(true); setResizeHandle('tr'); setDragStart({x, y}); e.currentTarget.setPointerCapture(e.pointerId); return; }
         if (Math.abs(x - cx) < handleSize && Math.abs(y - (cy + ch)) < handleSize) { setIsResizingCrop(true); setResizeHandle('bl'); setDragStart({x, y}); e.currentTarget.setPointerCapture(e.pointerId); return; }
         if (Math.abs(x - (cx + cw)) < handleSize && Math.abs(y - (cy + ch)) < handleSize) { setIsResizingCrop(true); setResizeHandle('br'); setDragStart({x, y}); e.currentTarget.setPointerCapture(e.pointerId); return; }

         if (x > cx && x < cx + cw && y > cy && y < cy + ch) { setIsDraggingCrop(true); setDragStart({ x, y }); e.currentTarget.setPointerCapture(e.pointerId); }
      } else {
         if (settings.textOverlay.enabled) {
             const ctx = canvas.getContext('2d');
             if (ctx) {
                 const bounds = measureTextBounds(ctx, settings.textOverlay);
                 const tx = canvas.width * settings.textOverlay.x;
                 const ty = canvas.height * settings.textOverlay.y;
                 const startX = tx - bounds.width / 2;
                 const startY = ty - bounds.height / 2;
                 
                 if (x >= startX && x <= startX + bounds.width && y >= startY && y <= startY + bounds.height) {
                     setIsDraggingText(true);
                     setDragOffset({ x: x - tx, y: y - ty });
                     e.currentTarget.setPointerCapture(e.pointerId);
                 }
             }
         }
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDraggingText && !isDraggingCrop && !isResizingCrop) return;
      const { x, y } = getEventCoords(e);
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (isDraggingText) {
          const newTx = x - dragOffset.x;
          const newTy = y - dragOffset.y;
          onUpdateTextPosition(newTx / canvas.width, newTy / canvas.height);
      } else if (isCropMode && frames.length > 0) {
          const transform = viewTransform.current;
          const scale = transform.scale;
          
          if (isDraggingCrop) {
              const dx = (x - dragStart.x) / scale;
              const dy = (y - dragStart.y) / scale;
              onUpdateCrop({ ...activeCrop, x: activeCrop.x + dx, y: activeCrop.y + dy, isCustom: true });
              setDragStart({ x, y });
          } else if (isResizingCrop) {
              const dx = (x - dragStart.x) / scale;
              const dy = (y - dragStart.y) / scale;
              
              let anchorX = 0, anchorY = 0, currentCornerX = 0, currentCornerY = 0;
              if (resizeHandle === 'tl') { anchorX = activeCrop.x + activeCrop.width; anchorY = activeCrop.y + activeCrop.height; currentCornerX = activeCrop.x; currentCornerY = activeCrop.y; }
              else if (resizeHandle === 'tr') { anchorX = activeCrop.x; anchorY = activeCrop.y + activeCrop.height; currentCornerX = activeCrop.x + activeCrop.width; currentCornerY = activeCrop.y; }
              else if (resizeHandle === 'bl') { anchorX = activeCrop.x + activeCrop.width; anchorY = activeCrop.y; currentCornerX = activeCrop.x; currentCornerY = activeCrop.y + activeCrop.height; }
              else if (resizeHandle === 'br') { anchorX = activeCrop.x; anchorY = activeCrop.y; currentCornerX = activeCrop.x + activeCrop.width; currentCornerY = activeCrop.y + activeCrop.height; }

              let proposedX = currentCornerX + dx;
              let proposedY = currentCornerY + dy;
              let newW = Math.abs(proposedX - anchorX);
              let newH = Math.abs(proposedY - anchorY);

              if (settings.aspectRatio !== 'free' && settings.aspectRatio !== 'original') {
                  const [wR, hR] = settings.aspectRatio.split(':').map(Number);
                  newH = newW / (wR / hR);
              }

              if (newW < 20) newW = 20; if (newH < 20) newH = 20;

              let finalX = (proposedX < anchorX || (resizeHandle === 'tl' || resizeHandle === 'bl')) ? anchorX - newW : anchorX;
              let finalY = (proposedY < anchorY || (resizeHandle === 'tl' || resizeHandle === 'tr')) ? anchorY - newH : anchorY;
              
              onUpdateCrop({ ...activeCrop, x: finalX, y: finalY, width: newW, height: newH, isCustom: true });
              setDragStart({ x, y });
          }
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      setIsDraggingText(false); setIsDraggingCrop(false); setIsResizingCrop(false); setResizeHandle(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const getCursor = () => {
    if (isDraggingText) return 'grabbing';
    if (isResizingCrop) return 'nwse-resize'; 
    if (isDraggingCrop) return 'move';
    if (isCropMode) return 'crosshair';
    return 'default';
  }

  const canvasStyle: React.CSSProperties = {
      width: '100%', height: '100%', objectFit: 'contain', cursor: getCursor(), touchAction: 'none'
  };

  return (
    <div className="relative w-full h-full flex flex-col gap-2">
        <div ref={containerRef} className="flex-1 w-full flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden select-none">
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #334155 25%, transparent 25%), linear-gradient(-45deg, #334155 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #334155 75%), linear-gradient(-45deg, transparent 75%, #334155 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}></div>
            <canvas ref={canvasRef} className="shadow-2xl shadow-black/50 z-10" style={canvasStyle} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
            {settings.textOverlay.enabled && !isCropMode && <div className="absolute top-4 left-4 bg-black/50 backdrop-blur text-white text-[10px] px-2 py-1 rounded pointer-events-none border border-white/10">Drag text to move</div>}
             {isCropMode && <div className="absolute bottom-4 bg-black/70 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full pointer-events-none border border-white/10 shadow-lg">Drag box to move • Drag corners to resize</div>}
        </div>
        <div className="h-6 flex items-center justify-end px-2">
             <div className="text-[10px] text-slate-500 font-mono">{isCropMode ? `Source: ${frames[currentFrameIndex]?.file.name ?? 'Image'}` : `Output: ${settings.width}x${settings.height}`}</div>
        </div>
    </div>
  );
};

export default Preview;