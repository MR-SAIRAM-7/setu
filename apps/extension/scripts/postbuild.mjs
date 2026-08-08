import { deflateSync } from 'node:zlib';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

mkdirSync(resolve(dist, 'icons'), { recursive: true });

/* ── static assets the bundler does not own ───────────────────────────────── */

copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
copyFileSync(resolve(root, 'src/content/setu.css'), resolve(dist, 'content.css'));

/* ── icons ────────────────────────────────────────────────────────────────────
   Generated rather than committed as binaries so the repo stays diffable and
   there is no "where did this PNG come from" question at review time.
   A rounded square in SETU accent blue with a white bridge arc — setu means
   bridge, and the icon should teach the name.
   ─────────────────────────────────────────────────────────────────────────── */

const ACCENT = [0x2f, 0x6f, 0xed];
const WHITE = [0xff, 0xff, 0xff];

function icon(size) {
  const px = new Uint8Array(size * size * 4);
  const r = size * 0.22; // corner radius
  const cx = size / 2;

  // Bridge arc geometry: a band of a circle centred below the icon.
  const arcCy = size * 0.92;
  const arcR = size * 0.5;
  const arcW = Math.max(1, size * 0.09);
  const deckY = size * 0.66;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // rounded-rect mask
      const dx = Math.max(r - x, 0, x - (size - r));
      const dy = Math.max(r - y, 0, y - (size - r));
      if (Math.hypot(dx, dy) > r) {
        px[i + 3] = 0;
        continue;
      }

      let colour = ACCENT;

      // the arch
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - arcCy);
      if (Math.abs(d - arcR) < arcW / 2 && y < deckY + arcW) colour = WHITE;

      // the deck
      if (
        y >= deckY - arcW / 2 &&
        y <= deckY + arcW / 2 &&
        x > size * 0.14 &&
        x < size * 0.86
      )
        colour = WHITE;

      px[i] = colour[0];
      px[i + 1] = colour[1];
      px[i + 2] = colour[2];
      px[i + 3] = 255;
    }
  }
  return png(px, size, size);
}

function png(rgba, w, h) {
  // PNG scanlines are prefixed with a filter byte (0 = None).
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(dist, `icons/icon-${size}.png`), icon(size));
}

/* ── sanity checks that catch the two failures we actually hit ────────────── */

const required = ['manifest.json', 'background.js', 'content.js', 'content.css', 'sidepanel.html', 'options.html'];
const missing = required.filter((f) => !existsSync(resolve(dist, f)));
if (missing.length) {
  console.error(`\n✗ Build incomplete. Missing from dist/: ${missing.join(', ')}\n`);
  process.exit(1);
}

console.log('\n✓ SETU Lens built to apps/extension/dist');
console.log('  Load it: chrome://extensions → Developer mode → Load unpacked → apps/extension/dist\n');
