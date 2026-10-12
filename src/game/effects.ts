import { Obj } from "./obj.ts";
import { FX, fix } from "./state.ts";
import { G, atrGet, cos, div, free, nsin, rand, spawn, wrap64 } from "./core.ts";

function particle(o: Obj, x: number, y: number, spr: number) {
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = spr;
  o.f34 = 2;
  o.f58 = 1;
}

function puffUpdate(o: Obj) {
  o.f54++;
  o.x += (rand(4) - 2) * FX;
  o.y += rand(5) * -FX;
  o.spr = o.f40 + 0xc0000;
  if (o.f40 > 0x1a) {
    free(o);
    return;
  }
  if (rand(8) < 5 || o.f54 > 9) {
    o.f54 = 0;
    o.f40++;
    if (o.f40 === 0x18) {
      o.x += 8 * FX;
      o.y += 8 * FX;
    }
  }
}

export function puff(x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) {
    const o = spawn(puffUpdate, 4);
    if (!o) return;
    const ox = (rand(32) - 16) * FX + x;
    const oy = (rand(32) - 16) * FX + y;
    particle(o, ox, oy, 0xc0014);
    o.f40 = 0x14;
  }
}

function sparkUpdate(o: Obj) {
  o.x += o.f48;
  o.y += o.f4c;
  o.spr ^= 0x50000;
  o.f48 = Math.trunc(o.f48 * 1.4);
  o.f4c = Math.trunc(o.f4c * 1.4);
  const f = o.f44;
  o.spr = (G.t.frames.sparkle[f] + 0x50000) | 0x50000;
  if (f < 7) o.f44 = f + 1;
  else free(o);
}

function sparks(x: number, y: number, v: [number, number][]) {
  for (const [vx, vy] of v) {
    const o = spawn(sparkUpdate, 2);
    if (!o) return;
    particle(o, x + 8 * FX, y + 8 * FX, 0x5002b);
    o.f48 = vx;
    o.f4c = vy;
  }
}

export function hitSpark(x: number, y: number) {
  sparks(x, y, [
    [FX, FX],
    [-FX, FX],
    [FX, -FX],
    [-FX, -FX],
  ]);
}

export function burst8(x: number, y: number) {
  const d = 0x16a09;
  sparks(x, y, [
    [FX, FX],
    [FX, -FX],
    [-FX, FX],
    [-FX, -FX],
    [d, 0],
    [-d, 0],
    [0, -d],
    [0, d],
  ]);
}

function debrisUpdate(o: Obj) {
  o.x += o.f48;
  o.y += o.f4c;
  o.spr ^= 0x50000;
  o.f48 = Math.trunc(o.f48 * 1.2);
  o.f4c = Math.trunc(o.f4c * 1.2);
  const f = o.f44;
  o.spr = (G.t.frames.chip[f] + 0x50000) | 0x50000;
  if (f < 9) o.f44 = f + 1;
  else free(o);
}

export function debris(x: number, y: number) {
  const offs: [number, number][] = [
    [-4, -4],
    [-4, -6],
    [-6, -4],
    [-6, -6],
  ];
  for (const [ax, ay] of offs) {
    const o = spawn(debrisUpdate, 2);
    if (!o) return;
    particle(o, x + 8 * FX, y + 8 * FX, 0x5002a);
    o.f48 = (rand(10) + ax) * FX;
    o.f4c = (rand(10) + ay) * FX;
  }
}

function smokeAUpdate(o: Obj) {
  o.x += o.f48;
  o.y += o.f4c;
  o.f48 = Math.trunc(o.f48 * 1.2);
  o.f4c = Math.trunc(o.f4c * 1.2);
  if (rand(2) === 1 && ++o.f44 === 4) {
    free(o);
    return;
  }
  o.spr = o.f40 + o.f44;
}

function smokeA(x: number, y: number) {
  const o = spawn(smokeAUpdate, 4);
  if (!o) return;
  const ox = (rand(0x2f) - 0x18) * FX + x;
  const oy = (rand(0x2f) - 0x18) * FX + y;
  particle(o, ox, oy, 0xc0000);
  o.f48 = div(ox - x, 0x14);
  o.f4c = div(oy - y, 0x14);
  o.f40 = 0xc0000;
}

function smokeAEmitter(o: Obj) {
  smokeA(o.x, o.y);
  smokeA(o.x, o.y);
  smokeA(o.x, o.y);
  if (o.f54 === 0) free(o);
  else o.f54--;
}

export function smokeBurst(x: number, y: number, n: number) {
  const o = spawn(smokeAEmitter, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x - 16 * FX;
  o.y = y - 16 * FX;
  o.f34 = 1;
  o.f54 = n;
}

function smokeBUpdate(o: Obj) {
  o.y -= o.f4c;
  o.f4c = Math.trunc(o.f4c * 1.2);
  if (rand(2) === 1 && ++o.f44 === 4) {
    free(o);
    return;
  }
  o.spr = o.f40 + o.f44 + 4;
}

function smokeB(x: number, y: number) {
  const o = spawn(smokeBUpdate, 4);
  if (!o) return;
  const ox = (rand(0x2f) - 0x18) * FX + x;
  const oy = (rand(0x2f) - 0x18) * FX + y;
  particle(o, ox, oy, 0xc0004);
  o.f4c = div(rand(0x30) * FX, 0x14);
  o.f40 = 0xc0000;
}

function smokeBEmitter(o: Obj) {
  smokeB(o.x, o.y);
  smokeB(o.x, o.y);
  smokeB(o.x, o.y);
  if (o.f54 === 0) free(o);
  else o.f54--;
}

export function smokeRise(x: number, y: number, n: number) {
  const o = spawn(smokeBEmitter, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x - 16 * FX;
  o.y = y - 16 * FX;
  o.f34 = 1;
  o.f54 = n;
  o.f58 = 1;
}

function shardUpdate(o: Obj) {
  const a = o.f48;
  o.spr ^= 0x50000;
  const sp = o.f4c;
  const s = fix(sp);
  o.x += nsin(a) * s;
  o.y += cos(a) * s;
  o.f4c = sp + 0x20000;
  o.f48 = a + 1 > 0x3f ? a - 0x3f : a + 1;
  const f = o.f44;
  o.spr = (G.t.frames.debris[f] + 0x50000) | 0x50000;
  if (f < 0xb) o.f44 = f + 1;
  else free(o);
}

export function shards(x: number, y: number) {
  rand(3);
  for (let a = 0; a < 0x40; a += 8) {
    const o = spawn(shardUpdate, 2);
    if (!o) return;
    particle(o, x, y, 0x5002f);
    o.f48 = a;
    o.f4c = FX;
    o.f54 = 0xe;
  }
}

function fragmentUpdate(o: Obj) {
  const sp = o.f54;
  o.x += cos(o.f50) * sp;
  o.y += nsin(o.f50) * sp;
  o.f4c++;
  o.f54 = sp >> 1;
  if (o.f4c > 3) free(o);
}

export function fragments(x: number, y: number, dir: number, frame: number) {
  let count = 0;
  for (;;) {
    const d = wrap64(dir - 4 + rand(9));
    const o = spawn(fragmentUpdate, 5);
    if (!o) return;
    count++;
    o.kind = 1;
    o.x = (rand(9) - 4) * FX + x - 16 * FX;
    o.y = (rand(9) - 4) * FX + y - 16 * FX;
    o.spr = frame + 0x60000;
    o.f54 = rand(0x50) + 0x14;
    o.f50 = d;
    o.f34 = 4;
    if (count > 9) return;
  }
}

function scoreDigitUpdate(o: Obj) {
  const f = o.f4c;
  o.y += G.t.scoreRise[f] * FX;
  if (f === 0) {
    free(o);
    return;
  }
  o.f4c = f - 1;
}

function scoreDigit(x: number, y: number, d: number): boolean {
  const o = spawn(scoreDigitUpdate, 5);
  if (!o) return false;
  particle(o, x, y, d + 0xb000c);
  o.f4c = 0x23;
  return true;
}

export function scorePopup(x: number, y: number, n: number) {
  const X = (x - 0x18) * FX;
  const Y = (y - 4) * FX;
  G.score += n;
  let lead = false;
  if (n > 999) {
    if (!scoreDigit(X, Y, div(n, 1000))) return;
    lead = true;
    n %= 1000;
  }
  if (lead || n > 99) {
    if (!scoreDigit(X + 10 * FX, Y, div(n, 100))) return;
    lead = true;
    n %= 100;
  }
  if (lead || n > 9) {
    if (!scoreDigit(X + 20 * FX, Y, div(n, 10))) return;
    n %= 10;
  }
  scoreDigit(X + 30 * FX, Y, n);
}

function sparkleUpdate(o: Obj) {
  let a = o.f48 + 2;
  if (a > 0x3f) a = o.f48 - 0x3e;
  o.f48 = a;
  o.x = nsin(a) * o.f4c - 8 * FX + G.playerCX;
  o.y = cos(a) * o.f4c - 8 * FX + G.playerCY;
  o.f40++;
  if (o.f40 > 3) {
    o.f40 = 0;
    if (o.spr < o.f44) o.spr++;
  }
  if (o.f4c > 9 && G.noHit !== 1) {
    o.f4c -= 3;
    return;
  }
  free(o);
}

export function sparkle(x: number, y: number) {
  const o = spawn(sparkleUpdate, 3);
  if (!o) return;
  particle(o, x - 8 * FX, y - 8 * FX, 0x5002b);
  o.f44 = 0x5002e;
  o.f38 = o.x;
  o.f3c = o.y;
  o.f48 = rand(0x3f);
  o.f4c = 0x3c;
}

function afterimageUpdate(o: Obj) {
  o.x += o.f48;
  o.y += o.f4c;
  o.spr ^= 0x50000;
  const f = o.f44;
  o.spr = (G.t.frames.sparkle[f] + 0x50000) | 0x50000;
  if (f < 7) o.f44 = f + 1;
  else free(o);
}

export function afterimage(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const offs: [number, number][] = [
    [-3, -3],
    [-3, -5],
    [-5, -3],
    [-5, -5],
  ];
  for (const [ax, ay] of offs) {
    const o = spawn(afterimageUpdate, 2);
    if (!o) return;
    const ox = (rand(32) - 16) * FX + x1;
    const oy = (rand(32) - 16) * FX + y1;
    particle(o, ox, oy, 0x5002b);
    o.f48 = (rand(10) + ax) * FX + dx;
    o.f4c = (rand(10) + ay) * FX + dy;
  }
}

function bugUpdate(o: Obj) {
  if (o.f38 < 0x96) {
    o.f38++;
    o.f48 = wrap64(o.f48 + rand(4) - 2);
  }
  o.x += cos(o.f48) * 2;
  o.y += nsin(o.f48) * 2;
  if (o.f4c === 1) o.y += G.t.frames.bugWiggle[o.f40];
  if (atrGet(fix(o.x) + 2, fix(o.y) + 2) !== 0) {
    free(o);
    return;
  }
  o.f40++;
  if (o.f40 > 3) o.f40 = 0;
  const d = o.f48;
  let off: number;
  if (d < 8) off = 4;
  else if (d < 0x18) off = 0;
  else if (d < 0x28) off = 8;
  else off = d > 0x37 ? 4 : 0xc;
  o.spr = o.f44 + o.f40 + off;
}

function spawnBugs(x: number, y: number, n: number) {
  while (n > 4) {
    const o = spawn(bugUpdate, 1);
    if (!o) return;
    n--;
    o.kind = 1;
    o.x = x;
    o.y = y;
    o.spr = 0x5003f;
    o.f44 = 0x5003f;
    o.f48 = rand(0x3f);
    o.f4c = rand(2);
    o.f34 = 4;
  }
}

export function bugs(x: number, y: number) {
  if (G.bugMode === 0) return;
  spawnBugs(x, y, rand(0x32));
}

export function bugSwarm(x: number, y: number) {
  spawnBugs(x, y, rand(0x1e));
}

function dustUpdate(o: Obj) {
  if (rand(2) === 1 && ++o.f44 === 4) {
    free(o);
    return;
  }
  o.spr = o.f44 + o.f40;
}

export function dust(x: number, y: number) {
  const o = spawn(dustUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc0000;
  o.f40 = 0xc0000;
  o.f34 = 2;
}
