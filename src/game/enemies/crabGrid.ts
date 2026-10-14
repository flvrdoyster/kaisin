import { Obj } from "../obj.ts";
import { fix } from "../state.ts";
import {
  G,
  countHit,
  countSpawn,
  cos,
  dir64,
  div,
  free,
  inAttackRect,
  nsin,
  rand,
  seRequest,
  spawn,
  strikeD,
  touchPlayer,
} from "../core.ts";
import { puff, scorePopup, smokeRise } from "../effects.ts";

const ROW_CELLS = 40;

function laserHit(px: number, py: number, margin: number): boolean {
  for (let i = 0; i < 8; i++) {
    if (
      G.laserState[i] === 1 &&
      G.laserX[i] > px - margin &&
      px + margin > G.laserX[i] &&
      G.laserY[i] > py - margin &&
      py + margin > G.laserY[i]
    ) {
      G.laserState[i] = 2;
      return true;
    }
  }
  return false;
}

function laserPuffUpdate(o: Obj) {
  if (rand(8) < 3) o.spr--;
  if (rand(0x15) < 5) o.x -= 0x10000;
  o.y += (-1 - rand(2)) * 0x10000;
  if (o.spr < 0xe0006) free(o);
}

function spawnLaserPuff(x: number, y: number) {
  const o = spawn(laserPuffUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x80000;
  o.y = y - 0x80000;
  o.spr = 0xe0008;
  o.f34 = 4;
}

function laserUpdate(o: Obj) {
  if (strikeD(fix(o.x) + 8, fix(o.y) + 8) !== 0) G.laserState[o.f54] = 2;
  const old = o.x;
  o.x = old + 0x120000;
  if (o.x < 0x2000001 && G.laserState[o.f54] === 1) {
    G.laserX[o.f54] = old + 0x1a0000;
    G.laserY[o.f54] = o.y + 0x80000;
    spawnLaserPuff(o.x - 0xa0000, o.y + 0x80000);
    return;
  }
  G.laserX[o.f54] = 0;
  G.laserY[o.f54] = 0;
  G.laserState[o.f54] = 0;
  free(o);
}

function spawnLaser(px: number, py: number) {
  for (let i = 0; i < 8; i++) {
    if (G.laserState[i] !== 0) continue;
    const o = spawn(laserUpdate, 4);
    if (!o) return;
    o.kind = 1;
    o.x = px - 0x80000;
    o.y = py - 0x80000;
    o.spr = 0xe0005;
    o.f54 = i;
    o.f34 = 4;
    G.laserX[i] = px;
    G.laserY[i] = py;
    G.laserState[i] = 1;
    return;
  }
}

function sparkUpdate(o: Obj) {
  o.f4c--;
  if (o.f4c < 1) {
    free(o);
    return;
  }
  o.x += cos(o.f54) * o.f50;
  o.y += nsin(o.f54) * o.f50;
}

function sparks(px: number, py: number, n: number) {
  for (let i = 0; i < n; i++) {
    const o = spawn(sparkUpdate, 4);
    if (!o) return;
    o.kind = 1;
    o.x = (rand(7) - 7) * 0x10000 + px;
    o.y = (rand(7) - 7) * 0x10000 + py;
    o.spr = 0xc0079;
    o.f4c = rand(0x14) + 0xf;
    o.f54 = rand(0x40);
    o.f50 = rand(3) + 1;
    o.f34 = 4;
  }
}

function bulletUpdate(o: Obj) {
  o.x += cos(o.f48) * o.f4c;
  o.y += nsin(o.f48) * o.f4c;
  if (strikeD(fix(o.x) + 8, fix(o.y) + 8) === 0 && o.x >= 0 && o.x < 0x1e00001 && o.y >= 0 && o.y < 0x1c00001) {
    if (!inAttackRect(o.x + 0x80000, o.y + 0x80000) && !laserHit(o.x + 0x80000, o.y + 0x80000, 0xa0000)) {
      touchPlayer(o.x + 0x20000, o.y + 0x20000, o.x + 0xe0000, o.y + 0xe0000);
      return;
    }
    sparks(o.x + 0x80000, o.y + 0x80000, 0x1e);
    seRequest(1);
    free(o);
    return;
  }
  puff(o.x, o.y, 1);
  free(o);
}

function spawnBullet(x: number, y: number) {
  const o = spawn(bulletUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x80000;
  o.y = y - 0x80000;
  o.spr = 0xc0008;
  o.f38 = o.x;
  o.f3c = o.y;
  o.f48 = dir64(x, y, G.playerCX, G.playerCY);
  o.f4c = 8;
  o.f34 = 4;
}

function crabMain(o: Obj) {
  o.f54--;
  if (o.x > 0xa00000 && o.f54 < 1) {
    o.f54 = rand(800) + 200;
    spawnBullet(o.x + 0x100000, o.y + 0x100000);
  }
  if (G.counter518 !== 0) {
    switch (G.crabMode) {
      case 0:
        o.y -= 0x80000;
        if (o.y <= 0x200000) G.crabMoved = 1;
        break;
      case 1:
        o.y += 0x80000;
        if (o.y >= 0x1a00000) G.crabMoved = 1;
        break;
      case 2:
      case 3:
        o.x -= 0x80000;
        G.crabMoved = 1;
        if (o.x < 0x800000) {
          G.crabLeft--;
          puff(o.x, o.y, 2);
          free(o);
          return;
        }
        break;
    }
  }
  if (laserHit(o.x + 0x100000, o.y + 0x100000, 0x100000)) {
    seRequest(1);
    G.crabLeft--;
    smokeRise(o.x + 0x100000, o.y + 0x100000, 6);
    scorePopup(fix(o.x) + 8, fix(o.y) + 8, 10);
    countHit();
    free(o);
    return;
  }
  o.f40++;
  if (o.f40 > 8) o.f40 = 0;
  o.spr = o.f44 + div(o.f40, 3);
}

function crabGather(o: Obj) {
  o.x += (o.f38 - o.x) >> 1;
  o.f50++;
  o.y += (o.f3c - o.y) >> 1;
  if (o.f50 > 0xc) {
    o.x = o.f38;
    o.y = o.f3c;
    o.f50 = 0;
    o.update = crabMain;
  }
}

function spawnTako(x: number, y: number, tx: number, ty: number) {
  const spr = tx > 0x19fffff ? 0xe0009 : 0xe0002;
  const o = spawn(crabGather, 3);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = spr;
  o.f44 = spr;
  o.f38 = tx;
  o.f3c = ty;
  o.f54 = rand(800) + 100;
  o.f34 = 4;
  countSpawn();
  G.crabLeft++;
}

function clearRow(row: number) {
  G.atr[row * ROW_CELLS + 6] = 0;
  G.atr[row * ROW_CELLS + 7] = 0;
  G.mdt[(row >> 1) * 20 + 3] = 9;
}

function finisherUpdate(o: Obj) {
  o.f50++;
  if (o.f50 <= 1) return;
  clearRow(o.f54 + 0xf);
  clearRow(0xe - o.f54);
  puff(0x600000, (o.f54 + 0xf) * 0x100000, 1);
  puff(0x600000, (0xe - o.f54) * 0x100000, 1);
  seRequest(1);
  o.f50 = 0;
  o.f54++;
  if (o.f54 > 0xc) free(o);
}

function spawnFinisher() {
  const o = spawn(finisherUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f34 = 4;
}

function controllerUpdate(o: Obj) {
  o.x += (0x500000 - o.x) >> 1;
  if (G.crabLeft === 0) {
    G.clearFlag = 1;
    spawnFinisher();
    free(o);
    return;
  }
  o.y = G.playerCY - 0x100000;
  o.f50++;
  if (div(G.crabLeft + 1, 3) < o.f50) {
    o.f50 = 0;
    G.counter518 = 1;
    if (G.crabMoved !== 0) {
      G.crabMode = [2, 3, 1, 0][G.crabMode];
      G.crabMoved = 0;
    }
  } else {
    G.counter518 = 0;
  }
  if (o.f40 < 1) o.spr = 0xe0000;
  else o.f40--;
  if (inAttackRect(o.x + 0x180000, o.y + 0x180000)) {
    o.spr = 0xe0001;
    o.f40 = 2;
    o.x = 0x700000;
    spawnLaser(0x800000, o.y + 0x100000);
  }
}

function spawnController() {
  const o = spawn(controllerUpdate, 3);
  if (!o) return;
  o.kind = 1;
  o.x = 0x500000;
  o.y = G.playerCY - 0x100000;
  o.spr = 0xe0000;
  o.f34 = 4;
}

export function spawnCrabGrid() {
  spawnController();
  for (let x = 0x1400000; x < 0x1d00000; x += 0x300000) {
    for (let y = 0x400000; y < 0x1000000; y += 0x300000) {
      spawnTako(0xf00000, 0x700000, x, y);
      spawnTako(0xf00000, 0x1500000, x, y + 0xc00000);
    }
  }
  puff(0xf00000, 0x700000, 5);
  puff(0xf00000, 0x1500000, 5);
}
