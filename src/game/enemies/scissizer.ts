import { Obj } from "../obj.ts";
import { fix } from "../state.ts";
import {
  G,
  atrSolid,
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
import { puff, scorePopup } from "../effects.ts";
import { bossCleared, spriteMessage } from "../messages.ts";

function chunkUpdate(o: Obj) {
  o.x += o.f48;
  o.y += o.f4c;
  o.f4c = Math.min(o.f4c + o.f3c, 0x100000);
  o.f3c += o.f38;
  o.f50--;
  if (o.f50 < 1) free(o);
}

function chunk(x: number, y: number) {
  const o = spawn(chunkUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x80000;
  o.y = y - 0x80000;
  o.spr = rand(3) + 0xc003f;
  o.f48 = (rand(0xb) - 5) * 0x10000;
  o.f4c = 0;
  o.f38 = (rand(2) + 1) * 0x10000;
  o.f3c = rand(4) * -0x10000;
  o.f50 = rand(0xf) + 5;
  o.f34 = 1;
  o.f58 = 1;
}

function boomUpdate(o: Obj) {
  const v = o.f48;
  o.x += cos(o.f4c) * v;
  const f = o.f44;
  o.spr = o.f40 + f;
  o.f44 = f + 1;
  o.y += nsin(o.f4c) * v;
  o.f48 = v - (v >> 2);
  if (f + 1 > 0x53) free(o);
}

function boom(x: number, y: number) {
  const o = spawn(boomUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x180000;
  o.y = y - 0x180000;
  o.spr = 0xc004c;
  o.f40 = 0xc0000;
  o.f44 = 0x4c;
  o.f48 = rand(0x18);
  o.f4c = rand(0x40);
  o.f34 = 2;
}

function flashAUpdate(o: Obj) {
  o.spr = o.f50 + 0xc0004;
  o.f50++;
  if (o.f50 > 3) free(o);
}

export function flashA(x: number, y: number) {
  const o = spawn(flashAUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x100000;
  o.y = y - 0x100000;
  o.spr = 0xc0004;
  o.f50 = 0;
  o.f34 = 4;
}

function flashBUpdate(o: Obj) {
  o.spr = rand(3) + 0xc0004;
  o.f50++;
  if (o.f50 > 0xc) free(o);
}

function flashB(x: number, y: number) {
  const o = spawn(flashBUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x100000;
  o.y = y - 0x100000;
  o.spr = 0xc0007;
  o.f50 = 0;
  o.f34 = 4;
}

export function shotUpdate(o: Obj) {
  const ox = o.x;
  const oy = o.y;
  if (o.f50 > 0) {
    o.f50--;
    o.spr = rand(3) + 0xc003c;
    return;
  }
  o.x = cos(o.f38) * 0x10 + ox;
  o.y = nsin(o.f38) * 0x10 + oy;
  if (atrSolid(fix(o.x) + 8, fix(o.y) + 8) !== 0) {
    o.x = ox;
    o.y = oy;
    flashA(ox + 0x80000, oy + 0x80000);
    if (o.f3c === 0) {
      free(o);
      return;
    }
    o.f3c--;
    o.f38 = dir64(o.x + 0x80000, o.y + 0x80000, G.playerCX, G.playerCY);
    o.f50 = o.f48;
  }
  let d = o.f38;
  if (d > 0x1f) d -= 0x20;
  o.spr = (d >> 1) + 0xc002c;
  touchPlayer(o.x - 0x30000, o.y - 0x30000, o.x + 0x130000, o.y + 0x130000);
}

function shot(x: number, y: number, dir: number, bounces: number, wait: number, extra: number) {
  const o = spawn(shotUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x - 0x80000;
  o.y = y - 0x80000;
  o.spr = 0xc003c;
  o.f38 = dir;
  o.f3c = bounces;
  o.f48 = wait;
  o.f4c = extra;
  o.f34 = 4;
}

export function emitterUpdate(o: Obj) {
  shot(o.x, o.y, o.f38, o.f3c, o.f48, o.f4c);
  if (o.f50 === 0) {
    free(o);
    return;
  }
  o.f50--;
}

export function emitter(x: number, y: number, dir: number, bounces: number, wait: number, extra: number, count: number) {
  const o = spawn(emitterUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = y;
  o.spr = 0xc003c;
  o.f38 = dir;
  o.f3c = bounces;
  o.f48 = wait;
  o.f4c = extra;
  o.f50 = count;
  o.f54 = 0;
  o.f34 = 4;
}

function flyApart(o: Obj) {
  const d = o.f50;
  const dx = Math.imul(cos(d), 0x40);
  const dy = Math.imul(nsin(d), 0x40);
  o.x = (o.x + dx) | 0;
  o.y = (o.y + dy) | 0;
  o.f38 = (o.f38 + dx) | 0;
  o.f3c = (o.f3c + dy) | 0;
  if (o.f38 > -1 && o.f38 < 0x1e00001 && o.f3c > -1 && o.f3c < 0x1c00001) return;
  free(o);
}

function scatter(p: Obj, dx: number, dy: number, size: number, dir: number) {
  p.update = flyApart;
  p.f38 = p.x + dx;
  p.f3c = p.y + dy;
  p.f54 = size;
  p.f50 = dir;
}

function still(_o: Obj) {}

function eyeLeftUpdate(o: Obj) {
  const p = o.p54!;
  o.x = (rand(3) - 0xe) * 0x10000 + p.x;
  o.y = (rand(2) + 0x28) * 0x10000 + p.y;
}

function eyeRightUpdate(o: Obj) {
  const p = o.p54!;
  o.x = (0x2e - rand(3)) * 0x10000 + p.x;
  o.y = (rand(2) + 0x28) * 0x10000 + p.y;
}

function wiggleRight(o: Obj) {
  o.f50++;
  if (o.f50 > 0x1f) o.f50 = 0;
  o.x += G.t.limbWiggle[o.f50 * 2];
  o.y -= G.t.limbWiggle[o.f50 * 2 + 1];
}

function wiggleLeft(o: Obj) {
  o.f50++;
  if (o.f50 > 0x1f) o.f50 = 0;
  o.x -= G.t.limbWiggle[o.f50 * 2];
  o.y -= G.t.limbWiggle[o.f50 * 2 + 1];
}

function bodyUpdate(o: Obj) {
  const v = o.f50;
  o.f50 = v + 1;
  o.y += (v - 3) * 0x10000;
  if (o.f50 > 6) o.f50 = 0;
}

function stackUpdate(o: Obj) {
  if (o.f44 === 0) {
    o.f50++;
    if (o.f50 > 4) o.f44 = 1;
  } else {
    o.f50--;
    if (o.f50 < 1) o.f44 = 0;
  }
  const h = o.f50;
  const blobs = [o.p38!, o.p3c!, o.p48!, o.p4c!];
  let y = o.y;
  for (let i = 0; i < 4; i++) {
    const b = blobs[i];
    b.x = (-0x17 - rand(3)) * 0x10000 + o.x;
    y += (i === 0 ? -0x18 - h : -0x10 - h) * 0x10000;
    b.y = y;
  }
}

function handUpdate(o: Obj, mirror: boolean) {
  const tx = o.f40;
  const ty = o.f44;
  let px = o.f48;
  const py = o.f4c;
  if (tx < px) o.f50 = Math.max(o.f50 - 1, -4);
  else if (px < tx) o.f50 = Math.min(o.f50 + 1, 4);
  else o.f50 = 0;
  if (ty < py) o.spr = Math.max(o.spr - 1, -4);
  else if (py < ty) o.spr = Math.min(o.spr + 1, 4);
  else o.spr = 0;
  px += o.f50 * 0x10000;
  o.f48 = px;
  const ny = o.spr * 0x10000 + py;
  o.x = px;
  o.f4c = ny;
  o.y = ny;
  o.p38!.x = px;
  o.p38!.y = o.y;
  const w = o.p3c!;
  if (mirror) {
    w.x = o.x + rand(3) * -0x10000;
  } else {
    w.x = rand(3) * 0x10000 + o.x;
  }
  w.y = (rand(5) - 2) * 0x10000 + o.y;
}

function leftHandUpdate(o: Obj) {
  handUpdate(o, false);
}

function rightHandUpdate(o: Obj) {
  handUpdate(o, true);
}

function bodyHit(x: number, y: number): boolean {
  const a = inAttackRect(x, y);
  const b = inAttackRect(x + 0x2f0000, y);
  const c = inAttackRect(x, y + 0x1f0000);
  const d = inAttackRect(x + 0x2f0000, y + 0x1f0000);
  const e = inAttackRect(x, y + 0x3f0000);
  const f = inAttackRect(x + 0x2f0000, y + 0x3f0000);
  return a || b || c || d || e || f;
}

function explode(o: Obj) {
  const body = o.p3c!;
  scatter(body.p38!, 0x80000, 0x100000, 0, rand(0x1d) + 0x12);
  const ef = body.p3c!;
  scatter(ef, 0x80000, 0x100000, 0, 0);
  const rf = rand(0x1d) - 0xe;
  ef.f50 = rf < 0 ? rf + 0x40 : rf;
  scatter(body, 0x180000, 0x280000, 2, 0);
  body.f50 = rand(0x11) + 0x28;
  const stack = o.p38!;
  const b4 = stack.p4c!;
  scatter(b4, 0x180000, 0x100000, 2, 0);
  const r4 = rand(0x31) - 8;
  b4.f50 = r4 < 0 ? r4 + 0x40 : r4;
  for (const b of [stack.p48!, stack.p38!, stack.p3c!]) {
    scatter(b.p38!, 0x80000, 0x100000, 0, rand(0x1d) + 0x12);
    const f = b.p3c!;
    scatter(f, 0x80000, 0x100000, 0, 0);
    f.f50 = rand(0x1d) - 0xe;
    if (b.f50 < 0) f.f50 += 0x40;
    scatter(b, 0x180000, 0x180000, 2, 0);
    const r = rand(0x31) - 8;
    b.f50 = r < 0 ? r + 0x40 : r;
  }
  free(stack);
  for (const hand of [o.p48!, o.p4c!]) {
    const a = hand.p38!;
    scatter(a, 0x100000, 0x100000, 2, 0);
    a.f50 = dir64(o.x, o.y, a.f38, a.f3c);
    const w = hand.p3c!;
    scatter(w, 0x100000, 0x180000, 1, 0);
    w.f50 = dir64(o.x, o.y, w.f38, w.f3c);
    free(hand);
  }
  free(o);
}

function slimeUpdate(o: Obj) {
  let hit = false;
  const f = o.f50;
  let state = f & 0x1f;
  let t = (f & 0x7e0) >>> 5;
  let c = (f & 0x1f800) >>> 11;
  let side = (f & 0xfe0000) >>> 17;
  let wait = f >>> 24;
  const L = o.p48!;
  const R = o.p4c!;
  if (wait === 0) {
    if (state === 0) {
      hit = true;
      if (!bodyHit(o.x, o.y)) {
        c++;
        if (c < 0x33) {
          if (t === 0) {
            o.x += 0x20000;
            if (o.x > 0x1b00000) t = 1;
          } else {
            o.x -= 0x20000;
            if (o.x < 0x300000) t = 0;
          }
          L.f40 = (rand(0x14) - 0x38) * 0x10000 + o.x;
          L.f44 = (rand(0x14) + 0x46) * 0x10000 + o.y;
          R.f40 = (rand(0x14) + 0xe) * 0x10000 + o.x;
          R.f44 = (rand(0x14) + 0x46) * 0x10000 + o.y;
          o.f44 += rand(3) - 1;
          if (o.f44 < -2) o.f44 = -2;
          if (o.f44 > 3) o.f44 = 3;
          o.y += o.f44 * 0x10000;
          if (o.y < 0x3c0000) o.y = 0x3c0000;
          if (o.y > 0x1400000) {
            state = 2;
            wait = 0x1e;
            o.f44 = -1;
            L.f40 = o.x - 0x240000;
            L.f44 = o.y + 0x4b0000;
            R.f40 = o.x - 0x60000;
            R.f44 = o.y + 0x4b0000;
          }
        } else {
          c = 0;
          if (side === 0) {
            side = 1;
            state = 4;
          } else {
            side = 0;
            state = 5;
          }
        }
      } else {
        state = 6;
        c = 0;
        seRequest(2);
        wait = 0;
      }
    } else if (state === 1) {
      hit = true;
      o.y += 0x40000;
      L.f48 = o.x - 0x240000;
      L.f4c = o.y + 0x50000;
      R.f48 = o.x - 0x60000;
      R.f4c = o.y + 0x50000;
      L.f40 = o.x - 0x240000;
      L.f44 = o.y + 0x50000;
      R.f40 = o.x - 0x60000;
      R.f44 = o.y + 0x50000;
      if (o.y > 0x3c0000) {
        state = 0;
        wait = 0x14;
        o.f44 = 0;
        L.f40 = o.x - 0x380000;
        L.f44 = o.y + 0x4b0000;
        R.f40 = o.x + 0xe0000;
        R.f44 = o.y + 0x4b0000;
      }
      let ry = rand(0x20) << 16;
      let rx = rand(0x40);
      puff((rx - 0x20) * 0x10000 + o.x, ry, 2);
      if (rand(3) < 2) seRequest(1);
      if (-0x1a40000 < o.y) {
        ry = rand(0x20) << 16;
        rx = rand(0x40);
        chunk((rx - 0x20) * 0x10000 + o.x, ry);
        if (rand(3) < 1) seRequest(3);
      }
      if (-0xc80000 < o.y) {
        ry = rand(0x20) << 16;
        rx = rand(0x40);
        puff((rx - 0x20) * 0x10000 + o.x, ry, 2);
        ry = rand(0x20) << 16;
        rx = rand(0x40);
        chunk((rx - 0x20) * 0x10000 + o.x, ry);
      }
      if (-0x640000 < o.y) {
        ry = rand(0x20) << 16;
        rx = rand(0x40);
        puff((rx - 0x20) * 0x10000 + o.x, ry, 2);
        ry = rand(0x20) << 16;
        rx = rand(0x40);
        chunk((rx - 0x20) * 0x10000 + o.x, ry);
      }
    } else if (state === 2) {
      hit = true;
      const v = o.f44;
      const nv = v * 2;
      o.f44 = nv;
      o.y += v * 0x20000;
      if (nv < -0x10) {
        o.f44 = -1;
        L.f48 = o.x - 0x240000;
        L.f4c = o.y + 0x410000;
        R.f48 = o.x - 0x60000;
        R.f4c = o.y + 0x410000;
        L.f40 = o.x - 0x60000;
        L.f44 = o.y + 0x460000;
        R.f40 = o.x - 0x380000;
        R.f44 = o.y + 0x460000;
      }
      wait = nv < -0x10 ? 1 : 0;
      if (o.y < 0x3c0000) {
        wait = 0x28;
        state = 0;
        o.y = 0x3c0000;
        o.f44 = 0;
        L.f40 = o.x - 0x240000;
        L.f44 = o.y + 0x410000;
        R.f40 = o.x - 0x60000;
        R.f44 = o.y + 0x410000;
      }
    } else if (state === 3) {
      if (rand(3) < 2) seRequest(1);
      if (rand(7) < 2) seRequest(3);
      for (let n = Math.floor(c / 0xf) + 1; n > 0; n--) {
        const y = (rand(0x78) - 0x3c) * 0x10000 + o.y;
        boom((rand(0x40) - 0x20) * 0x10000 + o.x, y);
      }
      t++;
      if (t > 3) {
        t = 0;
        c++;
        if (c === 0xf) spriteMessage(0xf00000, 0, 0x500000, 0xa00000, 0, 0xa0);
      }
      if (c > 0x35) {
        state = 7;
        c = 0;
        t = 0;
      }
    } else if (state === 4) {
      hit = true;
      if (!bodyHit(o.x, o.y)) {
        if (c === 0) {
          let ok = 0;
          let v = L.f48 - ((L.f48 - o.x + 0x4c0000) >> 1);
          L.f48 = v;
          if ((((o.x - 0x4c0000) ^ v) & 0xffff0000) === 0) ok++;
          L.f40 = v;
          v = L.f4c - ((L.f4c - o.y + 0xf0000) >> 1);
          L.f4c = v;
          if ((((o.y - 0xf0000) ^ v) & 0xffff0000) === 0) ok++;
          L.f44 = v;
          flashA(L.f48 + 0x170000, L.f4c + 0x3a0000);
          v = R.f48 - ((R.f48 - o.x - 0x220000) >> 1);
          R.f48 = v;
          if ((((o.x + 0x220000) ^ v) & 0xffff0000) === 0) ok++;
          R.f40 = v;
          v = R.f4c - ((R.f4c - o.y + 0xf0000) >> 1);
          R.f4c = v;
          if ((((o.y - 0xf0000) ^ v) & 0xffff0000) === 0) ok++;
          R.f44 = v;
          flashA(R.f48 + 0x90000, R.f4c + 0x3a0000);
          if (ok === 4) {
            c = 1;
            wait = 5;
          } else {
            c = 0;
          }
        } else if (c === 1) {
          wait = 10;
          flashB(L.f48 + 0x170000, L.f4c + 0x3a0000);
          emitter(L.f48 + 0x170000, L.f4c + 0x3a0000, 0x30, 1, 10, 1, 10);
          flashB(R.f48 + 0x90000, R.f4c + 0x3a0000);
          state = 0;
          emitter(R.f48 + 0x90000, R.f4c + 0x3a0000, 0x30, 1, 10, 1, 10);
        }
      } else {
        state = 6;
        c = 0;
        seRequest(2);
        wait = 0;
      }
    } else if (state === 5) {
      hit = true;
      if (!bodyHit(o.x, o.y)) {
        state = 4;
        wait = 0;
      } else {
        state = 6;
        c = 0;
        seRequest(2);
        wait = 0;
      }
    } else if (state === 6) {
      hit = true;
      c++;
      o.p3c!.spr = 0x18005e - o.p3c!.spr;
      if (c === 2) scorePopup(fix(o.x) - 8, fix(o.y) + 0x1e, 10);
      if (c > 0xf) {
        c = 0;
        o.p3c!.spr = 0xc001c;
        o.f54--;
        if (o.f54 === 0) {
          state = 3;
          t = 0;
        } else {
          state = 0;
          c = 0x32;
        }
      }
    } else if (state === 7) {
      for (let i = 0; i < 6; i++) {
        const y = (rand(0x78) - 0x3c) * 0x10000 + o.y;
        boom((rand(0x40) - 0x20) * 0x10000 + o.x, y);
      }
      if (t > 3 && c < 0x3c) c++;
      t++;
      if (c > 7) {
        seRequest(1);
        scorePopup(fix(o.x) - 0x10, fix(o.y) + 0x1e, 1000);
        bossCleared(0x1e);
        explode(o);
        return;
      }
    }
  } else {
    wait--;
  }
  o.f50 = (wait << 24) | (side << 17) | ((c & 0x3f) << 11) | ((t & 0x3f) << 5) | state;
  o.p38!.x = o.x;
  o.p38!.y = o.y;
  o.p3c!.x = o.x - 0x180000;
  o.p3c!.y = o.y;
  L.x = o.x;
  L.y = o.y;
  R.x = o.x;
  R.y = o.y;
  if (hit) touchPlayer(o.x - 0x200000, o.y - 0x400000, o.x + 0x200000, o.y + 0x480000);
}

function part(update: (o: Obj) => void, layer: number): Obj | null {
  return spawn(update, layer);
}

function setup(o: Obj, spr: number, parent: Obj | null, cat: number) {
  o.kind = 1;
  o.spr = spr;
  o.p54 = parent;
  o.f34 = cat;
}

export function spawnScissizer(a: number, b: number) {
  const m = part(slimeUpdate, 1);
  const stack = part(stackUpdate, 1);
  const left = part(leftHandUpdate, 1);
  const right = part(rightHandUpdate, 1);
  const body = part(bodyUpdate, 3);
  if (!m || !stack || !left || !right || !body) return;
  const bodyEyeL = part(eyeLeftUpdate, 2)!;
  const bodyEyeR = part(eyeRightUpdate, 2)!;
  m.kind = 2;
  m.x = a;
  m.y = b;
  m.p38 = stack;
  m.p3c = body;
  m.p48 = left;
  m.p4c = right;
  m.f54 = 8;
  m.f50 = 1;
  m.f34 = 4;
  body.x = a;
  body.y = b;
  body.p38 = bodyEyeL;
  body.p3c = bodyEyeR;
  setup(body, 0xc001c, m, 1);
  body.x = a;
  body.y = b;
  for (const [e, spr] of [[bodyEyeL, 0xc0023], [bodyEyeR, 0xc0024]] as const) {
    setup(e, spr, body, 1);
    e.x = a;
    e.y = b;
  }
  const blobs = [part(still, 3)!, part(still, 3)!, part(still, 3)!, part(still, 3)!];
  stack.kind = 2;
  stack.x = a;
  stack.y = b;
  stack.p38 = blobs[0];
  stack.p3c = blobs[1];
  stack.p48 = blobs[2];
  stack.p4c = blobs[3];
  stack.p54 = m;
  stack.f34 = 4;
  for (let i = 0; i < 3; i++) {
    const blob = blobs[i];
    setup(blob, 0xc001d, stack, 1);
    blob.x = a;
    blob.y = b;
    const el = part(eyeLeftUpdate, 2)!;
    setup(el, 0xc0023, blob, 4);
    el.x = a;
    el.y = b;
    blob.p38 = el;
    const er = part(eyeRightUpdate, 2)!;
    setup(er, 0xc0024, blob, 4);
    er.x = a;
    er.y = b;
    blob.p3c = er;
  }
  setup(blobs[3], 0xc001e, stack, 1);
  blobs[3].x = a;
  blobs[3].y = b;
  const hands: [Obj, (o: Obj) => void, number, number][] = [
    [left, wiggleRight, 0xc001f, 0xc0021],
    [right, wiggleLeft, 0xc0020, 0xc0022],
  ];
  for (const [hand, wig, spr1, spr2] of hands) {
    const c1 = part(still, 3)!;
    const c2 = part(wig, 3)!;
    hand.kind = 2;
    hand.x = a;
    hand.y = b;
    hand.spr = 0;
    hand.p38 = c1;
    hand.p3c = c2;
    hand.f48 = a;
    hand.f4c = b;
    hand.p54 = m;
    hand.f34 = 4;
    setup(c1, spr1, hand, 1);
    c1.x = a;
    c1.y = b;
    setup(c2, spr2, hand, 1);
    c2.x = a;
    c2.y = b;
  }
}
