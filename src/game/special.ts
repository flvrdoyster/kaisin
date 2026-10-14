import { G, atrGet, rand, seRequest } from "./core.ts";
import { openExit } from "./rooms.ts";
import { startRoomBurst } from "./enemies/bats.ts";
import { spriteMessage } from "./messages.ts";

function trialResult() {
  const t = G.trialTime;
  const m = G.t.spriteMsgs;
  const base = 12 * 60;
  const tens = Math.trunc(t / 10);
  const hundreds = Math.trunc(tens / 10);
  m[base + 15] = t % 10;
  m[base + 14] = tens % 10;
  m[base + 12] = hundreds % 10;
  m[base + 11] = Math.trunc(hundreds / 10) % 10;
  spriteMessage(0xf00000, 0, 0x400000, 0x800000, 10, 5000);
  spriteMessage(0xf00000, 0, 0x500000, 0xc00000, 0xb, 5000);
  spriteMessage(0xf00000, 0, 0x700000, 0x1000000, 0xc, 5000);
  if (t < 0x3e9) {
    spriteMessage(0xf00000, 0, 0x700000, 0x1400000, 0xd, 5000);
    openExit(0x20);
    G.counter518++;
    G.exitOpened[0x20] = 1;
    return;
  }
  spriteMessage(0xf00000, 0, 0xa00000, 0x1400000, 0xe, 5000);
  openExit(0xd);
  G.counter518++;
  G.exitOpened[0xd] = 1;
}

function floorFlicker() {
  for (let row = 1; row < 14; row++) {
    const col = rand(0xe) + 1;
    if (atrGet(col * 0x20, row * 0x20) !== 0) continue;
    const i = row * 20 + col;
    const t = G.mdt[i];
    G.mdt[i] = t - 0x14 < 0 ? t + 0x50 : t - 0x14;
  }
}

export function roomSpecial() {
  switch (G.room) {
    case 0xd:
      if (G.clearFlag === 0 && G.exitOpened[10] === 0 && G.blocksLeft === 0) {
        seRequest(8);
        openExit(10);
        G.exitOpened[10] = 1;
      }
      break;
    case 0x15:
      if (G.counter518 === 0 && G.tkEnded !== 0) trialResult();
      break;
    case 0x1d:
      floorFlicker();
      break;
    case 0x1f:
      if (G.counter518 === 2 && G.tkDone !== 0) G.clearFlag = 1;
      break;
    case 0x20:
      if (G.clearFlag !== 0 && G.roomEvent === 0) {
        G.roomEvent = 1;
        startRoomBurst();
      }
      break;
  }
}
