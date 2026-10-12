export interface IndexedImage {
  width: number;
  height: number;
  palette: [number, number, number][];
  pixels: Uint8Array;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decodeIndexedPng(png: Uint8Array): Promise<IndexedImage> {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let width = 0;
  let height = 0;
  const palette: [number, number, number][] = [];
  const parts: Uint8Array[] = [];
  for (let p = 8; p < png.length; ) {
    const length = v.getUint32(p);
    const type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
    const body = png.subarray(p + 8, p + 8 + length);
    if (type === "IHDR") {
      width = v.getUint32(p + 8);
      height = v.getUint32(p + 12);
    } else if (type === "PLTE") {
      for (let i = 0; i < length; i += 3) palette.push([body[i], body[i + 1], body[i + 2]]);
    } else if (type === "IDAT") {
      parts.push(body);
    }
    p += 12 + length;
  }
  const joined = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
  let at = 0;
  for (const a of parts) {
    joined.set(a, at);
    at += a.length;
  }
  const raw = await inflate(joined);
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)];
    const row = raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1));
    const out = pixels.subarray(y * width, (y + 1) * width);
    const up = y > 0 ? pixels.subarray((y - 1) * width, y * width) : null;
    for (let x = 0; x < width; x++) {
      const a = x > 0 ? out[x - 1] : 0;
      const b = up ? up[x] : 0;
      const c = up && x > 0 ? up[x - 1] : 0;
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
  return { width, height, palette, pixels };
}
