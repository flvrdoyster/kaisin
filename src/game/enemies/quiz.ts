import { Obj } from "../obj.ts";
import { fix } from "../state.ts";
import { G, cos, div, free, inAttackRect, nsin, rand, seRequest, spawn } from "../core.ts";
import { puff, scorePopup } from "../effects.ts";
import { clearTexts, showText } from "../text.ts";
import { spawnMeat } from "./misc.ts";

function flameUpdate(o: Obj) {
  o.x += (o.f38 - o.x) >> 1;
  o.y += (o.f3c - o.y) >> 1;
  if (((o.f38 ^ o.x) & 0xfff80000) === 0 && ((o.y ^ o.f3c) & 0xfff80000) === 0) {
    free(o);
    return;
  }
  o.spr++;
  if (o.spr > 0x5002e) o.spr = 0x5002b;
}

function flames(px: number, py: number) {
  for (let ring = 0; ring < 3; ring++) {
    for (let i = 0; i < 64; i++) {
      const o = spawn(flameUpdate, 1);
      if (!o) return;
      o.kind = 1;
      o.x = px - 0x80000;
      o.y = py - 0x80000;
      o.spr = 0x5002b;
      o.f38 = cos(i) * (ring + 1) * 0x1e + px - 0x80000;
      o.f3c = nsin(i) * (ring + 1) * 0x1e + py - 0x80000;
      o.f34 = 2;
    }
  }
}

function choiceUpdate(o: Obj) {
  const phase = o.f38;
  const wave = nsin(phase);
  o.f38 = phase + 1 > 0x3f ? phase - 0x3f : phase + 1;
  o.y = wave * 4 + o.f3c;
  if (inAttackRect(o.x + 0x180000, o.y + 0x180000)) {
    seRequest(2);
    o.p50!.f3c = o.f4c;
    flames(o.x + 0x180000, o.y + 0x180000);
    free(o.p54);
    free(o);
  }
}

function spawnChoices(host: Obj) {
  const a = spawn(choiceUpdate, 3);
  const b = spawn(choiceUpdate, 3);
  if (!a || !b) return;
  a.kind = 1;
  a.x = 0x600000;
  a.y = 0x1600000;
  a.spr = 0xe0005;
  a.f3c = 0x1600000;
  a.f4c = 1;
  a.p50 = host;
  a.p54 = b;
  a.f34 = 2;
  a.drawFlags = 1;
  b.kind = 1;
  b.x = 0x1600000;
  b.y = 0x1600000;
  b.spr = 0xe0006;
  b.f38 = 0x20;
  b.f3c = 0x1600000;
  b.f4c = 2;
  b.p50 = host;
  b.p54 = a;
  b.f34 = 2;
  b.drawFlags = 1;
}

function meatFlightUpdate(o: Obj) {
  puff(o.x, o.y, 2);
  o.x += (o.f38 - o.x) >> 1;
  o.y += (o.f3c - o.y) >> 1;
  if (((o.f38 ^ o.x) & 0xffe00000) === 0 && ((o.f3c ^ o.y) & 0xffe00000) === 0) {
    spawnMeat(o.x - 0x180000, o.y - 0x180000);
    free(o);
  }
}

function spawnMeatFlight(x: number, y: number, tx: number, ty: number) {
  const o = spawn(meatFlightUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = y;
  o.f38 = tx;
  o.f3c = ty;
  o.f34 = 2;
  o.f58 = 1;
}

function payoutUpdate(o: Obj) {
  o.f54++;
  if (o.f54 > 100) {
    free(o);
    return;
  }
  const y = rand(0x20) + fix(G.playerCY) - 0x10;
  const x = rand(0x20) + fix(G.playerCX) - 0x20;
  scorePopup(x, y, 0x1d);
}

function spawnPayout() {
  const o = spawn(payoutUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f34 = 4;
  o.drawFlags = 1;
}

function tailUpdate(o: Obj) {
  const p = o.p54!;
  o.x = div(p.x + o.x, 2);
  o.y = div(p.y + o.y, 2);
}

function exitLine(o: Obj) {
  showText(0x50, 0x40, 0x41, 0x3c);
  o.f48 = 0xc00000;
  o.f4c = 0x1e00000;
  o.f38 = 1;
  G.clearFlag = 1;
}

function quizUpdate(o: Obj) {
  const go = (state: number) => {
    o.f40 = 0;
    o.f54 = state;
  };
  const answered = (a: number, b: number, sprA: number, sprB: number) => {
    if (o.f3c === 1) {
      o.f54 = a;
      o.f3c = 0;
      clearTexts();
      o.spr = sprA;
    } else if (o.f3c === 2) {
      o.f54 = b;
      o.f3c = 0;
      clearTexts();
      o.spr = sprB;
    }
  };
  const step = (limit: number, state: number, x: number, y: number, id: number, frames: number) => {
    o.f40++;
    if (o.f40 > limit) {
      go(state);
      showText(x, y, id, frames);
      return true;
    }
    return false;
  };
  const target = (x: number, y: number) => {
    o.f38 = 1;
    o.f48 = x;
    o.f4c = y;
  };
  switch (o.f54) {
    case 0: {
      const a = o.f44;
      const r = o.f40;
      o.x = cos(a) * r + 0xc00000;
      o.y = nsin(a) * r + 0x600000;
      for (let i = 0; i < 5; i++) if (o.f40 > 0) o.f40--;
      o.f44 = a + 4 > 0x3f ? a - 0x3c : a + 4;
      if (o.f40 === 0) {
        showText(0xa0, 0x40, 0x2d, 0x28);
        o.f54 = 1;
      }
      break;
    }
    case 1:
      step(0x2d, 2, 0x60, 0x50, 0x2e, 0x32);
      break;
    case 2:
      step(0x46, 3, 0x20, 0x30, 0x2f, 0x78);
      break;
    case 3:
      step(0x28, 4, 0x20, 0x60, 0x30, 0x50);
      break;
    case 4:
      if (step(100, 5, 0x80, 0x30, 0x31, 100)) target(0x200000, 0xa00000);
      break;
    case 5:
      if (step(0x14, 6, 0x90, 0x50, 0x32, 400)) target(0x1600000, 0xa00000);
      break;
    case 6:
      o.f40++;
      if (o.f40 > 0x14) {
        go(7);
        target(0xc00000, 0x600000);
        spawnChoices(o);
        o.spr = 0xe0009;
      }
      break;
    case 7:
      answered(8, 9, 0xe0007, 0xe0008);
      break;
    case 8:
      step(10, 10, 0x60, 0x40, 0x34, 0x28);
      break;
    case 9:
      step(10, 0xb, 0x20, 0x40, 0x35, 0x28);
      break;
    case 10:
      if (step(0x50, 0xd, 0x60, 0x20, 0x36, 0x46)) o.spr = 0xe0000;
      break;
    case 0xb:
      if (step(0x3c, 0xc, 0x20, 0x30, 0x39, 0x5a)) G.clearFlag = 1;
      break;
    case 0xc:
      o.f40++;
      if (o.f40 > 0x1e) {
        o.f40 = 0;
        o.f54 = 1000;
        showText(0x20, 0x50, 0x3a, 400);
        G.clearFlag = 1;
      }
      break;
    case 0xd:
      if (step(0x28, 0xe, 0x20, 0x50, 0x37, 0x5a)) spawnMeatFlight(o.x + 0x400000, o.y + 0x400000, 0x1000000, 0x1300000);
      break;
    case 0xe:
      step(100, 0xf, 0x20, 0x40, 0x38, 0x5a);
      break;
    case 0xf:
      step(0x96, 0x10, 0x20, 0x40, 0x3b, 0x28);
      break;
    case 0x10:
      if (step(0x3c, 0x11, 0x10, 0x50, 0x3c, 400)) spawnChoices(o);
      break;
    case 0x11:
      answered(0x12, 0x13, 0xe0007, 0xe0008);
      break;
    case 0x12:
      step(10, 0x14, 0x60, 0x50, 0x3e, 0x28);
      break;
    case 0x13:
      step(10, 0xb, 0x30, 0x40, 0x3d, 0x28);
      break;
    case 0x14:
      step(0x3c, 0x15, 0x20, 0x30, 0x3f, 0x5a);
      break;
    case 0x15:
      step(0x28, 0x16, 0x20, 0x50, 0x40, 0x5a);
      break;
    case 0x16:
      o.f40++;
      if (o.f40 >= 0x65) {
        go(0x17);
        exitLine(o);
      }
      break;
    case 0x17:
      o.f40++;
      if (o.f40 > 600) {
        go(0x18);
        target(0xc00000, 0x600000);
        o.spr = 0xe0000;
      }
      break;
    case 0x18:
      step(0x28, 0x19, 0x40, 0x50, 0x42, 0x28);
      break;
    case 0x19:
      step(0x32, 0x1a, 0x20, 0x40, 0x43, 0x32);
      break;
    case 0x1a:
      step(0x3c, 0x1b, 0x20, 0x20, 0x44, 0x8c);
      break;
    case 0x1b:
      step(0x28, 0x1c, 0x20, 0x40, 0x45, 100);
      break;
    case 0x1c:
      step(0x28, 0x1d, 0x20, 0x60, 0x46, 0x3c);
      break;
    case 0x1d:
      step(100, 0x1e, 0x80, 0x30, 0x31, 100);
      break;
    case 0x1e:
      if (step(0x14, 0x1f, 0x90, 0x50, 0x47, 400)) spawnChoices(o);
      break;
    case 0x1f:
      answered(0x21, 0x20, 0xe0007, 0xe0008);
      break;
    case 0x20:
      step(10, 0xb, 0x30, 0x40, 0x48, 0x28);
      break;
    case 0x21:
      step(10, 0x22, 0x40, 0x40, 0x49, 0x28);
      break;
    case 0x22:
      step(0x32, 0x23, 0x40, 0x50, 0x4a, 0x28);
      break;
    case 0x23:
      if (step(0x82, 0x24, 0x20, 0x40, 0x4b, 0x3c)) o.spr = 0xe0000;
      break;
    case 0x24:
      if (step(0x46, 0x25, 0x40, 0x50, 0x4c, 600)) {
        spawnChoices(o);
        o.spr = 0xe0000;
      }
      break;
    case 0x25:
      answered(0x26, 0x27, 0xe0008, 0xe0007);
      break;
    case 0x26:
      step(10, 0xb, 0x30, 0x40, 0x4d, 0x28);
      break;
    case 0x27:
      if (step(10, 0x28, 0x30, 0x40, 0x4e, 0x3c)) spawnPayout();
      break;
    case 0x28:
      step(0x3c, 0x29, 0x10, 0x30, 0x4f, 0x5a);
      break;
    case 0x29:
      step(0x28, 0x2a, 0x20, 0x50, 0x40, 0x5a);
      break;
    case 0x2a:
      o.f40++;
      if (o.f40 >= 0x65) {
        o.f40 = 0;
        o.f54 = 1000;
        exitLine(o);
      }
      break;
  }
  if (o.f38 === 1) {
    o.x = div(o.f48 - o.x, 2) + o.x;
    o.y = div(o.f4c - o.y, 2) + o.y;
  }
}

export function spawnQuiz() {
  const e = spawn(quizUpdate, 3);
  if (!e) return;
  e.kind = 1;
  e.x = 0;
  e.y = 0x1e00000;
  e.spr = 0xe0000;
  e.f40 = 0x180;
  e.f34 = 2;
  e.drawFlags = 1;
  let prev: Obj = e;
  for (const spr of [0xe0001, 0xe0002, 0xe0003, 0xe0004]) {
    const t = spawn(tailUpdate, 2);
    if (!t) return;
    t.kind = 1;
    t.x = 0;
    t.y = 0x1e00000;
    t.spr = spr;
    t.p54 = prev;
    t.f34 = 2;
    t.drawFlags = 1;
    prev = t;
  }
}
