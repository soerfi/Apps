import React, { useState, useCallback } from 'react';
import Dropzone from './components/Dropzone';
import ImageEditor from './components/ImageEditor';
import Loader from './components/Loader';

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      
      <header className="w-full text-center p-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 flex-shrink-0 z-10">
        <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Image Resizer & Cropper</h1>
      </header>
      
      <main className="flex-1 w-full flex items-start justify-center overflow-y-auto">
          {errorMessage && (
              <div className="fixed top-20 bg-red-500/90 text-white py-2 px-4 rounded-md shadow-lg z-50 animate-pulse">
                  {errorMessage}
                  <button onClick={() => setErrorMessage(null)} className="ml-4 font-bold">X</button>
              </div>
          )}
          {imageFile ? (
              <ImageEditor 
                  file={imageFile}
                  onIsLoadingChange={handleIsLoadingChange}
                  setErrorMessage={setErrorMessage}
                  onReset={handleReset}
              />
          ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Dropzone onFileDrop={handleFileDrop} setErrorMessage={setErrorMessage}/>
              </div>
          )}
      </main>
    </div>
  );
};

export default App;
