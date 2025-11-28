
export interface WebPFrame {
  data: Uint8Array;
  duration: number; // ms
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function writeUint24(view: DataView, offset: number, value: number) {
  view.setUint8(offset, value & 0xff);
  view.setUint8(offset + 1, (value >> 8) & 0xff);
  view.setUint8(offset + 2, (value >> 16) & 0xff);
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

export async function createAnimatedWebP(
  frames: WebPFrame[],
  width: number,
  height: number,
  loop: boolean
): Promise<Blob> {
  const chunks: { type: string; data: Uint8Array; duration: number }[] = [];

  for (const frame of frames) {
    let offset = 12; // Skip RIFF header
    const view = new DataView(frame.data.buffer);
    
    // Simple WebP parser to find the bitstream
    while (offset < frame.data.length - 8) {
      const type = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1), 
        view.getUint8(offset + 2), view.getUint8(offset + 3)
      );
      const size = view.getUint32(offset + 4, true);
      
      if (type === 'VP8 ' || type === 'VP8L') {
        chunks.push({
          type,
          data: frame.data.slice(offset + 8, offset + 8 + size), // Extract raw bitstream
          duration: frame.duration
        });
        break; // Only need the first image chunk
      }
      
      offset += 8 + size + (size % 2);
    }
  }
  
  let totalSize = 12 + 18 + 14;
  
  for (const chunk of chunks) {
    const bitstreamSize = chunk.data.length;
    const chunkPayloadSize = 8 + bitstreamSize;
    const anmfPayloadSize = 16 + chunkPayloadSize;
    const anmfTotalSize = 8 + anmfPayloadSize + (anmfPayloadSize % 2);
    totalSize += anmfTotalSize;
  }

  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);
  let cursor = 0;

  // --- RIFF HEADER ---
  writeString(view, 0, 'RIFF');
  writeUint32(view, 4, totalSize - 8);
  writeString(view, 8, 'WEBP');
  cursor += 12;

  // --- VP8X CHUNK ---
  writeString(view, cursor, 'VP8X');
  writeUint32(view, cursor + 4, 10);
  cursor += 8;
  
  view.setUint8(cursor, 2 | 16); 
  cursor += 4; 
  
  writeUint24(view, cursor, width - 1);
  cursor += 3;
  writeUint24(view, cursor, height - 1);
  cursor += 3;

  // --- ANIM CHUNK ---
  writeString(view, cursor, 'ANIM');
  writeUint32(view, cursor + 4, 6);
  cursor += 8;
  
  writeUint32(view, cursor, 0xFFFFFFFF);
  cursor += 4;
  writeUint16(view, cursor, loop ? 0 : 1);
  cursor += 2;

  // --- ANMF CHUNKS ---
  for (const chunk of chunks) {
    const bitstreamSize = chunk.data.length;
    const chunkPayloadSize = 8 + bitstreamSize;
    const anmfPayloadSize = 16 + chunkPayloadSize; 
    
    writeString(view, cursor, 'ANMF');
    writeUint32(view, cursor + 4, anmfPayloadSize);
    cursor += 8;

    writeUint24(view, cursor, 0); // x
    cursor += 3;
    writeUint24(view, cursor, 0); // y
    cursor += 3;
    writeUint24(view, cursor, width - 1); // w
    cursor += 3;
    writeUint24(view, cursor, height - 1); // h
    cursor += 3;
    writeUint24(view, cursor, Math.round(chunk.duration)); // duration
    cursor += 3;
    
    view.setUint8(cursor, 0);
    cursor += 1;

    writeString(view, cursor, chunk.type);
    writeUint32(view, cursor + 4, bitstreamSize);
    cursor += 8;
    
    buffer.set(chunk.data, cursor);
    cursor += bitstreamSize;

    if (anmfPayloadSize % 2 !== 0) {
      view.setUint8(cursor, 0);
      cursor += 1;
    }
  }

  return new Blob([buffer], { type: 'image/webp' });
}