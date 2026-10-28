// Shrinks a big PNG (like a phone photo uploaded as a team logo) without any image
// libraries: decode, box-downscale, re-encode. Handles 8-bit non-interlaced PNGs,
// which is what phones and editors save; anything else is left alone (returns null).
const zlib = require('zlib');

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let pos = 8, w, h, depth, type, interlace, palette, trns;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (depth !== 8 || interlace || !ch) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, out = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[out + x - ch] : 0, b = y ? px[out - stride + x] : 0, c = x >= ch && y ? px[out - stride + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[out + x] = v & 255;
    }
  }
  // To RGBA.
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, al = 255;
    if (type === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; al = px[i * 4 + 3]; }
    else if (type === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
    else if (type === 0) { r = g = b = px[i]; }
    else if (type === 4) { r = g = b = px[i * 2]; al = px[i * 2 + 1]; }
    else { const k = px[i]; r = palette[k * 3]; g = palette[k * 3 + 1]; b = palette[k * 3 + 2]; if (trns && k < trns.length) al = trns[k]; }
    rgba.set([r, g, b, al], i * 4);
  }
  return { w, h, rgba };
}

function encode(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const chunk = (kind, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const kd = Buffer.concat([Buffer.from(kind, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(kd)); return Buffer.concat([len, kd, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Box-average down so the longest side is `max` pixels (alpha-weighted).
function shrinkPng(buf, max = 256) {
  const img = decode(buf);
  if (!img) return null;
  const k = max / Math.max(img.w, img.h);
  if (k >= 1) return null;
  const W = Math.max(1, Math.round(img.w * k)), H = Math.max(1, Math.round(img.h * k)), out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.floor(x / k), x1 = Math.min(img.w, Math.floor((x + 1) / k)), y0 = Math.floor(y / k), y1 = Math.min(img.h, Math.floor((y + 1) / k));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * img.w + xx) * 4, al = img.rgba[i + 3];
      r += img.rgba[i] * al; g += img.rgba[i + 1] * al; b += img.rgba[i + 2] * al; a += al; n++;
    }
    const o = (y * W + x) * 4;
    if (a) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
    out[o + 3] = n ? Math.round(a / n) : 0;
  }
  return encode(W, H, out);
}

module.exports = { shrinkPng };
