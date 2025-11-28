
import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons';

interface DropzoneProps {
  onFileDrop: (file: File) => void;
  setErrorMessage: (message: string) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ onFileDrop, setErrorMessage }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        onFileDrop(file);
      } else {
        setErrorMessage('Invalid file type. Please drop an image file.');
      }
    }
  }, [onFileDrop, setErrorMessage]);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
       if (file.type.startsWith('image/')) {
        onFileDrop(file);
      } else {
        setErrorMessage('Invalid file type. Please select an image file.');
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8">
      <label
        htmlFor="file-upload"
        className={`relative flex flex-col items-center justify-center w-full max-w-2xl h-96 border-4 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ${isDragging ? 'border-blue-500 bg-gray-800' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800'}`}
      >
        <div 
          className="absolute inset-0"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
            <UploadIcon className="w-12 h-12 mb-3 text-gray-400"/>
            <p className="mb-2 text-lg font-semibold text-gray-300">
            <span className="font-bold text-blue-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-gray-500">PNG, JPG, WEBP, GIF</p>
        </div>
        <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
      </label>
    </div>
  );
};

export default Dropzone;
