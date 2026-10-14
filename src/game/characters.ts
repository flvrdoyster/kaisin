import { G } from "./core.ts";

export type CharacterId = "smash" | "kiri";

export interface Character {
  id: CharacterId;
  sheet: number;
  face: number;
  anim: Int32Array;
  poses: Int32Array;
  attackRects: Int32Array;
  strikes: Int32Array[];
  hurt: Rect;
}

export type Rect = [number, number, number, number];

export interface DirDef {
  trail: [number, number];
  swing: Rect[];
  start: Rect;
  strikes: [number, number][];
}

export interface CharDef {
  version: 1;
  hurt: Rect;
  dirs: DirDef[];
}

export const KIRI_SHEET = 8;
export const KIRI_FACE = 0x12;
export const CENTER = 24;
export const DIR_NAMES = ["up", "right", "down", "left"];

export function defaultDef(): CharDef {
  const dir = (): DirDef => ({
    trail: [-16, -16],
    swing: [
      [-40, -20, 40, 20],
      [-20, -40, 20, 40],
      [-32, -32, 32, 32],
    ],
    start: [-24, -24, 24, 24],
    strikes: [
      [0, -32],
      [32, 0],
      [0, 32],
      [-32, 0],
      [-24, -24],
      [24, -24],
      [24, 24],
      [-24, 24],
    ],
  });
  return { version: 1, hurt: [0, 0, 0, 0], dirs: [dir(), dir(), dir(), dir()] };
}

const isRect = (v: unknown): v is Rect => Array.isArray(v) && v.length === 4 && v.every((n) => Number.isInteger(n));
const isPoint = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n));

export function parseDef(json: unknown): CharDef | null {
  const d = json as Partial<CharDef> | null;
  if (!d || d.version !== 1 || !isRect(d.hurt) || !Array.isArray(d.dirs) || d.dirs.length !== 4) return null;
  for (const x of d.dirs) {
    if (!x || !isPoint(x.trail) || !Array.isArray(x.swing) || x.swing.length !== 3 || !x.swing.every(isRect) || !isRect(x.start)) return null;
    if (!Array.isArray(x.strikes) || !x.strikes.every(isPoint)) return null;
  }
  return d as CharDef;
}

const arr = (a: number[]) => `[${a.join(", ")}]`;

export function formatDef(def: CharDef): string {
  const dirs = def.dirs.map((d) => {
    const lines = [
      `   "trail": ${arr(d.trail)}`,
      `   "swing": [${d.swing.map(arr).join(", ")}]`,
      `   "start": ${arr(d.start)}`,
      `   "strikes": [${d.strikes.map(arr).join(", ")}]`,
    ];
    return `  {\n${lines.join(",\n")}\n  }`;
  });
  return `{\n "version": 1,\n "hurt": ${arr(def.hurt)},\n "dirs": [\n${dirs.join(",\n")}\n ]\n}\n`;
}

let kiriDef: CharDef = defaultDef();
export const getKiriDef = () => kiriDef;
export function setKiriDef(def: CharDef) {
  kiriDef = def;
}

function kiriTables(def: CharDef) {
  const t = G.t;
  const anim = t.playerAnim;
  const poses = Int32Array.from(t.poses);
  const attackRects = Int32Array.from(t.attackRects);
  const strikes: Int32Array[] = [];
  const around = (dst: number, r: Rect, pose: number) => {
    const ox = CENTER - poses[pose * 4];
    const oy = CENTER - poses[pose * 4 + 1];
    attackRects[dst] = r[0] + ox;
    attackRects[dst + 1] = r[1] + oy;
    attackRects[dst + 2] = r[2] + ox;
    attackRects[dst + 3] = r[3] + oy;
  };
  for (let d = 0; d < 4; d++) {
    const dd = def.dirs[d];
    const trail = anim[(d + 4) * 16 + 2];
    poses[trail * 4] = dd.trail[0];
    poses[trail * 4 + 1] = dd.trail[1];
    for (let i = 0; i < 3; i++) around(d * 20 + i * 4, dd.swing[i], trail);
    around(d * 20 + 16, dd.start, anim[(d + 4) * 16 + 1]);
    strikes[d] = Int32Array.from(dd.strikes.flat());
  }
  return { anim, poses, attackRects, strikes, hurt: def.hurt };
}

export function selectCharacter(id: CharacterId) {
  const t = G.t;
  if (id === "kiri") {
    G.char = { id, sheet: KIRI_SHEET, face: G.sheets.get(KIRI_FACE) ? KIRI_FACE << 16 : 0, ...kiriTables(kiriDef) };
    G.hurt.set(G.char.hurt.map((v) => v * 0x10000));
    return;
  }
  const strikes = [0, 1, 2, 3].map((d) => Int32Array.from(t.strikePoints.subarray(d * 14, d * 14 + 14)));
  G.char = { id, sheet: 5, face: 0, anim: t.playerAnim, poses: t.poses, attackRects: t.attackRects, strikes, hurt: [0, 0, 0, 0] };
  G.hurt.fill(0);
}

export const charSpr = () => G.char.sheet << 16;
