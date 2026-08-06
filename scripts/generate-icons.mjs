// Generates the PWA/app icons as PNGs (pure Node, no deps) into public/icons/.
// Draws an emerald rounded square with a white "plate" and three macro dots.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- minimal PNG encoder -------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};
function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing -------------------------------------------------------------
function canvas(size) {
  return {
    size,
    buf: Buffer.alloc(size * size * 4),
    set(x, y, r, g, b, a = 255) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const i = (y * size + x) * 4;
      this.buf[i] = r;
      this.buf[i + 1] = g;
      this.buf[i + 2] = b;
      this.buf[i + 3] = a;
    },
  };
}
const insideRounded = (x, y, x0, y0, x1, y1, rad) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + rad, Math.min(x, x1 - rad));
  const cy = Math.max(y0 + rad, Math.min(y, y1 - rad));
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + 0.5;
};
const insideCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

function draw(size, opts = {}) {
  const c = canvas(size);
  const pad = opts.pad ?? 0; // safe-zone padding for maskable icons
  // background rounded square (emerald)
  const be = [16, 185, 129];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (insideRounded(x, y, pad, pad, size - 1 - pad, size - 1 - pad, size * 0.22)) {
        c.set(x, y, be[0], be[1], be[2]);
      }
    }
  }
  // white plate in center
  const cx = size / 2;
  const cy = size / 2;
  const plateR = size * 0.3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (insideCircle(x, y, cx, cy, plateR)) c.set(x, y, 250, 250, 250);
    }
  }
  // three macro dots: amber, indigo, pink
  const dots = [
    [-1, [245, 158, 11]],
    [0, [99, 102, 241]],
    [1, [236, 72, 153]],
  ];
  const dR = size * 0.055;
  for (const [off, [dr, dg, db]] of dots) {
    const dcx = cx + off * size * 0.13;
    const dcy = cy + size * 0.02;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (insideCircle(x, y, dcx, dcy, dR)) c.set(x, y, dr, dg, db);
      }
    }
  }
  return png(size, size, c.buf);
}

mkdirSync(join(root, 'public', 'icons'), { recursive: true });
const outputs = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-512-maskable.png', 512, { pad: 512 * 0.12 }],
  ['apple-touch-icon.png', 180, {}],
];
for (const [name, size, opts] of outputs) {
  writeFileSync(join(root, 'public', 'icons', name), draw(size, opts));
  console.log('wrote', name, size + 'px');
}
