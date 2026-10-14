import { GameData } from "../data/gameData.ts";
import type { Lang, Mode } from "../settings.ts";
import type { TextInfo } from "./text.ts";
import { Sheets } from "../gfx/sheets.ts";
import { Obj, World } from "./obj.ts";

export const FX = 0x10000;
export const fix = (v: number) => (v / FX) | 0;
export const px = (v: number) => v * FX;

export const MDT_COLS = 20;
export const MDT_ROWS = 15;
export const ATR_STRIDE = 40;
export const ATR_ROWS = 30;
export const TK_RECORDS = 200;

export class Tables {
  readonly negSin: Int32Array;
  readonly cos: Int32Array;
  readonly atanSteps: Int32Array;
  readonly scoreRise: Int32Array;
  readonly dirFromInput: Int32Array;
  readonly strikePoints: Int32Array;
  readonly playerAnim: Int32Array;
  readonly poses: Int32Array;
  readonly attackRects: Int32Array;
  readonly hurtBounce: Int32Array;
  readonly exitTable: Int32Array;
  readonly roomTable: Int32Array;
  readonly roomRules: Int32Array;
  readonly roomBgm: Int32Array;
  readonly roomIntroCount: Int32Array;
  readonly roomIntroIds: Int32Array;
  readonly invulnBlink: Int32Array;
  readonly shakeX: Int32Array;
  readonly shakeY: Int32Array;
  readonly frames: Record<string, Int32Array>;
  readonly paths: Int32Array;
  readonly wallFollow: Int32Array;
  readonly sqrt: Uint16Array;
  readonly jointOffsets: Int32Array;
  readonly limbWiggle: Int32Array;
  readonly mirrorAnim: Int32Array;
  readonly smallMsgs: Int32Array;
  readonly finalAnim: Record<string, Int32Array>;
  readonly finalLightning: Int32Array;
  readonly batCircle: Int32Array;
  readonly boss10tgt: Int32Array;
  readonly boss0f3: Int32Array;
  readonly pitcher: Record<number, Int32Array>;
  readonly demoDir: Int32Array;
  readonly demoBtn: Int32Array;
  readonly continueLetters: Int32Array;
  readonly spriteMsgs: Int32Array;
  readonly spriteMsgArgs: Int32Array;
  readonly negSinBefore: Int32Array;

  constructor(readonly data: GameData) {
    this.negSin = data.i32("negSin64");
    this.cos = data.i32("cos64");
    this.atanSteps = data.i32("atanSteps");
    this.scoreRise = data.i32("scoreRise");
    this.dirFromInput = data.i32("dirFromInput");
    this.strikePoints = data.i32("strikePoints");
    this.playerAnim = data.i32("playerAnim");
    this.poses = data.i32("poses");
    this.attackRects = data.i32("attackRects");
    this.hurtBounce = data.i32("hurtBounce");
    this.exitTable = data.i32("exitTable");
    this.roomTable = data.i32("roomTable");
    this.roomRules = data.i32("roomRules");
    this.roomBgm = data.i32("roomBgm");
    this.roomIntroCount = data.i32("roomIntroCount");
    this.roomIntroIds = data.i32("roomIntroIds");
    this.invulnBlink = data.i32("invulnBlink");
    this.shakeX = data.i32("shakeX");
    this.shakeY = data.i32("shakeY");
    this.paths = data.i32("paths");
    this.wallFollow = data.i32("wallFollow");
    this.sqrt = data.u16("sqrtTable");
    this.jointOffsets = data.i32("jointOffsets");
    this.limbWiggle = data.i32("limbWiggle");
    this.mirrorAnim = data.i32("mirrorAnim");
    this.smallMsgs = data.i32("smallMsgs");
    this.finalAnim = {
      A: data.i32("finalAnimA"),
      B: data.i32("finalAnimB"),
      C: data.i32("finalAnimC"),
      D: data.i32("finalAnimD"),
      E: data.i32("finalAnimE"),
    };
    this.finalLightning = data.i32("finalLightning");
    this.batCircle = data.i32("batCircle");
    this.boss10tgt = data.i32("boss10tgt");
    this.boss0f3 = data.i32("boss0f3");
    this.pitcher = {
      1: data.i32("pitcher1"),
      3: data.i32("pitcher3"),
      4: data.i32("pitcher4"),
      6: data.i32("pitcher6"),
      7: data.i32("pitcher7"),
      8: data.i32("pitcher8"),
    };
    this.demoDir = data.i32("demoDir");
    this.demoBtn = data.i32("demoBtn");
    this.continueLetters = data.i32("continueLetters");
    this.spriteMsgs = data.i32("spriteMsgs");
    this.spriteMsgArgs = data.i32("spriteMsgArgs");
    this.negSinBefore = data.i32Before(16);
    this.frames = {
      sparkle: data.i32("frames2b318"),
      chip: data.i32("frames2b358"),
      bugWiggle: data.i32("bugWiggle"),
      debris: data.i32("frames2b398"),
      zako2Fly: data.i32("zako2Fly"),
      zako2Fall: data.i32("zako2Fall"),
      bounce4dir: data.i32("bounce4dir"),
    };
  }
}

export class State {
  readonly world = new World();
  readonly mdtMem = new Int32Array(MDT_COLS * MDT_ROWS * 2);
  readonly mdt = this.mdtMem.subarray(0, MDT_COLS * MDT_ROWS);
  readonly mdtTemp = this.mdtMem.subarray(MDT_COLS * MDT_ROWS);
  readonly atrMem = new Int32Array(ATR_STRIDE * ATR_ROWS + 32 * ATR_ROWS);
  readonly atr = this.atrMem.subarray(0, ATR_STRIDE * ATR_ROWS);
  readonly atrTemp = this.atrMem.subarray(ATR_STRIDE * ATR_ROWS);
  readonly tk = new Int32Array(TK_RECORDS * 4);
  readonly tkTemp = new Int32Array(TK_RECORDS * 4);
  readonly atkRects = new Int32Array(12);
  hitbox = false;
  readonly hitboxRects = new Int32Array(12);
  hitboxStrikes: number[] = [];
  hitboxTtl = 0;

  scene = 2;
  room = 0;
  life = 5;
  power = 0;
  score = 0;
  hiScore = 5000;
  input = 0;
  prevPauseKey = 0;
  seed = 0;
  player: Obj | null = null;
  playerCX = 0;
  playerCY = 0;
  blocksLeft = 0;
  hurtTimer = 0;
  invuln = 0;
  noHit = 0;
  tkPos = 0;
  tkWait = 0;
  tkDone = 0;
  tkEnded = 0;
  spawnCount = 0;
  hitCount = 0;
  clearFlag = 0;
  roomEvent = 0;
  roundA = 0;
  roundB = 0;
  timeTrial = 0;
  playMin = 0;
  playSec = 0;
  playTick = 0;
  entering = 0;
  introHeld = 0;
  savedX = 0;
  savedY = 0;
  retry = 0;
  shake = 0;
  shakeX = 0;
  shakeY = 0;
  invincible = 0;
  bugMode = 0;
  switchCooldown = 0;
  counter518 = 0;
  hudSlots = [1, 2, 3, 6, 5];
  se: { request(n: number): void; frame(): void; reset(): void } | null = null;
  readonly exitOpened = new Int32Array(36);

  trialTime = 0;
  trialShow = 0;
  trialSide = 0;
  trialShown = 0;
  pauseKeyPrev = 0;
  crabLeft = 0;
  menu = 0;
  crabMoved = 0;
  crabMode = 0;
  readonly laserState = new Int32Array(8);
  readonly laserX = new Int32Array(8);
  readonly laserY = new Int32Array(8);
  textQueue: { x: number; y: number; id: number; center?: number }[] = [];
  lang: Lang = "kr";
  textTable = "";
  mode: Mode = 0;
  languages: Lang[] = ["kr"];
  texts: TextInfo[] = [];
  languageHooks: (() => void)[] = [];

  constructor(
    readonly t: Tables,
    readonly data: GameData,
    readonly sheets: Sheets,
    readonly ints: (key: string) => Int32Array,
  ) {}
}
