import { G } from "./core.ts";

export type Rect = [number, number, number, number];

export interface Character {
  id: string;
  sheet: number;
  face: number;
  anim: Int32Array;
  poses: Int32Array;
  attackRects: Int32Array;
  strikes: Int32Array[];
  hurt: Rect;
}

export const CENTER = 24;

const builders = new Map<string, () => Character>();

export function registerCharacter(id: string, build: () => Character) {
  builders.set(id, build);
}

function smash(): Character {
  const t = G.t;
  const strikes = [0, 1, 2, 3].map((d) => Int32Array.from(t.strikePoints.subarray(d * 14, d * 14 + 14)));
  return { id: "smash", sheet: 5, face: 0, anim: t.playerAnim, poses: t.poses, attackRects: t.attackRects, strikes, hurt: [0, 0, 0, 0] };
}

export function selectCharacter(id: string) {
  G.char = (builders.get(id) ?? smash)();
  G.hurt.set(G.char.hurt.map((v) => v * 0x10000));
}

export const charSpr = () => G.char.sheet << 16;
