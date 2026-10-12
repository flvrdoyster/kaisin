import { Obj } from "../obj.ts";
import { fix } from "../state.ts";
import {
  G,
  atrSet,
  cos,
  free,
  inAttackRect,
  nsin,
  rand,
  seRequest,
  spawn,
  tileMinus20,
  touchPlayer,
} from "../core.ts";
import { puff, scorePopup, smokeBurst, smokeRise } from "../effects.ts";
import { bgmPlay } from "../../audio/bgm.ts";
import { bossCleared, spriteMessage } from "../messages.ts";
import { killByUpdate } from "../world.ts";

function flashUpdate(o: Obj) {
  o.spr++;
  if (o.spr > 0xe0017) free(o);
}

function sparkUpdate(o: Obj) {
  o.spr++;
  if (o.spr > 0xe000f) free(o);
}

function spawnFlash(x: number, y: number) {
  const o = spawn(flashUpdate, 1);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x100000;
  o.y = y - 0x100000;
  o.spr = 0xe0010;
  o.f34 = 2;
}

function spawnSpark(x: number, y: number) {
  const o = spawn(sparkUpdate, 1);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x80000;
  o.y = y - 0x80000;
  o.spr = 0xe000c;
  o.f34 = 2;
}

function stackUpdate(o: Obj) {
  o.spr++;
  if (o.spr > 0xe002f) free(o);
}

function spawnStack(x: number, y: number) {
  let px = x - 0x200000;
  let py = y - 0x200000;
  for (let i = 0; i < 8; i++) {
    const o = spawn(stackUpdate, 2);
    if (!o) return;
    o.kind = 1;
    o.x = px;
    o.y = py;
    o.spr = 0xe002f - i;
    o.f34 = 4;
    px += cos(16) * 0x10;
    py += nsin(16) * 0x10;
  }
}

function columnUpdate(o: Obj) {
  o.spr++;
  if (o.spr < 0xe0038 && o.spr > 0xe002f) return;
  free(o);
}

function spawnColumn(x: number, y: number) {
  let px = x - 0x100000;
  let py = y - 0x100000;
  for (let i = 0; i < 8; i++) {
    const o = spawn(columnUpdate, 3);
    if (!o) return;
    o.kind = 1;
    o.x = px;
    o.y = py;
    o.spr = 0xe0037 - i;
    o.f34 = 4;
    px += cos(16) * 0xd;
    py += nsin(16) * 0xd;
  }
}

function sweepColumns(o: Obj) {
  if (o.f38 > 0x200000) spawnColumn(o.f38, o.f3c);
  if (o.f48 < 0x1e00000) spawnColumn(o.f48, o.f4c);
  o.f38 -= 0x100000;
  o.f48 += 0x100000;
  if (o.f38 <= 0x200000 && o.f48 >= 0x1e00000) free(o);
}

function sweepStacks(o: Obj) {
  if (o.f38 > 0x200000) spawnStack(o.f38, o.f3c);
  if (o.f48 < 0x1e00000) spawnStack(o.f48, o.f4c);
  o.f38 -= 0x200000;
  o.f48 += 0x200000;
  if (o.f38 <= 0x200000 && o.f48 >= 0x1e00000) free(o);
}

function spawnSweep(update: (o: Obj) => void, x: number, y: number) {
  const o = spawn(update, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = y;
  o.f38 = x;
  o.f3c = y;
  o.f48 = x;
  o.f4c = y;
  o.f54 = 0;
  o.f34 = 4;
}

function debrisUpdate(o: Obj) {
  o.y -= o.f4c;
  if (rand(0xd) === 1) o.spr++;
  if (o.spr > 0xe000a) {
    free(o);
    return;
  }
  if (o.y < -0x100000) free(o);
}

function spawnDebris(x: number, y: number, vy: number) {
  const o = spawn(debrisUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x80000;
  o.y = y - 0x80000;
  o.f4c = vy;
  o.spr = 0xe0008;
  o.f34 = 4;
}

function shadowUpdate(o: Obj) {
  if (o.spr < 0xe0007) o.spr++;
}

function targetHit(o: Obj, y: number) {
  seRequest(1);
  scorePopup(fix(o.x) + 0x14, fix(y) + 10, 0x14);
  smokeBurst(o.x + 0x180000, y + 0x100000, 6);
  smokeRise(o.x + 0x180000, y + 0x100000, 6);
  free(o);
}

function targetBlink(o: Obj) {
  o.f40++;
  if (o.f40 > 0xb) o.f40 = 0;
  o.spr = G.t.boss10tgt[o.f40] + 0xe0000;
  o.y = (o.f44 & 3) === 1 ? 0x1f40000 : o.f4c;
  if (inAttackRect(o.x + 0x180000, o.y + 0x100000)) {
    targetHit(o, o.y);
    return;
  }
  o.f44++;
  if (o.f44 > 0x19) {
    puff(o.x, o.f4c, 2);
    free(o);
  }
}

function targetUpdate(o: Obj) {
  o.f40++;
  if (o.f40 > 0xb) o.f40 = 0;
  o.spr = G.t.boss10tgt[o.f40] + 0xe0000;
  if (inAttackRect(o.x + 0x180000, o.y + 0x100000)) {
    targetHit(o, o.y);
    return;
  }
  touchPlayer(o.x, o.y, o.x + 0x300000, o.y + 0x200000);
  o.f44++;
  if (o.f44 > 200) {
    o.update = targetBlink;
    o.f44 = 0;
    o.f4c = o.y;
  }
}

function spawnTarget(x: number, y: number) {
  const o = spawn(targetUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x180000;
  o.y = y - 0x100000;
  o.spr = 0xe0018;
  o.f34 = 4;
}

function bombUpdate(o: Obj) {
  const target = o.f3c;
  o.y += o.f4c;
  if (target < o.y) {
    o.y = target;
    puff(o.x, target, 2);
    spawnTarget(o.x + 0x100000, o.y + 0x100000);
    free(o.p54);
    free(o);
  }
}

function spawnBomb(x: number, y: number) {
  const b = spawn(bombUpdate, 4);
  if (!b) return;
  b.kind = 1;
  b.x = x - 0x100000;
  b.y = (-0xa0 - rand(0x50)) * 0x10000;
  b.f3c = y - 0x100000;
  b.f4c = 0xc0000;
  b.spr = 0xe0008;
  const s = spawn(shadowUpdate, 1);
  if (!s) {
    free(b);
    return;
  }
  s.kind = 1;
  s.x = x - 0x180000;
  s.y = y - 0x100000;
  s.spr = 0xe0004;
  s.p54 = b;
  s.f34 = 4;
  b.p54 = s;
  b.f34 = 4;
}

function topFlash(): void {
  const y = (rand(0x60) + 0x30) * 0x10000;
  spawnFlash((rand(0x1a0) + 0x30) * 0x10000, y);
}

function bottomFlash(): void {
  const y = (rand(0x60) + 0x150) * 0x10000;
  spawnFlash((rand(0x1a0) + 0x30) * 0x10000, y);
}

function midSpark(): void {
  const y = (rand(0x80) + 0xb0) * 0x10000;
  spawnSpark((rand(0x1a0) + 0x30) * 0x10000, y);
}

function rowBurst(o: Obj) {
  spawnStack(o.x + 0x500000, 0x900000);
  spawnStack(o.x + 0x100000, 0x900000);
  spawnStack(o.x + 0x900000, 0x900000);
  spawnStack(o.x + 0x300000, 0x600000);
  spawnStack(o.x + 0x700000, 0x600000);
  seRequest(6);
  for (let i = 0; i < 0xc00000; i += 0x200000) spawnColumn(o.x + i, 0x900000);
  for (let i = 0; i < 0xa00000; i += 0x200000) spawnColumn(o.x + i + 0x100000, 0x700000);
  for (let i = 0; i < 0x1e; i++) {
    const vy = (rand(0x20) + 8) * 0x10000;
    const y = (rand(0x50) + 0x40) * 0x10000;
    spawnDebris(rand(0xa0) * 0x10000 + o.x, y, vy);
  }
}

function floorFall(o: Obj, next: number, ty: number, py: number): boolean {
  o.f50++;
  if (o.f50 < next) return false;
  o.f50 = 0;
  tileMinus20(0xe0, ty);
  tileMinus20(0x100, ty);
  puff(0xf00000, py, 4);
  return true;
}

function bossUpdate(o: Obj) {
  if (o.f54 > 0 && o.f54 < 10) {
    topFlash();
    bottomFlash();
    midSpark();
  }
  switch (o.f54) {
    case 0:
      o.f50++;
      if (o.f50 === 0x28) spawnFlash(0x1000000, 0x800000);
      if (o.f50 > 0x3c && o.f50 < 100) {
        if ((o.f50 & 0xf) === 1) topFlash();
        if ((o.f50 & 0xf) === 8) bottomFlash();
      }
      if (o.f50 > 100 && o.f50 < 0x96) {
        if ((o.f50 & 7) === 1) topFlash();
        if ((o.f50 & 7) === 4) bottomFlash();
      }
      if (o.f50 > 0x96 && o.f50 < 200) {
        if ((o.f50 & 3) === 1) topFlash();
        if ((o.f50 & 3) === 3) bottomFlash();
        if ((o.f50 & 3) === 2) midSpark();
      }
      if (o.f50 > 200 && o.f50 < 400) {
        topFlash();
        bottomFlash();
        midSpark();
      }
      if (o.f50 > 399) {
        bgmPlay(2);
        o.f50 = 0;
        o.f54 = 1;
      }
      break;
    case 1:
      rowBurst(o);
      o.f54 = 2;
      o.y = 0x400000;
      break;
    case 2:
      o.f50++;
      if (o.f50 > 0) {
        o.f50 = 0;
        o.spr++;
        if (o.spr > 0xe0001) {
          o.f54 = 3;
          for (let i = 0; i < 10; i++) {
            const y = (rand(0x80) + 0xb0) * 0x10000;
            spawnBomb((rand(0x1a0) + 0x30) * 0x10000, y);
          }
        }
      }
      break;
    case 3:
      if (!inAttackRect(o.x + 0x100000, 0x800000) && !inAttackRect(o.x + 0x600000, 0x800000) && !inAttackRect(o.x + 0x900000, 0x800000)) {
        o.f50++;
        if (o.f50 > 0x3c) {
          o.f50 = 0;
          o.f54 = 4;
        }
        if (o.f38 === 1 && o.f50 > 0xf) {
          o.f50 = 0;
          o.f54 = 4;
        }
      } else {
        seRequest(2);
        o.f54 = 6;
        o.f50 = 0;
      }
      break;
    case 4:
      o.f50++;
      if (o.f50 > 1) {
        o.f50 = 0;
        o.spr--;
        if (o.spr < 0xe0000) {
          o.spr = 0xe0000;
          o.y = 0x1f40000;
          o.f54 = 5;
          spawnColumn(o.x + 0x500000, 0x900000);
          seRequest(6);
          o.x = (rand(0x10) + 3) * 0x100000;
        }
      }
      break;
    case 5:
      o.f50++;
      if (o.f50 > 100) {
        o.f50 = 0;
        o.f54 = 1;
      }
      if (o.f38 === 1 && o.f50 > 0x14) {
        o.f50 = 0;
        o.f54 = 1;
      }
      break;
    case 6: {
      o.f50++;
      o.spr = 0xe0002;
      o.x += (o.f50 & 1) * 2 - 1;
      if ((o.f50 & 1) === 0) o.spr = 0xe0003;
      if (o.f50 > 0x14) {
        o.f50 = 0;
        o.spr = 0xe0002;
        o.f38--;
        if (o.f38 < 1) {
          o.f54 = 7;
          killByUpdate([bombUpdate, targetUpdate, shadowUpdate]);
        } else o.f54 = 4;
      }
      break;
    }
    case 7: {
      o.f50++;
      const u = o.f50 & 1;
      o.spr = 0xe0002;
      o.x += u * 4 - 2;
      if (u === 0) {
        o.spr = 0xe0003;
        seRequest(6);
      }
      if ((o.f50 & 7) === 0) {
        spawnSweep(sweepColumns, o.x + 0x500000, 0xa00000);
        spawnSweep(sweepStacks, o.x + 0x500000, 0xa00000);
      }
      if (o.f50 > 0x50) {
        o.f50 = 0;
        o.spr = 0xe0002;
        o.f54 = 8;
        spriteMessage(0xf00000, 0, 0x500000, 0xa00000, 8, 0xcd);
      }
      break;
    }
    case 8: {
      o.f50++;
      const u = o.f50 & 1;
      o.spr = 0xe0002;
      o.x += u * 4 - 2;
      if (u === 0) o.spr = 0xe0003;
      let y = (rand(0x50) + 0x30) * 0x10000;
      spawnColumn((rand(0x1a0) + 0x30) * 0x10000, y);
      y = (rand(0x50) + 0x30) * 0x10000;
      spawnStack((rand(0x1a0) + 0x30) * 0x10000, y);
      y = (rand(0x50) + 0x150) * 0x10000;
      spawnColumn((rand(0x1a0) + 0x30) * 0x10000, y);
      y = (rand(0x50) + 0x150) * 0x10000;
      spawnStack((rand(0x1a0) + 0x30) * 0x10000, y);
      if (rand(6) < 1) seRequest(6);
      if (rand(5) < 2) seRequest(1);
      if (o.f50 > 0xd2) {
        o.f50 = 0;
        o.spr = 0xe0002;
        o.f54 = 9;
      }
      break;
    }
    case 9:
      rowBurst(o);
      o.y = 0x1f40000;
      scorePopup(fix(o.x) + 0x46, 0x90, 5000);
      bossCleared(0x14);
      o.f54 = 10;
      o.f50 = 0;
      break;
    case 10:
      if (floorFall(o, 0x1f, 0x1a0, 0x1b00000)) {
        o.f54 = 0xb;
        seRequest(1);
      }
      break;
    case 0xb:
      if (floorFall(o, 0xb, 0x180, 0x1900000)) {
        o.f54 = 0xc;
        seRequest(1);
      }
      break;
    case 0xc:
      if (floorFall(o, 0xb, 0x160, 0x1700000)) {
        o.f54 = 0xd;
        seRequest(1);
      }
      break;
    case 0xd:
      if (floorFall(o, 0xb, 0x140, 0x1500000)) {
        o.f54 = 0xe;
        atrSet(0xf0, 0x140, 0x20);
        atrSet(0x100, 0x140, 0x20);
        seRequest(1);
      }
      break;
  }
}

export function spawnBoss2() {
  const o = spawn(bossUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = 0xb00000;
  o.y = 0x1f40000;
  o.spr = 0xe0000;
  o.f38 = 8;
  o.f34 = 4;
}
