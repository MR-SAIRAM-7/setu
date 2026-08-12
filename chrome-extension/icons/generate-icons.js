const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc = crc ^ byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, body, crcBuf]);
}

function createPngBuffer(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  
  const ihdrChunk = makeChunk('IHDR', ihdr);
  
  const rawLines = [];
  for (let y = 0; y < size; y++) {
    const line = Buffer.alloc(1 + size * 3);
    line[0] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isInside = dist < size * 0.42;
      const offset = 1 + x * 3;
      if (isInside) {
        line[offset] = r;
        line[offset + 1] = g;
        line[offset + 2] = b;
      } else {
        line[offset] = 15;
        line[offset + 1] = 23;
        line[offset + 2] = 42;
      }
    }
    rawLines.push(line);
  }
  
  const rawData = Buffer.concat(rawLines);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const dir = __dirname;
fs.writeFileSync(path.join(dir, 'icon16.png'), createPngBuffer(16, 99, 102, 241));
fs.writeFileSync(path.join(dir, 'icon48.png'), createPngBuffer(48, 99, 102, 241));
fs.writeFileSync(path.join(dir, 'icon128.png'), createPngBuffer(128, 99, 102, 241));

console.log('Successfully generated icon16.png, icon48.png, icon128.png');
