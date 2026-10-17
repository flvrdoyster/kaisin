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
      { hands: [[4, 31, 16, 41]], feet: [[23, 38, 38, 47]] },
      { hands: [[1, 32, 11, 40]], feet: [[27, 39, 39, 46]] },
      { hands: [[31, 31, 43, 41]], feet: [[9, 38, 24, 47]] },
      { hands: [[35, 31, 46, 40]], feet: [[8, 42, 20, 46]] },
    ],
  },
  2: {
    standHands: [[0, 26, 10, 37], [37, 26, 47, 37]],
    standFeet: [[8, 36, 19, 47], [28, 36, 40, 47]],
    frames: [
      { hands: [[40, 12, 45, 20], [4, 30, 16, 42]], feet: [[22, 36, 36, 47]] },
      { hands: [[40, 21, 45, 28], [1, 32, 10, 42]], feet: [[25, 39, 37, 45]] },
      { hands: [[2, 12, 7, 20], [31, 30, 43, 42]], feet: [[11, 36, 25, 47]] },
      { hands: [[1, 21, 7, 28], [36, 31, 46, 41]], feet: [[10, 39, 22, 45]] },
    ],
  },
};

const KIRI_HAND = [9, 10, 2, 4];
const KIRI_FOOT = [6, 9];
const SMASH_OUTLINE = 14;
const SMASH_LIMB = [9, 10, 8, 15];
const HAND_COLORS = new Map([[14, 1], [10, 9], [9, 10], [8, 2], [15, 4]]);
const FOOT_COLORS = new Map([[14, 1], [10, 9], [9, 6]]);

const rects = GAME_TABLES.rectSMASH;
const anim = GAME_TABLES.playerAnim;

export const hasWalkTable = (dir: number) => TABLES[dir] !== undefined;
export const walkCells = (dir: number) => WALK_KEYS.map((k) => anim[dir * 16 + k]);

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
  const stand = smashCell(smash, cells[0]);
  const shifts: string[] = [];
  table.frames.forEach((limbs, i) => {
    const cell = cells[i + 1];
    const frame = smashCell(smash, cell);
    const [dx, dy] = headShift(stand, frame);
    shifts.push(`${cell}번 ${dy > 0 ? "+" : ""}${dy}`);
    for (let y = 0; y < 48; y++) work.data.fill(0, at(cell, 0, y), at(cell, 48, y));
    core.forEach((px, p) => {
      const x = (p % 48) + dx;
      const y = Math.floor(p / 48) + dy;
      if (px && x >= 0 && y >= 0 && x < 48 && y < 48) work.data.set(px, at(cell, x, y));
    });
    const paste = (boxes: Box[], colors: Map<number, number>) => {
      for (const p of limbPixels(frame, SMASH_OUTLINE, boxes, SMASH_LIMB)) {
        const v = colors.get(frame[Math.floor(p / 48)][p % 48]);
        if (v !== undefined) work.data.set([...palette[v], 255], at(cell, p % 48, Math.floor(p / 48)));
      }
    };
    paste(limbs.feet, FOOT_COLORS);
    paste(limbs.hands, HAND_COLORS);
  });
  return `걷기 칸 ${cells.slice(1).join("·")}번을 ${cells[0]}번 정지 칸과 스마슈 걷기 칸으로 만듦 (머리 이동: ${shifts.join(", ")})`;
}
