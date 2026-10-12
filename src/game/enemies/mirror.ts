import { Obj } from "../obj.ts";
import { G, spawn } from "../core.ts";

function still(_o: Obj) {}

function mirrorUpdate(o: Obj) {
  const px = G.playerCX;
  const py = G.playerCY;
  const dx = Math.sign(px - o.f48);
  const dy = Math.sign(py - o.f4c);
  o.f48 = px;
  o.f4c = py;
  if (dy === -1) {
    o.f3c += 0x40000;
    o.y += 0x40000;
  }
  if (dy === 1) {
    o.f3c -= 0x40000;
    o.y -= 0x40000;
  }
  if (dx === -1) {
    o.f38 += 0x40000;
    o.x += 0x40000;
  }
  if (dx === 1) {
    o.f38 -= 0x40000;
    o.x -= 0x40000;
  }
  o.spr = G.t.mirrorAnim[o.f44] + 0xe0000;
  o.f44 = o.f44 < 0xf ? o.f44 + 1 : 0;
}

export function spawnMirror() {
  const a = spawn(still, 3);
  const b = spawn(mirrorUpdate, 3);
  if (!a || !b) return;
  a.kind = 1;
  a.x = 0x1900000;
  a.y = 0x300000;
  a.spr = 0xe0000;
  a.p54 = b;
  a.f34 = 2;
  a.drawFlags = 1;
  b.kind = 1;
  b.x = 0xe00000;
  b.y = 0xe00000;
  b.spr = 0xe001c;
  b.f38 = b.x;
  b.f3c = b.y;
  b.f48 = G.playerCX;
  b.f4c = G.playerCY;
  b.f34 = 2;
  b.drawFlags = 1;
}
