import { deflateSync, inflateSync } from "node:zlib";

export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Indexed {
  width: number;
  height: number;
  palette: [number, number, number][];
  transparent: boolean;
  pixels: Uint8Array;
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunks(png: Uint8Array) {
  const buf = Buffer.from(png);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("PNG 파일이 아닙니다");
  const out: { type: string; body: Buffer }[] = [];
  for (let p = 8; p < buf.length; ) {
    const length = buf.readUInt32BE(p);
    out.push({ type: buf.toString("latin1", p + 4, p + 8), body: buf.subarray(p + 8, p + 8 + length) });
    p += 12 + length;
  }
  return out;
}

function unfilter(raw: Buffer, width: number, height: number, bpp: number, stride: number): Uint8Array {
  const bytes = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = bytes.subarray(y * stride, (y + 1) * stride);
    const up = y > 0 ? bytes.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = up ? up[x] : 0;
      const c = up && x >= bpp ? up[x - bpp] : 0;
      let predict = 0;
      if (filter === 1) predict = a;
      else if (filter === 2) predict = b;
      else if (filter === 3) predict = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        predict = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = (row[x] + predict) & 0xff;
    }
  }
  return bytes;
}

export function decodePng(png: Uint8Array): Rgba {
  let width = 0;
  let height = 0;
  let depth = 8;
  let type = 0;
  let palette: number[][] = [];
  let alpha: Uint8Array = new Uint8Array();
  const idat: Buffer[] = [];
  for (const { type: t, body } of chunks(png)) {
    if (t === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      if (body[12] !== 0) throw new Error("인터레이스 PNG는 읽지 않습니다");
    } else if (t === "PLTE") {
      palette = [];
      for (let i = 0; i < body.length; i += 3) palette.push([body[i], body[i + 1], body[i + 2]]);
    } else if (t === "tRNS") alpha = new Uint8Array(body);
    else if (t === "IDAT") idat.push(body);
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (channels === undefined || (type !== 3 && depth !== 8)) throw new Error(`지원하지 않는 PNG 형식(색 형식 ${type}, ${depth}비트)`);
  const stride = Math.ceil((width * channels * depth) / 8);
  const bytes = unfilter(inflateSync(Buffer.concat(idat)), width, height, Math.max(1, (channels * depth) >> 3), stride);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const row = y * stride;
      if (type === 3) {
        const bit = x * depth;
        const v = (bytes[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        const c = palette[v] ?? [0, 0, 0];
        data.set([c[0], c[1], c[2], v < alpha.length ? alpha[v] : 255], o);
      } else {
        const p = row + x * channels;
        const g = bytes[p];
        if (type === 0) data.set([g, g, g, 255], o);
        else if (type === 4) data.set([g, g, g, bytes[p + 1]], o);
        else if (type === 2) data.set([bytes[p], bytes[p + 1], bytes[p + 2], 255], o);
        else data.set(bytes.subarray(p, p + 4), o);
      }
    }
  }
  return { width, height, data };
}

export function decodeIndexed(png: Uint8Array): Indexed {
  let width = 0;
  let height = 0;
  let depth = 8;
  let transparent = false;
  const palette: [number, number, number][] = [];
  const idat: Buffer[] = [];
  for (const { type, body } of chunks(png)) {
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      if (body[9] !== 3) throw new Error("인덱스 컬러 PNG가 아닙니다");
    } else if (type === "PLTE") {
      for (let i = 0; i < body.length; i += 3) palette.push([body[i], body[i + 1], body[i + 2]]);
    } else if (type === "tRNS") transparent = body.length > 0 && body[0] === 0;
    else if (type === "IDAT") idat.push(body);
  }
  const stride = Math.ceil((width * depth) / 8);
  const bytes = unfilter(inflateSync(Buffer.concat(idat)), width, height, 1, stride);
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = x * depth;
      pixels[y * width + x] = (bytes[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
    }
  }
  return { width, height, palette, transparent, pixels };
}

function chunk(type: string, body: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
  return Buffer.concat([head, body, crcBuf]);
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

export function encodeIndexed(img: Indexed): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const raw = Buffer.alloc((img.width + 1) * img.height);
  for (let y = 0; y < img.height; y++) raw.set(img.pixels.subarray(y * img.width, (y + 1) * img.width), y * (img.width + 1) + 1);
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("PLTE", Uint8Array.from(img.palette.flat())),
    ...(img.transparent ? [chunk("tRNS", new Uint8Array([0]))] : []),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}

export function encodeRgba(img: Rgba): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = img.width * 4;
  const raw = Buffer.alloc((stride + 1) * img.height);
  for (let y = 0; y < img.height; y++) raw.set(img.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())]);
}
