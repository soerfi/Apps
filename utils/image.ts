import { CropSettings } from '../types';

export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64.split(',')[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
};

export const calculateAutoCrop = (imgWidth: number, imgHeight: number, aspectRatio: string): CropSettings => {
    // Default to full image
    let newCrop: CropSettings = { x: 0, y: 0, width: imgWidth, height: imgHeight, isCustom: false };

    if (aspectRatio !== 'original' && aspectRatio !== 'free') {
        const parts = aspectRatio.split(':');
        if (parts.length === 2) {
            const wR = parseFloat(parts[0]);
            const hR = parseFloat(parts[1]);
            
            if (!isNaN(wR) && !isNaN(hR) && hR !== 0) {
              const ratio = wR / hR;
              const imgRatio = imgWidth / imgHeight;
              
              if (imgRatio > ratio) {
                  const targetW = imgHeight * ratio;
                  newCrop = {
                      x: (imgWidth - targetW) / 2,
                      y: 0,
                      width: targetW,
                      height: imgHeight,
                      isCustom: false
                  };
              } else {
                  const targetH = imgWidth / ratio;
                  newCrop = {
                      x: 0,
                      y: (imgHeight - targetH) / 2,
                      width: imgWidth,
                      height: targetH,
                      isCustom: false
                  };
              }
            }
        }
    }
    return newCrop;
};