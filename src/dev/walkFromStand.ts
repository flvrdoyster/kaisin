import { GAME_TABLES } from "../data/gameTables.ts";
import type { IndexedImage } from "../data/image.ts";

type Box = [number, number, number, number];
type Grid = number[][];

export interface Pixels {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

interface FrameLimbs {
  hands: Box[];
  feet: Box[];
  body: "hide" | "trim" | "keep";
}

interface DirectionTable {
  standHands: Box[];
  standFeet: Box[];
  frames: [FrameLimbs, FrameLimbs, FrameLimbs, FrameLimbs];
}

export const WALK_KEYS = [0, 2, 6, 10, 14];

const TABLES: Partial<Record<number, DirectionTable>> = {
  0: {
    standHands: [[0, 28, 10, 36], [37, 28, 47, 36]],
    standFeet: [[9, 37, 19, 43], [29, 37, 39, 43]],
    frames: [
      { hands: [[4, 31, 16, 41]], feet: [[23, 38, 38, 47]], body: "hide" },
      { hands: [[1, 32, 11, 40]], feet: [[27, 39, 39, 46]], body: "trim" },
      { hands: [[31, 31, 43, 41]], feet: [[9, 38, 24, 47]], body: "hide" },
      { hands: [[35, 31, 46, 40]], feet: [[8, 42, 20, 46]], body: "trim" },
    ],
  },
  1: {
    standHands: [],
    standFeet: [[12, 40, 25, 47], [25, 40, 35, 47]],
    frames: [
      { hands: [[37, 18, 45, 26], [1, 29, 10, 37]], feet: [[36, 26, 47, 41]], body: "keep" },
      { hands: [[3, 31, 9, 37]], feet: [[7, 36, 17, 45], [20, 37, 39, 46]], body: "keep" },
      { hands: [[38, 19, 45, 31], [30, 33, 39, 41], [0, 22, 5, 32]], feet: [[0, 34, 8, 44]], body: "keep" },
      { hands: [[36, 31, 40, 36]], feet: [[25, 36, 34, 44], [10, 41, 22, 46]], body: "keep" },
    ],
  },
  2: {
    standHands: [[0, 26, 10, 37], [37, 26, 47, 37]],
    standFeet: [[8, 36, 19, 47], [28, 36, 40, 47]],
    frames: [
      { hands: [[40, 12, 45, 20], [4, 30, 16, 42]], feet: [[22, 36, 36, 47]], body: "hide" },
      { hands: [[40, 21, 45, 28], [1, 32, 10, 42]], feet: [[25, 39, 37, 45]], body: "trim" },
      { hands: [[2, 12, 7, 20], [31, 30, 43, 42]], feet: [[11, 36, 25, 47]], body: "hide" },
      { hands: [[1, 21, 7, 28], [36, 31, 46, 41]], feet: [[10, 39, 22, 45]], body: "trim" },
    ],
  },
};

const KIRI_HAND = [9, 10, 2, 4];
const KIRI_FOOT = [6, 9];
const KIRI_BODY = [14, 15];
const BODY_TRIM = 4;
const SMASH_OUTLINE = 14;
const SMASH_LIMB = [9, 10, 8, 15];
const HAND_COLORS = new Map([[14, 1], [10, 9], [9, 10], [8, 2], [15, 4]]);
const FOOT_COLORS = new Map([[14, 1], [10, 9], [9, 6]]);

const rects = GAME_TABLES.rectSMASH;
const anim = GAME_TABLES.playerAnim;

export const hasWalkTable = (dir: number) => TABLES[dir] !== undefined;
export const walkCells = (dir: number) => WALK_KEYS.map((k) => anim[dir * 16 + k]);

export const MIRRORS: [number, number][] = [[1, 3]];

export function mirrorWalk(work: Pixels, from: number, to: number): number[] {
  const filled: number[] = [];
  const src = walkCells(from);
  walkCells(to).forEach((cell, i) => {
    if (!cellIsEmpty(work, cell)) return;
    const [sl, st] = rects.slice(src[i] * 4, src[i] * 4 + 2);
    const [dl, dt] = rects.slice(cell * 4, cell * 4 + 2);
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const s = ((st + y) * work.width + sl + 47 - x) * 4;
        work.data.set(work.data.slice(s, s + 4), ((dt + y) * work.width + dl + x) * 4);
      }
    }
    filled.push(cell);
  });
  return filled;
}

export function cellIsEmpty(work: Pixels, cell: number): boolean {
  const [l, t, r, b] = rects.slice(cell * 4, cell * 4 + 4);
  for (let y = t; y < b; y++) for (let x = l; x < r; x++) if (work.data[(y * work.width + x) * 4 + 3] >= 128) return false;
  return true;
}

function smashCell(img: IndexedImage, cell: number): Grid {
  const [l, t] = rects.slice(cell * 4, cell * 4 + 2);
  return Array.from({ length: 48 }, (_, y) => Array.from({ length: 48 }, (_, x) => img.pixels[(t + y) * img.width + l + x]));
}

function components(g: Grid, ok: (v: number) => boolean): [number, number][][] {
  const seen = new Set<number>();
  const out: [number, number][][] = [];
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      if (!ok(g[y][x]) || seen.has(y * 48 + x)) continue;
      const stack: [number, number][] = [[x, y]];
      seen.add(y * 48 + x);
      const px: [number, number][] = [];
      while (stack.length) {
        const [a, b] = stack.pop()!;
        px.push([a, b]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const qx = a + dx;
          const qy = b + dy;
          if (qx < 0 || qy < 0 || qx >= 48 || qy >= 48 || seen.has(qy * 48 + qx) || !ok(g[qy][qx])) continue;
          seen.add(qy * 48 + qx);
          stack.push([qx, qy]);
        }
      }
      out.push(px);
    }
  }
  return out;
}

const inside = (px: [number, number][], [l, t, r, b]: Box) => px.every(([x, y]) => x >= l && x <= r && y >= t && y <= b);

function limbPixels(g: Grid, outline: number, boxes: Box[], allow?: number[]): Set<number> {
  const out = new Set<number>();
  const ok = (v: number) => v !== 0 && v !== outline && (!allow || allow.includes(v));
  for (const box of boxes) {
    for (const c of components(g, ok)) {
      if (!inside(c, box)) continue;
      for (const [x, y] of c) {
        for (let ey = -1; ey <= 1; ey++) {
          for (let ex = -1; ex <= 1; ex++) {
            const nx = x + ex;
            const ny = y + ey;
            if (nx >= 0 && ny >= 0 && nx < 48 && ny < 48 && (g[ny][nx] === outline || (ex === 0 && ey === 0))) out.add(ny * 48 + nx);
          }
        }
      }
    }
  }
  return out;
}

function footPixels(g: Grid, outline: number, boxes: Box[], allow: number[]): Set<number> {
  const out = new Set<number>();
  for (const box of boxes) {
    const [l, t, r, b] = box;
    const stack = [...limbPixels(g, outline, [box], allow)];
    const seen = new Set(stack);
    while (stack.length) {
      const p = stack.pop()!;
      out.add(p);
      const x = p % 48;
      const y = Math.floor(p / 48);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const q = ny * 48 + nx;
        if (nx < l || nx > r || ny < t || ny > b || seen.has(q) || g[ny][nx] !== outline) continue;
        seen.add(q);
        stack.push(q);
      }
    }
  }
  return out;
}

function headShift(stand: Grid, frame: Grid): [number, number] {
  let best = [-1, 0, 0];
  for (let dy = -7; dy <= 7; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      let score = 0;
      for (let y = 3; y < 34; y++) {
        for (let x = 8; x < 40; x++) {
          const v = stand[y][x];
          const fy = y + dy;
          const fx = x + dx;
          if (v && fy >= 0 && fy < 48 && fx >= 0 && fx < 48 && frame[fy][fx] === v) score++;
        }
      }
      if (score > best[0]) best = [score, dx, dy];
    }
  }
  return [best[1], best[2]];
}

export function buildWalk(work: Pixels, palette: [number, number, number][], smash: IndexedImage, dir: number): string {
  const table = TABLES[dir];
  if (!table) return "";
  const cells = walkCells(dir);
  const W = work.width;
  const at = (cell: number, x: number, y: number) => ((rects[cell * 4 + 1] + y) * W + rects[cell * 4] + x) * 4;
  const indexOf = new Map(palette.map((c, i) => [(c[0] << 16) | (c[1] << 8) | c[2], i]));
  const kiri: Grid = Array.from({ length: 48 }, (_, y) =>
    Array.from({ length: 48 }, (_, x) => {
      const d = work.data.subarray(at(cells[0], x, y), at(cells[0], x, y) + 4);
      if (d[3] < 128) return 0;
      return indexOf.get((d[0] << 16) | (d[1] << 8) | d[2]) ?? -1;
    }),
  );
  const standLimbs = new Set([...limbPixels(kiri, 1, table.standHands, KIRI_HAND), ...limbPixels(kiri, 1, table.standFeet, KIRI_FOOT)]);
  const core: (Uint8Array | Uint8ClampedArray | null)[] = [];
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const v = kiri[y][x];
      const limb = standLimbs.has(y * 48 + x);
      let keep = v !== 0 && !(limb && v !== 1);
      if (keep && limb) {
        keep = false;
        for (let ey = -1; ey <= 1 && !keep; ey++) {
          for (let ex = -1; ex <= 1; ex++) {
            const nx = x + ex;
            const ny = y + ey;
            if (nx >= 0 && ny >= 0 && nx < 48 && ny < 48 && ![0, 1].includes(kiri[ny][nx]) && !standLimbs.has(ny * 48 + nx)) keep = true;
          }
        }
      }
      core.push(keep ? work.data.slice(at(cells[0], x, y), at(cells[0], x, y) + 4) : null);
    }
  }
  const isBody = (x: number, y: number) => KIRI_BODY.includes(kiri[y][x]) && core[y * 48 + x] !== null;
  const body = core.map((px, p) => {
    if (!px) return false;
    const x = p % 48;
    const y = Math.floor(p / 48);
    if (KIRI_BODY.includes(kiri[y][x])) return true;
    if (kiri[y][x] !== 1) return false;
    let touchesBody = false;
    for (let ey = -1; ey <= 1; ey++) {
      for (let ex = -1; ex <= 1; ex++) {
        const nx = x + ex;
        const ny = y + ey;
        if (nx < 0 || ny < 0 || nx >= 48 || ny >= 48 || (!ex && !ey)) continue;
        if (isBody(nx, ny)) touchesBody = true;
        else if (![0, 1].includes(kiri[ny][nx]) && core[ny * 48 + nx]) return false;
      }
    }
    return touchesBody;
  });
  const bodyXs = core.flatMap((px, p) => (body[p] ? [p % 48] : []));
  const bodyLeft = Math.min(...bodyXs);
  const bodyRight = Math.max(...bodyXs);
  const black = work.data.slice(0, 4).fill(0);
  black.set([...palette[1], 255]);
  const trimmed = core.map((px, p) => {
    if (!px || !body[p]) return px;
    const x = p % 48;
    if (x < bodyLeft + BODY_TRIM || x > bodyRight - BODY_TRIM) return null;
    if (x === bodyLeft + BODY_TRIM || x === bodyRight - BODY_TRIM) return black;
    return px;
  });
  const stand = smashCell(smash, cells[0]);
  const shifts: string[] = [];
  table.frames.forEach((limbs, i) => {
    const cell = cells[i + 1];
    if (!cellIsEmpty(work, cell)) return;
    const frame = smashCell(smash, cell);
    const [dx, dy] = headShift(stand, frame);
    shifts.push(`${cell}번 ${dy > 0 ? "+" : ""}${dy}`);
    for (let y = 0; y < 48; y++) work.data.fill(0, at(cell, 0, y), at(cell, 48, y));
    const layers = limbs.body === "hide" ? [false] : [true, false];
    const lift = limbs.body === "trim" ? 1 : 0;
    const source = limbs.body === "trim" ? trimmed : core;
    for (const layer of layers) {
      source.forEach((px, p) => {
        if (!px || body[p] !== layer) return;
        const x = (p % 48) + dx;
        const y = Math.floor(p / 48) + dy - (layer ? lift : 0);
        if (x >= 0 && y >= 0 && x < 48 && y < 48) work.data.set(px, at(cell, x, y));
      });
    }
    const paste = (pixels: Set<number>, colors: Map<number, number>) => {
      for (const p of pixels) {
        const v = colors.get(frame[Math.floor(p / 48)][p % 48]);
        if (v !== undefined) work.data.set([...palette[v], 255], at(cell, p % 48, Math.floor(p / 48)));
      }
    };
    paste(footPixels(frame, SMASH_OUTLINE, limbs.feet, SMASH_LIMB), FOOT_COLORS);
    paste(limbPixels(frame, SMASH_OUTLINE, limbs.hands, SMASH_LIMB), HAND_COLORS);
  });
  return shifts.length ? `${cells[0]}번 기준으로 빈 걷기 칸 채움 (머리 이동: ${shifts.join(", ")})` : "";
}
