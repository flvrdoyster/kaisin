import { Obj } from "./obj.ts";
import { G, free, rand, seRequest, spawn, switchHooks } from "./core.ts";
import { spawnGlyph, spriteMessage } from "./messages.ts";
import { openExit } from "./rooms.ts";
import { smallMessage } from "./smallmsg.ts";

function iconUpdate(o: Obj) {
  if (o.spr < 0xc0088) o.spr++;
}

function spawnIcon(x: number, y: number) {
  const o = spawn(iconUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xc0083;
  o.f34 = 4;
}

function marksUpdate(o: Obj) {
  const row = Math.trunc(G.hitCount / 0x19);
  if ((G.hitCount % 0x19 + 5) * 0x100000 !== o.x || o.y !== row * 0x100000 + 0x280000) {
    spawnIcon(o.x, o.y);
    o.x += 0x100000;
    if (o.x > 0x1dfffff) {
      o.x = 0x500000;
      o.y += 0x100000;
    }
  }
}

function spawnMarks() {
  const o = spawn(marksUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = 0x500000;
  o.y = 0x280000;
  o.f34 = 4;
}

function exitDelayUpdate(o: Obj) {
  o.f50--;
  if (o.f50 < 1) {
    if (o.f54 === 8) seRequest(8);
    openExit(o.f54);
    G.exitOpened[o.f54] = 1;
    free(o);
  }
}

function spawnExitDelay(exit: number) {
  const o = spawn(exitDelayUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f54 = exit;
  o.f50 = 0x5a;
  o.f34 = 4;
}

function resultUpdate(o: Obj) {
  if (G.tkDone === 0) return;
  const hits = G.hitCount;
  const m = G.t.smallMsgs;
  m[60 + 16] = (hits % 10) + 0x1f;
  m[60 + 15] = (Math.trunc(hits / 10) % 10) + 0x1f;
  m[60 + 14] = (Math.trunc(hits / 100) % 10) + 0x1f;
  smallMessage(0x580000, 0xb00000, 1, 2000);
  smallMessage(0x900000, 0xc80000, 2, 2000);
  if (hits < 0x55) {
    smallMessage(0x780000, 0xe80000, 4, 2000);
    spawnExitDelay(8);
  } else {
    smallMessage(0x780000, 0xe80000, 3, 2000);
    spawnExitDelay(7);
  }
  free(o);
}

export function spawnKillChallenge() {
  spawnMarks();
  const o = spawn(resultUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f34 = 4;
}

function digitUpdate(_o: Obj) {}

function messageArgs(i: number): [number, number, number, number, number] {
  const t = G.t.spriteMsgArgs;
  return [t[i * 5], t[i * 5 + 1], t[i * 5 + 2], t[i * 5 + 3], t[i * 5 + 4]];
}

function timerUpdate(o: Obj) {
  if (G.blocksLeft === 0) {
    if (o.f50 === 0) {
      const [x, y, tx, ty, life] = messageArgs(6);
      spriteMessage(x, y, tx, ty, 6, life);
      o.f50 = 1;
      const t = o.f54;
      spawnGlyph(0x1700000, 0xa00000, 0xb00000, 0xc00000, (t % 0x1b) + 0xb0039, 20000);
      spawnGlyph(0x1300000, 0x1400000, 0xd00000, 0xc00000, ((t * 3) % 0x1b) + 0xb0039, 20000);
      spawnGlyph(0xf00000, 0x400000, 0xf00000, 0xc00000, ((t * 2 + 5) % 0x15) + 0xb0039, 20000);
      spawnGlyph(0xb00000, 0x1400000, 0x1100000, 0xc00000, rand(0x1a) + 0xb0039, 20000);
      spawnGlyph(0x700000, 0xa00000, 0x1300000, 0xc00000, ((t * 7) % 0xd) + 0xb0041, 20000);
    }
  } else {
    o.f54++;
  }
  if (o.f54 > 9999) o.f54 = 9999;
  let v = o.f54;
  let d = 0;
  if (v > 999) {
    d = Math.trunc(v / 1000);
    v %= 1000;
  }
  o.p4c!.spr = d + 0xb0000;
  d = 0;
  if (v > 99) {
    d = Math.trunc(v / 100);
    v %= 100;
  }
  o.p48!.spr = d + 0xb0000;
  d = 0;
  if (v > 9) {
    d = Math.trunc(v / 10);
    v %= 10;
  }
  o.p3c!.spr = d + 0xb0000;
  o.p38!.spr = v + 0xb0000;
}

function spawnTimer() {
  const o = spawn(timerUpdate, 1);
  if (!o) return;
  o.kind = 2;
  const digit = (x: number) => {
    const d = spawn(digitUpdate, 5);
    if (d) {
      d.kind = 1;
      d.spr = 0xb0000;
      d.x = x;
      d.y = 0x1900000;
      d.f34 = 4;
    }
    return d;
  };
  o.p38 = digit(0x1b00000);
  o.p3c = digit(0x1940000);
  o.p48 = digit(0x1780000);
  o.p4c = digit(0x15c0000);
  o.f34 = 4;
}

function introUpdate(o: Obj) {
  o.f48++;
  const cues: [number, number][] = [[4, 2], [0x16, 3], [0x28, 4], [0x44, 5]];
  for (const [frame, msg] of cues) {
    if (o.f48 === frame) {
      const [x, y, tx, ty, life] = messageArgs(msg);
      spriteMessage(x, y, tx, ty, msg, life);
    }
  }
  if (o.f48 === 0x46) {
    switchHooks.toggle7();
    spawnTimer();
    free(o);
  }
}

export function spawnTrialIntro() {
  const o = spawn(introUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f48 = 0;
  o.f34 = 4;
}
