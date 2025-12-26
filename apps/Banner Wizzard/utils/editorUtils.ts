import { Layer, LayerStyles, Transform, Preset } from '../types';

export const defaultStyles: LayerStyles = {
    dropShadow: { enabled: false, color: '#000000', blur: 10, offsetX: 5, offsetY: 5, opacity: 0.75 },
    outerGlow: { enabled: false, color: '#ffffff', blur: 20, opacity: 0.85, strength: 1 },
};

export const loadImage = (file: File, preset: Preset): Promise<Layer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const newLayer: Omit<Layer, 'transform'> = {
                    id: `${file.name}-${new Date().getTime()}`,
                    image: img,
                    name: file.name,
                    type: 'image',
                    visible: true,
                    hasTransparency: false,
                    opacity: 1,
                    blendMode: 'source-over',
                    styles: JSON.parse(JSON.stringify(defaultStyles)),
                };

                const tempCanvas = document.createElement('canvas');
                const size = Math.min(img.width, img.height, 100);
                tempCanvas.width = size; tempCanvas.height = size;
                const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                    ctx.drawImage(img, 0, 0, size, size);
                    try {
                        const imageData = ctx.getImageData(0, 0, size, size).data;
                        for (let i = 3; i < imageData.length; i += 4) {
                            if (imageData[i] < 255) {
                                newLayer.hasTransparency = true;
                                break;
                            }
                        }
                    } catch (e) { console.error("Could not check for transparency:", e); }
                }

                const scaleX = preset.width / img.width;
                const scaleY = preset.height / img.height;
                const initialScale = Math.max(scaleX, scaleY);
                const transform = { x: preset.width / 2, y: preset.height / 2, scale: initialScale, rotation: 0 };

                resolve({ ...newLayer, transform });
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const applySnapping = (layer: Layer, preset: Preset, ctrlKey: boolean): Transform => {
    const { transform } = layer;
    if (ctrlKey || !layer.image) return transform;

    const snapThreshold = 10;
    const { image } = layer;
    const scaledWidth = image.width * transform.scale;
    const scaledHeight = image.height * transform.scale;

    const left = transform.x - scaledWidth / 2;
    const right = transform.x + scaledWidth / 2;
    const top = transform.y - scaledHeight / 2;
    const bottom = transform.y + scaledHeight / 2;

    let snappedX = transform.x;
    let snappedY = transform.y;

    if (Math.abs(left) < snapThreshold) snappedX = scaledWidth / 2;
    if (Math.abs(right - preset.width) < snapThreshold) snappedX = preset.width - scaledWidth / 2;
    if (Math.abs(top) < snapThreshold) snappedY = scaledHeight / 2;
    if (Math.abs(bottom - preset.height) < snapThreshold) snappedY = preset.height - scaledHeight / 2;

    return { ...transform, x: snappedX, y: snappedY };
};
