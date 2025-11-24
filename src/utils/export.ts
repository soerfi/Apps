import type { AnimationSettings, Frame } from '../types';
import { createAnimatedWebP } from './webpMuxer';
import { createGIF } from './gifExporter';
import { base64ToUint8Array, loadImage } from './image';
import { drawFrameToCanvas } from './render';

export const exportAnimation = async (
    frames: Frame[],
    settings: AnimationSettings,
    format: 'webp' | 'gif',
    onProgress?: (msg: string) => void
): Promise<void> => {
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = settings.width;
    exportCanvas.height = settings.height;
    const ctx = exportCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create canvas context");

    // 1. Preload Images
    onProgress?.("Loading images...");
    const images: HTMLImageElement[] = await Promise.all(frames.map(f => loadImage(f.previewUrl)));

    // 2. Render Frames
    const renderedFramesData: { imageData: ImageData, duration: number, data: Uint8ClampedArray }[] = [];
    const baseFrameMs = settings.frameDuration;

    onProgress?.("Rendering frames...");
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const image = images[i];
        const frameDuration = Math.max(1, baseFrameMs * frame.durationMultiplier);
        const transDuration = settings.transitionType === 'crossfade' ? settings.transitionDuration : 0;
        
        const nextIndex = (i + 1) % frames.length;
        const nextFrame = frames[nextIndex];
        const nextImage = images[nextIndex];

        const isLastFrame = i === frames.length - 1;
        const shouldTransition = settings.transitionType === 'crossfade' && frames.length > 1 && (!isLastFrame || settings.loop);

        if (!shouldTransition) {
            // Static Frame
            drawFrameToCanvas(ctx, settings.width, settings.height, frame, image, settings, undefined, 0, i, nextIndex);
            const imageData = ctx.getImageData(0, 0, settings.width, settings.height);
            renderedFramesData.push({
                imageData: imageData,
                duration: frameDuration,
                data: imageData.data
            });
        } else {
            // Static part of frame (Frame time - Transition time)
            const staticTime = Math.max(0, frameDuration - transDuration);
            if (staticTime > 0) {
                drawFrameToCanvas(ctx, settings.width, settings.height, frame, image, settings, undefined, 0, i, nextIndex);
                const imageData = ctx.getImageData(0, 0, settings.width, settings.height);
                renderedFramesData.push({
                    imageData: imageData,
                    duration: staticTime,
                    data: imageData.data
                });
            }

            // Transition part
            const stepMs = 50; // Rendering resolution for fade
            const steps = Math.floor(Math.min(frameDuration, transDuration) / stepMs);
            
            if (steps > 0) {
                for (let s = 1; s <= steps; s++) {
                    const alpha = s / steps;
                    drawFrameToCanvas(
                        ctx, settings.width, settings.height, 
                        frame, image, settings, 
                        { frame: nextFrame, image: nextImage }, 
                        alpha, i, nextIndex
                    );
                    const imageData = ctx.getImageData(0, 0, settings.width, settings.height);
                    renderedFramesData.push({
                        imageData: imageData,
                        duration: stepMs,
                        data: imageData.data
                    });
                }
            }
        }
    }
    
    // 3. Encode & Optimize
    let currentQuality = settings.quality;
    // Force lossy for WebP if optimization is needed
    if (settings.maxFileSize > 0 && format === 'webp' && currentQuality > 90) {
        currentQuality = 90; 
    }

    let attempt = 0;
    let blob: Blob | null = null;
    const MAX_RETRIES = 10;
    
    console.log(`[Export Start] Format: ${format}, Target Max Size: ${settings.maxFileSize} bytes`);

    while (attempt < MAX_RETRIES) {
        attempt++;
        onProgress?.(`Encoding... Attempt ${attempt} (Quality: ${currentQuality}%)`);

        if (format === 'webp') {
            const framesForWebP = renderedFramesData.map(f => {
                    const tmpCanvas = document.createElement('canvas');
                    tmpCanvas.width = settings.width;
                    tmpCanvas.height = settings.height;
                    const tmpCtx = tmpCanvas.getContext('2d')!;
                    tmpCtx.putImageData(f.imageData, 0, 0);
                    
                    let q = currentQuality / 100;
                    if (settings.maxFileSize > 0) {
                        q = Math.min(0.9, q); // Cap to ensure lossy
                    }
                    const qualityParam = Math.max(0.01, q);

                    const dataUrl = tmpCanvas.toDataURL('image/webp', qualityParam);
                    const data = base64ToUint8Array(dataUrl);
                    return { data, duration: f.duration };
            });
            
            blob = await createAnimatedWebP(framesForWebP, settings.width, settings.height, settings.loop);
        } else {
            const framesForGif = renderedFramesData.map(f => ({
                data: f.data,
                width: settings.width,
                height: settings.height,
                delay: f.duration
            }));
            blob = await createGIF(framesForGif, settings.width, settings.height, settings.loop, currentQuality);
        }

        // Optimization check
        if (blob && settings.maxFileSize > 0) {
            if (blob.size <= settings.maxFileSize) {
                console.log(`[Success] File size: ${blob.size} <= ${settings.maxFileSize}`);
                break; 
            } else {
                const ratio = blob.size / settings.maxFileSize;
                let dropAmount = 5;
                if (ratio > 4.0) dropAmount = 40; 
                else if (ratio > 3.0) dropAmount = 30;
                else if (ratio > 2.0) dropAmount = 20;
                else if (ratio > 1.3) dropAmount = 10;
                else dropAmount = 5;

                console.warn(`[Retry] Size: ${(blob.size/1024).toFixed(1)}KB > ${(settings.maxFileSize/1024).toFixed(1)}KB (Ratio: ${ratio.toFixed(2)}). Reducing quality by ${dropAmount}.`);
                currentQuality = Math.max(1, currentQuality - dropAmount);
                if (currentQuality <= 1 && attempt < MAX_RETRIES) {
                        console.warn("Quality too low, stopping optimization.");
                        break;
                }
            }
        } else {
            break; 
        }
    }

    if (blob) {
        const filename = `Anim-${settings.width}x${settings.height}-${currentQuality}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    } else {
        throw new Error("Failed to generate blob");
    }
};