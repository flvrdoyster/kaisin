import { Obj } from "../obj.ts";
import { countHit, cos, dir64, free, inAttackRect, nsin, rand, seRequest, spawn, touchPlayer, G } from "../core.ts";
import { smokeRise } from "../effects.ts";
import { spawnHeart } from "./misc.ts";

const wrap = (d: number) => (d > 0x3f ? d - 0x40 : d < 0 ? d + 0x40 : d);

function chipUpdate(o: Obj) {
  const vy = o.f4c;
  const t = o.f38;
  o.f4c = vy + 0x20000;
  o.y += vy + 0x20000;
  o.f38 = t + 1;
  o.x += o.f48;
  if (t + 1 > 10) free(o);
}

function chip(x: number, y: number) {
  const o = spawn(chipUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x40000;
  o.y = y - 0x40000;
  o.spr = rand(4) + 0xc007a;
  o.f3c = y;
  o.f48 = (rand(7) - 3) * 0x10000;
  o.f4c = (-6 - rand(4)) * 0x10000;
  o.f34 = 4;
  o.f58 = 1;
}

export function partUpdate(_o: Obj) {}

export function jointUpdate(o: Obj) {
  const d0 = o.f48;
  o.f48 = d0 + 0x20 > 0x3f ? d0 - 0x20 : d0 + 0x20;
  o.x = o.f38 - 0x80000;
  o.y = o.f3c - 0x80000;
  const t = G.t.jointOffsets;
  const k = o.f40 * 3;
  let x = o.x;
  let y = o.y;
  const segs = [o.p4c!, o.p54!, o.p50!];
  for (let i = 0; i < 3; i++) {
    const d = wrap(t[k + i] + o.f48);
    x += cos(d) * 8;
    y += nsin(d) * 8;
    segs[i].x = x;
    segs[i].y = y;
  }
  o.f40++;
  if (o.f40 > 0xb) o.f40 = 0;
}

export function setFrames(o: Obj, eye: number, add: number) {
  o.p38!.spr = eye;
  o.p3c!.spr = eye;
  o.p2c!.spr = add + 0xe0000;
  const j = o.p48!;
  j.spr = add + 0xe0001;
  j.p4c!.spr = add + 0xe0002;
  j.p54!.spr = add + 0xe0002;
  j.p50!.spr = add + 0xe0002;
}

function headDie(o: Obj) {
  spawnHeart(o.x, o.y);
  free(o.p38!);
  free(o.p3c!);
  free(o.p2c!);
  const j = o.p48!;
  free(j.p4c!);
  free(j.p54!);
  free(j.p50!);
  free(j);
  free(o);
  countHit();
}

function headUpdate(o: Obj) {
  const x0 = o.x;
  const y0 = o.y;
  if (o.f54 > 3) {
    for (let i = 0; i < 6; i++) {
      const y = (rand(0x20) + 0xe0) * 0x10000;
      chip((rand(0x20) + 0xf0) * 0x10000, y);
    }
    o.f54--;
    o.x = o.f40;
    o.f40 = x0;
    o.y = o.f44;
    o.f44 = y0;
  } else {
    const tx = o.f40;
    o.x = ((tx - x0) >> 3) + x0;
    o.y = ((o.f44 - y0) >> 3) + y0;
    if (((x0 ^ o.x) & ~0xff) === 0 && ((y0 ^ o.y) & ~0xff) === 0) {
      o.f40 = (rand(0xc0) - 0x60) * 0x10000 + tx;
      o.f44 += (rand(0xc0) - 0x60) * 0x10000;
      if (o.f40 < 0x200000) o.f40 = 0x200000;
      else if (o.f40 > 0x1e00000) o.f40 = 0x1e00000;
      if (o.f44 < 0x200000) o.f44 = 0x200000;
      else if (o.f44 > 0x1c00000) o.f44 = 0x1c00000;
      o.f50 = dir64(o.x, o.y, o.f40, o.f44);
    }
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
  if (o.f4c < 2) {
    if (o.f4c === 1) setFrames(o, 0xe0003, 0);
    else if (inAttackRect(o.x, o.y)) {
      seRequest(0);
      o.f4c = 0x14;
      o.f54--;
      if (o.f54 < 1) {
        seRequest(1);
        o.update = headDie;
        smokeRise(o.x + 0x100000, o.y + 0x100000, 0xf);
      }
    } else touchPlayer(o.x - 0x100000, o.y - 0x100000, o.x + 0x100000, o.y + 0x100000);
  } else setFrames(o, 0xe0007, (o.f4c & 1) * 4);
  if (o.f4c !== 0) o.f4c--;
}

export function part(
  x: number,
  y: number,
  spr: number,
  update: (o: Obj) => void = partUpdate,
  layer = 2,
  drawFlags = 0,
): Obj | null {
  const o = spawn(update, layer);
  if (!o) return null;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = spr;
  o.f34 = 1;
  o.drawFlags = drawFlags;
  return o;
}

export function spawnJointBoss(a: number, b: number) {
  const d = dir64(a, b, 0x1000000, 0xf00000);
  const h = spawn(headUpdate, 1);
  if (!h) return;
  h.kind = 2;
  h.x = a;
  h.y = b;
  h.f50 = d;
  h.f54 = 0x14;
  h.f40 = cos(d) * 3 + a;
  h.f44 = nsin(d) * 3 + b;
  h.f4c = 0;
  h.p38 = part(a, b, 0xe0003);
  h.p3c = part(a, b, 0xe0003);
  const j = part(a, b, 0xe0001, jointUpdate)!;
  h.p48 = j;
  j.f38 = a;
  j.f3c = b;
  j.f48 = 0x10;
  j.p4c = part(a, b, 0xe0002);
  j.p54 = part(a, b, 0xe0002);
  j.p50 = part(a, b, 0xe0002);
  h.p2c = part(a, b, 0xe0000);
  h.f34 = 4;
}
