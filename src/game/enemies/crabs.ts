import { Obj } from "../obj.ts";
import { fix } from "../state.ts";
import { cos, countSpawn, free, nsin, rand, spawn } from "../core.ts";
import { zako1Walk } from "./basic.ts";
import { bugSwarm, puff } from "../effects.ts";

const onScreen = (x: number, y: number) => x > -0x100001 && x < 0x2000001 && y > -0x100001 && y < 0x1e00001;

function turnUp(d: number): number {
  if (d >= 0x11 && d <= 0x30) return d - 1;
  if (d === 0x10) return d;
  return d + 1 < 0x40 ? d + 1 : d - 0x3f;
}

function crabAnim(o: Obj) {
  o.f40++;
  if (o.f40 > 7) o.f40 = 0;
  o.spr = (o.f40 >> 2) + 0x7000d;
}

export function crabCurve(o: Obj) {
  crabAnim(o);
  const v = o.f50;
  const d = o.f54;
  const sp = fix(v);
  o.x += cos(d) * sp;
  o.y += nsin(d) * sp;
  o.f54 = turnUp(d);
  o.f50 = v + 0x9999;
  if (!onScreen(o.x, o.y)) free(o);
}

function crabWander(o: Obj) {
  crabAnim(o);
  const sp = fix(o.f50);
  o.x += cos(o.f54) * sp;
  o.y += nsin(o.f54) * sp;
  if (rand(0xd) < 5) o.f54 = turnUp(o.f54);
  o.f50 += 0x9999;
  if (!onScreen(o.x, o.y)) free(o);
}

export function spawnCrab(update: (o: Obj) => void, x: number, y: number, dir: number, speed: number) {
  const o = spawn(update, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x100000;
  o.y = y - 0x100000;
  o.spr = 0x7000d;
  o.f54 = dir;
  o.f50 = speed;
  o.f34 = 2;
  o.drawFlags = 1;
  o.f58 = 1;
}

export function crabSwarm() {
  const d0 = rand(0x28) + 4;
  const y0 = (rand(0x10) + 0x108) * 0x10000;
  spawnCrab(crabCurve, (rand(0x10) + 0xe8) * 0x10000, y0, d0, 0x10000);
  for (let i = 0; i < 0x13; i++) {
    const d = rand(0x28) + 4;
    const y = (rand(0x10) + 0x108) * 0x10000;
    spawnCrab(crabWander, (rand(0x10) + 0xe8) * 0x10000, y, d, 0x50000);
  }
}

function gatherUpdate(o: Obj) {
  o.f40++;
  if (o.f40 > 4) o.f40 = 0;
  o.x += (o.f38 - o.x) >> 2;
  o.y += (o.f3c - o.y) >> 2;
  o.spr = o.f44 + o.f40;
  o.f54++;
  if (o.f54 > 10) {
    o.update = zako1Walk;
    o.f40 = 0;
    o.f54 = 0;
  }
}

function trailUpdate(o: Obj) {
  o.spr++;
  if (o.spr > 0x50032) free(o);
}

function trail(x: number, y: number, dir: number, step: number) {
  let px = x - 0x100000;
  let py = y - 0x100000;
  for (let i = 0; i < 8; i++) {
    const o = spawn(trailUpdate, 4);
    if (o) {
      o.kind = 1;
      o.x = px;
      o.y = py;
      o.spr = 0x50032 - (i >> 1);
      o.f34 = 4;
      o.f58 = 1;
    }
    px += cos(dir) * step;
    py += nsin(dir) * step;
  }
}

export function startRoomBurst() {
  for (let i = 0; i < 0x14; i++) {
    const o = spawn(gatherUpdate, 2);
    if (!o) return;
    o.kind = 1;
    o.x = 0xf00000;
    o.y = 0;
    o.spr = 0x60000;
    o.f44 = 0x60000;
    o.f38 = (rand(0x78) + 0xb4) * 0x10000;
    o.f3c = (rand(0x78) + 0x20) * 0x10000;
    o.f48 = rand(0x3f);
    o.f34 = 1;
    countSpawn();
  }
  for (let i = 0; i < 0x14; i++) {
    const d = rand(0x18) + 0x28;
    const y = (rand(0x10) + 2) * 0x10000;
    spawnCrab(crabCurve, (rand(0x10) + 0xf8) * 0x10000, y, d, 0x10000);
  }
  for (let i = 0; i < 3; i++) {
    const d = rand(0x18) + 0x28;
    const y = (rand(0x10) + 2) * 0x10000;
    spawnCrab(crabWander, (rand(0x10) + 0xf8) * 0x10000, y, d, 0x10000);
  }
  for (let i = 0; i < 8; i++) trail(0x1000000, 0, rand(0x14) + 0x26, 0x12);
  puff(0x1000000, 0x200000, 8);
  bugSwarm(0x1000000, 0x220000);
}
