import { Obj } from "./obj.ts";
import { FX, fix } from "./state.ts";
import {
  G,
  atrGet,
  atrSolid,
  rand,
  seRequest,
  strikeA,
  strikeB,
} from "./core.ts";
import { afterimage, burst8, puff, sparkle } from "./effects.ts";
import { charSpr } from "./characters.ts";
import { freeCategory, killCategory, screenWipe } from "./world.ts";
import { bgmPlay } from "../audio/bgm.ts";
import { changeRoom, startRoomScript } from "./rooms.ts";
import { showRoomIntro, clearTexts } from "./text.ts";

const IN_LEFT = 1;
const IN_RIGHT = 2;
const IN_UP = 4;
const IN_DOWN = 8;
const IN_BUTTON = 0x100;

export function clearAttack() {
  G.atkRects.fill(0);
}

function setRects(x: number, y: number, base: number, count: number) {
  const t = G.char.attackRects;
  for (let i = 0; i < count; i++) {
    G.atkRects[i * 4] = t[base + i * 4] * FX + x;
    G.atkRects[i * 4 + 1] = t[base + i * 4 + 1] * FX + y;
    G.atkRects[i * 4 + 2] = t[base + i * 4 + 2] * FX + x;
    G.atkRects[i * 4 + 3] = t[base + i * 4 + 3] * FX + y;
  }
  if (G.hitbox) {
    G.hitboxRects.set(G.atkRects);
    G.hitboxTtl = 10;
  }
}

const startRect = (x: number, y: number, dir: number) => setRects(x, y, 16 + dir * 20, 1);
const swingRects = (x: number, y: number, dir: number) => setRects(x, y, dir * 20, 3);
const smashRect = (x: number, y: number, dir: number) => setRects(x, y, 12 + dir * 20, 1);

function strikePoints(x: number, y: number, row: number) {
  const t = G.char.strikes[row - 4];
  if (G.hitbox) G.hitboxStrikes = [];
  for (let k = 0; k < t.length; k += 2) {
    const sx = t[k] + fix(x) + 0x18;
    const sy = t[k + 1] + fix(y) + 0x18;
    if (G.hitbox) G.hitboxStrikes.push(sx, sy);
    strikeA(sx, sy);
  }
}

export function playerStep(px: number, py: number, dir: number, smash: boolean): number {
  const x = fix(px);
  const y = fix(py);
  let side = 0;
  const s = atrSolid;
  if (dir === 0) {
    const ex = atrGet(x + 0x18, y + 0xd);
    if (ex >= 0x1e && ex <= 0x21) return ex;
    if (smash) {
      strikeB(x + 0x18, y + 2);
      strikeB(x + 7, y + 6);
      strikeB(x + 0x28, y + 6);
    }
    const front = s(x + 0x18, y + 8);
    if (s(x + 9, y + 0x16) !== 0 || s(x + 0xd, y + 0xc) !== 0) side = -1;
    if (s(x + 0x22, y + 0xc) !== 0 || s(x + 0x26, y + 0x16) !== 0) side++;
    if (side < 0) {
      if (s(x + 0x19, y + 9) === 0 && s(x + 0x23, y + 0xd) === 0 && s(x + 0x27, y + 0x18) === 0 && s(x + 0x23, y + 0x22) === 0 && s(x + 0x19, y + 0x26) === 0) return 1;
      return 0xff;
    }
    if (side > 0) {
      if (s(x + 0x16, y + 9) === 0 && s(x + 0xc, y + 0xd) === 0 && s(x + 8, y + 0x17) === 0 && s(x + 0xc, y + 0x22) === 0 && s(x + 0x16, y + 0x26) === 0) return 3;
      return 0xff;
    }
    return front !== 0 ? 0xff : dir;
  }
  if (dir === 1) {
    const ex = atrGet(x + 0x22, y + 0x18);
    if (ex >= 0x1e && ex <= 0x21) return ex;
    if (smash) {
      strikeB(x + 0x2d, y + 0x18);
      strikeB(x + 0x29, y + 7);
      strikeB(x + 0x29, y + 0x28);
    }
    const front = s(x + 0x27, y + 0x18);
    if (s(x + 0x23, y + 0xd) !== 0 || s(x + 0x19, y + 9) !== 0) side = -1;
    if (s(x + 0x23, y + 0x22) !== 0 || s(x + 0x19, y + 0x26) !== 0) side++;
    if (side < 0) {
      if (s(x + 0xd, y + 0x23) === 0 && s(x + 9, y + 0x19) === 0 && s(x + 0x26, y + 0x19) === 0 && s(x + 0x22, y + 0x23) === 0 && s(x + 0x18, y + 0x27) === 0) return 2;
      return 0xff;
    }
    if (side > 0) {
      if (s(x + 0x17, y + 8) === 0 && s(x + 0xd, y + 0xc) === 0 && s(x + 9, y + 0x16) === 0 && s(x + 0x22, y + 0xc) === 0 && s(x + 0x26, y + 0x16) === 0) return 0;
      return 0xff;
    }
    return front !== 0 ? 0xff : dir;
  }
  if (dir === 2) {
    const ex = atrGet(x + 0x18, y + 0x22);
    if (ex >= 0x1e && ex <= 0x21) return ex;
    if (smash) {
      strikeB(x + 0x17, y + 0x2d);
      strikeB(x + 7, y + 0x29);
      strikeB(x + 0x28, y + 0x29);
    }
    const front = s(x + 0x18, y + 0x27);
    if (s(x + 9, y + 0x19) !== 0 || s(x + 0xd, y + 0x23) !== 0) side = -1;
    if (s(x + 0x22, y + 0x23) !== 0 || s(x + 0x26, y + 0x19) !== 0) side++;
    if (side < 0) {
      if (s(x + 0x19, y + 9) === 0 && s(x + 0x23, y + 0xd) === 0 && s(x + 0x27, y + 0x18) === 0 && s(x + 0x23, y + 0x22) === 0 && s(x + 0x19, y + 0x26) === 0) return 1;
      return 0xff;
    }
    if (side > 0) {
      if (s(x + 0x16, y + 9) === 0 && s(x + 0xc, y + 0xd) === 0 && s(x + 8, y + 0x17) === 0 && s(x + 0xc, y + 0x22) === 0 && s(x + 0x16, y + 0x26) === 0) return 3;
      return 0xff;
    }
    return front !== 0 ? 0xff : dir;
  }
  const ex = atrGet(x + 0xd, y + 0x17);
  if (ex >= 0x1e && ex <= 0x21) return ex;
  if (smash) {
    strikeB(x + 2, y + 0x16);
    strikeB(x + 6, y + 7);
    strikeB(x + 6, y + 0x28);
  }
  const front = s(x + 8, y + 0x18);
  if (s(x + 0xc, y + 0xd) !== 0 || s(x + 0x16, y + 9) !== 0) side = -1;
  if (s(x + 0xc, y + 0x22) !== 0 || s(x + 0x16, y + 0x26) !== 0) side++;
  if (side < 0) {
    if (s(x + 0xd, y + 0x23) === 0 && s(x + 9, y + 0x19) === 0 && s(x + 0x26, y + 0x19) === 0 && s(x + 0x22, y + 0x23) === 0 && s(x + 0x18, y + 0x27) === 0) return 2;
    return 0xff;
  }
  if (side > 0) {
    if (s(x + 0x17, y + 8) === 0 && s(x + 0xd, y + 0xc) === 0 && s(x + 9, y + 0x16) === 0 && s(x + 0x22, y + 0xc) === 0 && s(x + 0x26, y + 0x16) === 0) return 0;
    return 0xff;
  }
  return front !== 0 ? 0xff : 3;
}

function applyPose(o: Obj, frameIndex: number) {
  const pose = G.char.anim[frameIndex];
  o.x = G.char.poses[pose * 4] * FX + o.f38;
  o.y = G.char.poses[pose * 4 + 1] * FX + o.f3c;
  o.spr = (pose + charSpr()) | charSpr();
}

function updateCenter(o: Obj) {
  G.playerCX = o.f38 + 0x180000;
  G.playerCY = o.f3c + 0x180000;
}

function stepOnce(o: Obj, dir: number) {
  if (dir === 0) o.f3c -= FX;
  else if (dir === 1) o.f38 += FX;
  else if (dir === 2) o.f3c += FX;
  else o.f38 -= FX;
}

function isExit(r: number) {
  return r >= 0x1e && r <= 0x21;
}

function enterExit(o: Obj, code: number) {
  o.update = playerExit;
  o.f48 = code;
  G.noHit = 3;
  killCategory(1);
  freeCategory(4);
}

export function playerMain(o: Obj) {
  clearAttack();
  o.spr ^= charSpr();
  if ((G.input & IN_BUTTON) === 0 && o.f54 !== 1) {
    if (o.f50 !== 0) {
      o.f50 = 0;
      const row = o.f40;
      o.f40 = row - 4;
      if (G.power === 0x5f) {
        o.update = playerSmash;
        o.f40 = row + 4;
      }
      G.power = 0;
    }
  } else {
    if (o.f50 === 0) {
      o.f40 += 4;
      o.f44 = 0;
      o.f54 = 1;
    }
    if (o.f44 === 2) {
      startRect(o.x, o.y, o.f40 - 4);
      seRequest(7);
    }
    if (o.f44 === 3) {
      strikePoints(o.f38, o.f3c, o.f40);
      swingRects(o.x, o.y, o.f40 - 4);
    }
    if (o.f44 === 5) o.f54 = 0;
    if (o.f44 > 0xc) o.f44 = 5;
    o.f50 = 1;
    G.power = Math.trunc(G.power * 1.2 + 1.0);
    if (G.power > 0x5f) {
      G.power = 0x5f;
      if (rand(0x40) < 0x20) sparkle(o.f38 + 0x180000, o.f3c + 0x180000);
    }
  }
  if (o.f40 < 8) {
    let sum = 0;
    if (G.input & IN_UP) {
      sum = 1;
      o.f4c -= FX;
      if (o.f4c < -0x80000) o.f4c = -0x80000;
    }
    if (G.input & IN_DOWN) {
      sum--;
      o.f4c += FX;
      if (o.f4c > 0x80000) o.f4c = 0x80000;
    }
    if (G.input & IN_LEFT) {
      sum += 3;
      o.f48 -= FX;
      if (o.f48 < -0x80000) o.f48 = -0x80000;
    }
    if (G.input & IN_RIGHT) {
      sum -= 3;
      o.f48 += FX;
      if (o.f48 > 0x80000) o.f48 = 0x80000;
    }
    if (sum !== 0) {
      const d = G.t.dirFromInput[sum + 4];
      o.f40 = o.f50 !== 0 ? d + 4 : d;
    }
  }
  if ((G.input & 3) === 0) {
    if (o.f48 < 0) o.f48 += FX;
    if (o.f48 > 0) o.f48 -= FX;
  }
  if ((G.input & 0xc) === 0) {
    if (o.f4c < 0) o.f4c += FX;
    if (o.f4c > 0) o.f4c -= FX;
  }
  if (o.f48 < FX && o.f48 > -FX) o.f48 = 0;
  if (o.f4c < FX && o.f4c > -FX) o.f4c = 0;
  moveSteps(o, false);
  applyPose(o, o.f40 * 16 + o.f44);
  o.f44 = o.f44 < 0xf ? o.f44 + 1 : 0;
  updateCenter(o);
  G.noHit = 0;
  if (G.hurtTimer === 7) {
    o.f44 = 0;
    o.update = playerHurt;
    o.f50 = 0;
    seRequest(9);
  }
}

function moveSteps(o: Obj, smash: boolean) {
  let sx = fix(o.f48);
  let sy = fix(o.f4c);
  const n = Math.max(Math.abs(sx), Math.abs(sy));
  const dx = sx > 0 ? 1 : 3;
  const dy = sy > 0 ? 2 : 0;
  for (let i = 0; i < n; i++) {
    if (i < Math.abs(sx)) {
      const r = playerStep(o.f38, o.f3c, dx, smash);
      if (isExit(r)) {
        enterExit(o, r);
        return;
      }
      if (r === 0xff) {
        sx = 0;
        if (smash) {
          burst8(o.f38 + 0x100000, o.f3c + 0x180000);
          o.f48 = -o.f48 >> 2;
          if (o.f40 > 7) o.f40 -= 8;
          o.update = playerMain;
        } else {
          o.f48 = -Math.trunc(o.f48 * 0.5);
        }
      } else stepOnce(o, r);
    }
    if (i < Math.abs(sy)) {
      const r = playerStep(o.f38, o.f3c, dy, smash);
      if (isExit(r)) {
        enterExit(o, r);
        return;
      }
      if (r === 0xff) {
        sy = 0;
        if (smash) {
          burst8(o.f38 + 0x100000, o.f3c + 0x180000);
          o.f4c = -o.f4c >> 2;
          if (o.f40 > 7) o.f40 -= 8;
          o.update = playerMain;
        } else {
          o.f4c = -Math.trunc(o.f4c * 0.5);
        }
      } else stepOnce(o, r);
    }
  }
}

export function playerSmash(o: Obj) {
  G.noHit = 1;
  const ox = o.f38;
  const oy = o.f3c;
  o.spr ^= charSpr();
  if (o.f40 < 8) o.f40 += 4;
  if (o.f40 === 8) o.f4c -= 0x40000;
  if (o.f40 === 10) o.f4c += 0x40000;
  if (o.f40 === 11) o.f48 -= 0x40000;
  if (o.f40 === 9) o.f48 += 0x40000;
  moveSteps(o, true);
  afterimage(o.f38 + 0x100000, o.f3c + 0x180000, ox + 0x100000, oy + 0x180000);
  applyPose(o, o.f40 * 16 + o.f44);
  o.f44 = o.f44 < 0xf ? o.f44 + 1 : 0;
  updateCenter(o);
  if (o.f40 > 7 && o.f40 < 0xc) smashRect(o.x, o.y, o.f40 - 8);
}

export function playerHurt(o: Obj) {
  G.power = 0;
  clearAttack();
  G.noHit = 2;
  o.x = o.f38;
  o.spr ^= charSpr();
  o.y = o.f3c - G.t.hurtBounce[o.f44];
  o.spr = charSpr() + 0x20;
  updateCenter(o);
  o.f44++;
  if (o.f44 > 0x24) {
    if (G.life === 0) {
      bgmPlay(0xff);
      o.f44 = 0;
      o.update = playerDead;
      freeCategory(7);
      screenWipe();
      return;
    }
    G.hurtTimer = 0;
    o.update = playerMain;
    o.f44 = 0;
    G.invuln = 100;
    o.f50 = 0;
    o.f54 = 0;
    for (let i = 0; i < 3; i++) if (o.f40 > 3) o.f40 -= 4;
  }
}

function playerDead(o: Obj) {
  o.spr = charSpr() + 0x24;
  o.f44++;
  if (o.f44 > 0x28) G.scene = 7;
}

export function playerExit(o: Obj) {
  clearAttack();
  o.spr ^= charSpr();
  const code = o.f48;
  if (code === 0x1e) {
    o.f3c -= 0x40000;
    o.f40 = 0;
  }
  if (code === 0x1f) {
    o.f38 += 0x40000;
    o.f40 = 1;
  }
  if (code === 0x20) {
    o.f3c += 0x40000;
    o.f40 = 2;
  }
  if (code === 0x21) {
    o.f38 -= 0x40000;
    o.f40 = 3;
  }
  if (o.f38 < -0x380000 || o.f38 > 0x2080000 || o.f3c < -0x380000 || o.f3c > 0x1e80000) {
    freeCategory(2);
    let px = 0;
    let py = 0;
    if (code === 0x1e) {
      py = 0x1c00000;
      o.f3c = 0x1e00000;
      const old = G.room;
      G.room -= 6;
      px = o.f38;
      if (G.room < 0) G.room = old + 0x1e;
    }
    if (code === 0x1f) {
      px = 0x100000;
      py = o.f3c;
      o.f38 = -0x300000;
      const old = G.room;
      G.room += 1;
      if (G.room > 0x23) G.room = old - 0x23;
    }
    if (code === 0x20) {
      px = o.f38;
      py = 0x100000;
      o.f3c = -0x300000;
      G.room += 6;
      if (G.room > 0x23) {
        G.scene = 2;
        return;
      }
    }
    if (code === 0x21) {
      px = 0x1d00000;
      py = o.f3c;
      o.f38 = 0x1e00000;
      const old = G.room;
      G.room -= 1;
      if (G.room < 0) G.room = old + 0x23;
    }
    G.retry = 0;
    if (G.timeTrial !== 0) {
      G.scene = 2;
      return;
    }
    if (G.room === 0x17) {
      G.scene = 5;
      return;
    }
    changeRoom(G.room);
    o.f44 = 0;
    o.f50 = 0;
    o.f54 = 0;
    o.update = playerEnter;
    G.power = 0;
    puff(px, py, 8);
    G.world.freeze = false;
    bgmPlay(G.t.roomBgm[G.room]);
  }
  applyPose(o, o.f40 * 16 + o.f44);
  o.f44 = o.f44 < 0xf ? o.f44 + 1 : 0;
  updateCenter(o);
}

function beginIntro(o: Obj) {
  G.introHeld = 1;
  o.update = playerIntro;
  G.savedX = o.f38;
  o.f48 = 0;
  o.f4c = 0;
  o.f50 = 0;
  o.f44 = 0;
  o.f34 = 8;
  G.savedY = o.f3c;
}

export function playerEnter(o: Obj) {
  G.entering = 1;
  clearAttack();
  o.spr ^= charSpr();
  const code = o.f48;
  if (code === 0x1e) {
    o.f3c -= 0x80000;
    o.f40 = 0;
  }
  if (code === 0x1f) {
    o.f38 += 0x80000;
    o.f40 = 1;
  }
  if (code === 0x20) {
    o.f3c += 0x80000;
    o.f40 = 2;
  }
  if (code === 0x21) {
    o.f38 -= 0x80000;
    o.f40 = 3;
  }
  o.f44 = o.f44 < 5000 ? o.f44 + 1 : 0;
  if (o.f38 > 0x1fffff && o.f38 < 0x1c00000 && o.f3c > 0x1fffff && o.f3c < 0x1a00000) {
    seRequest(5);
    startRoomScript();
    beginIntro(o);
  }
  applyPose(o, (o.f44 & 0xf) + o.f40 * 16);
  updateCenter(o);
}

export function playerIntro(o: Obj) {
  G.entering = 1;
  G.world.freeze = true;
  if (!(o.f54 < G.t.roomIntroCount[G.room])) {
    o.f44 = 0;
    o.f54 = 0;
    o.update = playerMain;
    G.world.freeze = false;
    return;
  }
  if (o.f44 === 0) showRoomIntro(G.room, o.f54);
  o.f44++;
  let advance = o.f44 >= 0x7f;
  if (!advance && (G.input & IN_BUTTON) !== 0 && G.introHeld === 0) advance = true;
  if (advance) {
    clearTexts();
    o.f44 = 0;
    o.f54++;
  }
  G.introHeld = (G.input & IN_BUTTON) !== 0 ? 1 : 0;
  applyPose(o, (o.f44 & 0xf) + o.f40 * 16);
}

export function playerStartWalk(o: Obj) {
  G.entering = 1;
  clearAttack();
  o.f40 = 0;
  o.f3c -= 0x80000;
  o.f44 = o.f44 < 5000 ? o.f44 + 1 : 0;
  if (o.f3c < 0x1600000) beginIntro(o);
  applyPose(o, (o.f44 & 0xf) + o.f40 * 16);
  updateCenter(o);
}
