import React, { useState, useEffect } from 'react';
import { Asset, Layer } from '../types';
import { CloseIcon, PlusIcon, TrashIcon, UploadIcon } from './icons';

interface AssetLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectAsset: (asset: Asset) => void;
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({ isOpen, onClose, onSelectAsset }) => {
    const [activeTab, setActiveTab] = useState<'shared' | 'user'>('shared');
    const [sharedAssets, setSharedAssets] = useState<Asset[]>([]);
    const [userAssets, setUserAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDraggingFile, setIsDraggingFile] = useState(false);

    useEffect(() => {
        // Load shared assets
        const loadShared = async () => {
            try {
                const res = await fetch('/library.json');
                const staticAssets: Asset[] = await res.json();

                // Get dynamic shared assets
                const storedShared = localStorage.getItem('banner-wizzard-shared-assets');
                const dynamicShared = storedShared ? JSON.parse(storedShared) : [];

                // Get hidden static asset IDs
                const hiddenStored = localStorage.getItem('banner-wizzard-hidden-shared');
                const hiddenIds = hiddenStored ? JSON.parse(hiddenStored) : [];

                const filteredStatic = staticAssets.filter(a => !hiddenIds.includes(a.id));
                setSharedAssets([...filteredStatic, ...dynamicShared]);
            } catch (err) {
                console.error("Failed to load shared library:", err);
                const storedShared = localStorage.getItem('banner-wizzard-shared-assets');
                if (storedShared) setSharedAssets(JSON.parse(storedShared));
            }
        };
        loadShared();

        // Load user assets from localStorage
        const stored = localStorage.getItem('banner-wizzard-assets');
        if (stored) {
            setUserAssets(JSON.parse(stored));
        }
    }, []);

    const processFiles = (files: FileList | File[]) => {
        setIsLoading(true);
        const readerPromises = Array.from(files).map((file: File) => {
            if (!file.type.startsWith('image/')) return Promise.resolve();

            return new Promise<void>((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const newAsset: Asset = {
                        id: `${activeTab}-${Date.now()}-${Math.random()}`,
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        url: event.target?.result as string,
                        category: activeTab === 'shared' ? 'Shared' : 'User'
                    };

                    if (activeTab === 'shared') {
                        const storedShared = localStorage.getItem('banner-wizzard-shared-assets');
                        const dynamicShared = storedShared ? JSON.parse(storedShared) : [];
                        const updated = [newAsset, ...dynamicShared];
                        localStorage.setItem('banner-wizzard-shared-assets', JSON.stringify(updated));

                        const hiddenStored = localStorage.getItem('banner-wizzard-hidden-shared');
                        const hiddenIds = hiddenStored ? JSON.parse(hiddenStored) : [];

                        fetch('/library.json')
                            .then(res => res.json())
                            .then((staticAssets: Asset[]) => {
                                const filteredStatic = staticAssets.filter(a => !hiddenIds.includes(a.id));
                                setSharedAssets([...filteredStatic, ...updated]);
                            })
                            .catch(() => setSharedAssets(updated))
                            .finally(() => resolve());
                    } else {
                        const updated = [newAsset, ...userAssets];
                        setUserAssets(updated);
                        localStorage.setItem('banner-wizzard-assets', JSON.stringify(updated));
                        resolve();
                    }
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(readerPromises).finally(() => setIsLoading(false));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processFiles(e.target.files);
    };

    const deleteAsset = (id: string, e: React.MouseEvent, type: 'shared' | 'user') => {
        e.stopPropagation();
        if (type === 'user') {
            const updated = userAssets.filter(a => a.id !== id);
            setUserAssets(updated);
            localStorage.setItem('banner-wizzard-assets', JSON.stringify(updated));
        } else {
            // 1. Check if it's a dynamic shared asset
            const storedShared = localStorage.getItem('banner-wizzard-shared-assets');
            const dynamicShared = storedShared ? JSON.parse(storedShared) : [];
            const isDynamic = dynamicShared.some((a: Asset) => a.id === id);

            if (isDynamic) {
                const updatedDynamic = dynamicShared.filter((a: Asset) => a.id !== id);
                localStorage.setItem('banner-wizzard-shared-assets', JSON.stringify(updatedDynamic));
            } else {
                // 2. If not dynamic, it's static. Add to hidden list.
                const hiddenStored = localStorage.getItem('banner-wizzard-hidden-shared');
                const hiddenIds = hiddenStored ? JSON.parse(hiddenStored) : [];
                if (!hiddenIds.includes(id)) {
                    hiddenIds.push(id);
                    localStorage.setItem('banner-wizzard-hidden-shared', JSON.stringify(hiddenIds));
                }
            }

            // Refresh UI
            const hiddenStored = localStorage.getItem('banner-wizzard-hidden-shared');
            const hiddenIds = hiddenStored ? JSON.parse(hiddenStored) : [];
            const updatedDynamic = localStorage.getItem('banner-wizzard-shared-assets')
                ? JSON.parse(localStorage.getItem('banner-wizzard-shared-assets')!)
                : [];

            fetch('/library.json')
                .then(res => res.json())
                .then((staticAssets: Asset[]) => {
                    const filteredStatic = staticAssets.filter(a => !hiddenIds.includes(a.id));
                    setSharedAssets([...filteredStatic, ...updatedDynamic]);
                })
                .catch(() => setSharedAssets(updatedDynamic));
        }
    };


    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
                e.preventDefault();
                const assetData = e.dataTransfer.getData('application/x-banner-wizzard-asset');
                if (assetData) {
                    try {
                        const asset = JSON.parse(assetData);
                        onSelectAsset(asset);
                        onClose();
                    } catch (err) {
                        console.error("Failed to parse dropped asset:", err);
                    }
                } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    // Handle files dropped anywhere on modal
                    processFiles(e.dataTransfer.files);
                }
            }}
        >
            <div className="bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-700 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        Asset Library
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex border-b border-gray-700">
                    <button onClick={() => setActiveTab('shared')} className={`flex-1 py-3 font-semibold transition ${activeTab === 'shared' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}>Shared Assets</button>
                    <button onClick={() => setActiveTab('user')} className={`flex-1 py-3 font-semibold transition ${activeTab === 'user' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}>My Images</button>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                    <div className="mb-6">
                        <label
                            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition ${isDraggingFile ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:bg-gray-700/50'}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingFile(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingFile(false);
                            }}
                            onDrop={(e) => {
                                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDraggingFile(false);
                                    processFiles(e.dataTransfer.files);
                                }
                            }}
                        >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadIcon className={`w-8 h-8 mb-2 transition-colors ${isDraggingFile ? 'text-blue-400' : 'text-gray-400'}`} />
                                <p className={`text-sm transition-colors ${isDraggingFile ? 'text-blue-300 font-semibold' : 'text-gray-400'}`}>
                                    {isDraggingFile ? 'Drop to upload' : `Add to ${activeTab === 'shared' ? 'Shared' : 'My Images'} (Image)`}
                                </p>
                            </div>
                            <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                        </label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {(activeTab === 'shared' ? sharedAssets : userAssets).map(asset => (
                            <div
                                key={asset.id}
                                onClick={() => onSelectAsset(asset)}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/x-banner-wizzard-asset', JSON.stringify(asset));
                                    e.dataTransfer.effectAllowed = 'copy';
                                }}
                                className="group relative aspect-square bg-gray-900 rounded-lg border border-gray-700 overflow-hidden cursor-pointer hover:border-blue-500 transition shadow-lg"
                            >
                                <img src={asset.url} alt={asset.name} className="w-full h-full object-contain p-2 pointer-events-none" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <PlusIcon className="w-8 h-8 text-white" />
                                </div>
                                <button onClick={(e) => deleteAsset(asset.id, e, activeTab)} className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-md opacity-0 group-hover:opacity-100 transition hover:bg-red-600" title="Delete from library">
                                    <TrashIcon className="w-3 h-3 text-white" />
                                </button>
                                <div className="absolute bottom-0 inset-x-0 bg-gray-900/90 py-1 px-2 text-[10px] truncate text-gray-300 border-t border-gray-800">
                                    {asset.name}
                                </div>
                            </div>
                        ))}
                    </div>

                    {(activeTab === 'shared' ? sharedAssets : userAssets).length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No assets found in this category.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
