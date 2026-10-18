import { GAME_TABLES } from "../data/gameTables.ts";
import type { Pixels } from "./walkFromStand.ts";

export interface SheetRow {
  name: string;
  cells: number[];
}

export interface SheetSpec {
  file: string;
  w: number;
  h: number;
  rows: SheetRow[];
}

export const KIRI_SHEETS: SheetSpec[] = [
  {
    file: "work/kiri/KIRI_48x48.png",
    w: 48,
    h: 48,
    rows: [
      { name: "걷기 위", cells: [0, 1, 2, 83, 84] },
      { name: "걷기 오른쪽", cells: [3, 4, 5, 85, 86] },
      { name: "걷기 아래", cells: [6, 7, 8, 87, 88] },
      { name: "걷기 왼쪽", cells: [9, 10, 11, 89, 90] },
      { name: "공격 몸", cells: [12, 15, 18, 21] },
      { name: "피격·쓰러짐·석상", cells: [32, 36, 34] },
    ],
  },
  { file: "work/kiri/KIRI_80x80.png", w: 80, h: 80, rows: [{ name: "공격 잔상", cells: [13, 16, 19, 22] }] },
  {
    file: "work/kiri/KIRI_48x80.png",
    w: 48,
    h: 80,
    rows: [
      { name: "위: 공격 끝·스매시", cells: [14, 24, 25] },
      { name: "아래: 공격 끝·스매시", cells: [20, 28, 29] },
    ],
  },
  {
    file: "work/kiri/KIRI_80x48.png",
    w: 80,
    h: 48,
    rows: [
      { name: "오른쪽: 공격 끝·스매시", cells: [17, 26, 27] },
      { name: "왼쪽: 공격 끝·스매시", cells: [23, 30, 31] },
    ],
  },
];

export const GAME_W = 640;
export const GAME_H = 272;

export function sheetSize(spec: SheetSpec): [number, number] {
  return [Math.max(...spec.rows.map((r) => r.cells.length)) * spec.w, spec.rows.length * spec.h];
}

function eachCell(spec: SheetSpec, fn: (cell: number, sx: number, sy: number, gx: number, gy: number) => void) {
  const rects = GAME_TABLES.rectSMASH;
  spec.rows.forEach((row, r) => row.cells.forEach((cell, c) => fn(cell, c * spec.w, r * spec.h, rects[cell * 4], rects[cell * 4 + 1])));
}

function copyRect(src: Pixels, sx: number, sy: number, dst: Pixels, dx: number, dy: number, w: number, h: number) {
  for (let y = 0; y < h; y++) {
    const s = ((sy + y) * src.width + sx) * 4;
    dst.data.set(src.data.subarray(s, s + w * 4), ((dy + y) * dst.width + dx) * 4);
  }
}

export function assemble(sheets: Pixels[], game: Pixels) {
  KIRI_SHEETS.forEach((spec, i) => eachCell(spec, (_, sx, sy, gx, gy) => copyRect(sheets[i], sx, sy, game, gx, gy, spec.w, spec.h)));
}

export function disassemble(game: Pixels, sheets: Pixels[]) {
  KIRI_SHEETS.forEach((spec, i) => eachCell(spec, (_, sx, sy, gx, gy) => copyRect(game, gx, gy, sheets[i], sx, sy, spec.w, spec.h)));
}

export function sheetCellAt(cell: number): { spec: SheetSpec; row: SheetRow; col: number } | null {
  for (const spec of KIRI_SHEETS) {
    for (const row of spec.rows) {
      const col = row.cells.indexOf(cell);
      if (col >= 0) return { spec, row, col };
    }
  }
  return null;
}
