import { Obj, Update } from "./obj.ts";
import { G, free, spawn } from "./core.ts";
import { puff } from "./effects.ts";

export function killCategory(mask: number) {
  for (const o of G.world.all()) {
    if ((o.f34 & mask) !== 0) {
      puff(o.x, o.y, 2);
      free(o);
    }
  }
}

export function freeCategory(mask: number) {
  for (const o of G.world.all()) if ((o.f34 & mask) !== 0) free(o);
}

export function killByUpdate(updates: Update[]) {
  for (const o of G.world.all()) {
    if (o.update && updates.includes(o.update)) {
      puff(o.x, o.y, 2);
      free(o);
    }
  }
}

export function freeByUpdate(updates: Update[]) {
  for (const o of G.world.all()) if (o.update && updates.includes(o.update)) free(o);
}

function wipeUpdate(o: Obj) {
  for (let row = 0, col = o.x; row < 15; row++, col--) {
    const x = col * 32;
    if (x >= 0 && x < 0x1e1) G.mdt[col + row * 20] = 400;
  }
  o.x++;
  if (o.x > 0x1e) free(o);
}

export function screenWipe() {
  const o = spawn(wipeUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.f34 = 8;
}
