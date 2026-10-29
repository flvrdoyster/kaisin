import type { Pixels } from "./walkFromStand.ts";

type Rgb = [number, number, number];

export interface HairBend {
  dx: number;
  dy: number;
  sway: number;
  phase: number;
  fixed: number;
  edge: number;
}

interface HairShape {
  w: number;
  h: number;
  layer: Uint8Array;
  resting: Uint8Array;
  depth: Uint8Array;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

type Disp = (x: number, y: number) => [number, number];

const MIN_HAIR = 120;
const STRAND = 7;

export function bendHair(work: Pixels, rect: ArrayLike<number>, hair: Rgb[], outline: Rgb, bend: HairBend): number {
  const at = (k: number) => ((rect[1] + Math.floor(k / (rect[2] - rect[0]))) * work.width + rect[0] + (k % (rect[2] - rect[0]))) * 4;
  const n = (rect[2] - rect[0]) * (rect[3] - rect[1]);
  const original = Array.from({ length: n }, (_, k) => work.data.slice(at(k), at(k) + 4));
  warpHair(work, rect, hair, outline, (s) => {
    const fixedY = s.top + bend.fixed * (s.bottom - s.top);
    return (x, y) => {
      if (x >= 0 && y >= 0 && x < s.w && y < s.h && s.resting[y * s.w + x]) return [0, 0];
      const f = Math.max(0, Math.min(1, (y - fixedY) / Math.max(1, s.bottom + 1 - fixedY)));
      const e = f * f;
      return [bend.dx * e + bend.sway * e * Math.sin((2 * Math.PI * x) / STRAND + bend.phase), bend.dy * e];
    };
  });
  if (bend.edge) {
    warpHair(work, rect, hair, outline, (s) => {
      const cx = (s.left + s.right) / 2;
      const cy = (s.top + s.bottom) / 2;
      return (x, y) => {
        const k = y * s.w + x;
        const inCell = x >= 0 && y >= 0 && x < s.w && y < s.h;
        if (inCell && s.resting[k]) return [0, 0];
        const weight = !inCell || !s.layer[k] ? 1 : Math.max(0, 1 - (s.depth[k] - 1) / EDGE_DEPTH);
        const a = Math.atan2(y - cy, x - cx);
        const m = bend.edge * weight * Math.sin(EDGE_WAVES * a + bend.phase);
        return [-Math.sin(a) * m, Math.cos(a) * m];
      };
    });
  }
  tidyHair(work, rect, hair, outline, original);
  let changed = 0;
  for (let k = 0; k < n; k++) {
    const p = at(k);
    if (original[k].some((v, i) => v !== work.data[p + i])) changed++;
  }
  return changed;
}

function tidyHair(work: Pixels, rect: ArrayLike<number>, hair: Rgb[], outline: Rgb, original: ArrayLike<number>[]) {
  const [l, t, r, b] = [rect[0], rect[1], rect[2], rect[3]];
  const w = r - l;
  const h = b - t;
  const at = (x: number, y: number) => ((t + y) * work.width + l + x) * 4;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const key = (x: number, y: number) => {
    if (!inside(x, y)) return -1;
    const p = at(x, y);
    return work.data[p + 3] < 128 ? -1 : (work.data[p] << 16) | (work.data[p + 1] << 8) | work.data[p + 2];
  };
  const toKey = (c: Rgb) => (c[0] << 16) | (c[1] << 8) | c[2];
  const hairKeys = new Set(hair.map(toKey));
  const lineKey = toKey(outline);
  const ownKeys = new Set([...hairKeys, lineKey]);
  const setKey = (x: number, y: number, k: number) => {
    const p = at(x, y);
    if (k < 0) work.data.fill(0, p, p + 4);
    else work.data.set([k >> 16, (k >> 8) & 255, k & 255, 255], p);
  };
  const changedOrNear = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = original[y * w + x];
      const p = at(x, y);
      if (o[3] === work.data[p + 3] && (o[3] < 128 || (o[0] === work.data[p] && o[1] === work.data[p + 1] && o[2] === work.data[p + 2]))) continue;
      for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) if (inside(x + ex, y + ey)) changedOrNear[(y + ey) * w + x + ex] = 1;
    }
  }
  const four = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!changedOrNear[y * w + x]) continue;
        const k = key(x, y);
        const around = four.map(([ex, ey]) => key(x + ex, y + ey));
        if (k >= 0 && ownKeys.has(k)) {
          let opaqueNear = 0;
          for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) if ((ex || ey) && key(x + ex, y + ey) >= 0) opaqueNear++;
          if (opaqueNear <= 1) {
            setKey(x, y, -1);
            continue;
          }
          if (hairKeys.has(k) && !around.includes(k)) {
            const counts = new Map<number, number>();
            for (const a of around) if (hairKeys.has(a)) counts.set(a, (counts.get(a) ?? 0) + 1);
            const best = [...counts].sort((p, q) => q[1] - p[1])[0];
            if (best && best[1] >= 3) setKey(x, y, best[0]);
          }
        } else if (k < 0) {
          const own = around.filter((a) => ownKeys.has(a));
          if (own.length >= 3) {
            const hairs = own.filter((a) => hairKeys.has(a));
            setKey(x, y, hairs.length ? hairs[0] : lineKey);
          }
        }
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!changedOrNear[y * w + x] || !hairKeys.has(key(x, y))) continue;
        if (four.some(([ex, ey]) => key(x + ex, y + ey) < 0)) setKey(x, y, lineKey);
      }
    }
  }
  const onEdge = (x: number, y: number) => four.some(([ex, ey]) => key(x + ex, y + ey) < 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!changedOrNear[y * w + x] || key(x, y) >= 0) continue;
      const around = four.map(([ex, ey]) => key(x + ex, y + ey)).filter((a) => a >= 0);
      if (around.length >= 3 && around.every((a) => ownKeys.has(a))) setKey(x, y, lineKey);
    }
  }
  const dominantHair = (x: number, y: number) => {
    const counts = new Map<number, number>();
    for (const [ex, ey] of four) {
      const a = key(x + ex, y + ey);
      if (hairKeys.has(a)) counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    if (!counts.size) {
      for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) if (ex || ey) {
        const a = key(x + ex, y + ey);
        if (hairKeys.has(a)) counts.set(a, (counts.get(a) ?? 0) + 1);
      }
    }
    return [...counts].sort((p, q) => q[1] - p[1])[0]?.[0];
  };
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const block = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
      if (!block.every(([a, c]) => changedOrNear[c * w + a] && key(a, c) === lineKey) || !block.some(([a, c]) => onEdge(a, c))) continue;
      const inner = block.find(([a, c]) => !onEdge(a, c));
      const color = inner && dominantHair(inner[0], inner[1]);
      if (inner && color !== undefined) setKey(inner[0], inner[1], color);
    }
  }
}

const EDGE_DEPTH = 4;
const EDGE_WAVES = 5;

function warpHair(work: Pixels, rect: ArrayLike<number>, hair: Rgb[], outline: Rgb, makeDisp: (shape: HairShape) => Disp) {
  const [l, t, r, b] = [rect[0], rect[1], rect[2], rect[3]];
  const w = r - l;
  const h = b - t;
  const at = (x: number, y: number) => ((t + y) * work.width + l + x) * 4;
  const before = work.data.slice();
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const opaque = (x: number, y: number) => inside(x, y) && before[at(x, y) + 3] >= 128;
  const is = (x: number, y: number, c: Rgb) => opaque(x, y) && before[at(x, y)] === c[0] && before[at(x, y) + 1] === c[1] && before[at(x, y) + 2] === c[2];
  const hairColor = (x: number, y: number) => hair.some((c) => is(x, y, c));

  const isHair = new Uint8Array(w * h);
  const seen = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] || !hairColor(x, y)) continue;
      const stack = [y * w + x];
      const comp: number[] = [];
      seen[y * w + x] = 1;
      while (stack.length) {
        const k = stack.pop()!;
        comp.push(k);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = (k % w) + dx;
          const ny = Math.floor(k / w) + dy;
          if (!inside(nx, ny) || seen[ny * w + nx] || !hairColor(nx, ny)) continue;
          seen[ny * w + nx] = 1;
          stack.push(ny * w + nx);
        }
      }
      if (comp.length >= MIN_HAIR) for (const k of comp) isHair[k] = 1;
    }
  }
  const layer = new Uint8Array(w * h);
  let top = h;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isHair[y * w + x]) {
        layer[y * w + x] = 1;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        continue;
      }
      if (!is(x, y, outline)) continue;
      for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) if (inside(x + ex, y + ey) && isHair[(y + ey) * w + x + ex]) layer[y * w + x] = 1;
    }
  }
  if (bottom < 0) return;
  const solid = (x: number, y: number) => opaque(x, y) && !layer[y * w + x];
  const resting = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!layer[y * w + x]) continue;
      for (let k = 1; k <= 4; k++) if (solid(x, y + k)) resting[y * w + x] = 1;
    }
  }
  const depth = new Uint8Array(w * h);
  let left = w;
  let right = -1;
  const queue: number[] = [];
  for (let k = 0; k < w * h; k++) {
    if (!layer[k]) continue;
    left = Math.min(left, k % w);
    right = Math.max(right, k % w);
    const x = k % w;
    const y = Math.floor(k / w);
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ey]) => !inside(x + ex, y + ey) || !layer[(y + ey) * w + x + ex])) {
      depth[k] = 1;
      queue.push(k);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i];
    const x = k % w;
    const y = Math.floor(k / w);
    for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = (y + ey) * w + x + ex;
      if (!inside(x + ex, y + ey) || !layer[q] || depth[q]) continue;
      depth[q] = Math.min(255, depth[k] + 1);
      queue.push(q);
    }
  }
  const disp = makeDisp({ w, h, layer, resting, depth, top, bottom, left, right });

  const out = before.slice();
  const covered = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opaque(x, y) && !layer[y * w + x]) continue;
      let [dx, dy] = disp(x, y);
      [dx, dy] = disp(x - dx, y - dy);
      const sx = Math.round(x - dx);
      const sy = Math.round(y - dy);
      if (!inside(sx, sy) || !layer[sy * w + sx]) continue;
      out.set(before.subarray(at(sx, sy), at(sx, sy) + 4), at(x, y));
      covered[y * w + x] = 1;
    }
  }
  const vacated = new Uint8Array(w * h);
  const nearSolid = (x: number, y: number) => {
    for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) if (solid(x + ex, y + ey)) return true;
    return false;
  };
  for (let k = 0; k < w * h; k++) if (layer[k] && !covered[k] && !nearSolid(k % w, Math.floor(k / w))) vacated[k] = 1;
  const clear = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let k = 0; k < w * h; k++) {
    if (!vacated[k]) continue;
    const x = k % w;
    const y = Math.floor(k / w);
    for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inside(x + ex, y + ey) || out[at(x + ex, y + ey) + 3] < 128) {
        clear[k] = 1;
        stack.push(k);
        break;
      }
    }
  }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w;
    const y = Math.floor(k / w);
    for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (y + ey) * w + x + ex;
      if (!inside(x + ex, y + ey) || !vacated[n] || clear[n]) continue;
      clear[n] = 1;
      stack.push(n);
    }
  }
  for (let k = 0; k < w * h; k++) if (clear[k]) out.fill(0, at(k % w, Math.floor(k / w)), at(k % w, Math.floor(k / w)) + 4);

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) work.data.set(out.subarray(at(x, y), at(x, y) + 4), at(x, y));
}
