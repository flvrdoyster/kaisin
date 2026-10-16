import { Renderer } from "../gfx/render.ts";
import { bgmPlay } from "../audio/bgm.ts";
import { G } from "./core.ts";
import { drawHud } from "./hud.ts";
import { playerMain, playerStartWalk } from "./player.ts";
import { changeRoom, loadInts, startRoomScript } from "./rooms.ts";
import { spawnGameOver, spawnTomb } from "./scenes.ts";
import { KIRI_FACE, KIRI_SHEET, charSpr } from "./characters.ts";
import { spawnTitle } from "./title.ts";
import { spawnStatusEdit } from "./status.ts";
import { loadBackdrop, spawnClearScreen, spawnEnding, spawnStaff } from "./ending.ts";

export function loadCommonSheets() {
  const s = G.sheets;
  const e = G.data;
  s.loadGrid(3, "MAP_DT_2.png", 0x20, 5, 0x20, 0x20);
  s.loadGrid(4, "MAP_DT_3.png", 0x90, 5, 0x20, 0x20);
  s.loadGrid(0xa, "STATE_DT.png", 0x40, 0x40, 0x80, 0x40);
  s.loadGrid(6, "ZAKO_1.png", 0x60, 0x60, 0x20, 0x20);
  s.loadGrid(7, "ZAKO_2.png", 0x70, 0x70, 0x20, 0x20);
  s.loadGrid(0xd, "ANI_SP.png", 0xc0, 0xc0, 0x20, 0x20);
  s.loadRects(0xb, "SUUJI_DT.png", 0x50, 0x50, e.i32("rectSUUJI"));
  s.loadRects(5, "SMASH.png", 0x30, 0x30, e.i32("rectSMASH"));
  if (s.has("KIRI.png")) s.loadRects(KIRI_SHEET, "KIRI.png", 0xe0, 0xe0, e.i32("rectSMASH"));
  if (s.has("KIRI_FACE.png")) s.loadGrid(KIRI_FACE, "KIRI_FACE.png", 0xf0, 0, 0x80, 0x80);
  s.loadRects(0xc, "IROIRO_0.png", 0xb0, 0xb0, e.i32("rectIROIRO"));
  s.loadRects(9, "ZAKO_4.png", 0xa0, 0xa0, e.i32("rectZAKO4"));
  s.loadRects(0x11, "UNEUNE.png", 0x80, 0x80, e.i32("rectUNEUNE"));
  s.loadRects(0x10, "UNEUNE.png", 0x80, 0x89, e.i32("rectUNEUNE"));
  s.loadGrid(0xf, "CIRCLE_S.png", 0xb0, 0xb0, 0x20, 0x20);
  s.applyPalette();
}

function resetCommon() {
  G.world.freeze = false;
  G.se?.reset();
  G.retry = 0;
  G.world.paused = false;
  G.shake = 0;
  G.shakeX = 0;
  G.shakeY = 0;
  G.mdt.fill(400);
  G.world.reset();
  G.score = 0;
  G.textQueue = [];
  G.life = 5;
  G.exitOpened.fill(0);
}

function startGame(room: number, timeTrial: boolean) {
  bgmPlay(0xff);
  G.entering = 0;
  G.playTick = 0;
  G.playMin = 0;
  G.playSec = 0;
  resetCommon();
  G.room = room;
  const p = G.world.spawn(timeTrial ? playerMain : playerStartWalk, 2)!;
  p.kind = 1;
  p.x = timeTrial ? 0x200000 : 0xe80000;
  p.y = timeTrial ? 0xc00000 : 0x2800000;
  p.spr = charSpr();
  p.f38 = p.x;
  p.f3c = p.y;
  p.f34 = 8;
  p.f58 = 1;
  G.player = p;
  if (!timeTrial) {
    G.savedX = p.x;
    G.savedY = p.y;
  }
  startRoomScript();
  G.sheets.loadGrid(2, "MAP_DT_1.png", 0x10, 5, 0x20, 0x20);
  loadInts("backdrop/MAIN_BG/tiles", G.mdt);
  changeRoom(room);
  G.sheets.applyPalette();
  G.timeTrial = timeTrial ? 1 : 0;
  G.scene = 0;
  bgmPlay(G.t.roomBgm[G.room]);
}

function enterTitle() {
  G.world.freeze = false;
  bgmPlay(0);
  G.se?.reset();
  G.invincible = 0;
  G.world.paused = false;
  G.shake = 0;
  G.shakeX = 0;
  G.shakeY = 0;
  G.mdt.fill(400);
  loadInts("backdrop/TITLE_BG/tiles", G.mdt);
  G.sheets.loadGrid(2, "TIT_BG.png", 0x10, 5, 0x20, 0x20);
  G.sheets.loadRects(0xe, "TITLE_P.png", 0xd0, 0xd0, G.data.i32("rectTITLE_P"));
  G.sheets.applyPalette();
  G.world.reset();
  spawnTitle();
  G.scene = 1;
  G.timeTrial = 0;
}

function enterStatusEdit() {
  G.world.freeze = false;
  bgmPlay(3);
  G.se?.reset();
  G.invincible = 0;
  G.world.paused = false;
  G.shake = 0;
  G.shakeX = 0;
  G.shakeY = 0;
  G.mdt.fill(400);
  G.sheets.loadRects(0xe, "NIKUWAR2.png", 0xd0, 0xd0, G.data.i32("rectNIKUWAR2"));
  G.sheets.applyPalette();
  G.world.reset();
  spawnStatusEdit();
  G.scene = 0x10;
  G.timeTrial = 0;
}

function enterSequence(track: number, spawnSequence: () => void, next: number) {
  bgmPlay(track);
  G.world.freeze = false;
  G.se?.reset();
  G.world.paused = false;
  G.shake = 0;
  G.shakeX = 0;
  G.shakeY = 0;
  loadBackdrop(0);
  G.world.reset();
  spawnSequence();
  G.timeTrial = 0;
  G.scene = next;
}

function runSequence() {
  const passes = (G.input & 0x100) !== 0 ? 6 : 1;
  for (let i = 0; i < passes; i++) {
    G.textQueue = [];
    G.world.freeze = false;
    G.world.run();
  }
}

function enterGameOver() {
  G.trialShow = 0;
  bgmPlay(6);
  G.world.freeze = false;
  G.se?.reset();
  G.world.paused = false;
  G.shake = 0;
  G.shakeX = 0;
  G.shakeY = 0;
  G.sheets.applyPalette();
  G.world.reset();
  spawnGameOver();
  G.scene = 8;
  G.timeTrial = 0;
}

function continueGame() {
  G.world.freeze = false;
  G.se?.reset();
  G.retry = 1;
  G.world.reset();
  G.textQueue = [];
  G.score = 0;
  G.life = 5;
  G.exitOpened.fill(0);
  const p = G.world.spawn(playerMain, 2)!;
  p.kind = 1;
  p.x = G.savedX;
  p.y = G.savedY;
  p.spr = charSpr();
  p.f38 = p.x;
  p.f3c = p.y;
  p.f34 = 8;
  p.f58 = 1;
  G.player = p;
  startRoomScript();
  G.sheets.loadGrid(2, "MAP_DT_1.png", 0x10, 5, 0x20, 0x20);
  loadInts("backdrop/MAIN_BG/tiles", G.mdt);
  changeRoom(G.room);
  G.sheets.applyPalette();
  G.timeTrial = 0;
  G.scene = 0;
  bgmPlay(G.t.roomBgm[G.room]);
}

function enterTomb() {
  bgmPlay(9);
  G.world.freeze = false;
  G.se?.reset();
  G.sheets.applyPalette();
  G.world.reset();
  spawnTomb();
  G.scene = 0xb;
}

function playFrame() {
  if ((G.input & 0x200) !== 0) {
    G.scene = 2;
    return;
  }
  if (G.entering === 0) {
    G.playTick++;
    if (G.playTick > 0x18) {
      G.playTick = 0;
      G.playSec++;
      if (G.playSec > 0x3b) {
        G.playSec = 0;
        G.playMin++;
        if (G.playMin > 99) {
          G.playMin = 99;
          G.playSec = 0x3b;
        }
      }
    }
  }
  G.entering = 0;
  const pauseKey = G.input & 0x80;
  if (!G.world.paused) {
    if (G.pauseKeyPrev === 0 && pauseKey !== 0) {
      G.world.paused = true;
      if (G.timeTrial === 1) {
        G.scene = 2;
        return;
      }
    }
  } else if (G.pauseKeyPrev === 0 && pauseKey !== 0) {
    G.world.paused = false;
  }
  G.pauseKeyPrev = pauseKey;
  G.world.run();
}

export class Game {
  constructor(
    private readonly renderer: Renderer,
    private readonly readInput: () => number,
    private readonly startRoom: number | null,
  ) {}

  autoPause() {
    if (G.scene === 0 && G.timeTrial !== 1) G.world.paused = true;
  }

  step() {
    G.input = this.readInput();
    G.se?.frame();
    switch (G.scene) {
      case 0:
        playFrame();
        break;
      case 1:
        G.world.run();
        break;
      case 2:
        enterTitle();
        break;
      case 0x11:
        enterStatusEdit();
        break;
      case 0x10:
        G.world.run();
        break;
      case 3:
        startGame(this.startRoom ?? 0x20, false);
        break;
      case 4:
        startGame(this.startRoom ?? 4, true);
        break;
      case 5:
        enterSequence(4, spawnEnding, 6);
        break;
      case 6:
      case 0xd:
        runSequence();
        break;
      case 0xc:
        enterSequence(5, spawnStaff, 0xd);
        break;
      case 0xe:
        enterSequence(3, spawnClearScreen, 0xf);
        break;
      case 0xf:
        G.world.freeze = false;
        G.world.run();
        break;
      case 7:
        enterGameOver();
        break;
      case 8:
      case 0xb:
        G.world.freeze = false;
        G.world.run();
        break;
      case 9:
        continueGame();
        break;
      case 10:
        enterTomb();
        break;
    }
  }

  private advanceShake() {
    const kind = G.shake & 0xff;
    if (kind === 0) {
      G.shakeX = 0;
      G.shakeY = 0;
      return;
    }
    const t = (G.shake >> 8) & 0xff;
    G.shakeX = G.t.shakeX[kind * 32 + t];
    G.shakeY = G.t.shakeY[kind * 32 + t];
    G.shake = t + 1 > 0x1f ? 0 : ((t + 1) << 8) | kind;
  }

  draw() {
    const r = this.renderer;
    r.clear();
    r.tiles(G.mdt);
    r.objects(G.world.drawList());
    if (G.scene === 0 || G.scene === 8 || G.scene === 0xb) drawHud(r);
    for (const q of G.textQueue) {
      const t = G.texts[q.id];
      if (!t) continue;
      if (q.center === undefined) r.text(q.x, q.y, t.text, t.font);
      else {
        const s = t.text.trim().replace(/^[\u3000\s]+|[\u3000\s]+$/g, "");
        r.text(Math.round(q.center - r.textWidth(s, t.font) / 2), q.y, s, t.font);
      }
    }
    G.textQueue = [];
    if (G.scene === 0 && G.invincible !== 0) {
      const t = G.texts[0x5b];
      if (t) r.text(0, 0x1c0, t.text, t.font);
    } else if (G.scene === 0 && G.bugMode !== 0) {
      const t = G.texts[0x5c];
      if (t) r.text(0, 0x1c0, t.text, t.font);
    }
    if (G.hitbox && G.scene === 0) this.drawHitbox();
    r.present(G.shakeX, G.shakeY);
    this.advanceShake();
  }

  private drawHitbox() {
    const r = this.renderer;
    if (G.hitboxTtl > 0) {
      G.hitboxTtl--;
      const b = G.hitboxRects;
      for (let i = 0; i < 12; i += 4) {
        if (b[i] === b[i + 2]) continue;
        r.box(b[i] >> 16, b[i + 1] >> 16, (b[i + 2] - b[i]) >> 16, (b[i + 3] - b[i + 1]) >> 16, "#ff4040");
      }
      for (let i = 0; i < G.hitboxStrikes.length; i += 2) r.dot(G.hitboxStrikes[i], G.hitboxStrikes[i + 1], 3, "#40c0ff");
    }
    r.dot(G.playerCX >> 16, G.playerCY >> 16, 5, "#ffff00");
  }
}
