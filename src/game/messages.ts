import { Obj } from "./obj.ts";
import { bgmPlay } from "../audio/bgm.ts";
import { G, spawn, free } from "./core.ts";

function bossClearedUpdate(o: Obj) {
  if (o.f48 < 1) {
    o.f54++;
    if (o.f50 < o.f54) {
      G.clearFlag = 1;
      free(o);
    }
    return;
  }
  o.f48--;
  if (o.f48 < 1) bgmPlay(7);
}

export function bossCleared(frames: number) {
  const o = spawn(bossClearedUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f48 = 0x1e;
  o.f54 = 0;
  o.f50 = frames;
  o.f34 = 4;
}

function glyphUpdate(o: Obj) {
  o.x += (o.f38 - o.x) >> 2;
  o.y += (o.f3c - o.y) >> 2;
  if (o.f40 < 10000) o.f44++;
  if (o.f40 < o.f44) free(o);
}

export function spawnGlyph(x: number, y: number, tx: number, ty: number, spr: number, life: number) {
  const o = spawn(glyphUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = spr;
  o.f40 = life;
  o.f38 = tx;
  o.f3c = ty;
  o.f34 = 2;
}

function messageUpdate(o: Obj) {
  const t = G.t.spriteMsgs;
  const base = o.f44 * 0x3c;
  const v = t[base + o.f54];
  if (v === -1) {
    free(o);
    return;
  }
  if (v === -2) {
    o.f54++;
    o.f40--;
    o.f38 += 0x200000;
    return;
  }
  if (v === -3) {
    o.f54++;
    o.f3c += 0x200000;
    o.f38 -= t[base + o.f54];
    o.f54++;
    o.f40--;
    return;
  }
  if (v > -1) {
    spawnGlyph(o.x, o.y, o.f38, o.f3c, v + 0xb0000, o.f40);
    o.f38 += 0x200000;
  }
  o.f54++;
  o.f40--;
}

export function spriteMessage(x: number, y: number, tx: number, ty: number, message: number, life: number) {
  const o = spawn(messageUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = y;
  o.f40 = life;
  o.f44 = message;
  o.f38 = tx;
  o.f3c = ty;
  o.f50 = 0;
  o.f54 = 0;
  o.f34 = 1;
}
