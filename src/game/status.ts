import { Obj } from "./obj.ts";
import { G, cos, dir64, nsin, rand, spawn, spawnBack, free } from "./core.ts";
import { jointUpdate, part, setFrames } from "./enemies/joint.ts";
import { showText } from "./text.ts";
import { setLanguage } from "./language.ts";
import { Mode, saveMode } from "../settings.ts";

function decoUpdate(o: Obj) {
  const x0 = o.x;
  const y0 = o.y;
  const tx = o.f40;
  o.x = ((tx - x0) >> 3) + x0;
  o.y = ((o.f44 - y0) >> 3) + y0;
  if (((x0 ^ o.x) & ~0xff) === 0 && ((o.y ^ y0) & ~0xff) === 0) {
    o.f40 = (rand(0xc0) - 0x60) * 0x10000 + tx;
    o.f44 += (rand(0xc0) - 0x60) * 0x10000;
    if (o.f40 < 0x200000) o.f40 = 0x200000;
    else if (o.f40 > 0x2580000) o.f40 = 0x2580000;
    if (o.f44 < 0x200000) o.f44 = 0x200000;
    else if (o.f44 > 0x1c00000) o.f44 = 0x1c00000;
    o.f50 = dir64(o.x, o.y, o.f40, o.f44);
  }
  o.p2c!.x = o.x - 0x180000;
  o.p2c!.y = o.y - 0x180000;
  let d = o.f50 + 4 > 0x3f ? o.f50 - 0x3c : o.f50 + 4;
  o.p38!.x = cos(d) * 0x18 + o.x - 0x80000;
  o.p38!.y = nsin(d) * 0x18 + o.y - 0x80000;
  d = o.f50 - 4 < 0 ? o.f50 + 0x3c : o.f50 - 4;
  o.p3c!.x = cos(d) * 0x18 + o.x - 0x80000;
  o.p3c!.y = nsin(d) * 0x18 + o.y - 0x80000;
  d = o.f50 + 0x20 > 0x3f ? o.f50 - 0x20 : o.f50 + 0x20;
  const j = o.p48!;
  j.f38 = cos(d) * 0x18 + o.x;
  j.f3c = nsin(d) * 0x18 + o.y;
  j.f48 = o.f50;
  if (o.f4c === 1) setFrames(o, 0xe0003, 0);
  if (o.f4c !== 0) o.f4c--;
}

function spawnDeco(x: number, y: number) {
  const tx = (rand(0x40) - 0x20) * 0x10000 + x;
  const ty = (rand(0x40) - 0x20) * 0x10000 + y;
  const h = spawn(decoUpdate, 1);
  if (!h) return;
  h.kind = 2;
  h.x = x;
  h.y = y;
  h.f50 = dir64(x, y, tx, ty);
  h.f54 = 3;
  h.f40 = tx;
  h.f44 = ty;
  h.f4c = 0;
  h.p38 = part(x, y, 0xe0003, undefined, 3, 3);
  h.p3c = part(x, y, 0xe0003, undefined, 3, 3);
  const j = part(x, y, 0xe0001, jointUpdate, 2, 3)!;
  h.p48 = j;
  j.f38 = x;
  j.f3c = y;
  j.f48 = 0x10;
  j.p4c = part(x, y, 0xe0002, undefined, 2, 3);
  j.p54 = part(x, y, 0xe0002, undefined, 2, 3);
  j.p50 = part(x, y, 0xe0002, undefined, 2, 3);
  h.p2c = part(x, y, 0xe0000, undefined, 2, 3);
  h.f34 = 4;
  h.drawFlags = 3;
}

function arrowUpdate(o: Obj) {
  o.f40++;
  o.spr += (o.f40 - 1) * 4;
  if (o.spr > 0xe000b) free(o);
}

function arrow(x: number, y: number, k: number) {
  const o = spawnBack(arrowUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = k + 0xe0004;
  o.f34 = 1;
  o.drawFlags = 3;
}

const ROWS = 7;
const ROW_Y = [0x58, 0x80, 0xa8, 0xd0, 0xf8, 0x178, 0x1a0];

function applyMode() {
  G.invincible = G.mode === 2 ? 1 : 0;
  G.bugMode = G.mode === 1 ? 1 : 0;
}

function adjust(row: number, delta: number) {
  if (row < 5) {
    const v = G.hudSlots[row] + delta;
    G.hudSlots[row] = v > 8 ? 0 : v < 0 ? 8 : v;
  } else if (row === 5) {
    G.mode = ((G.mode + delta + 3) % 3) as Mode;
    saveMode(G.mode);
    applyMode();
  } else if (G.languages.length > 1) {
    setLanguage(G.lang === "kr" ? "jp" : "kr");
  }
}

function statusUpdate(o: Obj) {
  if (o.f54 === 0) {
    if ((G.input & 0x40) !== 0) {
      G.menu = 0;
      G.scene = 2;
      return;
    }
  } else {
    o.f54--;
  }
  showText(0xc0, 0x28, 0x99, 1);
  for (let i = 0; i < 5; i++) showText(0xe0, ROW_Y[i], G.hudSlots[i] + 0x9a, 1);
  showText(0xc0, 0x148, 174, 1);
  showText(0xe0, ROW_Y[5], 171 + G.mode, 1);
  showText(0xe0, ROW_Y[6], 170, 1);
  const up = G.input & 4;
  const down = G.input & 8;
  const right = G.input & 2;
  const left = G.input & 1;
  if (up + down + right + left === 0) {
    o.f50 = 0;
  } else if (o.f50 === 0) {
    o.f50 = 8;
    if (right !== 0) adjust(o.y, 1);
    if (left !== 0) adjust(o.y, -1);
    if (up !== 0) {
      o.y--;
      if (o.y < 0) o.y = ROWS - 1;
    }
    if (down !== 0) {
      o.y++;
      if (o.y > ROWS - 1) o.y = 0;
    }
  } else {
    o.f50--;
  }
  const y = ROW_Y[o.y] * 0x10000;
  arrow(0x1280000, y - 0x100000, 0);
  arrow(0x1280000, y + 0x200000, 2);
  arrow(0x1780000, y + 0x80000, 1);
  arrow(0xd00000, y + 0x80000, 3);
}

export function spawnStatusEdit() {
  for (let i = 0; i < 10; i++) {
    const y = (rand(0x1b8) + 0x14) * 0x10000;
    spawnDeco((rand(600) + 0x14) * 0x10000, y);
  }
  const o = spawn(statusUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.y = 0;
  o.f54 = 10;
  o.f34 = 1;
  o.drawFlags = 3;
}
