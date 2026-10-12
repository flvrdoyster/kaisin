import { Obj, Update } from "./obj.ts";
import { ATR_STRIDE, FX, MDT_COLS, State } from "./state.ts";
import { debris, hitSpark, scorePopup } from "./effects.ts";

export let G!: State;

export function setState(s: State) {
  G = s;
}

export const div = (a: number, b: number) => (a / b) | 0;

export function rand(n: number): number {
  G.seed = (G.seed * 5 + 1) & 0xffff;
  return G.seed % n;
}

export function wrap64(d: number): number {
  if (d < 0) return d + 0x40;
  if (d > 0x3f) return d - 0x40;
  return d;
}

export function cos(d: number): number {
  return d >= 0 ? G.t.cos[d] : G.t.negSin[64 + d];
}

export function nsin(d: number): number {
  return d >= 0 ? G.t.negSin[d] : G.t.negSinBefore[16 + d];
}

export function dir64(x1: number, y1: number, x2: number, y2: number): number {
  const dx = (x2 - x1) | 0;
  const dy = (y2 - y1) | 0;
  const adx = Math.abs(dx);
  if ((adx & ~1) === 0) return dy > 0 ? 0x30 : 0x10;
  const ratio = div(Math.abs(dy) * 25, adx);
  const steps = G.t.atanSteps;
  let d = 15;
  for (let i = 0; i < 16; i++) {
    if (steps[i] < ratio && ratio <= steps[i + 1]) d = i;
  }
  if (dx < 1) {
    if (dy > 0) d += 0x20;
    else d = 0x1f - d;
  } else if (dy > 0) {
    d = 0x3f - d;
  }
  if (d < 0) d += 0x40;
  if (d > 0x3f) d -= 0x40;
  return d;
}

export function spawn(update: Update, layer: number): Obj | null {
  return G.world.spawn(update, layer);
}

export function spawnBack(update: Update, layer: number): Obj | null {
  return G.world.spawnBack(update, layer);
}

export function free(o: Obj | null) {
  G.world.kill(o);
}

export function seRequest(n: number) {
  G.se?.request(n);
}

export function countSpawn() {
  G.spawnCount++;
  if (G.spawnCount > 1000) G.spawnCount = 1000;
}

export function countHit() {
  G.hitCount++;
  if (G.hitCount > 999) G.hitCount = 999;
}

function atrIndex(x: number, y: number): number {
  return div(x, 16) + div(y, 16) * ATR_STRIDE;
}

const outside = (x: number, y: number) => x < 0 || x > 0x280 || y < 0 || y > 0x1e0;

export function atrGet(x: number, y: number): number {
  if (outside(x, y)) return -1;
  return G.atrMem[atrIndex(x, y)] ?? 0;
}

export function atrSolid(x: number, y: number): number {
  if (outside(x, y)) return -1;
  const v = G.atrMem[atrIndex(x, y)] ?? 0;
  return v >= 0x14 ? 0 : v;
}

export function atrSet(x: number, y: number, v: number) {
  if (outside(x, y)) return;
  G.atrMem[atrIndex(x, y)] = v;
}

function mdtIndex(x: number, y: number): number {
  return div(y, 32) * MDT_COLS + div(x, 32);
}

export function tileMinus20(x: number, y: number) {
  G.mdtMem[mdtIndex(x, y)] -= 20;
}

export function tileSet(x: number, y: number, t: number) {
  G.mdtMem[mdtIndex(x, y)] = t;
}

export function tiles2x2Minus20(tx: number, ty: number) {
  tileMinus20(tx * 32, ty * 32);
  tileMinus20((tx + 1) * 32, ty * 32);
  tileMinus20(tx * 32, (ty + 1) * 32);
  tileMinus20((tx + 1) * 32, (ty + 1) * 32);
}

export function blockSet(x: number, y: number, v: number) {
  debris((x - 8) * FX, (y - 8) * FX);
  atrSet(x, y, v);
  atrSet(x + 16, y, v);
  atrSet(x, y + 16, v);
  atrSet(x + 16, y + 16, v);
}

export function inAttackRect(x: number, y: number): boolean {
  const r = G.atkRects;
  let hit = false;
  for (let i = 0; i < 12; i += 4) {
    const l = r[i];
    const rr = r[i + 2];
    if (x < l || x > rr || r[i + 1] > y || r[i + 3] < y || l === rr) continue;
    hit = true;
  }
  return hit;
}

export function touchPlayer(l: number, t: number, r: number, b: number) {
  if (G.invuln !== 0 || G.noHit !== 0 || G.hurtTimer !== 0) return;
  if (l < G.playerCX && G.playerCX < r && t < G.playerCY && G.playerCY < b) G.hurtTimer = 8;
}

export function healTouch(l: number, t: number, r: number, b: number, n: number): boolean {
  if (G.hurtTimer === 0 && l < G.playerCX && G.playerCX < r && t < G.playerCY && G.playerCY < b) {
    G.life += n;
    if (G.life > 5) G.life = 5;
    return true;
  }
  return false;
}

export function addScore(x: number, y: number, n: number) {
  scorePopup(x, y, n);
}

function breakBlock(x: number, y: number, withScore: boolean) {
  if (withScore) addScore(x, y, 10);
  blockSet(x, y, 0);
  tileMinus20(x, y);
  G.blocksLeft--;
  seRequest(3);
}

export const switchHooks = {
  toggle7: () => {},
  toggle8: () => {},
  wall11: (_x: number, _y: number) => {},
  wall12: (_x: number, _y: number) => {},
  bugs: (_x: number, _y: number) => {},
};

export function strikeA(x: number, y: number): number {
  let ret = 0;
  switch (atrSolid(x, y)) {
    case 2:
      breakBlock(x, y, true);
      switchHooks.bugs((x + 16) * FX, (y + 16) * FX);
      break;
    case 3:
      breakBlock(x - 16, y, true);
      switchHooks.bugs(x * FX, (y + 16) * FX);
      break;
    case 4:
      breakBlock(x, y - 16, true);
      switchHooks.bugs((x + 16) * FX, y * FX);
      break;
    case 5:
      breakBlock(x - 16, y - 16, true);
      switchHooks.bugs(x * FX, y * FX);
      break;
    case 6:
      ret = 1;
      hitSpark((x - 8) * FX, (y - 8) * FX);
      G.life = 5;
      break;
    case 9:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      switchHooks.toggle7();
      ret = 1;
      seRequest(4);
      break;
    case 10:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      switchHooks.toggle8();
      ret = 1;
      seRequest(4);
      break;
    case 11:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      switchHooks.wall11(x, y);
      ret = 1;
      seRequest(4);
      break;
    case 12:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      switchHooks.wall12(x, y);
      ret = 1;
      seRequest(4);
      break;
    case -1:
    case 1:
    case 7:
    case 8:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      ret = 1;
      seRequest(4);
      break;
  }
  return ret;
}

export function strikeB(x: number, y: number): number {
  switch (atrSolid(x, y)) {
    case 2:
      breakBlock(x, y, true);
      return 0;
    case 3:
      breakBlock(x - 16, y, true);
      return 0;
    case 4:
      breakBlock(x, y - 16, true);
      return 0;
    case 5:
      breakBlock(x - 16, y - 16, true);
      return 0;
    case -1:
    case 1:
    case 7:
    case 8:
      return 1;
  }
  return 0;
}

export function strikeC(x: number, y: number): number {
  switch (atrSolid(x, y)) {
    case 2:
      breakBlock(x, y, false);
      return 1;
    case 3:
      breakBlock(x - 16, y, false);
      return 1;
    case 4:
      breakBlock(x, y - 16, false);
      return 1;
    case 5:
      breakBlock(x - 16, y - 16, false);
      return 1;
    case 9:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      switchHooks.toggle7();
      seRequest(4);
      return 1;
    case 10:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      switchHooks.toggle8();
      seRequest(4);
      return 1;
    case 11:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      switchHooks.wall11(x, y);
      seRequest(4);
      return 1;
    case -1:
    case 1:
    case 7:
    case 8:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      seRequest(4);
      return 1;
  }
  return 0;
}

export function strikeD(x: number, y: number): number {
  switch (atrSolid(x, y)) {
    case 2:
      breakBlock(x, y, false);
      return 1;
    case 3:
      breakBlock(x - 16, y, false);
      return 1;
    case 4:
      breakBlock(x, y - 16, false);
      return 1;
    case 5:
      breakBlock(x - 16, y - 16, false);
      return 1;
    case -1:
    case 1:
      hitSpark((x - 8) * FX, (y - 8) * FX);
      seRequest(4);
      return 1;
  }
  return 0;
}

