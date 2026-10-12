import { Obj } from "./obj.ts";
import { bgmPlay } from "../audio/bgm.ts";
import { G, free, seRequest, spawn } from "./core.ts";
import { loadInts } from "./rooms.ts";
import { queueText, showText } from "./text.ts";
import { smallMessage } from "./smallmsg.ts";

export function loadBackdrop(n: number) {
  const s = G.sheets;
  const e = G.data;
  switch (n) {
    case 0:
      loadInts("backdrop/END_BG_0/tiles", G.mdt);
      break;
    case 1:
      loadInts("backdrop/END_BG_1/tiles", G.mdt);
      s.loadGrid(2, "ENDING1.png", 0x10, 5, 0x20, 0x20);
      s.loadRects(0xe, "ENDING2.png", 0xd0, 0xd0, e.i32("rectENDING2"));
      break;
    case 2:
    case 3:
    case 4:
      loadInts(`backdrop/END_BG_${n}/tiles`, G.mdt);
      s.loadGrid(2, `ENDING${n + 1}.png`, 0x10, 5, 0x20, 0x20);
      break;
    case 5:
      loadInts("backdrop/END_BG_5/tiles", G.mdt);
      s.loadGrid(2, "ENDING6.png", 0x10, 5, 0x20, 0x20);
      s.loadGrid(0xe, "ENDING7.png", 0xd0, 0xd0, 0x100, 0x60);
      break;
    case 6:
      loadInts("backdrop/STAFF_BG/tiles", G.mdt);
      s.loadGrid(2, "STAFF.png", 0x10, 5, 0x20, 0x20);
      s.loadRects(0xe, "STAFF_SP.png", 0xd0, 0xd0, e.i32("rectSTAFF_SP"));
      break;
    case 7:
      loadInts("backdrop/END_BG_6/tiles", G.mdt);
      s.loadGrid(2, "BOW3.png", 0x10, 5, 0x20, 0x20);
      break;
  }
  s.applyPalette();
}

function timed(update: (o: Obj) => void, layer: number, x: number, y: number, spr: number, life: number, flags: number) {
  const o = spawn(update, layer);
  if (!o) return null;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = spr;
  o.f54 = life;
  o.f34 = 1;
  o.drawFlags = flags;
  return o;
}

function lifeUpdate(o: Obj) {
  o.f54--;
  if (o.f54 === 0) free(o);
}

function bobUpdate(o: Obj) {
  const v = o.f4c;
  o.y += v * 0x10000;
  o.f4c = o.y < 0x600000 ? v + 1 : v - 1;
  o.f54--;
  if (o.f54 === 0) free(o);
}

function fallUpdate(o: Obj) {
  o.y += 0x10000;
  if (o.y > 0x1300000) free(o);
}

function driftUpdate(o: Obj) {
  if (o.x > 0x1480000) o.x -= 0x1999;
  if (o.y < 0x500000) o.y += 0x6666;
  o.f50++;
  if (o.f50 > 1) {
    o.f50 = 0;
    o.f44++;
    if (o.f44 > 3) o.f44 = 0;
    o.spr = o.f40 + o.f44;
  }
  o.f54--;
  if (o.f54 === 0) free(o);
}

function flapUpdate(o: Obj) {
  o.f50++;
  if (o.f50 > 6) {
    o.f50 = 0;
    o.f44++;
    if (o.f44 > 1) o.f44 = 0;
    o.spr = o.f40 + o.f44;
  }
  o.f54--;
  if (o.f54 === 0) free(o);
}

function loopUpdate(o: Obj) {
  o.f3c++;
  if (o.f3c > 3) {
    o.f3c = 0;
    o.spr = o.f40 + o.f44;
    o.f44++;
    if (o.f38 <= o.f44) o.f44 = 0;
  }
}

function riseUpdate(o: Obj) {
  if (o.y > 0xa00000) o.y -= 0x20000;
}

function scrollUpdate(o: Obj) {
  queueText(o.x, o.y, o.f48, 200);
  o.y -= 2;
}

function spawnScroll(x: number, id: number) {
  const o = spawn(scrollUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = 0x1e0;
  o.f48 = id;
  o.f4c = 1000;
  o.f34 = 4;
}

function spawnLoop(x: number, y: number, k: number, frames: number) {
  const o = spawn(loopUpdate, 1);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = k + 0xe0000;
  o.f40 = k + 0xe0000;
  o.f38 = frames;
  o.f34 = 1;
  o.drawFlags = 3;
}

function spawnRise(x: number) {
  const o = spawn(riseUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = 0x1e00000;
  o.spr = 0xe0000;
  o.f34 = 4;
  o.drawFlags = 3;
}

function endingUpdate(o: Obj) {
  const before = o.f40;
  o.f40 = before - 1;
  if (o.f44 > 0x12) o.f40 = before - 2;
  if (o.f40 >= 1) return;
  o.f40 = 100;
  const step = (delay: number) => {
    o.f40 = delay;
    o.f44++;
  };
  switch (o.f44) {
    case 0:
      loadBackdrop(1);
      step(1);
      return;
    case 1: {
      timed(lifeUpdate, 1, 0x1400000, 0x400000, 0xe0001, 100, 4);
      const b = timed(bobUpdate, 3, 0xe00000, 0x680000, 0xe0003, 700, 4);
      if (b) b.f4c = 0;
      step(99);
      return;
    }
    case 2: {
      const d = timed(driftUpdate, 2, 0x1500000, 0x300000, 0xe0004, 200, 4);
      if (d) d.f40 = 0xe0004;
      showText(0x30, 0x170, 0, 0xc6);
      timed(lifeUpdate, 1, 0x1400000, 0x400000, 0xe0002, 600, 4);
      seRequest(5);
      step(200);
      return;
    }
    case 3: {
      const f = timed(flapUpdate, 2, 0x1480000, 0x500000, 0xe0008, 400, 4);
      if (f) f.f40 = 0xe0008;
      showText(0x30, 0x150, 1, 0xc6);
      showText(0x30, 400, 2, 0xc6);
      step(200);
      return;
    }
    case 4:
      showText(0x40, 0x160, 3, 0xc6);
      timed(lifeUpdate, 1, 0x1100000, 0xa00000, 0xe0000, 0xc6, 4);
      step(200);
      return;
    case 5:
      loadBackdrop(2);
      showText(0x30, 0x170, 4, 0x62);
      step(100);
      return;
    case 6:
      loadBackdrop(3);
      showText(0x30, 0x150, 5, 0xc6);
      step(100);
      return;
    case 7:
      showText(0x30, 400, 6, 0x62);
      step(100);
      return;
    case 8:
      loadBackdrop(0);
      showText(0x30, 0xc0, 7, 0x62);
      step(100);
      return;
    case 9:
      showText(0x40, 0xb0, 8, 0x62);
      step(100);
      return;
    case 10:
      loadBackdrop(4);
      showText(0x30, 0x150, 9, 0xc6);
      step(100);
      return;
    case 0xb:
      showText(0x30, 400, 10, 0x62);
      step(100);
      return;
    case 0xc:
      showText(0x30, 0x170, 7, 0x62);
      step(100);
      return;
    case 0xd:
      showText(0x40, 0x170, 0xb, 0x62);
      step(100);
      return;
    case 0xe:
      loadBackdrop(0);
      showText(0x30, 0x170, 0xc, 0x62);
      step(100);
      return;
    case 0xf:
      showText(0x30, 0x150, 0xd, 0xc6);
      step(100);
      return;
    case 0x10:
      showText(0x30, 400, 0xe, 0x62);
      step(100);
      return;
    case 0x11: {
      bgmPlay(0xff);
      const f = spawn(fallUpdate, 3);
      if (f) {
        f.kind = 1;
        f.x = 0xc00000;
        f.y = 0xd00000;
        f.spr = 0xe0000;
        f.f34 = 1;
        f.drawFlags = 4;
      }
      loadBackdrop(5);
      showText(0x40, 0x160, 0xf, 0x12a);
      step(300);
      return;
    }
    case 0x12:
      bgmPlay(5);
      loadBackdrop(0);
      step(0x32);
      return;
    case 0x13:
      spawnScroll(0xa0, 0x26);
      step(0x50);
      return;
    case 0x14:
      spawnScroll(0x100, 0x27);
      step(0xfa);
      return;
    case 0x15:
      loadBackdrop(6);
      spawnScroll(0xa0, 0x10);
      step(1);
      return;
    case 0x16:
      spawnLoop(0x1480000, 0x1300000, 1, 4);
      spawnLoop(0x1c00000, 0x1600000, 5, 0x10);
      o.f44++;
      o.f40 = 0x4f;
      return;
    case 0x17:
      spawnScroll(0x100, 0x11);
      step(0xb4);
      return;
    case 0x18:
      spawnScroll(0xa0, 0x12);
      step(0x32);
      return;
    case 0x19:
      spawnScroll(0x120, 0x13);
      step(0x78);
      return;
    case 0x1a:
      spawnScroll(0xa0, 0x14);
      step(0x32);
      return;
    case 0x1b:
      spawnScroll(0xd0, 0x15);
      step(0x28);
      return;
    case 0x1c:
      spawnScroll(0xe0, 0x16);
      step(0x78);
      return;
    case 0x1d:
      spawnScroll(0xa0, 0x17);
      step(0x32);
      return;
    case 0x1e:
      spawnScroll(0x100, 0x18);
      step(200);
      return;
    case 0x1f:
      spawnScroll(0xa0, 0x19);
      step(0x32);
      return;
    case 0x20:
      spawnScroll(0xe0, 0x1a);
      step(0x28);
      return;
    case 0x21:
      spawnScroll(0xd0, 0x1b);
      step(0x28);
      return;
    case 0x22:
      spawnScroll(0x100, 0x1c);
      step(0x28);
      return;
    case 0x23:
      spawnScroll(0xf0, 0x1d);
      step(0x28);
      return;
    case 0x24:
      spawnScroll(0xf0, 0x1e);
      step(0x28);
      return;
    case 0x25:
      spawnScroll(0x100, 0x1f);
      step(0x28);
      return;
    case 0x26:
      spawnScroll(0xf0, 0x28);
      step(0x28);
      return;
    case 0x27:
      spawnScroll(0x110, 0x20);
      step(0x28);
      return;
    case 0x28:
      spawnScroll(0x120, 0x21);
      step(0x28);
      return;
    case 0x29:
      spawnScroll(0x100, 0x22);
      step(0x28);
      return;
    case 0x2a:
      spawnScroll(0x110, 0x23);
      step(200);
      return;
    case 0x2b:
      spawnScroll(0xa0, 0x29);
      step(0x46);
      return;
    case 0x2c:
      spawnScroll(0xe0, 0x2a);
      step(0x118);
      return;
    case 0x2d:
      spawnScroll(0xa0, 0x24);
      step(0x50);
      return;
    case 0x2e:
      spawnScroll(0xe0, 0x25);
      step(0x140);
      return;
    case 0x2f:
      spawnRise(0x680000);
      step(600);
      return;
    default:
      G.scene = 0xc;
      o.f44++;
  }
}

export function spawnEnding() {
  const o = spawn(endingUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f40 = 0x1e;
  o.f34 = 1;
  o.drawFlags = 1;
}

function staffUpdate(o: Obj) {
  o.f40--;
  if (o.f40 >= 1) return;
  o.f40 = 100;
  const step = (delay: number) => {
    o.f40 = delay;
    o.f44++;
  };
  switch (o.f44) {
    case 0:
      loadBackdrop(0);
      step(1);
      return;
    case 1:
      showText(0x30, 0x130, 0x82, 0xc6);
      showText(0x50, 0x160, 0x83, 0xc6);
      step(200);
      return;
    case 2:
      showText(0x30, 0x50, 0x84, 0xc6);
      step(100);
      return;
    case 3:
      showText(0xf0, 0x80, 0x85, 0x62);
      step(100);
      return;
    case 4:
      showText(0x30, 0x130, 0x86, 0xc6);
      showText(0x30, 0x160, 0x87, 0xc6);
      step(0xdc);
      return;
    case 5:
      showText(0x50, 0x50, 0x88, 0xc6);
      showText(0x70, 0x80, 0x89, 0xc6);
      step(100);
      return;
    case 6:
      showText(0x90, 0xb0, 0x8a, 0x62);
      showText(0x100, 0xe0, 0x8b, 0x62);
      step(0x6e);
      return;
    case 7:
      showText(0x80, 0x150, 0x8c, 0xc6);
      step(0xdc);
      return;
    case 8:
      showText(0x50, 0x110, 0x8d, 0x12a);
      step(100);
      return;
    case 9:
      showText(0x90, 0x140, 0x8e, 0xc6);
      step(100);
      return;
    case 10:
      showText(0x60, 0x170, 0x8f, 0x62);
      bgmPlay(1);
      step(0x78);
      return;
    case 0xb:
      showText(0x60, 0x130, 0x90, 0x62);
      step(0x82);
      return;
    case 0xc:
      showText(0x30, 0x110, 0x91, 0x12a);
      step(100);
      return;
    case 0xd:
      showText(0x30, 0x140, 0x92, 0xc6);
      showText(0x60, 0x170, 0x93, 0xc6);
      step(200);
      return;
    case 0xe:
      loadBackdrop(7);
      showText(0x10, 0x150, 0x94, 0x256);
      step(300);
      return;
    case 0xf:
      showText(0xf0, 0x1a0, 0x95, 0xc6);
      bgmPlay(7);
      o.f44++;
      o.f40 = 100;
      return;
    default:
      G.scene = 0xe;
      o.f44++;
  }
}

export function spawnStaff() {
  const o = spawn(staffUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f40 = 10;
  o.f34 = 1;
  o.drawFlags = 1;
}

function clearScreenUpdate(_o: Obj) {
  if ((G.input & 0x40) !== 0) G.scene = 2;
}

export function spawnClearScreen() {
  const o = spawn(clearScreenUpdate, 1);
  if (o) {
    o.kind = 2;
    o.f34 = 1;
    o.drawFlags = 1;
  }
  const sec = G.playSec;
  const min = G.playMin;
  const d0 = sec % 10;
  const d1 = Math.trunc(sec / 10) % 10;
  const d2 = min % 10;
  const d3 = Math.trunc(min / 10) % 10;
  const m = G.t.smallMsgs;
  m[7 * 60 + 4] = d0 + 0x1f;
  m[7 * 60 + 3] = d1 + 0x1f;
  m[7 * 60 + 1] = d2 + 0x1f;
  m[7 * 60 + 0] = d3 + 0x1f;
  m[8 * 60 + 9] = (d2 + d3 + d1 + d0) % 0x1a + 1;
  m[8 * 60 + 10] = (d2 + d3 + d0) % 0x1a + 1;
  m[8 * 60 + 11] = (d2 + d3 + d1) % 0x1a + 1;
  m[8 * 60 + 12] = (d3 + d1 + d0) % 0x1a + 1;
  m[8 * 60 + 13] = (m[8 * 60 + 11] + m[8 * 60 + 12] + m[8 * 60 + 10] + m[8 * 60 + 9]) % 0x1a + 1;
  smallMessage(0x780000, 0x780000, 6, 2000);
  smallMessage(0xe80000, 0x900000, 7, 2000);
  smallMessage(0xa80000, 0xb80000, 8, 2000);
}
