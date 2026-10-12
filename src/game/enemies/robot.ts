import { Obj } from "../obj.ts";
import { fix } from "../state.ts";
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
  touchPlayer,
} from "../core.ts";
import { scorePopup, shards, smokeBurst, smokeRise } from "../effects.ts";
import { flashA } from "./scissizer.ts";
import { distance } from "./misc.ts";

function beamUpdate(o: Obj) {
  o.f50--;
  if (o.f50 < 1) free(o);
}

function impactUpdate(o: Obj) {
  o.f50--;
  if (o.f50 < 1) {
    free(o);
    return;
  }
  touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x200000);
}

function beam(x: number, y: number, dir: number, length: number) {
  const frame = dir === 0 ? 0x20 : dir;
  let i = 1;
  if (length > 1) {
    do {
      const o = spawn(beamUpdate, 4);
      if (!o) return;
      o.kind = 1;
      o.x = cos(dir) * i * 0x10 + x - 0x80000;
      o.y = nsin(dir) * i * 0x10 + y - 0x80000;
      i++;
      o.spr = (frame >> 1) + 0xc0055;
      o.f50 = 2;
      o.f34 = 4;
      o.drawFlags = 1;
    } while (i < length);
  }
  const o = spawn(impactUpdate, 3);
  if (!o) return;
  o.kind = 1;
  o.x = (cos(dir) * i - 0x8000) * 0x10 + x - 0x80000;
  o.y = (nsin(dir) * i - 0x8000) * 0x10 + y - 0x80000;
  o.spr = 0xc0064;
  o.f50 = 3;
  o.f34 = 4;
  o.drawFlags = 1;
  smokeRise(o.x + 0x100000, o.y + 0x100000, 2);
  seRequest(1);
}

function bodyUpdate(o: Obj) {
  o.x = o.f38 - 0x300000;
  o.y = o.f3c - 0x300000;
  if (o.f40 === 0) {
    o.spr = 0xe0000;
  } else if (o.f40 === 1) {
    o.spr = 0x1c0001 - o.spr;
    o.f50--;
    if (o.f50 <= 0) {
      o.f50 = 0;
      o.f40 = 0;
    }
  }
}

const HEAD_ANGLE: [number, number][] = [
  [0x11, 0xe0008],
  [0x24, 0xe0002],
  [0x29, 0xe0003],
  [0x2e, 0xe0004],
  [0x33, 0xe0005],
  [0x38, 0xe0006],
  [0x3d, 0xe0007],
];

function headSwing(i: number): number {
  if (i < 4) return 0xe0005;
  if (i < 9) return 0xe0004;
  if (i < 0xe) return 0xe0003;
  if (i < 0x14) return 0xe0002;
  if (i < 0x19) return 0xe0003;
  if (i < 0x1e) return 0xe0004;
  if (i < 0x23) return 0xe0005;
  if (i < 0x28) return 0xe0006;
  if (i < 0x2d) return 0xe0007;
  if (i < 0x33) return 0xe0008;
  if (i < 0x38) return 0xe0007;
  if (i < 0x3d) return 0xe0006;
  return 0xe0005;
}

function headUpdate(o: Obj) {
  const bx = o.f38;
  const by = o.f3c;
  o.x = bx - 0x100000;
  o.y = by - 0x100000;
  switch (o.f40) {
    case 0: {
      o.f50 = 0;
      const d = dir64(bx - 0x100000, by - 0x100000, G.playerCX, G.playerCY);
      o.spr = 0xe0008;
      for (const [limit, spr] of HEAD_ANGLE) {
        if (d < limit) {
          o.spr = spr;
          break;
        }
      }
      break;
    }
    case 1:
      o.f50 = 0;
      if (o.spr < 0xe0005) o.spr++;
      else if (o.spr > 0xe0005) o.spr--;
      break;
    case 2:
      o.f50 = 0;
      if (o.spr === 0xe0005) o.f40 = 3;
      else if (o.spr < 0xe0005) o.spr++;
      else o.spr--;
      o.f44 = distance(bx, by, G.playerCX, G.playerCY) >> 0x14;
      break;
    case 3: {
      o.f50++;
      if (o.f50 > 0x3f) {
        o.f50 = 0;
        o.f40 = 1;
      }
      const i = o.f50;
      o.spr = headSwing(i);
      if (i < 0x10) {
        flashA(bx + cos(0x30 - i) * 8, by + nsin(0x30 - i) * 8);
      } else if (i < 0x31) {
        let k = i + 0x10;
        if (k > 0x3f) k = i - 0x30;
        flashA(bx + cos(k) * 8, by + nsin(k) * 8);
        beam(bx, by, k, o.f44);
      }
      break;
    }
    default:
      o.f50 = 0;
  }
}

function legAUpdate(o: Obj) {
  o.f50 += 4;
  if (o.f50 > 0x3f) o.f50 = 0;
  if (o.f40 === 0) {
    o.x = o.f38 - 0x100000;
    o.y = o.f3c - 0x180000;
  } else if (o.f40 === 1) {
    let k = o.f50 + 0x20;
    if (k > 0x3f) k = o.f50 - 0x20;
    o.x = o.f38 - 0x100000;
    o.y = cos(k) * 2 - 0x180000 + o.f3c;
  } else if (o.f40 === 2) {
    o.x = o.f38 - 0x100000;
    o.y = o.f3c - 0x100000;
  }
}

function legBUpdate(o: Obj) {
  o.f50 += 4;
  if (o.f50 > 0x3f) o.f50 = 0;
  if (o.f40 === 0) {
    o.x = o.f38 - 0x100000;
    o.y = o.f3c - 0x180000;
  } else if (o.f40 === 1) {
    o.x = o.f38 - 0x100000;
    o.y = cos(o.f50) * 2 - 0x180000 + o.f3c;
  }
}

function handUpdate(o: Obj) {
  switch (o.f40) {
    case 0:
      o.f50++;
      if (o.f50 > 0x3f) o.f50 = 0;
      o.spr = 0xe000b;
      o.x = cos(o.f50) * 2 - 0x200000 + o.f38;
      o.y = o.f3c - 0x100000;
      break;
    case 1:
      o.f50 += 4;
      if (o.f50 > 0x3f) o.f50 = 0;
      o.x = ((cos(o.f50) - 0x20000) << 4) + o.f38;
      o.spr = 0xe000b;
      o.y = ((nsin(o.f50) - 0x10000) << 4) + o.f3c;
      break;
    case 2:
      o.f38 += (o.f48 - o.f38) >> 1;
      o.x = o.f38 - 0x200000;
      o.spr = 0xe000b;
      o.f3c += (o.f4c - o.f3c) >> 1;
      o.y = o.f3c - 0x100000;
      break;
    case 3:
      o.spr = 0xe000c;
      o.f40 = 4;
      o.x = o.f38 - 0x180000;
      o.y = o.f3c - 0x200000;
      break;
    case 4:
      o.spr = 0xe000d;
      o.x = o.f38 - 0x100000;
      o.y = o.f3c - 0x200000;
      break;
    case 5:
      o.spr = 0xe000c;
      o.f40 = 0;
      o.x = o.f38 - 0x180000;
      o.y = o.f3c - 0x200000;
      break;
  }
}

function armUpdate(o: Obj) {
  const bx = o.f38;
  const by = o.f3c;
  switch (o.f40) {
    case 0:
      o.f50++;
      if (o.f50 > 0x3f) o.f50 = 0;
      o.x = bx - 0x100000;
      o.spr = 0xe000e;
      o.y = cos(o.f50) * 2 - 0x600000 + by;
      return;
    case 1:
      o.x = bx - 0x100000;
      o.y = by - 0x600000;
      o.f50 = 0;
      o.spr = 0xe000e;
      o.f40 = 2;
      return;
    case 2:
      switch (o.f50) {
        case 0:
        case 8:
          o.x = bx - 0x100000;
          o.y = by - 0x700000;
          o.spr = 0xe000e;
          seRequest(7);
          o.f50++;
          return;
        case 1:
        case 7:
        case 9:
        case 0xf:
          o.x = bx - 0x400000;
          o.y = by - 0x600000;
          o.spr = 0xe000f;
          o.f50++;
          return;
        case 2:
        case 6:
        case 10:
        case 0xe:
          o.x = bx - 0x400000;
          o.y = by - 0x200000;
          o.spr = 0xe0010;
          o.f50++;
          return;
        case 3:
        case 5:
        case 0xb:
        case 0xd:
          o.x = bx - 0x200000;
          o.y = by - 0x200000;
          o.spr = 0xe0011;
          o.f50++;
          return;
        case 4:
        case 0xc:
          o.x = bx + 0x300000;
          o.y = by - 0x200000;
          o.spr = 0xe0012;
          o.f50++;
          return;
        case 0x10:
          o.x = bx - 0x100000;
          o.y = by - 0x700000;
          o.spr = 0xe000e;
          o.f40 = 3;
          o.f50 = 0;
          seRequest(7);
          o.f50++;
          return;
        default:
          o.f50 = 1;
          return;
      }
    case 3:
      switch (o.f50) {
        case 0:
          o.x = bx - 0x100000;
          o.y = by - 0x700000;
          o.spr = 0xe000e;
          touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x500000);
          o.f50++;
          return;
        case 1:
          o.x = bx - 0x500000;
          o.y = by - 0x600000;
          o.spr = 0xe000f;
          o.f50++;
          return;
        case 2:
          o.x = bx - 0x600000;
          o.y = by - 0x200000;
          o.spr = 0xe0010;
          touchPlayer(o.x, o.y, o.x + 0x700000, o.y + 0x200000);
          o.f50++;
          return;
        case 3:
          o.x = bx - 0x500000;
          o.y = by - 0x100000;
          o.spr = 0xe0011;
          touchPlayer(o.x, o.y, o.x + 0x600000, o.y + 0x600000);
          o.f50++;
          return;
        case 4:
          o.x = bx - 0x400000;
          o.y = by;
          o.spr = 0xe0011;
          touchPlayer(o.x, o.y, o.x + 0x600000, o.y + 0x600000);
          o.f50++;
          return;
        case 5:
          o.x = bx;
          o.y = by;
          o.spr = 0xe0012;
          touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x700000);
          o.f50++;
          return;
        case 6:
          o.x = bx + 0x200000;
          o.y = by + 0x200000;
          o.spr = 0xe0012;
          touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x700000);
          o.f50++;
          return;
        case 7:
          o.x = bx + 0x300000;
          o.y = by + 0x200000;
          o.spr = 0xe0012;
          touchPlayer(o.x, o.y, o.x + 0x200000, o.y + 0x700000);
          o.f50++;
          return;
        case 8:
          o.x = bx - 0x300000;
          o.y = by - 0x300000;
          o.spr = 0xe000f;
          o.f50 = 1;
          o.f40 = 4;
          return;
        default:
          o.f50 = 1;
          return;
      }
    case 4:
      o.x = bx - 0x100000;
      o.y = by - 0x600000;
      o.spr = 0xe000e;
      o.f40 = 0;
  }
}

function robotUpdate(o: Obj) {
  let a = 0xff;
  let b = 0xff;
  let c = 0xff;
  let d = 0xff;
  let head = 0xff;
  switch (o.f54) {
    case 0: {
      a = 0;
      const iy = fix(o.y);
      b = 0;
      if ((o.x & 0xfffe0000) < (G.playerCX & 0xfffe0000)) {
        const x = o.x;
        o.x = rand(3) * 0x10000 + x;
        if (atrGet(fix(o.x), iy) !== 0) o.x = x;
        b = 1;
        a = 1;
      } else if ((G.playerCX & 0xfffe0000) < (o.x & 0xfffe0000)) {
        const x = o.x;
        o.x = x + rand(3) * -0x10000;
        if (atrGet(fix(o.x), iy) !== 0) o.x = x;
        a = 1;
        b = 1;
      }
      c = 0;
      d = 0;
      head = 0;
      o.f50++;
      if (o.f50 > 0x3c) {
        o.f54 = 1;
        o.f50 = 0;
      }
      break;
    }
    case 1:
      b = 0;
      a = 0;
      d = 0;
      c = 0;
      o.f50++;
      head = 1;
      if (o.f50 > 0x14) {
        o.f50 = 0;
        if (G.playerCY < o.y + 0xa00000 && o.x - 0xc00000 < G.playerCX && G.playerCX < o.x + 0xc00000) {
          d = 1;
          c = 3;
          o.f54 = 3;
        } else {
          o.f54 = 4;
          head = 2;
          c = 3;
        }
      }
      break;
    case 2:
      d = 0;
      b = 0;
      a = 0;
      c = 0xff;
      head = 0;
      o.f50++;
      if (o.f50 >= 0x1f) {
        d = 0;
        c = 0xff;
        b = 0;
        a = 0;
        o.f50 = 0;
        o.f54 = 0;
      }
      break;
    case 3:
      b = 2;
      a = 0;
      c = 0xff;
      d = 0xff;
      o.f50++;
      head = 1;
      if (o.f50 > 0x3c) {
        o.f50 = 0;
        o.f54 = 0;
      }
      break;
    case 4:
      b = 0;
      a = 0;
      c = 0xff;
      d = 0;
      head = 0xff;
      o.f50++;
      if (o.f50 >= 0x3d) {
        d = 0;
        c = 0xff;
        b = 0;
        a = 0;
        o.f50 = 0;
        o.f54 = 0;
      }
      break;
    default:
      o.f54 = 0;
  }
  const body = o.p3c!;
  body.f38 = o.x;
  body.f3c = o.y;
  const hd = o.p38!;
  hd.f38 = o.x;
  hd.f3c = o.y - 0x200000;
  if (head < 100) hd.f40 = head;
  const arm = o.p40!;
  arm.f38 = o.x - 0x300000;
  arm.f3c = o.y + 0x200000;
  if (d < 100) arm.f40 = d;
  const hand = o.p44!;
  hand.f38 = o.x + 0x200000;
  hand.f3c = o.y;
  if (c < 100) hand.f40 = c;
  const legA = o.p48!;
  legA.f38 = o.x - 0x180000;
  legA.f3c = o.y + 0x300000;
  if (b < 100) legA.f40 = b;
  const legB = o.p4c!;
  legB.f38 = o.x + 0x180000;
  legB.f3c = o.y + 0x300000;
  if (a < 100) legB.f40 = a;
  if (body.f50 === 0 && body.f40 === 0) {
    if (
      inAttackRect(o.x + 0x200000, o.y) ||
      inAttackRect(o.x - 0x200000, o.y) ||
      inAttackRect(o.x, o.y + 0x200000)
    ) {
      seRequest(2);
      body.f40 = 1;
      body.f50 = 0x14;
      o.spr--;
      if (o.spr < 1) {
        for (const p of [o.p38, o.p3c, o.p48, o.p4c, o.p40, o.p44]) free(p);
        scorePopup(fix(o.x) - 8, fix(o.y), 300);
        countHit();
        for (let i = 0; i < 6; i++) {
          let y = (rand(0x30) - 0x18) * 0x10000 + o.y;
          smokeBurst((rand(0x30) - 0x18) * 0x10000 + o.x, y, 4);
          y = (rand(0x30) - 0x28) * 0x10000 + o.y;
          shards((rand(0x30) - 0x28) * 0x10000 + o.x, y);
        }
        free(o);
        return;
      }
    }
    touchPlayer(o.x - 0x300000, o.y - 0x300000, o.x + 0x300000, o.y + 0x300000);
  }
}

function part(update: (o: Obj) => void, layer: number, spr: number, a: number, b: number, parent: Obj): Obj | null {
  const o = spawn(update, layer);
  if (!o) return null;
  o.kind = 1;
  o.x = a;
  o.y = b;
  o.spr = spr;
  o.f38 = a;
  o.f3c = b;
  o.f48 = a;
  o.f4c = b;
  o.p54 = parent;
  o.f34 = 1;
  o.drawFlags = 1;
  return o;
}

export function spawnRobot(a: number, b: number) {
  const r = spawn(robotUpdate, 1);
  if (!r) return;
  r.kind = 2;
  r.x = a;
  r.y = b;
  r.spr = 3;
  r.p40 = part(armUpdate, 3, 0xe000e, a, b, r);
  r.p44 = part(handUpdate, 3, 0xe000b, a, b, r);
  r.p38 = part(headUpdate, 2, 0xe0005, a, b, r);
  r.p3c = part(bodyUpdate, 2, 0xe0000, a, b, r);
  r.p48 = part(legAUpdate, 2, 0xe0009, a, b, r);
  r.p4c = part(legBUpdate, 2, 0xe000a, a, b, r);
  r.f54 = 0;
  r.f50 = rand(0x3c);
  r.f34 = 4;
  r.drawFlags = 1;
}
