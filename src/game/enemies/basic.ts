import { Obj } from "../obj.ts";
import { FX, fix } from "../state.ts";
import {
  G,
  atrGet,
  countHit,
  cos,
  dir64,
  free,
  inAttackRect,
  nsin,
  rand,
  seRequest,
  spawn,
  strikeC,
  touchPlayer,
  wrap64,
} from "../core.ts";
import { burst8, dust, fragments, puff, scorePopup, shards, smokeBurst, smokeRise } from "../effects.ts";

const PX16 = 0x100000;
const outside480 = (x: number, y: number) => x < 0 || x > 0x1e00000 || y < 0 || y > 0x1c00000;

function walker(o: Obj, speed: number, pauseChance: number, pauseRange: number, pauseBase: number) {
  if (o.f54 === 0) {
    const d = dir64(o.x + PX16, o.y + PX16, G.playerCX, G.playerCY);
    o.f48 = d;
    const y0 = o.y;
    const nx = cos(d) * 16 + o.x;
    const ny = nsin(d) * 16 + y0;
    if (atrGet(fix(nx) + 16, fix(y0) + 16) === 0) o.x += cos(o.f48) * speed;
    if (atrGet(fix(o.x) + 16, fix(ny) + 16) === 0) o.y += nsin(o.f48) * speed;
    if (rand(pauseChance) < 2) o.f54 = rand(pauseRange) + pauseBase;
    o.f40++;
    if (o.f40 > 4) o.f40 = 0;
  } else {
    o.f54--;
    const prev = o.f40;
    o.f40 = prev + 1;
    if (prev + 1 < 4) o.f40 = prev + 5;
    if (o.f40 > 8) o.f40 -= 4;
  }
}

function zako1Die(o: Obj) {
  const cx = o.x + PX16;
  const cy = o.y + PX16;
  fragments(cx, cy, dir64(G.playerCX, G.playerCY, cx, cy), 0x25);
  scorePopup(fix(o.x) + 8, fix(o.y), 0x32);
  free(o);
  countHit();
}

export function zako1Walk(o: Obj) {
  walker(o, 2, 0x10, 0x14, 0x14);
  o.spr = o.f44 + o.f40;
  if (inAttackRect(o.x + PX16, o.y + PX16)) {
    o.f40 = 8;
    o.update = zako1Die;
    smokeBurst(o.x + PX16, o.y + PX16, 2);
    shards(o.x, o.y);
    seRequest(0);
    return;
  }
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
}

function initEnemy(o: Obj, a: number, b: number, spr: number) {
  o.kind = 1;
  o.x = a - PX16;
  o.y = b - PX16;
  o.spr = spr;
  o.f40 = 0;
  o.f44 = spr;
  o.f38 = a;
  o.f3c = b;
  o.f34 = 1;
}

export function spawnZako1(a: number, b: number) {
  const o = spawn(zako1Walk, 2);
  if (!o) return;
  initEnemy(o, a, b, 0x60000);
  o.f48 = rand(0x3f);
  o.f54 = 0;
  puff(a, b, 2);
}

export function zako2Fall(o: Obj) {
  const f = o.f40;
  if (f > 7) {
    scorePopup(fix(o.x) + 8, fix(o.y), 0x50);
    free(o);
    countHit();
    return;
  }
  o.spr = G.t.frames.zako2Fall[f] + o.f44;
  o.f40 = f + 1;
  o.y += 0x20000;
  o.x += rand(2) - 1;
}

function zako2Hit(o: Obj): boolean {
  if (!inAttackRect(o.x + PX16, o.y + PX16)) return false;
  o.update = zako2Fall;
  o.f40 = 0;
  smokeRise(o.x + PX16, o.y + PX16, 6);
  seRequest(0);
  return true;
}

function zako2Anim(o: Obj) {
  o.f40++;
  if (o.f40 > 7) o.f40 = 0;
  o.spr = G.t.frames.zako2Fly[o.f40] + o.f44;
}

function zako2Chase(o: Obj) {
  let d = dir64(o.x + PX16, o.y + PX16, G.playerCX, G.playerCY);
  o.f48 = wrap64(d);
  d = o.f48;
  const nx = cos(d) * 4 + o.x;
  const ny = nsin(d) * 4 + o.y;
  o.x = nx;
  o.y = ny;
  if (nx < 0 || nx > 0x2800000 || ny < 0 || ny > 0x1e00000) {
    o.f48 = d + 0x20;
    if (d + 0x20 > 0x3f) o.f48 = d - 0x20;
  }
  zako2Anim(o);
  if (zako2Hit(o)) return;
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
}

export function spawnZako2(a: number, b: number) {
  const o = spawn(zako2Chase, 3);
  if (!o) return;
  initEnemy(o, a, b, 0x70000);
  o.f48 = rand(0x3f);
  o.f54 = 0;
  puff(a, b, 2);
}

function accelerate(o: Obj) {
  o.f4c = Math.trunc(o.f4c * 1.05 + 6553.6);
  if (o.f4c > 0xf0000) o.f4c = 0xf0000;
}

function zako2Straight(o: Obj) {
  const sp = fix(o.f4c);
  const x = cos(o.f48) * sp + o.x;
  const y = nsin(o.f48) * sp + o.y;
  o.x = x;
  o.y = y;
  if (outside480(x, y)) {
    puff(x, y, 1);
    free(o);
    return;
  }
  zako2Anim(o);
  accelerate(o);
  if (zako2Hit(o)) return;
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
}

export function spawnZako2Straight(a: number, b: number, dir: number) {
  const o = spawn(zako2Straight, 3);
  if (!o) return;
  initEnemy(o, a, b, 0x70000);
  o.f48 = dir;
  o.f4c = 0x1999;
  o.f54 = 0;
  puff(a, b, 2);
}

function zako1bDie(o: Obj) {
  o.f40++;
  if (o.f40 > 0xb) {
    scorePopup(fix(o.x) + 8, fix(o.y), 0x32);
    o.f40 = 0xb;
    free(o);
    countHit();
    return;
  }
  o.spr = o.f44 + o.f40 + 0xc;
}

export function zako1bWalk(o: Obj) {
  walker(o, 3, 0x30, 0xf, 10);
  o.spr = o.f44 + o.f40 + 0xc;
  if (inAttackRect(o.x + PX16, o.y + PX16)) {
    o.f40 = 8;
    o.update = zako1bDie;
    smokeBurst(o.x + PX16, o.y + PX16, 6);
    shards(o.x, o.y);
    seRequest(0);
    return;
  }
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
}

export function spawnZako1b(a: number, b: number) {
  const o = spawn(zako1bWalk, 2);
  if (!o) return;
  initEnemy(o, a, b, 0x60000);
  o.f48 = rand(0x3f);
  o.f54 = 0;
  puff(a, b, 2);
}

function zako2Spiral(o: Obj) {
  const a = o.f4c;
  if (o.f54 === 0) {
    o.f4c = a + 1 > 0x3f ? a - 0x3f : a + 1;
    const r = o.f48;
    const c = cos(o.f4c);
    const s = nsin(o.f4c);
    o.x = c * r + 0x1000000;
    o.f50 = 0;
    o.y = s * r + 0xf00000;
    o.f48 = r - 1;
    if (r - 1 < 0) {
      o.f54 = 1;
      o.f48 = 0;
      o.f4c = dir64(c * r + 0x1100000, s * r + 0x1000000, G.playerCX, G.playerCY);
    }
  } else {
    const v = o.f48;
    const x = cos(a) * v + o.x;
    o.x = x;
    const y = nsin(a) * v + o.y;
    const nv = ((o.f50 / 10) | 0) + v;
    o.y = y;
    o.f48 = nv > 0xf0000 ? 0xf0000 : nv;
    o.f50 += 5;
    if (outside480(x, y)) {
      puff(x, y, 1);
      free(o);
      return;
    }
  }
  zako2Anim(o);
  if (zako2Hit(o)) return;
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
}

export function spawnZako2Spiral(a: number, b: number, radius: number) {
  const o = spawn(zako2Spiral, 3);
  if (!o) return;
  initEnemy(o, a, b, 0x70000);
  o.f48 = radius;
  o.f4c = dir64(0x1000000, 0xf00000, a, b);
  o.f54 = 0;
  o.f50 = 0;
  puff(a, b, 2);
}

function markerUpdate(o: Obj) {
  o.y = o.f3c;
  if (o.f48 > 4) o.y = -0x320000;
  o.f48++;
  if (o.f48 > 8) {
    o.f48 = 0;
    o.f40++;
    if (o.f40 > 2) free(o);
  }
}

export function spawnMarker(a: number, b: number) {
  const o = spawn(markerUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = a;
  o.y = b;
  o.spr = 0x5005b;
  o.f44 = 0x5005b;
  o.f38 = a;
  o.f3c = b;
  o.f34 = 1;
}

const BOUNCE_PROBE: [number, number][] = [
  [0x18, 6],
  [0x2a, 0x18],
  [0x18, 0x2a],
  [6, 0x18],
];

function bouncerUpdate(o: Obj) {
  if (outside480(o.x, o.y)) {
    free(o);
    return;
  }
  o.f40++;
  if (o.f40 > 3) o.f40 = 0;
  o.spr = G.t.frames.bounce4dir[o.f48 * 4 + o.f40] + o.f44;
  const dir = o.f48;
  const step = [
    [0, -0x40000],
    [0x40000, 0],
    [0, 0x40000],
    [-0x40000, 0],
  ][dir];
  if (step) {
    o.x += step[0];
    o.y += step[1];
    const [px, py] = BOUNCE_PROBE[dir];
    if (atrGet(fix(o.x) + px, fix(o.y) + py) !== 0) {
      strikeC(fix(o.x) + px, fix(o.y) + py);
      o.x -= step[0];
      o.y -= step[1];
      const back = [2, 3, 0, 1][dir];
      o.f48 = back;
      o.spr = o.f44 + [8, 0xb, 9, 0xa][dir];
      seRequest(4);
      const spark: [number, number][] = [
        [o.x + 0x80000, o.y - 0xa0000],
        [o.x + 0x1a0000, o.y + 0x80000],
        [o.x + 0x80000, o.y + 0x1a0000],
        [o.x - 0xa0000, o.y + 0x80000],
      ];
      const [sx, sy] = spark[dir];
      burst8(sx, sy);
    }
  }
  touchPlayer(o.x, o.y, o.x + 0x300000, o.y + 0x300000);
}

export function spawnBouncer(a: number, b: number, dir: number) {
  const o = spawn(bouncerUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = a;
  o.y = b;
  o.spr = 0xe0000;
  o.f44 = 0xe0000;
  o.f38 = a;
  o.f3c = b;
  o.f48 = dir;
  o.f4c = 0;
  o.f54 = 0;
  o.f50 = 0;
  o.f34 = 2;
}

function bulletReflected(o: Obj) {
  const x = cos(o.f48) * o.f4c + o.x;
  const y = nsin(o.f48) * o.f4c + o.y;
  o.x = x;
  o.y = y;
  if (x >= 0 && x < 0x1e00001 && y >= 0 && y < 0x1c00001) return;
  puff(x, y, 1);
  free(o);
}

function bulletUpdate(o: Obj) {
  const x = cos(o.f48) * o.f4c + o.x;
  const y = nsin(o.f48) * o.f4c + o.y;
  o.x = x;
  o.y = y;
  if (x >= 0 && x < 0x1e00001 && y >= 0 && y < 0x1c00001) {
    if (inAttackRect(o.x + 0x80000, o.y + 0x80000)) {
      o.spr = 0xc0026;
      o.update = bulletReflected;
      o.f4c <<= 1;
      o.f48 = dir64(G.playerCX, G.playerCY, o.x + 0x80000, o.y + 0x80000);
      seRequest(4);
    }
    touchPlayer(o.x + 0x20000, o.y + 0x20000, o.x + 0xe0000, o.y + 0xe0000);
    return;
  }
  puff(x, y, 1);
  free(o);
}

export function spawnBullet(x: number, y: number, dir: number) {
  const o = spawn(bulletUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc0008;
  o.f38 = x;
  o.f3c = y;
  o.f48 = dir;
  o.f4c = 8;
  o.f34 = 4;
}

function turretUpdate(o: Obj) {
  if (o.f48 < 1) {
    if (o.f4c === 0) {
      puff(o.x, o.y, 1);
      free(o);
      return;
    }
    o.f4c--;
    spawnBullet(o.x + 0x80000, o.y, o.f38);
    const a = o.f38;
    o.f38 = a + 2 > 0x3f ? a - 0x3e : a + 2;
  } else {
    o.f4c = 0x40;
    o.f48--;
  }
  zako2Anim(o);
  if (inAttackRect(o.x + PX16, o.y + PX16)) {
    o.update = zako2Fall;
    o.f40 = 0;
    smokeRise(o.x + PX16, o.y + PX16, 6);
    seRequest(1);
  }
}

export function spawnTurret(a: number, b: number) {
  const o = spawn(turretUpdate, 3);
  if (!o) return;
  o.kind = 1;
  o.x = a - PX16;
  o.y = b - PX16;
  o.spr = 0x70000;
  o.f40 = 0;
  o.f44 = 0x70000;
  o.f38 = 0x10;
  o.f48 = 0x14;
  o.f4c = 0x1e;
  o.f34 = 1;
  puff(a, b, 2);
}

function fallerShadow(o: Obj) {
  const b = o.p54!;
  o.y = (rand(5) + 0x1c) * FX + b.y;
  o.x = (rand(4) + 6) * FX + b.x;
}

function fallerRise(o: Obj) {
  const y = o.y - o.f4c;
  o.y = y;
  o.f4c = Math.trunc(o.f4c * 1.2);
  if (o.f4c > 0x200000) o.f4c = 0x200000;
  if (y < 0) {
    puff(o.x, y, 1);
    free(o);
    return;
  }
  dust(rand(0x20) * FX + o.x, y + 0x180000);
}

function fallerUpdate(o: Obj) {
  const shadow = o.p54;
  const a = o.f4c;
  o.f4c = a + 2 > 0x3f ? a - 0x3e : a + 2;
  const x = nsin(o.f4c) * 8 + o.f38;
  o.f48++;
  o.x = x;
  if (o.f48 > 5) o.f48 = 1;
  const y = o.f48 * FX + o.y;
  o.y = y;
  if (y > 0x1c00000) {
    const d = dir64(x + PX16, y - 0x80000, G.playerCX, G.playerCY);
    spawnBullet(o.x + PX16, o.y - 0x80000, d);
    puff(o.x, o.y, 1);
    free(shadow);
    free(o);
    return;
  }
  if (inAttackRect(o.x + PX16, o.y + PX16)) {
    seRequest(0);
    scorePopup(fix(o.x) + 0x10, fix(o.y), 0x1d);
    o.update = fallerRise;
    o.spr = 0xc0011;
    o.f4c = 0x40000;
    smokeRise(o.x + PX16, o.y + PX16, 4);
    free(shadow);
    return;
  }
  touchPlayer(o.x + 0x40000, o.y + 0x40000, o.x + 0x2c0000, o.y + 0x2c0000);
}

export function spawnFaller(a: number) {
  const shadow = spawn(fallerShadow, 2);
  if (!shadow) return;
  const o = spawn(fallerUpdate, 2);
  if (!o) {
    free(shadow);
    return;
  }
  shadow.kind = 1;
  shadow.x = a + 0x80000;
  shadow.y = 0x200000;
  shadow.spr = 0xc0012;
  shadow.p54 = o;
  shadow.f34 = 1;
  o.kind = 1;
  o.x = a;
  o.y = 0;
  o.spr = rand(7) + 0xc0009;
  o.f38 = rand(0x1e0) * FX;
  o.p54 = shadow;
  o.f34 = 1;
  puff(a + 0x80000, 0x80000, 1);
}

function decoUpdate(o: Obj) {
  o.f40++;
  if (o.f48 <= o.f40) o.f40 = 0;
  o.spr = o.f44 + o.f40;
}

export function spawnDeco(a: number, b: number, frame: number, count: number, layer: number) {
  const o = spawn(decoUpdate, layer);
  if (!o) return;
  o.kind = 1;
  o.x = a;
  o.y = b;
  o.spr = frame + 0xd0000;
  o.f44 = frame + 0xd0000;
  o.f48 = count;
  o.f34 = 2;
  o.f58 = 1;
}
