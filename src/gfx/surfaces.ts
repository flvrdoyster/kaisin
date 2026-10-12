import { IndexedImage } from "../data/image.ts";

export interface Cell {
  sx: number;
  sy: number;
  w: number;
  h: number;
}

export class Surface {
  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly cell: (frame: number) => Cell | null,
  ) {}

  frame(n: number): Cell | null {
    return this.cell(n);
  }
}

export function sheetCanvas(img: IndexedImage, palStart: number, colorKey: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  const data = ctx.createImageData(img.width, img.height);
  for (let k = 0; k < img.pixels.length; k++) {
    const idx = img.pixels[k];
    const [r, g, b] = img.palette[idx] ?? [0, 0, 0];
    const p = k * 4;
    data.data[p] = r;
    data.data[p + 1] = g;
    data.data[p + 2] = b;
    data.data[p + 3] = idx + palStart === colorKey ? 0 : 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export function gridSurface(canvas: HTMLCanvasElement, cellW: number, cellH: number): Surface {
  const cols = Math.trunc(canvas.width / cellW);
  return new Surface(canvas, (n) => {
    if (n < 0) return null;
    return { sx: (n % cols) * cellW, sy: Math.trunc(n / cols) * cellH, w: cellW, h: cellH };
  });
}

export function rectSurface(canvas: HTMLCanvasElement, rects: Int32Array): Surface {
  return new Surface(canvas, (n) => {
    if (n < 0 || n * 4 + 3 >= rects.length) return null;
    const l = rects[n * 4];
    const t = rects[n * 4 + 1];
    const r = rects[n * 4 + 2];
    const b = rects[n * 4 + 3];
    if (r <= l || b <= t) return null;
    return { sx: l, sy: t, w: r - l, h: b - t };
  });
}
