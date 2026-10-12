import { Obj } from "./obj.ts";
import { G, free, seRequest, spawn, switchHooks, tileMinus20, tiles2x2Minus20 } from "./core.ts";
import { bugs, puff } from "./effects.ts";
import { runTkOp } from "./tkops.ts";
import { roomSpecial } from "./special.ts";

const pad2 = (n: number) => String(n).padStart(2, "0");
const TILESETS = "123456789A".split("").map((c) => `MAP_DT_${c}.png`);

export function loadInts(key: string, dest: Int32Array) {
  const src = G.ints(key);
  dest.set(src.subarray(0, Math.min(dest.length, src.length)));
}

export function roomSheets(room: number) {
  const s = G.sheets;
  s.release(2);
  s.release(3);
  const rec = room * 3;
  s.loadGrid(2, TILESETS[G.t.roomTable[rec]], 0x10, 5, 0x20, 0x20);
  const e = G.data;
  switch (G.t.roomTable[rec + 2]) {
    case 1:
      s.loadGrid(0xe, "PITCHER.png", 0xd0, 0xd0, 0x40, 0x60);
      break;
    case 3:
      s.loadRects(0xe, "NIKUWARM.png", 0xd0, 0xd0, e.i32("rectNIKUWARM"));
      break;
    case 4:
      s.loadRects(0xe, "BOSS_2.png", 0xd0, 0xd0, e.i32("rectBOSS2"));
      break;
    case 5:
      s.loadRects(0xe, "BOSS_3.png", 0xd0, 0xd0, e.i32("rectBOSS3"));
      break;
    case 6:
      s.loadGrid(0xe, "YAMI_SP.png", 0xd0, 0xd0, 0x80, 0x60);
      break;
    case 7:
      s.loadGrid(0xe, "SPOT_SP.png", 0xd0, 0xd0, 0xa0, 0xa0);
      break;
    case 8:
      s.loadRects(0xe, "JUMPDEBU.png", 0xd0, 0xd0, e.i32("rectJUMPDEBU"));
      break;
    case 9:
      s.loadGrid(0xe, "ZAKO_3.png", 0xd0, 0xd0, 0x30, 0x30);
      break;
    case 11:
      s.loadRects(0xe, "MAGICIAN.png", 0xd0, 0xd0, e.i32("rectMAGICIAN"));
      break;
    case 12:
      s.loadRects(0xe, "RED_T_1.png", 0xd0, 0xd0, e.i32("rectRED_T_1"));
      break;
    case 13:
      s.loadRects(0xe, "TAKOSHA.png", 0xd0, 0xd0, e.i32("rectTAKOSHA"));
      break;
  }
  G.shakeX = 0;
  G.shakeY = 0;
  G.shake = 0;
  s.applyPalette();
}

export function roomInit() {
  G.tkPos = 0;
  G.tkWait = 0;
  G.hurtTimer = 0;
  G.tkDone = 0;
  G.tkEnded = 0;
  G.spawnCount = 0;
  G.hitCount = 0;
  G.clearFlag = 0;
  G.roomEvent = 0;
  G.roundA = G.t.roomRules[G.room * 6 + 4];
  G.roundB = G.t.roomRules[G.room * 6 + 5];
  G.exitOpened.fill(0);
  G.counter518 = 0;
  G.trialTime = 0;
  G.trialShow = 0;
  G.trialSide = 0;
  G.trialShown = 0;
  G.power = 0;
  G.invuln = 0;
  G.takoLeft = 0;
  G.takoMoved = 0;
  G.takoMode = 0;
  G.laserState.fill(0);
  G.laserY.fill(0);
  G.laserX.fill(0);
}

export function swapRoom() {
  const { mdt, mdtTemp, atr, atrTemp, tk, tkTemp } = G;
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 16; c++) {
      const a = r * 20 + c;
      const b = r * 16 + c;
      const t = mdt[a];
      mdt[a] = mdtTemp[b];
      mdtTemp[b] = t;
    }
  }
  let blocks = 0;
  for (let r = 0; r < 30; r++) {
    for (let c = 0; c < 32; c++) {
      const a = r * 40 + c;
      const b = r * 32 + c;
      const v = atrTemp[b];
      if (v === 2) blocks++;
      atrTemp[b] = atr[a];
      atr[a] = v;
    }
  }
  G.blocksLeft = blocks;
  for (let i = 0; i < tk.length; i++) {
    const t = tk[i];
    tk[i] = tkTemp[i];
    tkTemp[i] = t;
  }
}

export function loadRoomFiles(room: number) {
  loadInts(`room/${pad2(room)}/attributes`, G.atrTemp);
  loadInts(`room/${pad2(room)}/tiles`, G.mdtTemp);
  loadInts(`room/${pad2(room)}/script`, G.tkTemp);
}

export function changeRoom(room: number) {
  loadRoomFiles(room);
  roomSheets(room);
  roomInit();
  swapRoom();
}

function tkRun(o: Obj) {
  if (G.world.freeze) return;
  if (G.tkPos >= 200) {
    free(o);
    return;
  }
  if (G.tkWait >= 1) {
    G.tkWait--;
    return;
  }
  let more = 0;
  do {
    const base = G.tkPos * 4;
    const op = G.tk[base];
    const a = G.tk[base + 1];
    const b = G.tk[base + 2];
    const c = G.tk[base + 3];
    if (more > 0) more--;
    if (op === 0) G.tkWait = a;
    else if (op === 0xfc) G.tkDone = 1;
    else if (op === 0xfd) G.tkPos = a;
    else if (op === 0xfe) more = a;
    else if (!runTkOp(op, a, b, c)) {
      G.tkDone = 1;
      G.tkEnded = 1;
      free(o);
    }
    G.tkPos++;
  } while (more > 0);
}

function exitArrowUpdate(o: Obj) {
  if (o.f54 === 0) {
    o.y = o.f3c;
    if (o.f48 > 4) o.y = 0x1f40000;
    o.f48++;
    if (o.f48 === 1) seRequest(10);
    if (o.f48 > 8) {
      o.f48 = 0;
      o.f40++;
      if (o.f40 > 2) {
        free(o);
        return;
      }
    }
  } else o.f54--;
}

function exitArrow(x: number, y: number, dir: number) {
  const o = spawn(exitArrowUpdate, 5);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = 0x1f40000;
  o.spr = dir + 0xc008a;
  o.f44 = dir + 0xc008a;
  o.f38 = x;
  o.f3c = y;
  o.f54 = 0x1e;
  o.f34 = 1;
}

export function openExit(i: number) {
  seRequest(5);
  const dir = G.t.exitTable[i * 3];
  const pos = G.t.exitTable[i * 3 + 1];
  const p = pos * 0x200000;
  const atr = G.atr;
  if (dir === 0) {
    exitArrow(p, 0x100000, 0);
    tileMinus20(pos * 32, 0);
    tileMinus20((pos + 1) * 32, 0);
    puff((pos + 1) * 0x200000, 0x100000, 2);
    puff(p + 0x100000, 0x100000, 2);
    puff(p + 0x300000, 0x100000, 2);
    atr[40 + pos * 2 + 1] = 0x1e;
    atr[40 + pos * 2 + 2] = 0x1e;
  } else if (dir === 1) {
    exitArrow(0x1b00000, p, 1);
    tileMinus20(0x1e0, pos * 32);
    tileMinus20(0x1e0, (pos + 1) * 32);
    puff(0x1f00000, (pos + 1) * 0x200000, 2);
    puff(0x1f00000, p + 0x100000, 2);
    puff(0x1f00000, p + 0x300000, 2);
    atr[(pos * 2 + 1) * 40 + 30] = 0x1f;
    atr[(pos * 2 + 2) * 40 + 30] = 0x1f;
  } else if (dir === 2) {
    exitArrow(p, 0x1900000, 2);
    tileMinus20(pos * 32, 0x1c0);
    tileMinus20((pos + 1) * 32, 0x1c0);
    puff((pos + 1) * 0x200000, 0x1d00000, 2);
    puff(p + 0x100000, 0x1d00000, 2);
    puff(p + 0x300000, 0x1d00000, 2);
    atr[28 * 40 + pos * 2 + 1] = 0x20;
    atr[28 * 40 + pos * 2 + 2] = 0x20;
  } else if (dir === 3) {
    exitArrow(0x100000, p, 3);
    tileMinus20(0, pos * 32);
    tileMinus20(0, (pos + 1) * 32);
    puff(0x100000, (pos + 1) * 0x200000, 2);
    puff(0x100000, p + 0x100000, 2);
    puff(0x100000, p + 0x300000, 2);
    atr[(pos * 2 + 1) * 40 + 1] = 0x21;
    atr[(pos * 2 + 2) * 40 + 1] = 0x21;
  }
}

function tryExit(k: number, cond: boolean) {
  if (k === 0) return;
  if (G.exitOpened[k - 1] !== 0 || !cond) return;
  openExit(k - 1);
  G.exitOpened[k - 1] = 1;
}

function roomRules(_o: Obj) {
  if (G.hurtTimer !== 0) {
    G.hurtTimer--;
    if (G.hurtTimer === 0 && G.life > 0 && G.invincible === 0) G.life--;
  }
  if (G.invuln !== 0 && !G.world.freeze) G.invuln--;
  if (G.switchCooldown !== 0) G.switchCooldown--;
  const r = G.room * 6;
  const rules = G.t.roomRules;
  const done = G.tkDone;
  tryExit(rules[r], done === 1);
  tryExit(rules[r + 1], done === 1 && G.hitCount === G.spawnCount);
  tryExit(rules[r + 2], G.clearFlag === 1);
  tryExit(rules[r + 3], G.blocksLeft === 0);
  roomSpecial();
}

export function startRoomScript() {
  for (const fn of [tkRun, roomRules]) {
    const o = spawn(fn, 1);
    if (!o) continue;
    o.kind = 2;
    o.f34 = 4;
    o.f58 = 1;
  }
}

function toggleGates(from: number, to: number) {
  if (G.switchCooldown !== 0) return;
  const atr = G.atr;
  for (let col = 2; col < 30; col += 2) {
    for (let row = 2; row < 28; row += 2) {
      const i = row * 40 + col;
      const v = atr[i];
      const tile = (row >> 1) * 20 + (col >> 1);
      if (v === from) {
        atr[i] = atr[i + 1] = atr[i + 40] = atr[i + 41] = to;
        G.mdt[tile] -= 20;
        G.switchCooldown = 3;
      } else if (v === to) {
        atr[i] = atr[i + 1] = atr[i + 40] = atr[i + 41] = from;
        G.mdt[tile] += 20;
        G.switchCooldown = 3;
      }
    }
  }
}

function wallTile(x: number, y: number) {
  const tx = x >> 5;
  const ty = y >> 5;
  const i = ty * 80 + tx * 2;
  G.atr[i] = G.atr[i + 40] = G.atr[i + 1] = G.atr[i + 41] = 1;
  G.mdt[ty * 20 + tx] -= 20;
}

switchHooks.bugs = bugs;
switchHooks.toggle7 = () => toggleGates(7, 0x22);
switchHooks.toggle8 = () => toggleGates(8, 0x23);
switchHooks.wall11 = (x, y) => {
  wallTile(x, y);
  G.clearFlag = 1;
};
switchHooks.wall12 = (x, y) => {
  wallTile(x, y);
  tiles2x2Minus20(0xc, 2);
  tiles2x2Minus20(0xc, 5);
  tiles2x2Minus20(0xc, 8);
  tiles2x2Minus20(0xc, 0xb);
  G.tkDone = 1;
  G.tkPos = 5000;
};

