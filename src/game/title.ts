import { Obj } from "./obj.ts";
import { G, free, seRequest, spawn, spawnBack } from "./core.ts";

function still(_o: Obj) {}

function piece(layer: number, x: number, y: number, spr: number, update: (o: Obj) => void = still): Obj | null {
  const o = spawn(update, layer);
  if (!o) return null;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = spr;
  o.f34 = 1;
  o.drawFlags = 3;
  return o;
}

function blinkUpdate(o: Obj) {
  o.f54++;
  if (o.f54 > 10) {
    o.f54 = 0;
    o.y = o.f3c - o.y + 0x1f40000;
  }
}

function slideUpdate(o: Obj) {
  if (o.f54 < 300) o.f54++;
  if (o.f54 === 0x58) seRequest(0);
  if (o.f54 > 0x6e && o.x < 0x1080000) {
    o.y += 0x10000;
    o.x += 0x10000;
  }
}

function trailUpdate(o: Obj) {
  o.spr++;
  if (o.spr > 0xe000f) free(o);
}

function spawnTrail(x: number, y: number) {
  const o = spawn(trailUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x180000;
  o.y = y - 0x180000;
  o.spr = 0xe000a;
  o.f34 = 1;
  o.drawFlags = 3;
}

function sweepUpdate(o: Obj) {
  spawnTrail(o.x, o.y);
  o.y += 0x180000;
  o.x += 0x180000;
  if (o.x > 0x1a00000) free(o);
}

function spawnSweep() {
  const o = spawn(sweepUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = 0x1000000;
  o.y = 0x900000;
  o.spr = 0xe000a;
  o.f34 = 1;
  o.drawFlags = 3;
}

function arrowUpdate(o: Obj) {
  o.f40++;
  if (o.f40 > 1) free(o);
}

function spawnArrow(x: number, y: number, k: number) {
  const o = spawnBack(arrowUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = k + 0xe0015;
  o.f34 = 1;
  o.drawFlags = 3;
}

function menuUpdate(o: Obj) {
  if ((G.input & 4) === 0) {
    if ((G.input & 8) === 0) o.f54 = 0;
    else if (o.f54 === 0) {
      G.menu++;
      o.f54 = 1;
      if (G.menu > 2) G.menu = 2;
    }
  } else if (o.f54 === 0) {
    G.menu--;
    o.f54 = 1;
    if (G.menu < 0) G.menu = 0;
  }
  if (G.menu < 2) spawnArrow(0x2200000, 0x1d00000, 1);
  if (G.menu > 0) spawnArrow(0x2200000, 0x1a00000, 0);
  o.spr = G.menu + 0xe0012;
}

function spawnMenu() {
  const o = spawn(menuUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = 0x1e00000;
  o.y = 0x1b80000;
  o.spr = G.menu + 0xe0012;
  o.f54 = 1;
  o.f34 = 1;
  o.drawFlags = 3;
}

function demoUpdate(o: Obj) {
  const bits = G.t.demoDir[o.f34];
  const btn = G.t.demoBtn[o.f34];
  o.f34++;
  if (o.f34 > 300) o.f34 = 300;
  if (btn === 0 && o.f54 !== 1) {
    if (o.f50 !== 0) {
      o.f40 -= 4;
      o.f50 = 0;
    }
  } else {
    if (o.f50 === 0) {
      o.f40 += 4;
      o.f44 = 0;
      o.f54 = 1;
      seRequest(7);
    }
    if (o.f44 === 5) o.f54 = 0;
    if (o.f44 > 0xc) o.f44 = 5;
    o.f50 = 1;
  }
  if (o.f40 < 8) {
    let k = 0;
    if (bits & 1) {
      k = 1;
      o.f4c -= 0x10000;
      if (o.f4c < -0x80000) o.f4c = -0x80000;
    }
    if (bits & 4) {
      k--;
      o.f4c += 0x10000;
      if (o.f4c > 0x80000) o.f4c = 0x80000;
    }
    if (bits & 8) {
      k += 3;
      o.f48 -= 0x10000;
      if (o.f48 < -0x80000) o.f48 = -0x80000;
    }
    if (bits & 2) {
      k -= 3;
      o.f48 += 0x10000;
      if (o.f48 > 0x80000) o.f48 = 0x80000;
    }
    if (k !== 0) {
      const v = G.t.dirFromInput[k + 4];
      o.f40 = v;
      if (o.f50 !== 0) o.f40 = v + 4;
    }
  }
  if ((bits & 10) === 0) {
    if (o.f48 < 0) o.f48 += 0x10000;
    if (o.f48 > 0) o.f48 -= 0x10000;
  }
  if ((bits & 5) === 0) {
    if (o.f4c < 0) o.f4c += 0x10000;
    if (o.f4c > 0) o.f4c -= 0x10000;
  }
  if (o.f48 < 0x10000 && -0x10000 < o.f48) o.f48 = 0;
  if (o.f4c < 0x10000 && -0x10000 < o.f4c) o.f4c = 0;
  o.f38 += o.f48;
  o.f3c += o.f4c;
  const pose = G.t.playerAnim[o.f40 * 0x10 + o.f44];
  o.x = o.f38 + G.t.poses[pose * 4] * 0x10000;
  o.y = o.f3c + G.t.poses[pose * 4 + 1] * 0x10000;
  o.spr = (pose + 0x50000) | 0x50000;
  if (o.f44 < 0xf) o.f44++;
  else o.f44 = 0;
}

function titleUpdate(o: Obj) {
  if ((G.input & 0x40) === 0) {
    const s = G.hudSlots;
    G.bugMode = G.mode === 1 || (s[0] === 8 && s[1] === 0) ? 1 : 0;
    if (G.mode === 2 || (s[0] === 8 && s[1] === 4 && s[2] === 5 && s[3] === 6)) G.invincible = 1;
    const t = o.f54++;
    switch (t) {
      case 0x27:
        piece(4, 0x1900000, 0x100000, 0xe0002);
        break;
      case 0x3b:
        piece(4, 0x1900000, 0x700000, 0xe0003);
        break;
      case 0x4f:
        piece(3, 0xd00000, 0x900000, 0xe0000);
        piece(3, 0x1000000, 0x500000, 0xe0001, slideUpdate);
        break;
      case 0x63:
        piece(4, 0x880000, 0xb00000, 0xe0004);
        break;
      case 0x77:
        piece(4, 0x840000, 0x1100000, 0xe0005);
        break;
      case 0xa9:
        spawnSweep();
        break;
      case 0xdb: {
        const p = piece(4, 0x1100000, 0x1500000, 0xe0007, blinkUpdate);
        if (p) p.f3c = 0x1500000;
        break;
      }
    }
    return;
  }
  G.scene = G.menu === 1 ? 4 : G.menu === 2 ? 0x11 : 3;
}

export function spawnTitle() {
  const c = spawn(titleUpdate, 1);
  if (c) {
    c.kind = 2;
    c.f34 = 1;
    c.drawFlags = 1;
  }
  const d = spawn(demoUpdate, 2);
  if (d) {
    d.kind = 1;
    d.x = 0x2800000;
    d.y = 0x1600000;
    d.spr = 0x50000;
    d.f38 = d.x;
    d.f3c = d.y;
    d.f34 = 0;
    d.drawFlags = 3;
  }
  piece(4, 0xc00000, 0x1b00000, 0xe0006);
  spawnMenu();
}
