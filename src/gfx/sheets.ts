import { IndexedImage } from "../data/image.ts";
import { Surface, gridSurface, rectSurface } from "./surfaces.ts";

interface Loaded {
  name: string;
  img: IndexedImage;
  palStart: number;
  key: number;
  layout: { cellW: number; cellH: number } | { rects: Int32Array };
  builtWith: string;
  owned: boolean;
  surface: Surface;
}

export class Sheets {
  readonly palette = new Uint8Array(256 * 3);
  private readonly loaded = new Map<number, Loaded>();

  constructor(private readonly image: (name: string) => IndexedImage) {}

  private writePalette(img: IndexedImage, start: number) {
    for (let i = 0; i < img.palette.length; i++) {
      const g = start + i;
      this.palette.set(img.palette[i], g * 3);
      if (g === 0xff) break;
    }
  }

  private slice(start: number, count: number): string {
    return Array.from(this.palette.subarray(start * 3, Math.min(256, start + count) * 3)).join(",");
  }

  private fill(l: Loaded, data: ImageData, x: number, y: number) {
    const { img, palStart, key } = l;
    for (let row = 0; row < data.height; row++) {
      for (let col = 0; col < data.width; col++) {
        const g = (img.pixels[(y + row) * img.width + x + col] + palStart) & 0xff;
        const p = (row * data.width + col) * 4;
        data.data[p] = this.palette[g * 3];
        data.data[p + 1] = this.palette[g * 3 + 1];
        data.data[p + 2] = this.palette[g * 3 + 2];
        data.data[p + 3] = g === key ? 0 : 255;
      }
    }
  }

  private build(l: Loaded): Surface {
    const { img } = l;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    const data = ctx.createImageData(img.width, img.height);
    this.fill(l, data, 0, 0);
    ctx.putImageData(data, 0, 0);
    l.builtWith = this.slice(l.palStart, img.palette.length);
    return "rects" in l.layout ? rectSurface(canvas, l.layout.rects) : gridSurface(canvas, l.layout.cellW, l.layout.cellH);
  }

  private load(id: number, name: string, palStart: number, key: number, layout: Loaded["layout"]) {
    const img = this.image(name);
    this.writePalette(img, palStart);
    const l: Loaded = { name, img, palStart, key, layout, builtWith: "", owned: false, surface: null as unknown as Surface };
    l.surface = this.build(l);
    this.loaded.set(id, l);
  }

  loadGrid(id: number, name: string, palStart: number, key: number, cellW: number, cellH: number) {
    this.load(id, name, palStart, key, { cellW, cellH });
  }

  loadRects(id: number, name: string, palStart: number, key: number, rects: Int32Array) {
    this.load(id, name, palStart, key, { rects });
  }

  blit(dstId: number, dx: number, dy: number, srcId: number, sx: number, sy: number, w: number, h: number) {
    const dst = this.loaded.get(dstId);
    const src = this.loaded.get(srcId);
    if (!dst || !src) return;
    if (!dst.owned) {
      dst.img = { ...dst.img, pixels: dst.img.pixels.slice() };
      dst.owned = true;
    }
    const di = dst.img;
    const si = src.img;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const v = si.pixels[(sy + row) * si.width + sx + col];
        if (((v + src.palStart) & 0xff) === src.key) continue;
        di.pixels[(dy + row) * di.width + dx + col] = (v + src.palStart - dst.palStart) & 0xff;
      }
    }
    const ctx = dst.surface.canvas.getContext("2d")!;
    const data = ctx.createImageData(w, h);
    this.fill(dst, data, dx, dy);
    ctx.putImageData(data, dx, dy);
  }

  reload(names: Set<string>) {
    for (const [id, l] of [...this.loaded]) {
      if (names.has(l.name)) this.load(id, l.name, l.palStart, l.key, l.layout);
    }
  }

  release(id: number) {
    this.loaded.delete(id);
  }

  applyPalette() {
    for (const l of this.loaded.values()) {
      if (this.slice(l.palStart, l.img.palette.length) !== l.builtWith) l.surface = this.build(l);
    }
  }

  has(name: string): boolean {
    try {
      this.image(name);
      return true;
    } catch {
      return false;
    }
  }

  get(id: number): Surface | null {
    return this.loaded.get(id)?.surface ?? null;
  }
}
