import { Renderer } from "../gfx/render.ts";
import { G, div } from "./core.ts";
import { fix } from "./state.ts";

let blink = 0;
let pauseColor = 0;

function life(r: Renderer, i: number) {
  r.sprite(0x200, (i + 2) * 0x40, 0xa0000);
  const y = i * 0x40 + 0x98;
  if (G.life !== 5 && 5 - G.life >= 0) {
    for (let k = 0, x = 0x210; k < 5 - G.life; k++, x += 0x10) r.sprite(x, y, 0xb000b);
  }
  for (let k = 0, x = 0x250; k < G.life; k++, x -= 0x10) r.sprite(x, y, 0xb000a);
  if (G.hurtTimer > 0) r.sprite((0x26 - G.life) * 0x10, y, 0xb001e - G.hurtTimer);
}

function power(r: Renderer, i: number) {
  const y = (i + 2) * 0x40;
  r.sprite(0x200, y, 0xa0009);
  r.sprite(0x25f - G.power, y, 0xa0005);
  r.sprite(0x200, y, 0xa0001);
}

function digits(r: Renderer, v: number, i: number) {
  const y = i * 0x40 + 0x98;
  if (v < 100000) {
    r.sprite(0x208, y, 0xb0000);
    if (v < 10000) {
      r.sprite(0x218, y, 0xb0000);
      if (v < 1000) {
        r.sprite(0x228, y, 0xb0000);
        if (v < 100) {
          r.sprite(0x238, y, 0xb0000);
          if (v < 10) {
            r.sprite(0x248, y, 0xb0000);
            if (v < 1) r.sprite(600, y, 0xb0000);
          }
        }
      }
    }
  }
  for (let x = 600; v > 0; x -= 0x10) {
    r.sprite(x, y, (v % 10) + 0xb0000);
    v = div(v, 10);
  }
}

function round(r: Renderer, i: number) {
  const y = i * 0x40 + 0x98;
  r.sprite(0x200, (i + 2) * 0x40, 0xa0004);
  r.sprite(0x210, y, G.roundA + 0xb0000);
  r.sprite(0x250, y, G.roundB + 0xb0000);
}

function time(r: Renderer, i: number) {
  r.sprite(0x200, (i + 2) * 0x40, 0xa0007);
  const y = i * 0x40 + 0x98;
  r.sprite(0x206, y, div(G.playMin, 10) + 0xb0000);
  r.sprite(0x21f, y, (G.playMin % 10) + 0xb0000);
  r.sprite(0x241, y, div(G.playSec, 10) + 0xb0000);
  r.sprite(0x25a, y, (G.playSec % 10) + 0xb0000);
}

function ratio(r: Renderer, i: number) {
  r.sprite(0x200, (i + 2) * 0x40, 0xa0008);
  const y = i * 0x40 + 0x99;
  if (G.spawnCount !== 0 && G.hitCount < G.spawnCount) {
    const v = div(G.hitCount * 100, G.spawnCount);
    r.sprite(0x21d, y, div(v, 10) + 0xb0000);
    r.sprite(0x238, y, (v % 10) + 0xb0000);
    return;
  }
  r.sprite(0x208, y, 0xb0001);
  r.sprite(0x21d, y, 0xb0000);
  r.sprite(0x238, y, 0xb0000);
}

function pauseText(r: Renderer) {
  const red = pauseColor * 0x1a;
  pauseColor = 1 - pauseColor;
  r.sprite(0xb0, 0xc0, red + 0xb002e);
  r.sprite(0xd0, 0xc0, red + 0xb001f);
  r.sprite(0xf0, 0xc0, red + 0xb0033);
  r.sprite(0x110, 0xc0, red + 0xb0031);
  r.sprite(0x130, 0xc0, red + 0xb0023);
}

function trialHud(r: Renderer) {
  const left = G.trialSide === 0 ? -0x120 : 0;
  r.sprite(left + 0x150, 0x30, 0xa0007);
  const t = G.trialTime;
  r.sprite(left + 0x1aa, 0x49, (t % 10) + 0xb0000);
  r.sprite(left + 400, 0x49, (div(t, 10) % 10) + 0xb0000);
  const h = div(div(t, 10), 10);
  r.sprite(left + 0x170, 0x49, (h % 10) + 0xb0000);
  r.sprite(left + 0x156, 0x49, (div(h, 10) % 10) + 0xb0000);
  if (G.playerCX < 0xc00000) G.trialSide = 1;
  if (G.playerCX > 0x1400000) G.trialSide = 0;
  if (G.hitCount > 0x31) {
    G.tkPos = 5000;
    G.tkEnded = 1;
  }
  r.sprite(0x1a0, 0x1b8, 0xc0088);
  if (G.trialShown < G.hitCount) G.trialShown++;
  let x: number;
  let spr: number;
  if (G.trialShown < 0x32) {
    const left50 = 0x32 - G.trialShown;
    r.sprite(0x1c0, 0x1b8, (left50 % 10) + 0xb000c);
    spr = (div(left50, 10) % 10) + 0xb000c;
    x = 0x1b0;
  } else {
    r.sprite(0x1b0, 0x1b8, 0xb000c);
    spr = 0xb000c;
    x = 0x1c0;
  }
  r.sprite(x, 0x1b8, spr);
  if (G.hitCount < 0x32 && G.trialTime < 9999 && !G.world.paused && !G.world.freeze) G.trialTime++;
}

export function drawHud(r: Renderer) {
  if (G.room === 0x15 && G.trialShow !== 0) trialHud(r);
  if (G.invuln > 0 && G.noHit < 1) {
    blink = (blink + 1) & 7;
    const spr = G.t.invulnBlink[blink] + (G.invuln < 0x1f ? 0x50002 : 0x50000);
    r.sprite(fix(G.playerCX) - 0x20, fix(G.playerCY) - 0x20, spr);
  }
  if (G.hiScore < G.score) G.hiScore = G.score;
  for (let i = 0; i < 5; i++) {
    switch (G.hudSlots[i]) {
      case 1:
        life(r, i);
        break;
      case 2:
        power(r, i);
        break;
      case 3:
        r.sprite(0x200, (i + 2) * 0x40, 0xa0002);
        digits(r, G.score, i);
        break;
      case 4:
        r.sprite(0x200, (i + 2) * 0x40, 0xa0003);
        digits(r, G.hiScore, i);
        break;
      case 5:
        round(r, i);
        break;
      case 6:
        time(r, i);
        break;
      case 7:
        ratio(r, i);
        break;
      case 8:
        r.sprite(0x200, (i + 2) * 0x40, 0xa0006);
        break;
    }
  }
  if (G.world.paused) pauseText(r);
}
