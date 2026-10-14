import { Sheets } from "./sheets.ts";
import { Obj } from "../game/obj.ts";

export const SCREEN_W = 640;
export const SCREEN_H = 480;

export interface TextStyle {
  height: number;
  width: number;
  bold: boolean;
}

export const FONTS: TextStyle[] = [
  { height: 32, width: 16, bold: true },
  { height: 64, width: 32, bold: true },
  { height: 16, width: 8, bold: false },
  { height: 24, width: 12, bold: true },
  { height: 32, width: 32, bold: true },
];

export class Renderer {
  readonly back: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly screen: CanvasRenderingContext2D,
    private readonly sheets: Sheets,
    public fontFamily: string,
    private readonly clips: Int32Array,
  ) {
    this.back = document.createElement("canvas");
    this.back.width = SCREEN_W;
    this.back.height = SCREEN_H;
    this.ctx = this.back.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  tiles(mdt: Int32Array) {
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 20; c++) {
        let t = mdt[r * 20 + c];
        let id = 2;
        if (t >= 400) {
          id = 4;
          t -= 400;
        } else if (t >= 200) {
          id = 3;
          t -= 200;
        }
        const s = this.sheets.get(id);
        if (!s || t < 0) continue;
        const sx = (t % 20) * 32;
        const sy = Math.trunc(t / 20) * 32;
        this.ctx.drawImage(s.canvas, sx, sy, 32, 32, c * 32, r * 32, 32, 32);
      }
    }
  }

  sprite(x: number, y: number, spr: number, flags = 7, scaleX = 0x10000, scaleY = 0x10000) {
    const s = this.sheets.get((spr >>> 16) & 0xff);
    if (!s) return;
    const cell = s.frame(spr & 0xffff);
    if (!cell) return;
    let dx = x;
    let dy = y;
    let dw = cell.w;
    let dh = cell.h;
    if ((flags & 0x200) !== 0) {
      const hw = Math.trunc(cell.w / 2);
      const hh = Math.trunc(cell.h / 2);
      dx = x + hw - Math.trunc((scaleX * hw) / 0x10000);
      dy = y + hh - Math.trunc((scaleY * hh) / 0x10000);
      dw = Math.trunc((cell.w * scaleX) / 0x10000);
      dh = Math.trunc((cell.h * scaleY) / 0x10000);
    }
    const k = (flags & 7) * 4;
    const l = Math.max(dx, this.clips[k] >> 16);
    const t = Math.max(dy, this.clips[k + 1] >> 16);
    const r = Math.min(dx + dw, this.clips[k + 2] >> 16);
    const b = Math.min(dy + dh, this.clips[k + 3] >> 16);
    if (r <= l || b <= t || dw <= 0 || dh <= 0) return;
    const kx = cell.w / dw;
    const ky = cell.h / dh;
    this.ctx.drawImage(
      s.canvas,
      cell.sx + (l - dx) * kx,
      cell.sy + (t - dy) * ky,
      (r - l) * kx,
      (b - t) * ky,
      l,
      t,
      r - l,
      b - t,
    );
  }

  objects(list: Obj[]) {
    for (const o of list) this.sprite((o.x / 0x10000) | 0, (o.y / 0x10000) | 0, o.spr, o.drawFlags, o.scaleX, o.scaleY);
  }

  textWidth(text: string, font: number): number {
    const f = FONTS[font] ?? FONTS[0];
    this.ctx.font = `${f.bold ? "bold " : ""}${f.height}px ${this.fontFamily}`;
    return this.ctx.measureText(text).width;
  }

  text(x: number, y: number, text: string, font: number) {
    const f = FONTS[font] ?? FONTS[0];
    this.ctx.font = `${f.bold ? "bold " : ""}${f.height}px ${this.fontFamily}`;
    this.ctx.textBaseline = "top";
    this.ctx.fillStyle = "#fff";
    this.ctx.fillText(text, x, y);
  }

  box(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.globalAlpha = 0.25;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.globalAlpha = 1;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  dot(x: number, y: number, size: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - (size >> 1), y - (size >> 1), size, size);
  }

  present(dx: number, dy: number) {
    this.screen.fillStyle = "#000";
    this.screen.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.screen.drawImage(this.back, dx, dy);
  }
}
