import { G, countSpawn, tiles2x2Minus20 } from "./core.ts";
import {
  spawnBouncer,
  spawnDeco,
  spawnFaller,
  spawnMarker,
  spawnTurret,
  spawnZako1,
  spawnZako1b,
  spawnZako2,
  spawnZako2Spiral,
  spawnZako2Straight,
} from "./enemies/basic.ts";
import { batSwarm } from "./enemies/bats.ts";
import { spawnJointBoss } from "./enemies/joint.ts";
import { spawnBoss2 } from "./enemies/boss2.ts";
import { spawnHeavyBoss } from "./enemies/heavy.ts";
import { spawnKillChallenge, spawnTrialIntro } from "./trial.ts";
import { smallMessage } from "./smallmsg.ts";
import { spawnQuiz } from "./enemies/quiz.ts";
import { spawnMirror } from "./enemies/mirror.ts";
import { spawnNeglect } from "./enemies/neglect.ts";
import { spawnPitcher } from "./enemies/pitcher.ts";
import { spawnRobot } from "./enemies/robot.ts";
import { spawnScissizer } from "./enemies/scissizer.ts";
import { spawnCrabGrid } from "./enemies/crabGrid.ts";
import { spriteMessage } from "./messages.ts";
import {
  spawnArmored,
  spawnArms,
  spawnBallDrop,
  spawnBlob,
  spawnBlockOrder,
  spawnDarkness,
  spawnSealHeart,
  spawnDropper,
  spawnDropperGen,
  spawnFixedHeart,
  spawnHiddenEnemy,
  spawnHiddenHeart,
  spawnImmortalSpiral,
  spawnImmortalStraight,
  spawnMeat,
  spawnOnceAnim,
  spawnParade,
  spawnParadeGen,
  spawnPathFlyer,
  spawnSniper,
  spawnStarFountain,
  spawnTwinSniper,
  spawnWallCrawler,
} from "./enemies/misc.ts";

const missing = new Set<number>();

export function runTkOp(op: number, a: number, b: number, c: number): boolean {
  switch (op) {
    case 0x01:
      spawnZako1(a, b);
      countSpawn();
      return true;
    case 0x02:
      spawnZako2(a, b);
      countSpawn();
      return true;
    case 0x03:
      spawnZako2Straight(a, b, c);
      countSpawn();
      return true;
    case 0x04:
      spawnZako1b(a, b);
      countSpawn();
      return true;
    case 0x05:
      spawnZako2Spiral(a, b, c);
      countSpawn();
      return true;
    case 0x06:
      spawnMarker(a, b - 0x80000);
      return true;
    case 0x07:
      spawnBouncer(a - 0x80000, b - 0x80000, c);
      return true;
    case 0x08:
      spawnTurret(a, b);
      countSpawn();
      return true;
    case 0x09:
      spawnFaller(a);
      countSpawn();
      return true;
    case 0x0a:
      spawnDeco(a, b, c, 2, 4);
      return true;
    case 0x0b:
      spawnDeco(a, b, c, 4, 4);
      return true;
    case 0x18:
      spawnDeco(a, b, c, 2, 1);
      return true;
    case 0x19:
      spawnDeco(a, b, c, 4, 1);
      return true;
    case 0x0c:
      spawnScissizer(a, b);
      return true;
    case 0x0d:
      spawnPitcher(a, b);
      countSpawn();
      return true;
    case 0x0e:
      spawnJointBoss(a, b);
      countSpawn();
      return true;
    case 0x0f:
      spawnHeavyBoss();
      return true;
    case 0x10:
      spawnBoss2();
      return true;
    case 0x11:
      spawnWallCrawler(a, b, c);
      return true;
    case 0x12:
      spawnPathFlyer(a, b, c & 0x3f, c >> 10, (c & 0x3c0) >> 6);
      countSpawn();
      return true;
    case 0x13:
      spawnQuiz();
      return true;
    case 0x14:
      spawnMirror();
      return true;
    case 0x15:
      spawnNeglect();
      return true;
    case 0x16:
      spawnRobot(a, b);
      countSpawn();
      return true;
    case 0x17:
      spawnArmored(a, b);
      countSpawn();
      return true;
    case 0x1a:
      spawnHiddenHeart(a, b);
      return true;
    case 0x1b:
      spawnHiddenEnemy(a, b, c);
      return true;
    case 0x1c:
      spawnSniper(a, b);
      countSpawn();
      return true;
    case 0x1d:
      spawnArms();
      return true;
    case 0x1e:
      spawnImmortalStraight(a, b, c);
      return true;
    case 0x1f:
      spawnTwinSniper(a, b);
      countSpawn();
      return true;
    case 0x20:
      spawnImmortalSpiral(a, b);
      return true;
    case 0x21:
      spawnBlob(a, b);
      countSpawn();
      return true;
    case 0xe7:
      batSwarm();
      return true;
    case 0xe8:
      spawnFixedHeart(a, b, 0xc0089);
      return true;
    case 0xe9:
      smallMessage(0xc80000, 0xe00000, 5, 100);
      return true;
    case 0xea:
      G.trialShow = 1;
      return true;
    case 0xeb:
      spawnCrabGrid();
      return true;
    case 0xec:
      spawnKillChallenge();
      return true;
    case 0xed:
      spawnSealHeart(a, b);
      return true;
    case 0xee:
      spawnOnceAnim(a, b);
      return true;
    case 0xef:
      spawnBallDrop();
      return true;
    case 0xf0:
      spawnStarFountain();
      return true;
    case 0xf1:
      spawnDropper(a, b);
      return true;
    case 0xf2:
      spawnDarkness();
      return true;
    case 0xf3:
      spawnDropperGen(a, b);
      return true;
    case 0xf4:
      spawnParade(a, b);
      return true;
    case 0xf5:
      spawnParadeGen();
      return true;
    case 0xf6:
      spawnTrialIntro();
      smallMessage(0xa00000, 0x400000, 0, 100);
      return true;
    case 0xf7: {
      const t = G.t.spriteMsgArgs;
      spriteMessage(t[c * 5], t[c * 5 + 1], t[c * 5 + 2], t[c * 5 + 3], c, t[c * 5 + 4]);
      return true;
    }
    case 0xf8:
      spawnBlockOrder();
      return true;
    case 0xf9:
      spawnFixedHeart(a, b, 0xc0028);
      return true;
    case 0xfa:
      spawnMeat(a, b);
      return true;
    case 0xfb:
      tiles2x2Minus20(a, b);
      return true;
  }
  if ((op >= 0x22 && op <= 0xe6) || op === 0xff || op < 0) return false;
  if (!missing.has(op)) {
    missing.add(op);
    console.warn(`TK op 0x${op.toString(16)} not implemented`);
  }
  return true;
}
