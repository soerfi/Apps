// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export async function createGIF(
  frames: { data: Uint8ClampedArray; width: number; height: number; delay: number }[],
  width: number,
  height: number,
  loop: boolean,
  quality: number = 100
): Promise<Blob> {
  
  const gif = new GIFEncoder();
  
  // Exponential quality curve
  const normalizedQuality = Math.max(0.01, Math.min(1, quality / 100));
  const maxColors = Math.max(2, Math.min(256, Math.round(Math.pow(normalizedQuality, 2) * 256)));

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    
    const palette = quantize(frame.data, maxColors);
    const index = applyPalette(frame.data, palette);

    const options: any = {
        palette: palette,
        delay: frame.delay, 
        transparent: -1,
        dispose: -1 
    };

    if (i === 0) {
        options.repeat = loop ? 0 : -1;
    }

    gif.writeFrame(index, width, height, options);
  }
  
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}