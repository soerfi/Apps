import type { AnimationSettings, Frame, TextOverlay } from '../types';

/**
 * Draws a single frame (or blended frames) to a canvas context.
 * Used by both the Preview component (during playback) and the Export engine.
 */
export const drawFrameToCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: Frame,
  image: HTMLImageElement,
  settings: AnimationSettings,
  nextFrame?: { frame: Frame, image: HTMLImageElement },
  blendAlpha: number = 0,
  currentFrameIndex: number = 0,
  nextFrameIndex: number = 0
) => {
    // 1. Clear / Background
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Helper to draw a single image layer
    const drawLayer = (
        f: Frame, 
        img: HTMLImageElement, 
        opacity: number
    ) => {
        ctx.save();
        ctx.globalAlpha = opacity;

        try {
            const srcX = f.crop.x;
            const srcY = f.crop.y;
            const srcW = f.crop.width;
            const srcH = f.crop.height;
            
            // Calculate Aspect Fit
            const scale = Math.min(width / srcW, height / srcH);
            const drawW = srcW * scale;
            const drawH = srcH * scale;
            const centerX = (width - drawW) / 2;
            const centerY = (height - drawH) / 2;

            const imgDestX = centerX + (-srcX * scale);
            const imgDestY = centerY + (-srcY * scale);
            const imgDestW = img.width * scale;
            const imgDestH = img.height * scale;

            ctx.drawImage(img, imgDestX, imgDestY, imgDestW, imgDestH);
        } catch(e) { 
            // Fallback
            ctx.drawImage(img, 0, 0, width, height);
        }
        ctx.restore();
    };

    // 2. Draw Images
    if (nextFrame && blendAlpha > 0) {
        if (blendAlpha >= 1) {
             // Fully transitioned to next frame
             drawLayer(nextFrame.frame, nextFrame.image, 1);
        } else {
             // Crossfade: Draw current frame, then draw next frame on top with opacity
             drawLayer(frame, image, 1);
             drawLayer(nextFrame.frame, nextFrame.image, blendAlpha);
        }
    } else {
        // Static
        drawLayer(frame, image, 1);
    }

    // 3. Draw Text Overlay
    const { textOverlay } = settings;
    if (textOverlay.enabled && textOverlay.content) {
        // Determine which frame index "controls" the text visibility during a fade
        // Usually we show text if the dominant frame dictates it
        const effectiveIndex = (blendAlpha > 0.5 && nextFrame) ? nextFrameIndex : currentFrameIndex;
        const start = textOverlay.startFrame - 1; 
        const end = textOverlay.endFrame - 1;

        if (effectiveIndex >= start && effectiveIndex <= end) {
            drawTextInternal(ctx, width, height, textOverlay);
        }
    }
};

const drawTextInternal = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    textOverlay: TextOverlay
) => {
    ctx.save();
    ctx.font = `bold ${textOverlay.fontSize}px "${textOverlay.font}", sans-serif`;
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = `${textOverlay.letterSpacing}px`;
    
    const tx = width * textOverlay.x;
    const ty = height * textOverlay.y;

    const lines = textOverlay.content.split('\n');
    const lineHeightPx = textOverlay.fontSize * textOverlay.lineHeight;
    const totalHeight = lineHeightPx * lines.length;
    const startY = ty - (totalHeight / 2) + (lineHeightPx / 2);

    // Setup Shadow
    if (textOverlay.hasShadow) {
        const hex = textOverlay.shadowColor;
        let shadowColor = hex;
        if (hex.startsWith('#') && hex.length === 7) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            shadowColor = `rgba(${r}, ${g}, ${b}, ${textOverlay.shadowOpacity})`;
        }
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = textOverlay.shadowBlur;
        ctx.shadowOffsetX = textOverlay.shadowOffsetX;
        ctx.shadowOffsetY = textOverlay.shadowOffsetY;
    }

    // Pass 1: Draw combined shape (Outline + Fill) with shadow
    lines.forEach((line, lineIdx) => {
        const ly = startY + (lineIdx * lineHeightPx);
        if (textOverlay.hasOutline) {
            ctx.strokeStyle = textOverlay.outlineColor;
            ctx.lineWidth = textOverlay.outlineWidth;
            ctx.lineJoin = 'round';
            ctx.strokeText(line, tx, ly);
        }
        ctx.fillStyle = textOverlay.color;
        ctx.fillText(line, tx, ly);
    });

    // Pass 2: Draw clean shape on top (removes shadow artifacts from center)
    if (textOverlay.hasShadow) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        lines.forEach((line, lineIdx) => {
            const ly = startY + (lineIdx * lineHeightPx);
            if (textOverlay.hasOutline) {
                ctx.strokeStyle = textOverlay.outlineColor;
                ctx.lineWidth = textOverlay.outlineWidth;
                ctx.lineJoin = 'round';
                ctx.strokeText(line, tx, ly);
            }
            ctx.fillStyle = textOverlay.color;
            ctx.fillText(line, tx, ly);
        });
    }
    ctx.restore();
};