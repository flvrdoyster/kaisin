import { Obj } from "../obj.ts";
import { G, countHit, cos, dir64, free, inAttackRect, nsin, rand, seRequest, spawn, touchPlayer } from "../core.ts";
import { puff } from "../effects.ts";

const inside = (x: number, y: number) => x > -1 && x < 0x1e00001 && y > -1 && y < 0x1c00001;

function smokeUpdate(o: Obj) {
  o.y += (-1 - rand(3)) * 0x10000;
  o.x = (rand(3) - 1) * 0x10000 + o.f38;
  if (rand(0xf) > 6) {
    o.spr--;
    if (o.spr < 0xc0057) free(o);
  }
}

function smoke(n: number) {
  for (let i = 0; i < n; i++) {
    const o = spawn(smokeUpdate, 3);
    if (!o) return;
    o.kind = 1;
    o.x = (rand(0x24) + 0xe8) * 0x10000;
    o.y = (rand(8) + 0x58) * 0x10000;
    o.spr = 0xc005e;
    o.f38 = o.x;
    o.f34 = 4;
  }
}

function ballLost(o: Obj) {
  puff(o.x, o.y, 1);
  o.p54!.p50 = null;
  free(o);
}

function ballReturned(o: Obj) {
  const oldY = o.y;
  o.x += cos(o.f48) * o.f4c;
  o.y += nsin(o.f48) * o.f4c;
  const pitcher = o.p54!;
  const counter = pitcher.p54!;
  if (oldY < 0x600000 && o.y < 0x600001 && counter.f48 === 10) {
    pitcher.f4c = 9;
    free(o);
    return;
  }
  if (inside(o.x, o.y)) return;
  pitcher.p50 = null;
  counter.f48++;
  puff(o.x, o.y, 1);
  free(o);
}

function ballHittable(o: Obj) {
  o.x += cos(o.f48) * o.f4c;
  o.y += nsin(o.f48) * o.f4c;
  if (inside(o.x, o.y)) {
    if (inAttackRect(o.x + 0x80000, o.y + 0x80000) && o.y > 0xe00000) {
      seRequest(4);
      o.spr = 0xc0053;
      o.update = ballReturned;
      o.f4c <<= 1;
      if (o.p54!.p54!.f48 === 10) {
        o.f4c = 0x20;
        o.f48 = 0x10;
      } else {
        const a = rand(2);
        const b = rand(5);
        o.f48 = b + a * 10 + 9;
      }
    }
    touchPlayer(o.x, o.y, o.x + 0x100000, o.y + 0x100000);
    return;
  }
  ballLost(o);
}

function ballUnhittable(o: Obj) {
  o.x += cos(o.f48) * o.f4c;
  o.y += nsin(o.f48) * o.f4c;
  if (o.y < 0x1400001) {
    if (o.y > 0x1100000) o.spr = 0xc0054;
  } else {
    o.spr = 0xc0063;
  }
  if (inside(o.x, o.y)) return;
  ballLost(o);
}

function spawnBall(x: number, y: number, dir: number, pitcher: Obj): Obj | null {
  const o = spawn(ballHittable, 5);
  if (!o) return null;
  if (rand(0xf) === 3) o.update = ballUnhittable;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc0053;
  o.f38 = x;
  o.f3c = y;
  o.f48 = dir;
  o.f4c = rand(0x10) + 8;
  o.p54 = pitcher;
  o.f34 = 4;
  return o;
}

function step(o: Obj, table: Int32Array, limit: number): boolean {
  o.spr = table[o.f40] + o.f44;
  o.f48++;
  if (o.f48 <= 1) return false;
  o.f48 = 0;
  o.f40++;
  if (o.f40 > limit) {
    o.f40 = 0;
    return true;
  }
  return false;
}

function pitcherUpdate(o: Obj) {
  const t = G.t.pitcher;
  const counter = o.p54!;
  switch (o.f4c) {
    case 0:
      o.spr = o.f44;
      o.f48++;
      if (o.f48 >= 0x3d) {
        o.f48 = 0;
        o.f4c = 3;
      }
      break;
    case 1:
      o.spr = t[1][o.f40] + o.f44;
      o.f48++;
      if (o.f48 > 1) {
        o.f48 = 0;
        o.f40++;
        if (o.f40 > 0xf) {
          o.f40 = 0;
          o.f4c = 5;
        }
        if (o.f40 === 10) {
          const x = o.x - 0x80000;
          const y = o.y + 0x80000;
          o.p50 = spawnBall(x, y, dir64(x, y, 0x1100000, 0x1800000), o);
        }
      }
      break;
    case 2:
      o.f40++;
      if (o.f40 < 0x15 || o.p50 !== null) break;
      o.f40 = 0;
      o.f48 = 0;
      o.f4c = 3;
      if (G.clearFlag === 0) break;
      o.f4c = 6;
      if (counter.f4c < 0xb) break;
      o.f4c = 3;
      break;
    case 3:
      if (step(o, t[3], 7) && rand(4) === 1) o.f4c = 4;
      if (G.clearFlag !== 0) smoke(0xf);
      break;
    case 4:
      if (step(o, t[4], 0xf)) o.f4c = 1;
      if (G.clearFlag !== 0) smoke(0xf);
      break;
    case 5:
      o.f4c = 2;
      o.spr = o.f44;
      break;
    case 6:
      if (step(o, t[6], 0xf)) o.f4c = 7;
      break;
    case 7:
      if (step(o, t[7], 0xf)) {
        counter.f4c++;
        if (counter.f4c > 9) o.f4c = 8;
      }
      break;
    case 8:
      if (step(o, t[8], 0xf)) o.f4c = 3;
      break;
    case 9:
      o.spr = 0xe0013;
      o.y -= 0x200000;
      if (o.y < 0) {
        puff(0x1000000, 0x100000, 8);
        countHit();
        free(o);
      }
      break;
  }
}

function counterUpdate(o: Obj) {
  o.spr = o.f48 + 0xb0000;
  if (o.f48 > 2) {
    o.spr = 0xb0054;
    G.clearFlag = 1;
  }
}

function still(_o: Obj) {}

export function spawnPitcher(a: number, b: number) {
  const p = spawn(pitcherUpdate, 3);
  const c = spawn(counterUpdate, 1);
  const d = spawn(still, 1);
  if (!p || !c || !d) return;
  p.kind = 1;
  p.x = a;
  p.y = b;
  p.spr = 0xe0000;
  p.f44 = 0xe0000;
  p.f38 = a;
  p.f3c = b;
  p.p54 = c;
  p.f34 = 1;
  c.kind = 1;
  c.x = 0x200000;
  c.y = 0x1800000;
  c.spr = 0xb0000;
  c.f34 = 2;
  d.kind = 1;
  d.x = 0x600000;
  d.y = 0x1800000;
  d.spr = 0xb0002;
  d.f34 = 2;
  puff(a, b, 1);
}
