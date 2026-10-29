import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { decodeIndexed, decodePng, encodeIndexed } from "./png.ts";
import { MIRRORS, buildWalk, hasWalkTable, mirrorWalk } from "../art/walkFromStand.ts";
import { GAME_H, GAME_W, KIRI_SHEETS, assemble, sheetSize } from "../art/sheets.ts";

const root = resolve(import.meta.dirname, "../../..");

export const EXPORTS = [
  { sources: KIRI_SHEETS.map((s) => s.file), final: "mods/kiri/assets/KIRI.png", transparent: true, walk: true },
  { sources: ["mods/kiri/work/KIRI_FACE.png"], final: "mods/kiri/assets/KIRI_FACE.png", transparent: false, walk: false },
];

type Rgb = [number, number, number];
const key = (c: Rgb) => (c[0] << 16) | (c[1] << 8) | c[2];
const dist = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export function exportArt(spec: (typeof EXPORTS)[number]): string {
  const finalPath = join(root, spec.final);
  const missing = spec.sources.filter((f) => !existsSync(join(root, f)));
  if (missing.length) return `${missing.join(", ")} 없음`;
  const final = decodeIndexed(readFileSync(finalPath));
  let work: { width: number; height: number; data: Uint8Array };
  if (spec.walk) {
    work = { width: GAME_W, height: GAME_H, data: new Uint8Array(GAME_W * GAME_H * 4) };
    const sheets = [];
    for (const sheet of KIRI_SHEETS) {
      const img = decodePng(readFileSync(join(root, sheet.file)));
      const [w, h] = sheetSize(sheet);
      if (img.width !== w || img.height < h) return `${sheet.file} 크기 ${img.width}×${img.height}가 ${w}×${h}보다 작거나 폭이 달라 내보내지 않음`;
      sheets.push(img);
    }
    assemble(sheets, work);
  } else {
    const full = decodePng(readFileSync(join(root, spec.sources[0])));
    if (full.width !== final.width || full.height < final.height) {
      return `${spec.sources[0]} 크기 ${full.width}×${full.height}가 ${spec.final}(${final.width}×${final.height})보다 작거나 폭이 달라 내보내지 않음`;
    }
    work = { width: final.width, height: final.height, data: full.data.subarray(0, final.width * final.height * 4) };
  }
  const palette: Rgb[] = Array.from({ length: 16 }, (_, i) => final.palette[i] ?? [0, 0, 0]);
  const walked: number[] = [];
  if (spec.walk) {
    const smash = decodeIndexed(readFileSync(join(root, "assets/gfx/SMASH.png")));
    for (let dir = 0; dir < 4; dir++) {
      if (hasWalkTable(dir) && buildWalk(work, palette, smash, dir)) walked.push(dir);
    }
    for (const [from, to] of MIRRORS) if (mirrorWalk(work, from, to).length) walked.push(to);
  }
  const start = spec.transparent ? 1 : 0;
  const n = work.width * work.height;
  const rgb: (Rgb | null)[] = new Array(n);
  const used = new Map<number, Rgb>();
  for (let i = 0; i < n; i++) {
    const d = work.data.subarray(i * 4, i * 4 + 4);
    const c: Rgb = [d[0], d[1], d[2]];
    if (spec.transparent && (d[3] < 128 || key(c) === key(palette[0]))) {
      rgb[i] = null;
      continue;
    }
    rgb[i] = c;
    used.set(key(c), c);
  }
  const index = new Map<number, number>();
  for (let i = start; i < 16; i++) if (used.has(key(palette[i])) && !index.has(key(palette[i]))) index.set(key(palette[i]), i);
  const fresh = [...used.values()].filter((c) => !index.has(key(c)));
  const notes: string[] = [];
  if (spec.walk && walked.length) notes.push(`빈 걷기 칸 합성: ${walked.map((d) => ["위", "오른쪽", "아래", "왼쪽"][d]).join("·")}`);
  const free = [];
  for (let i = start; i < 16; i++) if (![...index.values()].includes(i)) free.push(i);
  if (fresh.length > 0 && fresh.length <= free.length) {
    fresh.forEach((c, k) => {
      palette[free[k]] = c;
      index.set(key(c), free[k]);
    });
    notes.push(`새 색 ${fresh.length}개를 ${free.slice(0, fresh.length).join("·")}번에 넣음`);
  } else if (fresh.length > 0) {
    let count = 0;
    for (const c of fresh) {
      let best = start;
      for (let i = start; i < 16; i++) if (dist(c, palette[i]) < dist(c, palette[best])) best = i;
      index.set(key(c), best);
    }
    for (const c of rgb) if (c && fresh.some((f) => key(f) === key(c))) count++;
    notes.push(`팔레트에 들어가지 않는 색 ${fresh.length}개(${count}px)를 가까운 색으로 바꿈`);
  }
  const pixels = new Uint8Array(n);
  for (let i = 0; i < n; i++) pixels[i] = rgb[i] ? index.get(key(rgb[i]!))! : 0;
  const png = encodeIndexed({ width: work.width, height: work.height, palette, transparent: spec.transparent, pixels });
  if (!readFileSync(finalPath).equals(png)) writeFileSync(finalPath, png);
  return [`${spec.final} 내보냄`, ...notes].join(", ");
}

if (import.meta.main) for (const spec of EXPORTS) console.log(exportArt(spec));
