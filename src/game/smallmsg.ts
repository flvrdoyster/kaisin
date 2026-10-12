import { Obj } from "./obj.ts";
import { G, cos, free, nsin, spawn } from "./core.ts";

function charUpdate(o: Obj) {
  if (o.f54 > 0) o.f54--;
  if (o.f54 > 0) o.f54--;
  o.f50 = o.f50 + 2 > 0x3f ? o.f50 - 0x3e : o.f50 + 2;
  const r = o.f54;
  o.x = cos(o.f50) * r + o.f38;
  o.y = nsin(o.f50) * r + o.f3c;
  if (r < 0x3d) {
    if (r < 0x29) {
      if (r < 0x15) o.spr = r < 0xb ? o.f44 : 0xb0073;
      else o.spr = 0xb0072;
    } else o.spr = 0xb0071;
  } else o.spr = 0xb0070;
  if (o.f40 < 1000) o.f40--;
  if (o.f40 < 1) free(o);
}

function spawnChar(x: number, y: number, code: number, life: number) {
  const o = spawn(charUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = cos(16) * 0x50 + x;
  o.y = nsin(16) * 0x50 + y;
  o.spr = 0xb0070;
  o.f40 = life;
  o.f44 = code + 0xb0000;
  o.f38 = x;
  o.f3c = y;
  o.f54 = 0x50;
  o.f50 = 0x10;
  o.f34 = 4;
}

function messageUpdate(o: Obj) {
  const v = G.t.smallMsgs[o.f44 * 0x3c + o.f4c];
  if (v === -2) {
    free(o);
    return;
  }
  if (v === -1) {
    o.y += 0x100000;
    o.x = o.f38;
  } else {
    if (v !== 0) spawnChar(o.x, o.y, v + 0x55, o.f40);
    o.x += 0x100000;
  }
  o.f4c++;
  if (o.f40 > 0) o.f40--;
}

export function smallMessage(x: number, y: number, message: number, life: number) {
  const o = spawn(messageUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = y;
  o.f40 = life;
  o.f44 = message;
  o.f38 = x;
  o.f3c = y;
  o.f34 = 4;
}
