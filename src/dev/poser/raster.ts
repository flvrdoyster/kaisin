import { apply, applyT, place, type Model, type Placed, type Vec3 } from "./model.ts";

export interface Frame {
  width: number;
  height: number;
  part: Int16Array;
  depth: Float32Array;
  shade: Float32Array;
  tex: Int16Array;
}

export function view(pitch: number) {
  const a = (pitch * Math.PI) / 180;
  const up: Vec3 = [0, Math.cos(a), -Math.sin(a)];
  const d: Vec3 = [0, -Math.sin(a), -Math.cos(a)];
  return { up, d };
}

export function project(pitch: number, p: Vec3): [number, number, number] {
  const { up, d } = view(pitch);
  return [p[0], -(p[0] * up[0] + p[1] * up[1] + p[2] * up[2]), p[0] * d[0] + p[1] * d[1] + p[2] * d[2]];
}

export function unproject(pitch: number, sx: number, sy: number): Vec3 {
  const { up } = view(pitch);
  return [sx, -sy * up[1], -sy * up[2]];
}

type Hit = [number, Vec3, number] | null;

function ellipsoid(pl: Placed, o: Vec3, d: Vec3): Hit {
  const s = pl.part.size;
  const lo = applyT(pl.rot, [o[0] - pl.center[0], o[1] - pl.center[1], o[2] - pl.center[2]]);
  const ld = applyT(pl.rot, d);
  const O: Vec3 = [lo[0] / s[0], lo[1] / s[1], lo[2] / s[2]];
  const D: Vec3 = [ld[0] / s[0], ld[1] / s[1], ld[2] / s[2]];
  const a = D[0] * D[0] + D[1] * D[1] + D[2] * D[2];
  const b = 2 * (O[0] * D[0] + O[1] * D[1] + O[2] * D[2]);
  const c = O[0] * O[0] + O[1] * O[1] + O[2] * O[2] - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  const P: Vec3 = [O[0] + t * D[0], O[1] + t * D[1], O[2] + t * D[2]];
  const n = apply(pl.rot, [P[0] / s[0], P[1] / s[1], P[2] / s[2]]);
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [t, [n[0] / len, n[1] / len, n[2] / len], (1 - P[1]) / 2];
}

function roundCone(x: number, y: number, z: number, len: number, r1: number, r2: number): number {
  const l2 = len * len;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const py = -y * len;
  const zz = py - l2;
  const qx = x * l2;
  const qy = y * l2 + len * py;
  const qz = z * l2;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = py * py * l2;
  const z2 = zz * zz * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) / l2 - r2;
  if (Math.sign(py) * a2 * y2 < k) return Math.sqrt(x2 + y2) / l2 - r1;
  return (Math.sqrt((x2 * a2) / l2) + py * rr) / l2 - r1;
}

function strand(pl: Placed, o: Vec3, d: Vec3): Hit {
  const [r1, len, r2] = pl.part.size;
  if (len <= 0) return null;
  const lo = applyT(pl.rot, [o[0] - pl.center[0], o[1] - pl.center[1], o[2] - pl.center[2]]);
  const ld = applyT(pl.rot, d);
  const R = len / 2 + Math.max(r1, r2);
  const cy = lo[1] + len / 2;
  const b = lo[0] * ld[0] + cy * ld[1] + lo[2] * ld[2];
  const c = lo[0] * lo[0] + cy * cy + lo[2] * lo[2] - R * R;
  const disc = b * b - c;
  if (disc < 0) return null;
  let t = -b - Math.sqrt(disc);
  const end = -b + Math.sqrt(disc);
  const sdf = (t: number) => roundCone(lo[0] + t * ld[0], lo[1] + t * ld[1], lo[2] + t * ld[2], len, r1, r2);
  for (let i = 0; i < 64 && t < end; i++) {
    const dist = sdf(t);
    if (dist < 0.005) {
      const px = lo[0] + t * ld[0], py = lo[1] + t * ld[1], pz = lo[2] + t * ld[2];
      const e = 0.01;
      const g: Vec3 = [
        roundCone(px + e, py, pz, len, r1, r2) - roundCone(px - e, py, pz, len, r1, r2),
        roundCone(px, py + e, pz, len, r1, r2) - roundCone(px, py - e, pz, len, r1, r2),
        roundCone(px, py, pz + e, len, r1, r2) - roundCone(px, py, pz - e, len, r1, r2),
      ];
      const n = apply(pl.rot, g);
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      return [t, [n[0] / nl, n[1] / nl, n[2] / nl], Math.min(1, Math.max(0, -py / len))];
    }
    t += dist;
  }
  return null;
}

interface Bound {
  pl: Placed;
  x: number;
  y: number;
  r2: number;
}

function bounds(placed: Placed[], up: Vec3): Bound[] {
  return placed.filter((pl) => pl.part.shape !== "decal").map((pl) => {
    const s = pl.part.size;
    let c = pl.center;
    let r = Math.max(s[0], s[1], s[2]);
    if (pl.part.shape === "strand") {
      const mid = apply(pl.rot, [0, -s[1] / 2, 0]);
      c = [c[0] + mid[0], c[1] + mid[1], c[2] + mid[2]];
      r = s[1] / 2 + Math.max(s[0], s[2]);
    }
    return { pl, x: c[0], y: -(c[0] * up[0] + c[1] * up[1] + c[2] * up[2]), r2: (r + 1) * (r + 1) };
  });
}

export function rasterize(m: Model, pose: string | null, dir: number, width: number, height: number, cx: number, cy: number, scale = 1): Frame {
  const { up, d } = view(m.pitch);
  const placed = place(m, pose, m.yaw[dir]);
  const bs = bounds(placed, up);
  const byId = new Map(placed.map((pl) => [pl.part.id, pl.index]));
  const decals = new Map<number, Placed[]>();
  for (const pl of placed) {
    if (pl.part.shape !== "decal" || !pl.part.parent || !pl.part.image?.length) continue;
    const at = byId.get(pl.part.parent)!;
    decals.set(at, [...(decals.get(at) ?? []), pl]);
  }
  const ll = Math.hypot(...m.light) || 1;
  const L: Vec3 = [m.light[0] / ll, m.light[1] / ll, m.light[2] / ll];
  const n = width * height;
  const f: Frame = { width, height, part: new Int16Array(n).fill(-1), depth: new Float32Array(n).fill(Infinity), shade: new Float32Array(n), tex: new Int16Array(n).fill(-1) };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = (x + 0.5) / scale - cx;
      const sy = (y + 0.5) / scale - cy;
      const o: Vec3 = [sx, -sy * up[1], -sy * up[2]];
      const i = y * width + x;
      for (const b of bs) {
        if ((sx - b.x) * (sx - b.x) + (sy - b.y) * (sy - b.y) > b.r2) continue;
        const h = b.pl.part.shape === "strand" ? strand(b.pl, o, d) : ellipsoid(b.pl, o, d);
        if (!h || h[0] >= f.depth[i]) continue;
        f.depth[i] = h[0];
        f.part[i] = b.pl.index;
        const g = b.pl.part.grad ?? 0;
        f.shade[i] = ((h[1][0] * L[0] + h[1][1] * L[1] + h[1][2] * L[2] + 1) / 2) * (1 - g) + (1 - h[2]) * g;
      }
      const on = f.part[i] >= 0 ? decals.get(f.part[i]) : undefined;
      if (on) {
        const t = f.depth[i];
        const P: Vec3 = [o[0] + t * d[0], o[1] + t * d[1], o[2] + t * d[2]];
        for (const dc of on) {
          const [w, h, depth] = dc.part.size;
          const l = applyT(dc.rot, [P[0] - dc.center[0], P[1] - dc.center[1], P[2] - dc.center[2]]);
          if (Math.abs(l[2]) > depth) continue;
          const u = l[0] / w + 0.5;
          const v = 0.5 - l[1] / h;
          if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
          const img = dc.part.image!;
          const ch = img[Math.floor(v * img.length)][Math.floor(u * img[0].length)];
          if (ch === ".") continue;
          f.part[i] = dc.index;
          f.tex[i] = parseInt(ch, 16);
        }
      }
    }
  }
  return f;
}

export function colorize(m: Model, f: Frame, outline = true, edge = m.edge): Uint8Array {
  const out = new Uint8Array(f.width * f.height);
  const W = f.width;
  for (let i = 0; i < out.length; i++) {
    const p = f.part[i];
    if (p < 0) continue;
    const ramp = m.parts[p].ramp;
    const line = m.parts[p].line === true;
    out[i] = f.tex[i] >= 0 ? f.tex[i] : ramp[Math.min(ramp.length - 1, Math.floor(f.shade[i] * ramp.length))];
    if (!outline) continue;
    const x = i % W;
    const y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const qx = x + dx;
      const qy = y + dy;
      const q = qy * W + qx;
      const empty = qx < 0 || qy < 0 || qx >= W || qy >= f.height || f.part[q] < 0;
      if (empty || (f.part[q] !== p && (f.depth[q] < f.depth[i] - edge || (line && f.depth[q] > f.depth[i])))) {
        out[i] = m.outline;
        break;
      }
    }
  }
  return out;
}
