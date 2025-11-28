import React, { useState, useEffect, useCallback } from 'react';
import { Preset, ExportOptions, ExportFormat, Layer } from '../types';
import { PRESET_CATEGORIES } from '../constants';
import { useImageEditorState } from '../hooks/useImageEditorState';
import PresetPanel from './PresetPanel';
import LayersPanel from './LayersPanel';
import PropertiesPanel from './PropertiesPanel';
import Canvas from './Canvas';

interface ImageEditorProps {
  file: File;
  onIsLoadingChange: (isLoading: boolean, message: string) => void;
  setErrorMessage: (message: string) => void;
  onReset: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ file, onIsLoadingChange, setErrorMessage, onReset }) => {
  const [preset, setPreset] = useState<Preset>(PRESET_CATEGORIES[0].presets[0]);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ format: 'image/png', quality: 0.9 });
  const [maxFileSize, setMaxFileSize] = useState('');

  const [state, dispatch] = useImageEditorState({ file, preset, onReset, setErrorMessage });
  const { layers, activeLayerId, undoStack, redoStack } = state;

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
        } catch(error) {
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
        ctx.translate(layer.transform.x, layer.transform.y);
        ctx.scale(layer.transform.scale, layer.transform.scale);
        ctx.rotate((layer.transform.rotation || 0) * Math.PI / 180);

        if (layer.color) {
            ctx.fillStyle = layer.color;
            ctx.fillRect(-canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight);
        } else if (layer.image) {
            ctx.drawImage(layer.image, -layer.image.width / 2, -layer.image.height / 2);
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
      
      layers.forEach(layer => {
        drawLayer(ctx, layer, preset.width, preset.height);
      });
      
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
        />
      </div>

      {/* Center Panel */}
      <Canvas
          layers={layers}
          preset={preset}
          activeLayerId={activeLayerId}
          dispatch={dispatch}
          undoStack={undoStack}
          redoStack={redoStack}
          drawLayer={drawLayer}
        />


      {/* Right Panel */}
      <div className="w-full lg:w-1/4 xl:w-1/5 flex-shrink-0 bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col gap-4 overflow-y-auto">
        <PropertiesPanel
          activeLayer={activeLayer}
          dispatch={dispatch}
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
    </div>
  );
};

export default ImageEditor;
