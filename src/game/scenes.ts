import { Obj } from "./obj.ts";
import { G, free, rand, spawn } from "./core.ts";

export function hideRoom() {
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 16; c++) {
      G.mdtTemp[r * 16 + c] = G.mdt[r * 20 + c];
      G.mdt[r * 20 + c] = 400;
    }
  }
}

function letterRising(o: Obj) {
  o.f50--;
  if (o.f50 < 1) {
    o.update = letterFalling;
    o.f50 = 3;
    o.spr += 0x1a;
  }
}

function letterFalling(o: Obj) {
  o.f50--;
  if (o.f50 < 1) {
    o.update = letterRising;
    o.f50 = 3;
    o.spr -= 0x1a;
  }
}

function spawnLetters() {
  for (let i = 0; i < 8; i++) {
    const o = spawn(letterRising, 1);
    if (!o) return;
    o.kind = 1;
    o.x = 0x800000 + i * 0x200000;
    o.y = 0x400000;
    o.spr = G.t.continueLetters[i] + 0xb0000;
    o.f50 = i * 2;
    o.f34 = 3;
    o.drawFlags = 1;
  }
}

function runnerUpdate(o: Obj) {
  o.f40++;
  if (o.f40 > 0xf) o.f40 = 0;
  const dir = o.f44;
  if (dir === 3) o.x -= 0x80000;
  if (dir === 1) o.x += 0x80000;
  o.f54++;
  if (o.f54 === 0x14) spawnDigit(o.x + 0x180000, o.y + 0x100000, o.f50, (dir - 2) * 0x10000);
  o.spr = G.t.playerAnim[dir * 0x10 + o.f40] + 0x50000;
  if (o.x > 0x3fffff && o.x < 0x1c00001) return;
  free(o);
}

function chaserUpdate(o: Obj) {
  o.f40++;
  if (o.f40 > 0xf) o.f40 = 0;
  if (o.f44 === 3) o.x -= 0x80000;
  if (o.f44 === 1) o.x += 0x80000;
  if (o.x > -0xa00001 && o.x < 0x2a00001) return;
  free(o);
}

function digitUpdate(o: Obj) {
  o.x += o.f48;
  o.y += o.f4c;
  if (o.y > 0x1600000) {
    free(o);
    return;
  }
  o.f4c += 0x10000;
}

function spawnDigit(x: number, y: number, count: number, vx: number) {
  const o = spawn(digitUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x100000;
  o.y = y - 0x100000;
  o.spr = count + 0xb0000;
  o.f48 = vx;
  o.f4c = -0x80000;
  o.f34 = 1;
  o.drawFlags = 5;
}

function spawnRunner(x: number, y: number, tx: number, ty: number, count: number, dir: number) {
  const r = spawn(runnerUpdate, 2);
  if (r) {
    r.kind = 1;
    r.x = x - 0x180000;
    r.y = y;
    r.spr = 0x50000;
    r.f44 = dir;
    r.f50 = count;
    r.f34 = 1;
    r.drawFlags = 5;
  }
  const c = spawn(chaserUpdate, 3);
  if (c) {
    c.kind = 1;
    c.x = tx - 0x180000;
    c.y = ty;
    c.spr = dir === 1 ? 0x90000 : 0x90004;
    c.f44 = dir;
    c.f34 = 1;
    c.drawFlags = 5;
  }
}

function counterUpdate(o: Obj) {
  o.f54++;
  if (o.f54 <= 0x3c) return;
  o.f54 = 0;
  if (o.f40 < 0) {
    G.scene = 10;
    return;
  }
  const y = (rand(0x60) + 0xc0) * 0x10000;
  if (o.f44 === 1) spawnRunner(0x600000, y, (3 - o.f40) << 0x14, y, o.f40, o.f44);
  else spawnRunner(0x1a00000, y, (o.f40 + 0x1d) << 0x14, y, o.f40, o.f44);
  o.f40--;
  o.f44 = 4 - o.f44;
}

function spawnCounter() {
  const o = spawn(counterUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f40 = 9;
  o.f44 = 3;
  o.f34 = 1;
  o.drawFlags = 5;
}

function gameOverUpdate(o: Obj) {
  if (o.f40 === 0) {
    spawnLetters();
    o.f40++;
    spawnCounter();
  }
  if ((G.input & 0x100) !== 0) G.scene = 9;
}

export function spawnGameOver() {
  const o = spawn(gameOverUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f34 = 1;
  o.drawFlags = 1;
  hideRoom();
}

function bounceUpdate(o: Obj) {
  const vy = o.f4c + 0x9999;
  o.f4c = vy;
  o.y += vy;
  if (o.y > 0xe00000) {
    o.y = 0xe00000;
    if (vy < 0x8000) o.f48 = 0;
    o.f4c = -Math.trunc(vy * 0.6);
  }
}

function spawnBounce() {
  const o = spawn(bounceUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = 0xe00000;
  o.y = 0x600000;
  o.spr = 0x50023;
  o.f34 = 1;
  o.drawFlags = 5;
  hideRoom();
}

function tombUpdate(o: Obj) {
  if (o.f40 === 0) {
    o.f40 = 1;
    spawnBounce();
  } else if (o.f40 === 1) {
    o.f44++;
    if (o.f44 > 200) o.f40 = 2;
  } else {
    G.scene = 2;
  }
  if ((G.input & 0x100) !== 0) G.scene = 2;
}

export function spawnTomb() {
  const o = spawn(tombUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = 0xe80000;
  o.y = 0x1000000;
  o.spr = 0x50022;
  o.f34 = 1;
  o.drawFlags = 5;
  hideRoom();
}
