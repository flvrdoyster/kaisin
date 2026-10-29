import { G } from "../../../src/game/core.ts";
import type { DebugHooks } from "../../../src/game/state.ts";

export function hitboxHooks(): DebugHooks {
  const rects = new Int32Array(12);
  let strikes: number[] = [];
  let ttl = 0;
  return {
    attack(r) {
      rects.set(r);
      ttl = 10;
    },
    strikes(points) {
      strikes = points;
    },
    overlay(r) {
      if (G.scene !== 0) return;
      if (ttl > 0) {
        ttl--;
        for (let i = 0; i < 12; i += 4) {
          if (rects[i] === rects[i + 2]) continue;
          r.box(rects[i] >> 16, rects[i + 1] >> 16, (rects[i + 2] - rects[i]) >> 16, (rects[i + 3] - rects[i + 1]) >> 16, "#ff4040");
        }
        for (let i = 0; i < strikes.length; i += 2) r.dot(strikes[i], strikes[i + 1], 3, "#40c0ff");
      }
      r.dot(G.playerCX >> 16, G.playerCY >> 16, 5, "#ffff00");
    },
  };
}
