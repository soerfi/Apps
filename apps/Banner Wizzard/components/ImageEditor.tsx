import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Preset, ExportOptions, ExportFormat, Layer } from '../types';
import { PRESET_CATEGORIES } from '../constants';
import { useImageEditorState } from '../hooks/useImageEditorState';
import PresetPanel from './PresetPanel';
import LayersPanel from './LayersPanel';
import PropertiesPanel from './PropertiesPanel';
import Canvas from './Canvas';
import { AssetLibrary } from './AssetLibrary';
import { Asset } from '../types';
import { SparklesIcon } from './icons';



interface ImageEditorProps {
  file: File | null;
  pastedFiles: File[];
  onProcessedPastedFiles: () => void;
  onIsLoadingChange: (isLoading: boolean, message: string) => void;
  setErrorMessage: (message: string) => void;
  onReset: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ file, pastedFiles, onProcessedPastedFiles, onIsLoadingChange, setErrorMessage, onReset }) => {
  const [preset, setPreset] = useState<Preset>(PRESET_CATEGORIES[0].presets[0]);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ format: 'image/jpeg', quality: 0.9 });
  const [maxFileSize, setMaxFileSize] = useState('');
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);

  const [state, dispatch] = useImageEditorState({ file, preset, onReset, onIsLoadingChange, setErrorMessage });
  const { layers, activeLayerId, undoStack, redoStack } = state;

  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null); // Optimization ref

  useEffect(() => {
    if (pastedFiles && pastedFiles.length > 0) {
      dispatch({ type: 'ADD_IMAGE_LAYERS', payload: { files: pastedFiles } });
      onProcessedPastedFiles?.();
    }
  }, [pastedFiles, dispatch, onProcessedPastedFiles]);

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const hasTransparency = layers.some(l => l.visible && ((l.image && l.hasTransparency) || l.opacity < 1));

  useEffect(() => {
    if (hasTransparency && exportOptions.format !== 'image/png' && exportOptions.format !== 'image/webp') {
      setExportOptions(prev => ({ ...prev, format: 'image/png' }));
    } else if (!hasTransparency && exportOptions.format === 'image/jpeg') {
      setExportOptions(prev => ({ ...prev, format: 'image/jpeg' }));
    }
  }, [hasTransparency, exportOptions.format, layers]);

  const dataURLtoBlob = (dataurl: string): Blob | null => {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const downloadImage = (data: string | Blob, baseName: string, format: ExportFormat) => {
    const blob = typeof data === 'string' ? dataURLtoBlob(data) : data;
    if (!blob) {
      setErrorMessage("Failed to process image for download.");
      return;
    }

    const url = URL.createObjectURL(blob);
    let ext = format.split('/')[1] || 'png';
    if (ext === 'jpeg') ext = 'jpg';

    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().getTime();
    link.download = `${baseName}-${preset.width}x${preset.height}-${timestamp}.${ext}`;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn("Could not clean up download link.", error);
      }
    }, 100);
  };

  const drawLayer = useCallback((ctx: CanvasRenderingContext2D, layer: Layer, canvasWidth: number, canvasHeight: number) => {
    if (!layer.visible) return;

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';

    const { dropShadow, outerGlow } = layer.styles || {};

    const hexToRgba = (hex: string, alpha: number) => {
      if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return `rgba(0,0,0,${alpha})`;
      let c = hex.substring(1).split('');
      if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      const numerical = parseInt(`0x${c.join('')}`);
      return `rgba(${(numerical >> 16) & 255},${(numerical >> 8) & 255},${numerical & 255},${alpha})`;
    };

    if (dropShadow?.enabled) {
      ctx.shadowColor = hexToRgba(dropShadow.color, dropShadow.opacity ?? 1);
      ctx.shadowBlur = dropShadow.blur;
      ctx.shadowOffsetX = dropShadow.offsetX;
      ctx.shadowOffsetY = dropShadow.offsetY;
    } else if (outerGlow?.enabled) {
      ctx.shadowColor = hexToRgba(outerGlow.color, outerGlow.opacity ?? 1);
      ctx.shadowBlur = outerGlow.blur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    const drawContent = () => {
      ctx.save();
      // Safety check for context
      if (!Number.isFinite(layer.transform.x) || !Number.isFinite(layer.transform.y) || !Number.isFinite(layer.transform.scale)) {
        ctx.restore();
        return;
      }

      ctx.translate(layer.transform.x, layer.transform.y);
      ctx.scale(layer.transform.scale, layer.transform.scale);
      ctx.rotate((layer.transform.rotation || 0) * Math.PI / 180);

      const contentW = layer.image ? layer.image.width : (layer.maskCanvas ? layer.maskCanvas.width : canvasWidth);
      const contentH = layer.image ? layer.image.height : (layer.maskCanvas ? layer.maskCanvas.height : canvasHeight);

      if (layer.maskImage) {
        if (!scratchCanvasRef.current) scratchCanvasRef.current = document.createElement('canvas');
        const offscreen = scratchCanvasRef.current;
        if (offscreen.width !== contentW || offscreen.height !== contentH) {
          offscreen.width = contentW;
          offscreen.height = contentH;
        } else {
          const offCtx = offscreen.getContext('2d');
          if (offCtx) offCtx.clearRect(0, 0, contentW, contentH);
        }

        const offCtx = offscreen.getContext('2d');
        if (offCtx) {
          if (layer.color) {
            offCtx.fillStyle = layer.color;
            offCtx.fillRect(0, 0, contentW, contentH);
          } else if (layer.image) {
            offCtx.drawImage(layer.image, 0, 0);
          }
          offCtx.globalCompositeOperation = 'destination-in';
          offCtx.drawImage(layer.maskImage, 0, 0, contentW, contentH);
          ctx.drawImage(offscreen, -contentW / 2, -contentH / 2);
        }
      } else {
        if (layer.color) {
          ctx.fillStyle = layer.color;
          ctx.fillRect(-contentW / 2, -contentH / 2, contentW, contentH);
        } else if (layer.image) {
          // Verify image validity
          if (layer.image.width > 0 && layer.image.height > 0) {
            try {
              ctx.drawImage(layer.image, -contentW / 2, -contentH / 2);
            } catch (e) {
              console.error("Failed to draw image:", e);
            }
          }
        } else if (layer.type === 'mask' && layer.maskCanvas) {
          ctx.drawImage(layer.maskCanvas, -contentW / 2, -contentH / 2);
        }
      }
      ctx.restore();
    };

    if (outerGlow?.enabled && outerGlow.strength > 1) {
      for (let i = 0; i < outerGlow.strength; i++) {
        drawContent();
      }
    } else {
      drawContent();
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    if (layer.frame && layer.frame.width > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.translate(layer.transform.x, layer.transform.y);
      ctx.scale(layer.transform.scale, layer.transform.scale);
      ctx.rotate((layer.transform.rotation || 0) * Math.PI / 180);
      ctx.strokeStyle = layer.frame.color;
      ctx.lineWidth = layer.frame.width;
      const layerWidth = layer.image ? layer.image.width : canvasWidth;
      const layerHeight = layer.image ? layer.image.height : canvasHeight;
      ctx.strokeRect(-layerWidth / 2, -layerHeight / 2, layerWidth, layerHeight);
      ctx.restore();
    }

    ctx.restore();
  }, []);

  const targetBufferRef = useRef<HTMLCanvasElement | null>(null);
  const maskBufferRef = useRef<HTMLCanvasElement | null>(null);

  const renderLayers = useCallback((ctx: CanvasRenderingContext2D, layerList: Layer[], canvasWidth: number, canvasHeight: number) => {
    // 1. Prepare buffers (once per render if size changed or first time)
    if (!targetBufferRef.current) targetBufferRef.current = document.createElement('canvas');
    if (!maskBufferRef.current) maskBufferRef.current = document.createElement('canvas');
    const targetBuffer = targetBufferRef.current;
    const maskBuffer = maskBufferRef.current;

    if (targetBuffer.width !== canvasWidth || targetBuffer.height !== canvasHeight) {
      targetBuffer.width = canvasWidth;
      targetBuffer.height = canvasHeight;
      maskBuffer.width = canvasWidth;
      maskBuffer.height = canvasHeight;
    }

    const tCtx = targetBuffer.getContext('2d');
    const mCtx = maskBuffer.getContext('2d');
    if (!tCtx || !mCtx) return;

    // layerList is bottom to top (0 is back, length-1 is front)
    for (let i = 0; i < layerList.length; i++) {
      const layer = layerList[i];
      if (!layer.visible) continue;

      if (!layer.isMaskChild) {
        drawLayer(ctx, layer, canvasWidth, canvasHeight);
        continue;
      }

      let nextMaskerIdx = -1;
      for (let j = i + 1; j < layerList.length; j++) {
        if (layerList[j].type === 'mask' || layerList[j].isClippingMask) {
          nextMaskerIdx = j;
          break;
        }
        if (!layerList[j].isMaskChild) break;
      }

      if (nextMaskerIdx !== -1 && layerList[nextMaskerIdx].visible) {
        const masker = layerList[nextMaskerIdx];

        // Use scratch contexts
        tCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        mCtx.clearRect(0, 0, canvasWidth, canvasHeight);

        // 1. Draw all children to target buffer
        for (let m = i; m < nextMaskerIdx; m++) {
          if (layerList[m].visible) {
            drawLayer(tCtx, layerList[m], canvasWidth, canvasHeight);
          }
        }

        // 2. Draw the MASK layer to its buffer
        drawLayer(mCtx, masker, canvasWidth, canvasHeight);

        // 3. Combine them
        tCtx.globalCompositeOperation = masker.isInverted ? 'destination-out' : 'destination-in';
        tCtx.drawImage(maskBuffer, 0, 0);
        tCtx.globalCompositeOperation = 'source-over';

        // 4. Draw result to main
        ctx.save();
        ctx.drawImage(targetBuffer, 0, 0);
        ctx.restore();

        // Skip the children and the masker
        i = nextMaskerIdx;
      } else {
        drawLayer(ctx, layer, canvasWidth, canvasHeight);
      }
    }
  }, [drawLayer]);


  const handleExport = async () => {
    if (layers.length === 0) return;
    onIsLoadingChange(true, 'Preparing image for export...');

    try {
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = preset.width;
      finalCanvas.height = preset.height;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) throw new Error("Could not create canvas context for export.");

      if (exportOptions.format === 'image/jpeg') {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
      }

      renderLayers(ctx, layers, preset.width, preset.height);

      const format = exportOptions.format;
      const quality = exportOptions.quality;
      const targetSizeKB = parseFloat(maxFileSize);

      if (!isNaN(targetSizeKB) && targetSizeKB > 0 && (format === 'image/jpeg' || format === 'image/webp')) {
        onIsLoadingChange(true, 'Optimizing image size...');
        const targetSizeInBytes = targetSizeKB * 1024;

        let optimalQuality = quality;
        let finalBlob: Blob | null = null;

        let low = 0;
        let high = 1;

        for (let i = 0; i < 8; i++) { // 8 iterations for precision
          const mid = (low + high) / 2;
          const currentBlob: Blob = await new Promise(resolve => finalCanvas.toBlob(blob => resolve(blob!), format, mid));
          if (currentBlob.size <= targetSizeInBytes) {
            optimalQuality = mid;
            finalBlob = currentBlob;
            low = mid;
          } else {
            high = mid;
          }
        }

        if (!finalBlob) {
          finalBlob = await new Promise(resolve => finalCanvas.toBlob(blob => resolve(blob!), format, 0));
          optimalQuality = 0;
        }

        setExportOptions(prev => ({ ...prev, quality: optimalQuality }));
        downloadImage(finalBlob!, 'exported-image', format);
      } else {
        const finalImageDataUrl = finalCanvas.toDataURL(format, quality);
        downloadImage(finalImageDataUrl, 'exported-image', format);
      }

    } catch (error: any) {
      setErrorMessage(error.message || "An error occurred during export.");
    } finally {
      onIsLoadingChange(false, '');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full p-4 gap-4">
      {/* Left Panel */}
      <div className="w-full lg:w-1/4 xl:w-1/5 flex-shrink-0 bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col gap-4 overflow-y-auto">
        <PresetPanel
          preset={preset}
          setPreset={setPreset}
          setErrorMessage={setErrorMessage}
        />
        <LayersPanel
          layers={layers}
          activeLayerId={activeLayerId}
          dispatch={dispatch}
          onOpenAssetLibrary={() => setIsAssetLibraryOpen(true)}
        />
      </div>

      {/* Center Panel */}
      <Canvas
        state={state}
        dispatch={dispatch}
        drawLayer={drawLayer}
        renderLayers={renderLayers}
      />


      {/* Right Panel */}
      <div className="w-full lg:w-1/4 xl:w-1/5 flex-shrink-0 bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col gap-4 overflow-y-auto">
        <PropertiesPanel
          activeLayer={activeLayer}
          dispatch={dispatch}
          brushSettings={state.brushSettings}
          onSaveToAssets={(layer) => {
            if (!layer.maskCanvas) return;
            const dataUrl = layer.maskCanvas.toDataURL('image/png');
            const newAsset: Asset = {
              id: `user-${Date.now()}`,
              name: layer.name.replace('Mask for ', 'Mask_'),
              url: dataUrl,
              category: 'User'
            };
            const stored = localStorage.getItem('banner-wizzard-assets');
            const current = stored ? JSON.parse(stored) : [];
            localStorage.setItem('banner-wizzard-assets', JSON.stringify([newAsset, ...current]));
            // Trigger a UI notification if exists, or just alert for now since we don't have a toast system
            alert("Mask saved to Library!");
          }}
        />
        {/* Export */}
        <div>
          <h3 className="text-xl font-semibold my-3 text-center text-gray-200">4. Export Image</h3>
          <div className="bg-gray-700/50 p-4 rounded-lg flex flex-col gap-4">
            <select id="format-select" value={exportOptions.format} onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as ExportFormat }))} className="bg-gray-600 border border-gray-500 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2">
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
              <option value="image/jpeg">JPG {hasTransparency && "(solid background)"}</option>
            </select>
            {(exportOptions.format === 'image/jpeg' || exportOptions.format === 'image/webp') && (
              <>
                <div className="flex items-center">
                  <div className="relative w-full">
                    <input type="number" value={maxFileSize} onChange={(e) => setMaxFileSize(e.target.value)} placeholder="Max Size (KB)" className="bg-gray-600 border-gray-500 text-white text-sm rounded-lg block w-full p-2.5 pr-8" />
                    {maxFileSize && (<button onClick={() => setMaxFileSize('')} className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-white" title="Clear max file size"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>)}
                  </div>
                </div>
                <label className="text-sm font-medium text-gray-300">Quality: {maxFileSize ? <span className="italic text-gray-400">(auto)</span> : `${Math.round(exportOptions.quality * 100)}%`}</label>
                <input type="range" min="0.1" max="1" step="0.05" value={exportOptions.quality} onChange={(e) => setExportOptions(prev => ({ ...prev, quality: parseFloat(e.target.value) }))} disabled={!!maxFileSize} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500 disabled:opacity-50" />
              </>
            )}
            <button onClick={handleExport} title="Export the current view" disabled={layers.length === 0} className="w-full text-white font-bold py-3 px-4 rounded-md transition text-lg flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">Export Image</button>
          </div>
        </div>
      </div>

      <AssetLibrary
        isOpen={isAssetLibraryOpen}
        onClose={() => setIsAssetLibraryOpen(false)}
        onSelectAsset={async (asset: Asset) => {
          onIsLoadingChange(true, `Adding ${asset.name}...`);
          try {
            const response = await fetch(asset.url);
            const blob = await response.blob();
            const file = new File([blob], `${asset.name}.png`, { type: 'image/png' });
            dispatch({ type: 'ADD_IMAGE_LAYERS', payload: { files: [file] } });
            setIsAssetLibraryOpen(false);
          } catch (err) {
            setErrorMessage("Failed to add asset from library.");
          } finally {
            onIsLoadingChange(false, '');
          }
        }}
      />
    </div>
  );
};

export default ImageEditor;
