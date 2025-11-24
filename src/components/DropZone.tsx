import React, { useState, useCallback, type ReactNode } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  className?: string;
  children?: ReactNode; // Allow wrapping content
  emptyState?: boolean; // If true, show the big placeholder
  openFileDialogRef?: React.MutableRefObject<(() => void) | null>; // Allow parent to trigger open
}

const DropZone: React.FC<DropZoneProps> = ({ 
  onFilesDropped, 
  className, 
  children, 
  emptyState = false,
  openFileDialogRef
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = React.useId();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set false if leaving the main container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const imageFiles = droppedFiles.filter((file: File) => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      onFilesDropped(imageFiles);
    }
  }, [onFilesDropped]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const imageFiles = selectedFiles.filter((file: File) => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        onFilesDropped(imageFiles);
      }
      // Clear value so the same file can be selected again if needed
      e.target.value = '';
    }
  }, [onFilesDropped]);

  // Expose the open function to parent via ref
  if (openFileDialogRef) {
      openFileDialogRef.current = () => document.getElementById(inputId)?.click();
  }

  return (
    <div
      className={`relative transition-all duration-300 ease-in-out
        ${emptyState ? 'cursor-pointer hover:bg-slate-800/50 bg-slate-800/20 border-2 border-dashed' : ''}
        ${isDragging && emptyState ? 'border-brand-500 bg-brand-500/10 scale-[1.01]' : 'border-slate-700'}
        ${className}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={emptyState ? () => document.getElementById(inputId)?.click() : undefined}
    >
      <input
        type="file"
        id={inputId}
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />
      
      {/* Content to Wrap */}
      {children}

      {/* Overlay for Dragging over existing content */}
      {!emptyState && isDragging && (
          <div className="absolute inset-0 z-50 bg-brand-500/20 backdrop-blur-sm border-2 border-brand-500 rounded-xl flex items-center justify-center pointer-events-none">
              <div className="bg-brand-600 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 font-bold animate-bounce">
                  <Upload size={20} />
                  Drop to add images
              </div>
          </div>
      )}

      {/* Empty State Display */}
      {emptyState && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
            <div className={`p-4 rounded-full mb-4 transition-all duration-300 ${isDragging ? 'bg-brand-500 text-white' : 'bg-slate-800 text-brand-400'}`}>
              {isDragging ? <Upload size={32} /> : <ImageIcon size={32} />}
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-1">
              {isDragging ? 'Drop images now' : 'Drag & drop images'}
            </h3>
            <p className="text-sm text-slate-400 max-w-[200px]">
              or click to browse. Supports PNG, JPG, WebP.
            </p>
          </div>
      )}
    </div>
  );
};

export default DropZone;