import { Obj } from "../obj.ts";
import { FX, fix } from "../state.ts";
import {
  G,
  atrGet,
  blockSet,
  countHit,
  countSpawn,
  cos,
  dir64,
  div,
  free,
  healTouch,
  inAttackRect,
  nsin,
  rand,
  seRequest,
  spawn,
  strikeC,
  tileSet,
  touchPlayer,
  wrap64,
} from "../core.ts";
import { puff, scorePopup, shards, smokeBurst, smokeRise } from "../effects.ts";

const PX16 = 0x100000;
const inside480 = (x: number, y: number) => x >= 0 && x < 0x1e00001 && y >= 0 && y < 0x1c00001;

function sparkleRiseUpdate(o: Obj) {
  o.x = cos(o.f48) * o.f4c + o.f38;
  const r = rand(3);
  const a = o.f48;
  o.y += (-1 - r) * FX;
  o.f3c++;
  o.f48 = a + 3 > 0x3f ? a - 0x3d : a + 3;
  if (o.f3c > 0x1e) free(o);
}

export function sparkleRise(x: number, y: number) {
  const o = spawn(sparkleRiseUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - PX16;
  o.y = y - PX16;
  o.spr = 0xc002b;
  o.f38 = x - PX16;
  o.f48 = rand(0x40);
  o.f4c = 10;
  o.f34 = 1;
  o.f58 = 1;
}

export function heartWait(o: Obj) {
  if (healTouch(o.x - PX16, o.y - PX16, o.x + 0x300000, o.y + 0x300000, 1)) {
    sparkleRise(o.x + PX16, o.y + PX16);
    free(o);
  }
}

function heartBounce(o: Obj) {
  const v = o.f4c + 0x20000;
  const y = o.y + v;
  o.f4c = v;
  o.y = y;
  if (o.f3c < y) {
    o.y = o.f3c;
    if (v < 0x10001) {
      o.update = heartWait;
      return;
    }
    o.f4c = -Math.trunc(v * 0.6);
  }
}

export function spawnHeart(x: number, y: number) {
  const o = spawn(heartBounce, 2);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc0028;
  o.f3c = y;
  o.f4c = -0xa0000;
  o.f34 = 1;
  o.f58 = 1;
}

export function spawnFixedHeart(x: number, y: number, spr: number) {
  const o = spawn(heartWait, 2);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = spr;
  o.f34 = 1;
}

function heartFly(o: Obj) {
  const v = o.f4c;
  o.x += cos(o.f48) * v;
  o.y += nsin(o.f48) * v;
  o.f4c = div(v, 2);
  if (div(v, 2) === 0) o.update = heartWait;
}

function spawnFlyingHeart(x: number, y: number, dir: number) {
  const o = spawn(heartFly, 2);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc0028;
  o.f48 = dir;
  o.f4c = 0x20;
  o.f34 = 1;
}

function meatUpdate(o: Obj) {
  if (inAttackRect(o.x + 0x180000, o.y + 0x180000)) {
    seRequest(0);
    smokeRise(o.x + PX16, o.y + PX16, 6);
    for (const d of [0, 0xd, 0x1a, 0x26, 0x33]) spawnFlyingHeart(o.x + 0x80000, o.y + 0x80000, d);
    free(o);
    return;
  }
  if (healTouch(o.x, o.y, o.x + 0x300000, o.y + 0x300000, 5)) {
    sparkleRise(o.x + 0x180000, o.y + 0x180000);
    sparkleRise(o.x + 0x160000, o.y + 0x160000);
    sparkleRise(o.x + 0x180000, o.y + 0x1a0000);
    sparkleRise(o.x + 0x160000, o.y + 0x140000);
    sparkleRise(o.x + 0x180000, o.y + 0x1c0000);
    free(o);
  }
}

export function spawnMeat(x: number, y: number) {
  const o = spawn(meatUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc0027;
  o.f34 = 1;
}

function wallCrawlerUpdate(o: Obj) {
  const w = G.t.wallFollow;
  for (let step = 0; step < 3; step++) {
    let t = o.f54 * 12;
    let bx = fix(o.x) + 2;
    let by = fix(o.y) + 2;
    const a = atrGet(w[t] + bx, w[t + 1] + by);
    const b = atrGet(w[t + 2] + bx, w[t + 3] + by);
    const c = atrGet(w[t + 4] + bx, w[t + 5] + by);
    const d = atrGet(w[t + 6] + bx, w[t + 7] + by);
    if (a === 0 && b === 0 && (c !== 0 || d !== 0)) {
      o.x += w[t + 8];
      o.y += w[t + 9];
      bx = fix(o.x) + 2;
      by = fix(o.y) + 2;
      atrGet(w[t] + bx, w[t + 1] + by);
      atrGet(w[t + 2] + bx, w[t + 3] + by);
      const e = atrGet(w[t + 10] + bx, w[t + 11] + by);
      const f = atrGet(w[t + 6] + bx, w[t + 7] + by);
      if (e === 0 && f === 0) {
        const old = o.f54;
        o.f54 = old - 1;
        if (old - 1 < 0) o.f54 = old + 3;
      }
      continue;
    }
    if (a === 0 && b === 0 && c === 0 && d === 0) {
      t = o.f54 * 12;
      o.x += w[t + 8];
      o.y += w[t + 9];
      continue;
    }
    o.f54++;
    if (o.f54 > 3) o.f54 -= 4;
  }
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
  o.spr = 0x120011 - o.spr;
}

export function spawnWallCrawler(a: number, b: number, dir: number) {
  const o = spawn(wallCrawlerUpdate, 3);
  if (!o) return;
  o.kind = 1;
  o.x = a - PX16;
  o.y = b - PX16;
  o.spr = 0x90008;
  o.f54 = dir;
  o.f34 = 1;
}

function pathFlyerUpdate(o: Obj) {
  const p = G.t.paths;
  const k = (o.f44 * 0x40 + o.f54) * 2;
  let d = p[k];
  if (d > 0x40) {
    free(o);
    return;
  }
  o.f50++;
  if (p[k + 1] <= o.f50) {
    o.f50 = 0;
    o.f54++;
    if (o.f54 > 0x3f) {
      free(o);
      return;
    }
  }
  d = o.f40 + d;
  if (d > 0x3f) d -= 0x40;
  if (o.f4c & 2) d = d < 0x21 ? 0x10 - (d - 0x10) : 0x30 - (d - 0x30);
  if (o.f4c & 1) {
    let e = d - 0x10;
    if (e < 0) e = d + 0x30;
    e = e < 0x21 ? 0x10 - (e - 0x10) : 0x30 - (e - 0x30);
    d = e + 0x10;
    if (d > 0x3f) d = e - 0x30;
  }
  let f = d + 3;
  o.y += nsin(d) * 8;
  o.x += cos(d) * 8;
  if (f > 0x3f) f = d - 0x3d;
  o.spr = (f >> 3) + 0x90000;
  if (inAttackRect(o.x + 0x180000, o.y + 0x180000)) {
    seRequest(1);
    smokeRise(o.x + PX16, o.y + PX16, 6);
    scorePopup(fix(o.x) + 8, fix(o.y), 0x14);
    countHit();
    free(o);
    return;
  }
  touchPlayer(o.x + 0x80000, o.y + 0x80000, o.x + 0x280000, o.y + 0x280000);
}

export function spawnPathFlyer(a: number, b: number, base: number, path: number, flags: number) {
  const o = spawn(pathFlyerUpdate, 3);
  if (!o) return;
  o.kind = 1;
  o.x = a - 0x180000;
  o.y = b - 0x180000;
  o.spr = 0x90000;
  o.f40 = base;
  o.f44 = path;
  o.f4c = flags;
  o.f34 = 1;
  puff(a, b, 2);
}

function armoredDie(o: Obj) {
  o.f40++;
  if (o.f40 > 0xb) {
    scorePopup(fix(o.x) + 8, fix(o.y), 100);
    o.f40 = 0xc;
    G.counter518++;
    free(o);
    countHit();
    return;
  }
  o.spr = o.f44 + o.f40;
}

function armoredUpdate(o: Obj) {
  if (o.f54 === 0) {
    const d = dir64(o.x + PX16, o.y + PX16, G.playerCX, G.playerCY);
    o.f48 = d;
    const y0 = o.y;
    const nx = cos(d) * 16 + o.x;
    const ny = nsin(d) * 16 + y0;
    if (atrGet(fix(nx) + 16, fix(y0) + 16) === 0) o.x += cos(o.f48) * 2;
    if (atrGet(fix(o.x) + 16, fix(ny) + 16) === 0) o.y += nsin(o.f48) * 2;
    if (rand(0x16) < 2) o.f54 = rand(0x14) + 0xd;
    o.f40++;
    if (o.f40 > 4) o.f40 = 0;
  } else {
    o.f54--;
    const prev = o.f40;
    o.f40 = prev + 1;
    if (prev + 1 < 4) o.f40 = prev + 5;
    if (o.f40 > 8) o.f40 -= 4;
  }
  o.spr = o.f44 + o.f40;
  if (o.f50 === 0) {
    if (inAttackRect(o.x + PX16, o.y + PX16)) {
      seRequest(0);
      o.f4c--;
      if (o.f4c < 1) {
        seRequest(1);
        o.f40 = 8;
        o.update = armoredDie;
        smokeBurst(o.x + PX16, o.y + PX16, 6);
        shards(o.x, o.y);
        return;
      }
      o.f38 = o.x;
      o.f3c = o.y;
      o.f50 = 0xf;
      o.f48 = wrap64(dir64(G.playerCX, G.playerCY, o.x + PX16, o.y + PX16));
      for (let i = 0; i < 0x30; i++) {
        const tx = cos(o.f48) * 16 + o.f38;
        const ty = nsin(o.f48) * 16 + o.f3c;
        if (atrGet(fix(tx) + 16, fix(o.y) + 16) === 0) o.f38 += cos(o.f48);
        if (atrGet(fix(o.x) + 16, fix(ty) + 16) === 0) o.f3c += nsin(o.f48);
      }
      return;
    }
    touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
  } else {
    const t = o.f50 - 1;
    o.f50 = t;
    o.x += div(o.f38 - o.x, 2);
    o.y += div(o.f3c - o.y, 2);
    if (t & 1) o.spr = 0x60024;
  }
}

export function spawnArmored(a: number, b: number) {
  const o = spawn(armoredUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = a - PX16;
  o.y = b - PX16;
  o.spr = 0x60018;
  o.f44 = 0x60018;
  o.f48 = rand(0x3f);
  o.f4c = 3;
  o.f34 = 1;
  puff(a, b, 2);
}

function hiddenHeartUpdate(o: Obj) {
  if (atrGet(fix(o.x), fix(o.y)) !== 2) {
    spawnHeart(o.x, o.y);
    free(o);
  }
}

export function spawnHiddenHeart(x: number, y: number) {
  const o = spawn(hiddenHeartUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = y;
  o.f34 = 4;
  o.f58 = 1;
}

function popperFall(o: Obj) {
  const f = o.f40;
  if (f > 7) {
    scorePopup(fix(o.x) + 8, fix(o.y), 0x5a);
    countHit();
    free(o);
    return;
  }
  o.spr = G.t.frames.zako2Fall[f] + o.f44;
  o.f40 = f + 1;
  o.y += 0x30000;
  o.x += rand(2) - 1;
}

function popperFly(o: Obj) {
  const sp = fix(o.f4c);
  const x = cos(o.f48) * sp + o.x;
  const y = nsin(o.f48) * sp + o.y;
  o.x = x;
  o.y = y;
  if (x < 0 || x > 0x1e00000 || y < 0 || y > 0x1c00000) {
    puff(x, y, 1);
    free(o);
    return;
  }
  o.f40++;
  if (o.f40 > 7) o.f40 = 0;
  o.spr = G.t.frames.zako2Fly[o.f40] + o.f44;
  o.f4c = Math.trunc(o.f4c * 1.05 + 6553.6);
  if (o.f4c > 0xf0000) o.f4c = 0xf0000;
  if (inAttackRect(o.x + PX16, o.y + PX16)) {
    o.update = popperFall;
    o.f40 = 0;
    smokeRise(o.x + PX16, o.y + PX16, 6);
    seRequest(0);
    return;
  }
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
}

function popperOut(o: Obj) {
  const x = o.x + o.f48;
  const y = o.y + o.f4c;
  o.x = x;
  o.y = y;
  o.f48 >>= 1;
  o.f4c >>= 1;
  o.f54++;
  if (o.f54 > 10) {
    o.f4c = 0;
    o.update = popperFly;
    o.f48 = o.f50;
  }
  o.f40++;
  if (o.f40 > 1) o.f40 = 0;
  o.spr = G.t.frames.zako2Fly[o.f40] + o.f44 + 0xd;
}

function spawnPopper(x: number, y: number, dir: number) {
  let out = dir + 0x20;
  if (out > 0x3f) out = dir - 0x20;
  const o = spawn(popperOut, 3);
  if (!o) return;
  o.kind = 1;
  o.x = x - PX16;
  o.y = y - PX16;
  o.spr = 0x7000d;
  o.f44 = 0x70000;
  o.f38 = x;
  o.f3c = y;
  o.f48 = cos(dir) << 5;
  o.f4c = nsin(dir) << 5;
  o.f50 = out;
  o.f34 = 1;
  countSpawn();
}

function hiddenEnemyUpdate(o: Obj) {
  if (atrGet(fix(o.x), fix(o.y)) !== 2) {
    const d = wrap64(dir64(G.playerCX, G.playerCY, o.x + PX16, o.y + PX16) + o.f48);
    spawnPopper(o.x + PX16, o.y + PX16, d);
    free(o);
  }
}

export function spawnHiddenEnemy(x: number, y: number, rot: number) {
  const o = spawn(hiddenEnemyUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = y;
  o.f48 = rot;
  o.f34 = 4;
  o.f58 = 1;
}

function aimedBulletReflected(o: Obj) {
  const x = cos(o.f48) * o.f4c + o.x;
  const y = nsin(o.f48) * o.f4c + o.y;
  o.x = x;
  o.y = y;
  if (inside480(x, y)) return;
  puff(x, y, 1);
  free(o);
}

function aimedBulletUpdate(o: Obj) {
  const nx = cos(o.f48) * o.f4c + o.x;
  o.x = nx;
  const ny = nsin(o.f48) * o.f4c + o.y;
  o.y = ny;
  if (atrGet(fix(nx) + 8, fix(ny) + 8) === 0 && inside480(o.x, o.y)) {
    if (inAttackRect(o.x + 0x80000, o.y + 0x80000)) {
      o.spr = 0xc0026;
      o.update = aimedBulletReflected;
      o.f4c <<= 1;
      o.f48 = dir64(G.playerCX, G.playerCY, o.x + 0x80000, o.y + 0x80000);
      seRequest(4);
    }
    touchPlayer(o.x + 0x20000, o.y + 0x20000, o.x + 0xe0000, o.y + 0xe0000);
    return;
  }
  puff(o.x, o.y, 1);
  free(o);
}

function spawnAimedBullet(x: number, y: number, dir: number) {
  const o = spawn(aimedBulletUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x80000;
  o.y = y - 0x80000;
  o.spr = 0xc0008;
  o.f38 = o.x;
  o.f3c = o.y;
  o.f48 = dir;
  o.f4c = 8;
  o.f34 = 4;
}

function sniperCommon(o: Obj, twin: boolean): number {
  if (o.x !== o.f38) o.x += (o.f38 - o.x) >> 1;
  if (o.y !== o.f3c) o.y += (o.f3c - o.y) >> 1;
  if (twin) o.f50++;
  const d = dir64(o.x + 0x180000, o.y + 0x180000, G.playerCX, G.playerCY);
  o.f54++;
  if (o.f54 > 0xf) {
    o.f54 = 0;
    if (twin) {
      const a = d + 3 > 0x3f ? d - 0x3d : d + 3;
      const b = d - 3 < 0 ? d + 0x3d : d - 3;
      spawnAimedBullet(o.x + 0x180000, o.y + 0x180000, a);
      spawnAimedBullet(o.x + 0x180000, o.y + 0x180000, b);
    } else {
      spawnAimedBullet(o.x + 0x180000, o.y + 0x180000, d);
    }
    let back = d + 0x20;
    if (back > 0x3f) back = d - 0x20;
    o.x += cos(back) * 8;
    o.y += nsin(back) * 8;
  }
  let f = d + 4;
  if (f > 0x3f) f = d - 0x3c;
  o.spr = (f >> 3) + 0x90000;
  return d;
}

function sniperUpdate(o: Obj) {
  sniperCommon(o, false);
  if (inAttackRect(o.x + 0x180000, o.y + 0x180000)) {
    seRequest(4);
    smokeRise(o.x + 0x180000, o.y + 0x180000, 0xc);
    scorePopup(fix(o.x) + 8, fix(o.y), 0x96);
    G.clearFlag = 1;
    free(o);
    countHit();
  }
}

export function spawnSniper(a: number, b: number) {
  const o = spawn(sniperUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = a - 0x180000;
  o.y = b - 0x180000;
  o.spr = 0x90000;
  o.f38 = o.x;
  o.f3c = o.y;
  o.f34 = 2;
  o.f58 = 1;
}

function twinSniperUpdate(o: Obj) {
  sniperCommon(o, true);
  if (inAttackRect(o.x + 0x180000, o.y + 0x180000)) {
    countHit();
    seRequest(2);
    smokeRise(o.x + 0x180000, o.y + 0x180000, 0xc);
    scorePopup(fix(o.x) + 8, fix(o.y), 0x96);
    free(o);
    return;
  }
  if (o.f50 > 0x46) {
    puff(o.x + 0x80000, o.y + 0x80000, 1);
    free(o);
  }
}

export function spawnTwinSniper(a: number, b: number) {
  const o = spawn(twinSniperUpdate, 3);
  if (!o) return;
  o.kind = 1;
  o.x = a - 0x180000;
  o.y = b - 0x180000;
  o.spr = 0x90000;
  o.f38 = o.x;
  o.f3c = o.y;
  o.f34 = 2;
  o.f58 = 1;
  puff(o.x + 0x80000, o.y + 0x80000, 1);
}

function armUpdate(o: Obj) {
  if (o.f44 === 0) {
    o.f54++;
    if (o.f50 < o.f54) {
      if (o.f50 > 1) o.f50--;
      o.f54 = 0;
      o.f48--;
      if (o.f48 < 0) o.f48 += 0x40;
    }
    o.x = cos(o.f48) * o.f4c + 0xf00000;
    o.y = nsin(o.f48) * o.f4c + 0xd00000;
  } else {
    o.f44--;
    o.x += (o.f38 - 0xf00000) >> 4;
    o.y += (o.f3c - 0xd00000) >> 4;
  }
  o.f40++;
  if (o.f40 > 1) o.f40 = 0;
  o.spr = o.f40 + 0x90008;
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
}

function spawnArm(angle: number, radius: number) {
  const o = spawn(armUpdate, 3);
  if (!o) return;
  o.kind = 1;
  o.x = 0xf00000;
  o.y = 0xd00000;
  o.spr = 0x90008;
  o.f44 = 0x10;
  o.f38 = cos(angle) * radius + 0xf00000;
  o.f3c = nsin(angle) * radius + 0xd00000;
  o.f48 = angle;
  o.f4c = radius;
  o.f50 = 10;
  o.f34 = 1;
}

export function spawnArms() {
  for (let r = 0; r < 400; r += 0x14) if (r < 0x28 || r > 100) spawnArm(0, r);
  for (let r = 0; r < 400; r += 0x14) if (r < 0x50 || r > 0x8c) spawnArm(0x15, r);
  for (let r = 0; r < 400; r += 0x14) if (r < 0x78 || r > 0xb4) spawnArm(0x2a, r);
}

function immortalStraight(o: Obj) {
  const sp = fix(o.f4c);
  const x = cos(o.f48) * sp + o.x;
  const y = nsin(o.f48) * sp + o.y;
  o.x = x;
  o.y = y;
  if (inside480(x, y)) {
    o.f40++;
    if (o.f40 > 1) o.f40 = 0;
    o.spr = o.f44 + o.f40;
    o.f4c = Math.trunc(o.f4c * 1.05 + 6553.6);
    if (o.f4c > 0xf0000) o.f4c = 0xf0000;
    touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
    return;
  }
  free(o);
}

export function spawnImmortalStraight(a: number, b: number, dir: number) {
  const o = spawn(immortalStraight, 3);
  if (!o) return;
  o.kind = 1;
  o.x = a - PX16;
  o.y = b - PX16;
  o.spr = 0x90008;
  o.f44 = 0x90008;
  o.f38 = a;
  o.f3c = b;
  o.f48 = dir;
  o.f4c = 0x1999;
  o.f34 = 1;
}

function immortalSpiral(o: Obj) {
  if (o.f54 === 0) {
    const a = o.f4c;
    const r = o.f48;
    o.x = cos(a) * r + 0xf00000;
    o.y = nsin(a) * r + 0xe00000;
    o.f4c = a - 2 < 0 ? a + 0x3e : a - 2;
    o.f48 = r - 1;
    if (r - 1 < 0x25) {
      const b = o.f4c;
      o.f4c = b - 0x10 < 0 ? b + 0x30 : b - 0x10;
      o.f54 = 1;
    }
  } else {
    const x = cos(o.f4c) * 16 + o.x;
    const y = nsin(o.f4c) * 16 + o.y;
    o.x = x;
    o.y = y;
    if (x < 0 || x > 0x1e00000 || y < 0 || y > 0x1c00000) {
      puff(x, y, 1);
      free(o);
      return;
    }
  }
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
  o.f40++;
  if (o.f40 > 1) o.f40 = 0;
  o.spr = o.f40 + 0x90008;
}

export function spawnImmortalSpiral(a: number, b: number) {
  const dist = distance(a, b, 0x1000000, 0xf00000);
  const ang = dir64(0x1000000, 0xf00000, a, b);
  const o = spawn(immortalSpiral, 3);
  if (!o) return;
  o.kind = 1;
  o.x = a - PX16;
  o.y = b - PX16;
  o.spr = 0x90008;
  o.f48 = fix(dist);
  o.f4c = ang;
  o.f34 = 4;
  puff(o.x, o.y, 1);
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = Math.abs(x1 - x2) >> 0xc;
  const dy = Math.abs(y1 - y2) >> 0xc;
  let v = (dy * dy + dx * dx) >> 8;
  let shift = 0;
  while (v > 0x400) {
    shift++;
    v = div(v, 16);
  }
  if (v === 0x400) return (FX << (shift * 2)) << 5;
  return (G.t.sqrt[v] << (shift * 2)) << 5;
}

function uneuneFrame() {
  rand(0x1a);
  const x = rand(0x1a);
  const y = rand(0x1a);
  G.sheets.blit(0x10, x, y, 0x11, 0x60, 0, 7, 7);
  G.sheets.blit(0x10, 0, 0, 0x11, 0x20, 0, 0x20, 0x20);
}

function blobUpdate(o: Obj) {
  uneuneFrame();
  if (o.x + PX16 < G.playerCX) {
    o.f48++;
    if (o.f48 > 10) o.f48 = 10;
  } else if (G.playerCX < o.x + PX16) {
    o.f48--;
    if (o.f48 < -10) o.f48 = -10;
  }
  if (o.y + PX16 < G.playerCY) {
    o.f4c++;
    if (o.f4c > 10) o.f4c = 10;
  } else if (G.playerCY < o.y + PX16) {
    o.f4c--;
    if (o.f4c < -10) o.f4c = -10;
  }
  o.x += o.f48 * FX;
  o.y += o.f4c * FX;
  if (inAttackRect(o.x + PX16, o.y + PX16)) {
    countHit();
    smokeBurst(o.x + 0x80000, o.y + PX16, 2);
    seRequest(1);
    spawnHeart(o.x, o.y);
    free(o);
    return;
  }
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
}

export function spawnBlob(a: number, b: number) {
  const o = spawn(blobUpdate, 3);
  if (!o) return;
  o.kind = 1;
  o.x = a - PX16;
  o.y = b - PX16;
  o.spr = 0x100000;
  o.f34 = 4;
  puff(o.x, o.y, 1);
}

function dropperUpdate(o: Obj) {
  if (o.f48 < 1) {
    if (inAttackRect(o.x + 0x80000, o.y + PX16)) {
      o.f48 = 0x14;
      smokeBurst(o.x + 0x80000, o.y + PX16, 2);
      o.y = 0x1f40000;
      seRequest(1);
      return;
    }
    touchPlayer(o.x, o.y, o.x + PX16, o.y + 0x200000);
    if (strikeC(fix(o.x) + 8, fix(o.y) + 0x10) === 0) o.y += 0x80000;
    else {
      o.f48 = 10;
      o.y = 0x1f40000;
    }
    if (o.y > 0x1e00000) {
      o.f48 = 10;
      o.y = 0x1f40000;
    }
  } else {
    o.f48--;
    o.y = 0x1f40000;
    if (o.f48 > 0) return;
    o.y = o.f4c;
  }
}

export function spawnDropper(a: number, b: number) {
  const o = spawn(dropperUpdate, 3);
  if (!o) return;
  o.kind = 1;
  o.x = a + 0x80000;
  o.y = b + 0x110000;
  o.f4c = b + 0x110000;
  o.f48 = 5;
  o.spr = 0xc0055;
  o.f34 = 1;
}

function dropUpdate(o: Obj) {
  if (strikeC(fix(o.x) + 8, fix(o.y) + 0x10) !== 0) {
    free(o);
    return;
  }
  o.y += 0x80000;
  if (o.y > 0x1e00000) free(o);
}

function dropperGenUpdate(o: Obj) {
  o.f54++;
  if (o.f54 > 10) {
    o.f54 = 0;
    const d = spawn(dropUpdate, 3);
    if (!d) return;
    d.kind = 1;
    d.x = o.x + PX16 - 0x80000;
    d.y = o.y + 0x190000 - 0x80000;
    d.spr = 0xc0055;
    d.f34 = 1;
  }
}

export function spawnDropperGen(a: number, b: number) {
  const o = spawn(dropperGenUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = a;
  o.y = b;
  o.f34 = 1;
}

function paradeUpdate(o: Obj) {
  const x = cos(o.f48) * o.f4c + o.x;
  const y = nsin(o.f48) * o.f4c + o.y;
  o.x = x;
  o.y = y;
  if (y > -0x600001 && x > -0xa00001) return;
  free(o);
}

export function spawnParade(x: number, y: number) {
  const o = spawn(paradeUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = rand(5) + 0xe0000;
  o.f4c = rand(4) * 2 + 2;
  o.f48 = 0x18;
  o.drawFlags = 1;
  o.f34 = 2;
  o.f58 = 1;
}

function paradeGenUpdate(o: Obj) {
  o.f54++;
  if (o.f50 < o.f54) {
    o.f54 = 0;
    o.f50 = rand(4) + 4;
    spawnParade(rand(0xc0) << 0x11, 0x1e00000);
    spawnParade(0x2000000, rand(0x100) << 0x11);
  }
}

export function spawnParadeGen() {
  const o = spawn(paradeGenUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f50 = 0x14;
  o.f34 = 4;
  o.f58 = 1;
}

function darknessUpdate(o: Obj) {
  o.x = (o.f48 * 5 - 0xf) * 0x200000 + G.playerCX - 0x500000;
  o.y = (o.f4c * 5 - 0xf) * 0x200000 + G.playerCY - 0x500000;
  if (o.f48 === 3 && o.f4c === 3) o.spr = 0xe0000;
}

export function spawnDarkness() {
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      const o = spawn(darknessUpdate, 5);
      if (!o) return;
      o.kind = 1;
      o.x = row * 0xa0000;
      o.y = col * 0xa0000;
      o.spr = 0xe0001;
      o.f48 = col;
      o.f4c = row;
      o.drawFlags = 1;
      o.f34 = 2;
      o.f58 = 1;
    }
  }
}

const ORDER_X = [0x40, 0x100, 0x1c0, 0x160];

function blockOrderUpdate(o: Obj) {
  if (atrGet(fix(o.x), fix(o.y)) === 2) return;
  const i = o.f54;
  o.f54 = i + 1;
  if (i < 4) {
    o.x = ORDER_X[i] * FX;
    if (atrGet(ORDER_X[i], fix(o.y)) !== 2) free(o);
    return;
  }
  if (i === 4) G.clearFlag = 1;
  free(o);
}

export function spawnBlockOrder() {
  const o = spawn(blockOrderUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = 0xa00000;
  o.y = 0x600000;
  o.f34 = 4;
}

function starUpdate(o: Obj) {
  o.f4c++;
  if (o.f4c > 0xf) {
    o.f4c = 0;
    o.spr++;
    if (o.spr > 0xc0062) {
      free(o);
      return;
    }
  }
  const x = cos(o.f54) * o.f50 + o.x;
  const y = nsin(o.f54) * o.f50 + o.y;
  o.x = x;
  o.y = y;
  if (!inside480(x, y)) free(o);
}

function starFountain(o: Obj) {
  o.f48++;
  if (o.f48 < 2) return;
  o.f48 = 0;
  const s = spawn(starUpdate, 1);
  if (!s) return;
  s.kind = 1;
  s.x = 0x1000000;
  s.y = 0xf00000;
  s.spr = 0xc005f;
  s.f54 = rand(0x40);
  s.f50 = rand(0xf) + 1;
  s.drawFlags = 2;
  s.f34 = 2;
  s.f58 = 1;
}

export function spawnStarFountain() {
  const o = spawn(starFountain, 1);
  if (!o) return;
  o.kind = 2;
  o.f34 = 2;
  o.f58 = 1;
}

function ballBounce(o: Obj) {
  const x = o.x + o.f48;
  const v = o.f4c + 0x9999;
  o.x = x;
  const y = o.y + v;
  o.f4c = v;
  o.y = y;
  if (y > 0x210000) {
    o.y = 0x210000;
    if (v < 0x8000) o.f48 = 0;
    o.f4c = -Math.trunc(v * 0.6);
  }
}

function noop(_o: Obj) {}

export function spawnBallDrop() {
  const hang = spawn(noop, 1);
  if (!hang) return;
  hang.kind = 1;
  hang.x = 0xe00000;
  hang.y = -0x160000;
  hang.spr = 0xe0013;
  hang.f34 = 2;
  hang.f58 = 1;
  const ball = spawn(ballBounce, 2);
  if (!ball) return;
  ball.kind = 1;
  ball.x = 0x1180000;
  ball.y = 0;
  ball.spr = 0xc0053;
  ball.f48 = 0x9999;
  ball.f34 = 2;
  ball.f58 = 1;
}

function sealHeartUpdate(o: Obj) {
  if (healTouch(o.x - PX16, o.y - PX16, o.x + 0x300000, o.y + 0x300000, 1)) {
    seRequest(1);
    puff(0xf00000, 0x1400000, 10);
    blockSet(0xe0, 0x140, 1);
    blockSet(0x100, 0x140, 1);
    tileSet(0xe0, 0x120, 0xb);
    tileSet(0x100, 0x120, 0xb);
    tileSet(0xe0, 0x140, 0x1f);
    tileSet(0x100, 0x140, 0x1f);
    sparkleRise(o.x + PX16, o.y + PX16);
    free(o);
  }
}

export function spawnSealHeart(x: number, y: number) {
  const o = spawn(sealHeartUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc0028;
  o.f34 = 1;
}

function onceAnimUpdate(o: Obj) {
  o.f38++;
  if (o.f38 > 5) {
    o.f38 = 0;
    o.spr++;
    if (o.spr > 0xc0082) free(o);
  }
}

export function spawnOnceAnim(x: number, y: number) {
  const o = spawn(onceAnimUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc007e;
  o.f3c = y;
  o.f34 = 4;
  o.f58 = 1;
}

