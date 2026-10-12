import { Obj } from "../obj.ts";
import { fix } from "../state.ts";
import {
  G,
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
import { killByUpdate } from "../world.ts";
import { spawnZako1, spawnZako1b, zako1Walk, zako1bWalk } from "./basic.ts";

const anim = (i: number) => G.t.boss0f3[i + 1];

function still(_o: Obj) {}

function bulletUpdate(o: Obj) {
  const ox = o.x;
  const oy = o.y;
  o.x = cos(o.f48) * o.f4c + ox;
  o.y = nsin(o.f48) * o.f4c + oy;
  if (o.x > 0x5fffff && o.x < 0x1e00001 && o.y > 0x1fffff && o.y < 0x1c00001) return;
  puff(ox, oy, 1);
  spawnZako1(ox, oy);
  free(o);
}

function spawnBullet(x: number, y: number, dir: number) {
  const o = spawn(bulletUpdate, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xe000e;
  o.f38 = x;
  o.f3c = y;
  o.f48 = dir;
  o.f4c = 8;
  o.f34 = 4;
}

function arc(o: Obj, landing: (o: Obj) => void) {
  const a = o.f48;
  o.f48 = o.f4c + a;
  let k = (o.f4c + a) >> 4;
  if (k > 0x1f) k = 0x20;
  const ox = o.x;
  const oy = o.f3c;
  const nx = cos(o.f50) * o.f54 + ox;
  const ny = nsin(o.f50) * o.f54 + oy;
  o.x = nx;
  o.f3c = ny;
  if (nx < 0x600000 || nx > 0x1e00000) o.x = ox;
  if (ny < 0x200000 || ny > 0x1c00000) o.f3c = oy;
  o.y = nsin(k) * o.f38 + o.f3c;
  if (k === 0x20) landing(o);
}

function eggUpdate(o: Obj) {
  arc(o, (e) => {
    puff(e.x, e.y, 1);
    spawnZako1b(e.x, e.y);
    free(e);
  });
}

function fragmentUpdate(o: Obj) {
  arc(o, (e) => {
    puff(e.x, e.y, 1);
    free(e);
  });
}

function spawnArc(update: (o: Obj) => void, spr: number, x: number, y: number, dir: number) {
  const o = spawn(update, 4);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = spr;
  o.f38 = rand(0x14) + 10;
  o.f3c = y;
  o.f48 = 0;
  o.f4c = rand(0x20) + 0x10;
  o.f50 = dir;
  o.f54 = rand(5) + 4;
  o.f34 = 4;
}

const spawnEgg = (x: number, y: number, dir: number) => spawnArc(eggUpdate, 0xe000f, x, y, dir);
const spawnFragment = (x: number, y: number, dir: number) => spawnArc(fragmentUpdate, 0xe000e, x, y, dir);

function ringUpdate(o: Obj) {
  o.spr++;
  if (o.spr > 0xe001f) free(o);
}

function boom(px: number, py: number) {
  let x = px - 0x100000;
  let y = py - 0x100000;
  const dir = rand(0x40);
  const dist = rand(0x40);
  for (let i = 0; i < 8; i++) {
    const o = spawn(ringUpdate, 4);
    if (!o) return;
    o.kind = 1;
    o.x = x;
    o.y = y;
    o.spr = 0xe001f - i;
    o.f34 = 4;
    x += cos(dir) * dist;
    y += nsin(dir) * dist;
  }
}

function burstUpdate(o: Obj) {
  const v = o.f4c;
  o.x += cos(o.f48) * v;
  o.y += nsin(o.f48) * v;
  o.f4c = v >> 1;
  o.spr += rand(2);
  if (o.spr > 0xe0017) free(o);
}

function burst(x: number, y: number, dir: number) {
  const o = spawn(burstUpdate, 2);
  if (!o) return;
  o.kind = 1;
  o.x = x;
  o.y = y;
  o.spr = 0xe0010;
  o.f48 = dir;
  o.f4c = 0x40;
  o.f34 = 1;
}

function mobGather(o: Obj) {
  const x = o.x;
  const y = o.y;
  o.x = (((rand(0x80) + 0xd0) * 0x10000 - x) >> 3) + x;
  o.y = (((rand(0x80) + 0x80) * 0x10000 - y) >> 3) + y;
  o.f50--;
  if (o.f50 === 0) {
    puff(o.x + 0x80000, o.y + 0x80000, 2);
    free(o);
  }
}

function mobUpdate(o: Obj) {
  const j = rand(4);
  o.f40++;
  o.x = (j - 2) * 0x10000 + o.f48 + o.f38;
  o.y = o.f4c + o.f3c;
  if (o.f40 > 3) o.f40 = 0;
  o.spr = o.f44 + o.f40;
  if (o.f40 === 0 && G.blocksLeft === 0) {
    o.update = mobGather;
    o.f50 = 0x18;
  }
}

function spawnMobs(count: number, offset: number, spr: number) {
  for (let i = 0; i < count; i++) {
    const o = spawn(mobUpdate, 2);
    if (!o) return false;
    o.kind = 1;
    o.f38 = (rand(0x160) + 0x70) * 0x10000;
    o.f3c = (rand(0x180) + 0x30) * 0x10000;
    o.x = o.f38 - offset;
    o.y = o.f3c - offset;
    o.f48 = -offset;
    o.f4c = -offset;
    o.spr = spr;
    o.f40 = rand(4);
    o.f44 = spr;
    o.f34 = 1;
    o.f58 = 1;
  }
  return true;
}

function bossUpdate(o: Obj) {
  const s = o.p48!;
  const t = s.p48!;
  const wobble = (amp: number) => {
    const a = o.f3c;
    o.f3c = a + 0x21 > 0x3f ? a - 0x1f : a + 0x21;
    o.x = nsin(a) * amp + o.f38;
  };
  const animate = () => {
    o.spr = anim(o.f40) + o.f44;
    o.f40++;
    if (o.f40 > 0xf) o.f40 = 0;
  };
  switch (o.f4c) {
    case 0:
      if (G.blocksLeft === 0) {
        o.f4c = 1;
        o.f50 = 0x1e;
      }
      return;
    case 1:
      o.f50--;
      if (o.f50 === 0) {
        o.f4c = 2;
        o.f54 = 0;
        o.x = 0xf00000;
        o.y = 0xa00000;
      }
      return;
    case 2: {
      animate();
      o.f50++;
      if (o.f50 > 0x50) {
        o.f50 = 0;
        o.f4c = 3;
        o.f3c = 0;
        o.f38 = o.x;
      }
      const a = inAttackRect(o.x + 0x100000, o.y + 0x100000);
      const b = inAttackRect(o.x + 0x500000, o.y + 0x100000);
      const c = inAttackRect(o.x + 0x100000, o.y + 0x500000);
      const d = inAttackRect(o.x + 0x500000, o.y + 0x500000);
      if (!a && !b && !c && !d) {
        touchPlayer(o.x, o.y, o.x + 0x600000, o.y + 0x600000);
        return;
      }
      seRequest(2);
      o.f4c = 10;
      o.f38 = o.x;
      o.f50 = 0;
      o.f3c = 0;
      return;
    }
    case 3:
      wobble(4);
      animate();
      touchPlayer(o.x, o.y, o.x + 0x600000, o.y + 0x600000);
      o.f50++;
      if (o.f50 > 0x20) {
        if (o.f54 === 0) {
          o.x = o.f38;
          o.f50 = 0;
          o.f4c = 4;
        } else if (o.f54 === 1) {
          o.x = o.f38;
          o.f50 = 0;
          o.f4c = 5;
        }
      }
      return;
    case 4:
      animate();
      o.f50++;
      touchPlayer(o.x, o.y, o.x + 0x600000, o.y + 0x600000);
      if ((o.f50 & 3) === 0) {
        const bx = o.x + 0x300000;
        const by = o.y + 0x300000;
        spawnBullet(bx, by, dir64(bx, by, G.playerCX, G.playerCY));
      }
      if (o.f50 > 0x14) {
        o.f50 = 0;
        o.f4c = 2;
        o.f54 = 1;
      }
      return;
    case 5:
      s.x = o.x;
      s.y = o.y + 0x180000;
      s.spr = 0xe0006;
      o.f4c = 6;
      o.y -= 0x10000;
      t.x = o.x;
      t.y = o.y;
      return;
    case 6:
      o.y = 0x1f40000;
      t.y -= 0x500000;
      if (t.y < -0x63ffff) {
        o.f4c = 7;
        o.f50 = 0;
      }
      return;
    case 7:
      o.y = 0x1f40000;
      o.f50++;
      if (o.f50 < 0x10) s.spr = 0xe0006;
      else if (o.f50 < 0x14) s.spr = 0xe0007;
      else if (o.f50 < 0x18) s.spr = 0xe0008;
      else if (o.f50 > 0x1b) {
        if (o.f50 > 0x27) {
          s.x = (rand(0x100) + 0x70) * 0x10000;
          s.y = (rand(0x100) + 0x50) * 0x10000;
          o.f4c = 8;
          o.f50 = 0;
        } else {
          s.y = 0x1f40000;
        }
      } else s.spr = 0xe0009;
      return;
    case 8:
      o.y = 0x1f40000;
      o.f50++;
      if (o.f50 < 8) s.spr = 0xe0009;
      else if (o.f50 < 0xc) s.spr = 0xe0008;
      else if (o.f50 < 0x10) s.spr = 0xe0007;
      else if (o.f50 > 0x13) {
        o.f4c = 9;
        t.x = s.x;
        t.y = -0x640000;
      } else s.spr = 0xe0006;
      return;
    case 9:
      o.y = 0x1f40000;
      t.y += 0x500000;
      if (s.y - 0x180000 <= t.y) {
        t.y = 0x1f40000;
        o.x = s.x;
        o.f4c = 2;
        o.f50 = 0;
        o.f54 = 0;
        o.y = s.y - 0x180000;
        seRequest(3);
        G.shake = 1;
      }
      return;
    case 10: {
      if (o.f50 === 0) {
        s.f40--;
        if (s.f40 < 1) {
          o.f4c = 0xb;
          killByUpdate([zako1Walk, zako1bWalk, bulletUpdate]);
          return;
        }
      }
      wobble(4);
      o.spr = 0xe0000;
      if ((o.f50 & 1) !== 0) o.spr = 0xe0005;
      if (rand(5) < 1) seRequest(6);
      if ((o.f50 & 7) === 0) spawnEgg(o.x + 0x300000, o.y + 0x300000, rand(0x40));
      o.f50++;
      if (o.f50 > 0x20) {
        o.x = o.f38;
        o.f50 = 0;
        o.f4c = 5;
      }
      return;
    }
    case 0xb:
    case 0xc:
    case 0xd: {
      if (rand(6) < 1) seRequest(1);
      if (rand(5) < 2) seRequest(6);
      wobble(o.f4c - 5);
      animate();
      if (o.f4c > 0xc) {
        const dir = rand(0x40);
        const y = rand(0x60) * 0x10000 + o.y;
        spawnFragment(rand(0x60) * 0x10000 + o.x, y, dir);
      }
      o.f50++;
      if (o.f50 > 0x20) {
        const n = o.f4c + 1;
        o.x = o.f38;
        o.f4c = n;
        o.f50 = 0;
        if (n === 0xe) {
          spriteMessage(0xf00000, 0, 0x500000, 0xa00000, 7, 0xfa);
          o.f54 = 0;
        }
        for (let i = 0; i < 0x10; i++) boom(o.x + 0x300000, o.y + 0x300000);
      }
      return;
    }
    case 0xe: {
      if (rand(6) < 2) seRequest(1);
      if (rand(5) < 2) seRequest(6);
      wobble(8);
      animate();
      const dir = rand(0x40);
      const y = rand(0x60) * 0x10000 + o.y;
      spawnFragment(rand(0x60) * 0x10000 + o.x, y, dir);
      boom(o.x + 0x300000, o.y + 0x300000);
      o.f50++;
      if (o.f50 > 0x20) {
        o.f50 = 0;
        o.x = o.f38;
        o.f54++;
        if (o.f54 > 7) o.f4c = 0xf;
      }
      return;
    }
    case 0xf:
      seRequest(1);
      free(t);
      free(s);
      for (let i = 0; i < 0x10; i++) boom(o.x + 0x300000, o.y + 0x300000);
      for (let i = 0; i < 0x40; i++) burst(o.x + 0x300000, o.y + 0x300000, i);
      scorePopup(fix(o.x) + 0x2e, fix(o.y) + 0x2e, 2000);
      bossCleared(0x1e);
      free(o);
  }
}

export function spawnHeavyBoss() {
  const b = spawn(bossUpdate, 2);
  if (!b) return;
  b.kind = 1;
  b.x = 0x28a0000;
  b.y = 0x1f40000;
  const s = spawn(still, 1);
  if (!s) return;
  s.kind = 1;
  s.x = 0x28a0000;
  s.y = 0x1f40000;
  s.spr = 0xe0006;
  s.f40 = 8;
  s.f34 = 4;
  const t = spawn(still, 4);
  if (!t) return;
  t.kind = 1;
  s.p48 = t;
  t.x = 0x28a0000;
  t.y = 0x1f40000;
  t.spr = 0xe0000;
  t.f34 = 4;
  b.p48 = s;
  b.spr = 0xe0000;
  b.f44 = 0xe0000;
  b.f34 = 4;
  if (!spawnMobs(0x46, 0x100000, 0x60000)) return;
  spawnMobs(0x1e, 0x80000, 0xe000a);
}
