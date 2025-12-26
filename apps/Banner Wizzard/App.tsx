import React, { useState, useCallback } from 'react';
import Dropzone from './components/Dropzone';
import ImageEditor from './components/ImageEditor';
import Loader from './components/Loader';
import { HomeIcon } from './components/icons';

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pastedFiles, setPastedFiles] = useState<File[]>([]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      if (!imageFile) {
        setImageFile(files[0]);
        if (files.length > 1) {
          setPastedFiles(files.slice(1));
        }
      } else {
        setPastedFiles(files);
      }
    }
  }, [imageFile]);

  React.useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleFileDrop = useCallback((file: File) => {
    setImageFile(file);
    setErrorMessage(null);
  }, []);

  const handleReset = useCallback(() => {
    setImageFile(null);
    setIsLoading(false);
    setErrorMessage(null);
  }, []);

  const handleIsLoadingChange = (loading: boolean, message: string) => {
    setIsLoading(loading);
    setLoadingMessage(message);
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col font-sans">
      {isLoading && <Loader message={loadingMessage} />}

      <header className="w-full text-center p-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 flex-shrink-0 z-10 relative">
        <a href="/" className="absolute left-4 top-1/2 -translate-y-1/2 bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition" title="Back to Dashboard">
          <HomeIcon className="w-6 h-6 text-gray-400 hover:text-white" />
        </a>
        <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Banner Wizzard</h1>
      </header>

      <main className="flex-1 w-full flex items-start justify-center overflow-y-auto">
        {errorMessage && (
          <div className="fixed top-20 bg-red-500/90 text-white py-2 px-4 rounded-md shadow-lg z-50 animate-pulse">
            {errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-4 font-bold">X</button>
          </div>
        )}
        <ImageEditor
          file={imageFile}
          pastedFiles={pastedFiles}
          onProcessedPastedFiles={() => setPastedFiles([])}
          onIsLoadingChange={handleIsLoadingChange}
          setErrorMessage={setErrorMessage}
          onReset={handleReset}
        />
      </main>
    </div>
  );
};

export default App;
