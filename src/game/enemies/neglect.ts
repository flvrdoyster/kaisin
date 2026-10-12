import { Obj } from "../obj.ts";
import { fix } from "../state.ts";
import {
  G,
  cos,
  dir64,
  div,
  free,
  inAttackRect,
  nsin,
  rand,
  seRequest,
  spawn,
  touchPlayer,
} from "../core.ts";
import { scorePopup } from "../effects.ts";
import { bossCleared, spriteMessage } from "../messages.ts";
import { showText } from "../text.ts";
import { killByUpdate } from "../world.ts";
import { spawnBullet, spawnZako2Straight } from "./basic.ts";
import { crabCurve, spawnCrab } from "./crabs.ts";
import { emitter, emitterUpdate, shotUpdate } from "./scissizer.ts";

function moveStep(o: Obj) {
  o.x += o.f48;
  o.y += o.f4c;
  o.f54--;
}

function decoyA(o: Obj) {
  o.spr = G.t.finalAnim.A[o.f44] + 0xe0000;
  o.f44++;
  if (o.f44 > 0xf) o.f44 = 0;
  moveStep(o);
  if (o.f54 === 0) free(o);
}

function decoyLoop(table: "B" | "C") {
  return (o: Obj) => {
    o.spr = G.t.finalAnim[table][o.f44] + 0xe0000;
    o.f44++;
    if (o.f44 > 0xf) o.f44 = 0;
    moveStep(o);
    if (o.f54 < 0) free(o);
  };
}

function decoyOnce(table: "D" | "E") {
  return (o: Obj) => {
    o.spr = G.t.finalAnim[table][o.f44] + 0xe0000;
    o.f44++;
    if (o.f44 > 7) {
      free(o);
      return;
    }
    moveStep(o);
    if (o.f54 === 0) free(o);
  };
}

const decoyB = decoyLoop("B");
const decoyC = decoyLoop("C");
const decoyD = decoyOnce("D");
const decoyE = decoyOnce("E");

function spawnDecoy(update: (o: Obj) => void, x1: number, y1: number, x2: number, y2: number, steps: number, anim: number) {
  if (steps === 0) return;
  const o = spawn(update, 3);
  if (!o) return;
  o.kind = 1;
  o.x = x1;
  o.y = y1;
  o.spr = 0xe000b;
  o.f44 = anim;
  o.f38 = x2;
  o.f3c = y2;
  o.f48 = div(x2 - x1, steps);
  o.f4c = div(y2 - y1, steps);
  o.f54 = steps;
  o.f34 = 4;
  o.drawFlags = 1;
}

const decoyFlight = (x1: number, y1: number, x2: number, y2: number, steps: number) =>
  spawnDecoy(decoyA, x1, y1, x2, y2, steps, 0);

function decoy(x1: number, y1: number, x2: number, y2: number, steps: number, kind: number, anim: number) {
  const update = kind === 1 ? decoyD : kind === 2 ? decoyC : kind === 3 ? decoyE : decoyB;
  spawnDecoy(update, x1, y1, x2, y2, steps, anim);
}

function spread(x: number, y: number, dir: number) {
  spawnBullet(x, y, dir);
  let a = dir - 4;
  if (a < 0) a = dir + 0x3c;
  spawnBullet(x, y, a);
  let b = a - 4;
  if (b < 0) b = a + 0x3c;
  let c = b + 0xc;
  spawnBullet(x, y, b);
  if (c > 0x3f) c = b - 0x34;
  let d = c + 4;
  spawnBullet(x, y, c);
  if (d > 0x3f) d = c - 0x3c;
  spawnBullet(x, y, d);
}

function sparkTrailUpdate(o: Obj) {
  o.spr++;
  if (o.spr > 0xc003e) free(o);
}

function spawnSparkTrail(x: number, y: number) {
  const o = spawn(sparkTrailUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = (rand(8) - 4) * 0x10000 + x;
  o.y = (rand(8) - 4) * 0x10000 + y;
  o.spr = 0xc003c;
  o.f34 = 4;
}

function trailEmitterUpdate(o: Obj) {
  o.f40--;
  if (o.f40 < 1) {
    emitter(o.x, o.y, dir64(o.x, o.y, G.playerCX, G.playerCY), 2, 7, 1, 5);
    free(o);
    return;
  }
  spawnSparkTrail(o.x, o.y);
}

function spawnTrailEmitter(x: number, y: number) {
  const o = spawn(trailEmitterUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = y;
  o.f40 = 0x14;
  o.f34 = 4;
}

function orbHeadUpdate(o: Obj) {
  if (o.f54 < 0x20) o.f54++;
  const a = o.f48;
  if (o.f4c === 0) {
    o.f48 = a + 1;
    if (a + 1 >= 0x40) o.f48 = a - 0x3f;
  } else {
    o.f48 = a - 1;
    if (a - 1 < 0) o.f48 = a + 0x3f;
  }
  o.x = cos(o.f48) * o.f54 + o.f38;
  o.y = nsin(o.f48) * o.f54 + o.f3c;
  const out = dir64(o.f38, o.f3c, o.x, o.y);
  const toPlayer = dir64(o.f38, o.f3c, G.playerCX, G.playerCY);
  if (toPlayer === out) {
    o.f38 = o.x * 2 - o.f38;
    o.f3c = o.y * 2 - o.f3c;
    const b = o.f48;
    o.f48 = b + 0x20 > 0x3f ? b - 0x20 : b + 0x20;
    o.f4c = 1 - o.f4c;
  }
  if (o.f50 === 0) {
    spawnTrailEmitter(o.x, o.y);
    free(o);
    return;
  }
  if (!inAttackRect(o.x + 0x80000, o.y + 0x80000)) {
    touchPlayer(o.x, o.y, o.x + 0x100000, o.y + 0x100000);
  } else {
    seRequest(0);
    o.spr = 0xc0008;
    o.f50 = 0;
  }
}

function orbFollowerUpdate(o: Obj) {
  if (o.f50 === 0) {
    free(o);
    return;
  }
  const prev = o.p54!;
  const ox = o.f38;
  const oy = o.f3c;
  o.f50 = prev.f50;
  o.x = ox;
  o.y = oy;
  o.f38 = prev.x;
  o.f3c = prev.y;
  o.spr = prev.spr;
  touchPlayer(ox, oy, ox + 0x100000, oy + 0x100000);
}

function orbPart(update: (o: Obj) => void, x: number, y: number, hp: number): Obj | null {
  const o = spawn(update, 4);
  if (!o) return null;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc0026;
  o.f38 = x;
  o.f3c = y;
  o.f50 = hp;
  o.f34 = 1;
  return o;
}

function spawnOrbs(px: number, py: number, dir: number, spin: number) {
  const x = px - 0x80000;
  const y = py - 0x80000;
  const head = orbPart(orbHeadUpdate, x, y, 10);
  if (!head) return;
  head.f48 = dir;
  head.f4c = spin;
  head.f54 = 0;
  let prev: Obj = head;
  for (const hp of [9, 8, 7, 6]) {
    const f = orbPart(orbFollowerUpdate, x, y, hp);
    if (!f) return;
    f.f4c = 0;
    f.p54 = prev;
    prev = f;
  }
}

function burstSparkUpdate(o: Obj) {
  o.f50++;
  o.x += cos(o.f54) * o.f50;
  o.y += nsin(o.f54) * o.f50;
  o.f40++;
  if (o.f40 > 10) free(o);
}

function burstSparks(x: number, y: number) {
  for (let i = 0; i < 0x40; i++) {
    let k = i + 0x10;
    if (k > 0x3f) k = i - 0x30;
    if (k > 0x1f) k -= 0x20;
    const o = spawn(burstSparkUpdate, 4);
    if (!o) return;
    o.kind = 1;
    o.x = x - 0x80000;
    o.y = y - 0x80000;
    o.spr = Math.trunc(k / 2) + 0xc0065;
    o.f54 = i;
    o.f50 = 10;
    o.f34 = 4;
  }
}

function crabCircle(x: number, y: number) {
  let py = y;
  for (let r = 0; r < 16; r++) {
    let px = x;
    for (let c = 0; c < 16; c++) {
      if (G.t.crabCircle[r * 16 + c] !== 0) spawnCrab(crabCurve, px, py, rand(0x40), 0x10000);
      px += 0x80000;
    }
    py += 0x80000;
  }
}

function pillarSparkUpdate(o: Obj) {
  if (o.f4c !== 0) o.f4c--;
  const d = o.f54;
  o.x = cos(d) * o.f4c + o.f38;
  o.y = nsin(d) * o.f4c + o.f3c;
  o.spr = o.f40 + o.f44;
  o.f44++;
  if (o.f44 > 3) o.f44 = 0;
  o.f54 = d + 1 > 0x3f ? d - 0x3f : d + 1;
  o.f50++;
  if (o.f50 > 0x23) free(o);
}

function pillarSparks(x: number, y: number, spr: number, dir: number) {
  for (let i = 0; i < 7; i++) {
    const o = spawn(pillarSparkUpdate, 4);
    if (!o) return;
    o.kind = 1;
    o.x = x - 0x100000;
    o.y = y - 0x100000;
    o.spr = spr;
    o.f40 = spr;
    o.f38 = o.x;
    o.f3c = o.y;
    o.f4c = 0x1e;
    o.f54 = dir;
    o.f34 = 4;
    o.drawFlags = 1;
    dir = dir + 9 > 0x3f ? dir - 0x37 : dir + 9;
  }
}

function lightningUpdate(o: Obj) {
  if (o.f50 < 8) o.x += o.f48;
  if (o.f50 > 0xc) o.x -= o.f48;
  o.f50++;
  if (o.f50 > 0x14) free(o);
}

function lightning(x: number, y: number, spr: number) {
  let row = fix(y);
  if (row >= 0x1e0) return;
  row = row << 16;
  const t = G.t.finalLightning;
  do {
    for (let e = 0; e < 7; e++) {
      const o = spawn(lightningUpdate, 4);
      if (!o) return;
      o.kind = 1;
      o.x = t[e * 3] + x;
      o.y = row;
      o.spr = t[e * 3 + 2] + spr;
      o.f38 = t[e * 3 + 1] + x;
      const d = o.f38 - o.x;
      o.f48 = (d + ((d >> 31) & 7)) >> 3;
      o.f34 = 4;
      o.drawFlags = 1;
    }
    row += 0x200000;
  } while (row < 0x1e00000);
}

function columnUpdate(o: Obj) {
  if (o.f54 < 10) {
    o.scaleX += 0x3333;
    o.scaleY += 0x3333;
  }
  if (o.f54 > 10) {
    o.scaleX -= 0x3333;
    o.scaleY -= 0x3333;
  }
  o.f54++;
  if (o.f54 > 0x14) {
    free(o);
    return;
  }
  if (o.f54 > 7 && o.f54 < 0xd) touchPlayer(o.x, o.y, o.x + 0x200000, 0x1e00000);
}

function spawnColumn(x: number, y: number, spr: number) {
  const o = spawn(columnUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x100000;
  o.y = y - 0x100000;
  o.spr = spr;
  o.f34 = 4;
  o.drawFlags = 0x201;
  o.scaleX = 0x10000;
  o.scaleY = 0x10000;
}

function pillarUpdate(o: Obj) {
  o.f54--;
  if (o.f54 < 1) {
    spawnColumn(o.x, o.y, 0xf0000);
    lightning(o.x, o.y, 0xe0008);
    free(o);
  }
}

function spawnPillar(x: number, y: number) {
  const o = spawn(pillarUpdate, 4);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = y;
  o.spr = 0xe0000;
  o.f54 = 0x23;
  o.f34 = 2;
  o.drawFlags = 1;
  pillarSparks(o.x, o.y, 0xc0004, rand(0x40));
}

function clearChains() {
  killByUpdate([orbHeadUpdate, orbFollowerUpdate, trailEmitterUpdate, emitterUpdate, shotUpdate]);
}

const BODY_POINTS: [number, number][] = [
  [0x1000000, 0x680000],
  [0x1200000, 0x800000],
  [0x1300000, 0xa00000],
  [0x1300000, 0xc00000],
  [0x1000000, 0xd00000],
  [0xe00000, 0x800000],
  [0xd00000, 0xa00000],
  [0xd00000, 0xc00000],
];

const COLUMN_X = [0, 0x800000, 0x1000000, 0x1800000];

function bossUpdate(o: Obj) {
  o.f44++;
  if (o.f44 > 0xf) o.f44 = 0;
  const next = (state: number) => {
    o.f40 = 1;
    o.f54 = state;
  };
  switch (o.f54) {
    case 0:
      if (o.f40 > 0x2d) {
        decoyFlight(0xc00000, 0x200000, 0xc00000, 0x800000, 0x20);
        next(1);
        return;
      }
      break;
    case 1:
      if (o.f40 > 0x28) {
        showText(0x40, 0x60, 0x50, 0x28);
        next(2);
        return;
      }
      break;
    case 2:
      if (o.f40 > 0x41) {
        showText(0x40, 0x60, 0x51, 0x28);
        next(3);
        return;
      }
      break;
    case 3:
      if (o.f40 > 0x41) {
        showText(0x40, 0x40, 0x52, 0x8c);
        decoyFlight(0xc00000, 0x800000, 0xc00000, 0x800000, 0x10);
        next(4);
        return;
      }
      break;
    case 4:
      if (o.f40 > 0x28) {
        showText(0x40, 0x60, 0x53, 100);
        next(5);
        return;
      }
      break;
    case 5:
      if (o.f40 > 0x28) {
        showText(0x40, 0x80, 0x54, 0x3c);
        next(6);
        return;
      }
      break;
    case 6:
      if (o.f40 > 0x50) {
        showText(0x40, 0x40, 0x55, 0x8c);
        next(7);
        return;
      }
      break;
    case 7:
      if (o.f40 > 0x28) {
        showText(0x40, 0x60, 0x56, 100);
        for (const x of COLUMN_X) decoyFlight(0xc00000, 0x800000, x, 0x200000, 0x10);
        next(8);
        return;
      }
      break;
    case 8:
      if (o.f40 > 0x28) {
        showText(0x40, 0x80, 0x57, 0x3c);
        next(9);
        return;
      }
      break;
    case 9:
      if (o.f40 > 0x2d) {
        for (const x of [0x400000, 0xc00000, 0x1400000, 0x1c00000]) spawnPillar(x, 0x600000);
        next(10);
        return;
      }
      break;
    case 10:
      if (o.f40 > 10) {
        for (const x of COLUMN_X) decoyFlight(x, 0x200000, x, 0x200000, 0x20);
        next(0xb);
        return;
      }
      break;
    case 0xb:
      if (o.f40 > 0x3c) {
        for (const x of COLUMN_X) decoyFlight(x, 0x200000, 0xc00000, 0x600000, 0x20);
        next(0xc);
        return;
      }
      break;
    case 0xc:
      if (o.f40 > 0x41) {
        decoy(0xc00000, 0x600000, 0xc00000, 0x600000, 8, 3, 0);
        next(0xd);
        return;
      }
      break;
    case 0xd:
      if (o.f40 > 6) {
        o.f44 = 0;
        decoy(0xc00000, 0x600000, 0xc00000, 0x600000, 1, 0, 0);
        next(0xe);
        return;
      }
      break;
    case 0xe: {
      decoy(0xc00000, 0x600000, 0xc00000, 0x600000, 1, 0, o.f44);
      if (o.f40 > 100) {
        o.f40 = 0;
        o.f54 = 0xf;
      }
      let hit = false;
      for (const [x, y] of BODY_POINTS) if (inAttackRect(x, y)) hit = true;
      if (!hit) {
        touchPlayer(0xc80000, 0x680000, 0x1380000, 0xd80000);
        o.f40++;
        return;
      }
      seRequest(2);
      next(0x10);
      return;
    }
    case 0xf:
      o.f44 = 0;
      decoy(0xc00000, 0x600000, 0xc00000, 0x600000, 8, 1, 0);
      next(0x11);
      return;
    case 0x10:
      decoy(0xc00000, 0x600000, 0xc00000, 0x600000, 1, 2, o.f44);
      if (o.f40 === 10) showText(0x40, 0x40, 0x50, 0x14);
      if ((o.f40 & 1) !== 0) seRequest(1);
      if (o.f40 > 0x1e) {
        o.f40 = 0;
        o.f54 = 0xf;
        o.f50--;
        if (o.f50 < 1) {
          o.f54 = 0x1f;
          o.f44 = 0;
          clearChains();
          o.f40 = 1;
          return;
        }
        spawnOrbs(0xe80000, 0x980000, 0x10, 0);
        spawnOrbs(0x1180000, 0x980000, 0x10, 1);
        o.f40 = 1;
        return;
      }
      break;
    case 0x11:
      if (o.f40 > 0x10) {
        const r = rand(6);
        next(r < 2 ? 0x12 : r < 4 ? 0x13 : 0x1c);
        return;
      }
      break;
    case 0x12:
      if (o.f40 > 0x28) {
        for (const x of COLUMN_X) decoyFlight(0xc00000, 0x600000, x, 0x200000, 0x10);
        next(9);
        return;
      }
      break;
    case 0x13:
      if (o.f40 > 0x28) {
        decoyFlight(0xc00000, 0x600000, 0, 0, 0x10);
        next(0x14);
        return;
      }
      break;
    case 0x14:
      if (o.f40 > 0x1e) {
        decoy(0, 0, 0, 0, 8, 3, 0);
        next(0x15);
        return;
      }
      break;
    case 0x15:
      if (o.f40 > 6) {
        decoy(0, 0, 0x1800000, 0, 8, 1, 0);
        spread(0x400000, 0x400000, 0x38);
        next(0x16);
        return;
      }
      break;
    case 0x16:
      if (o.f40 > 0x1e) {
        decoy(0x1800000, 0, 0x1800000, 0, 8, 3, 0);
        next(0x17);
        return;
      }
      break;
    case 0x17:
      if (o.f40 > 6) {
        decoy(0x1800000, 0, 0x1800000, 0x1600000, 8, 1, 0);
        spread(0x1c00000, 0x400000, 0x28);
        next(0x18);
        return;
      }
      break;
    case 0x18:
      if (o.f40 > 0x1e) {
        decoy(0x1800000, 0x1600000, 0x1800000, 0x1600000, 8, 3, 0);
        next(0x19);
        return;
      }
      break;
    case 0x19:
      if (o.f40 > 6) {
        decoy(0x1800000, 0x1600000, 0, 0x1600000, 8, 1, 0);
        spread(0x1c00000, 0x1a00000, 0x18);
        next(0x1a);
        return;
      }
      break;
    case 0x1a:
      if (o.f40 > 0x1e) {
        decoy(0, 0x1600000, 0, 0x1600000, 8, 3, 0);
        next(0x1b);
        return;
      }
      break;
    case 0x1b:
      if (o.f40 > 6) {
        decoy(0, 0x1600000, 0xc00000, 0x600000, 8, 1, 0);
        spread(0x400000, 0x1a00000, 8);
        next(0xc);
        return;
      }
      break;
    case 0x1c:
      if (o.f40 > 0x28) {
        decoy(0xc00000, 0x600000, 0xc00000, 0, 8, 3, 0);
        next(0x1d);
        return;
      }
      break;
    case 0x1d:
      if (o.f40 > 6) {
        decoy(0xc00000, 0, 0xc00000, 0, 8, 1, 0);
        next(0x1e);
        return;
      }
      break;
    case 0x1e: {
      let d = o.f40 * 2 + 0x10;
      if (d > 0x3f) d = o.f40 * 2 - 0x30;
      let e = d + 0x20;
      if (e > 0x3f) e = d - 0x20;
      const c = cos(d);
      const x = c * 0xb0 + 0xc00000;
      const y = (nsin(d) + 0x10000) * 0xb0;
      decoy(x, y, x, y, 8, 1, 0);
      spawnZako2Straight(c * 0xb0 + 0x1000000, y + 0x400000, e);
      if (o.f40 > 0x1f) {
        decoy(0xc00000, 0, 0xc00000, 0x600000, 8, 1, 0);
        next(0xc);
        return;
      }
      break;
    }
    case 0x1f:
    case 0x20:
    case 0x21: {
      const base = o.f54 === 0x1f ? 0x58 : 0x50;
      const wide = o.f54 === 0x1f ? 0xb8 : 0xb0;
      const y = (rand(0x20) + base) * 0x10000;
      decoy(0xc00000, 0x600000, (rand(0x20) + wide) * 0x10000, y, 1, 2, o.f44);
      if (o.f54 === 0x21) {
        const ty = rand(0x160) << 16;
        decoy(0xc00000, 0x600000, rand(0x180) << 16, ty, 8, 1, 0);
      }
      if ((o.f40 & 3) !== 0) seRequest(1);
      if (o.f54 === 0x21 && ((o.f40 + 2) & 3) !== 0) seRequest(3);
      if (o.f54 === 0x21) {
        if (o.f40 > 0x131) next(0x22);
        else break;
        return;
      }
      if (o.f40 > 0x1e) {
        if (o.f54 === 0x1f) {
          showText(0x40, 0x40, 0x51, 0x14);
          G.shake = 1;
          next(0x20);
        } else {
          G.shake = 1;
          spriteMessage(0xf00000, 0, 0x500000, 0xa00000, 9, 300);
          next(0x21);
        }
        return;
      }
      break;
    }
    case 0x22:
      decoy(0xc00000, 0x600000, 0xc00000, 0x600000, 1, 2, o.f44);
      if ((o.f40 & 1) !== 0) {
        const y = (rand(0x10) + 0x98) * 0x10000;
        burstSparks((rand(0x10) + 0xf8) * 0x10000, y);
      }
      if (o.f40 > 7) {
        G.shake = 1;
        next(0x33);
        return;
      }
      break;
    case 0x23:
      if (o.f40 > 0x2d) {
        decoyFlight(0xc00000, 0x200000, 0xc00000, 0x800000, 0x20);
        next(0x24);
        return;
      }
      break;
    case 0x24:
      if (o.f40 > 0x28) {
        showText(0x40, 0x40, 0x58, 0x50);
        next(0x25);
        return;
      }
      break;
    case 0x25:
      if (o.f40 > 0x14) {
        showText(0x40, 0x60, 0x59, 0x3c);
        next(0x26);
        return;
      }
      break;
    case 0x26:
      if (o.f40 > 0x14) {
        showText(0x40, 0x80, 0x5a, 0x28);
        decoyFlight(0xc00000, 0x800000, 0xc00000, 0x800000, 0x10);
        next(0xc);
        return;
      }
      break;
    case 0x33:
      scorePopup(0x100, 0xb0, 9999);
      crabCircle(0xc00000, 0x600000);
      seRequest(1);
      o.f54 = 0x34;
      bossCleared(0x1e);
      o.f40 = 0;
      break;
  }
  o.f40++;
}

export function spawnNeglect() {
  const o = spawn(bossUpdate, 3);
  if (!o) return;
  o.kind = 2;
  o.spr = 0xe0000;
  o.f54 = G.retry !== 0 ? 0x23 : 0;
  o.f50 = 6;
  o.f34 = 2;
  o.drawFlags = 1;
}
