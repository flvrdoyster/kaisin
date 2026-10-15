export type Vec3 = [number, number, number];

export interface Part {
  id: string;
  parent: string | null;
  pos: Vec3;
  rot: Vec3;
  size: Vec3;
  ramp: number[];
  shape?: Shape;
  grad?: number;
  line?: boolean;
  image?: string[];
}

export type Shape = "ellipsoid" | "strand" | "decal";
export const SHAPES: Record<Shape, string> = { ellipsoid: "타원체", strand: "가닥", decal: "데칼" };

export interface PartPose {
  pos: Vec3;
  rot: Vec3;
}

export interface Model {
  version: 1;
  pitch: number;
  yaw: number[];
  light: Vec3;
  outline: number;
  edge: number;
  palette: [number, number, number][];
  parts: Part[];
  poses: Record<string, Record<string, PartPose>>;
}

export const POSES = ["stand", "walk1", "walk2", "walk3", "walk4"] as const;
export type PoseName = (typeof POSES)[number];
export const POSE_LABELS: Record<PoseName, string> = { stand: "정지", walk1: "걷기1", walk2: "걷기2", walk3: "걷기3", walk4: "걷기4" };
const POSE_COLUMN: Record<PoseName, number> = { stand: 0, walk1: 2, walk2: 6, walk3: 10, walk4: 14 };

export interface CellJob {
  cell: number;
  pose: PoseName;
  dir: number;
}

export function walkJobs(anim: Int32Array): CellJob[] {
  const jobs: CellJob[] = [];
  for (let dir = 0; dir < 4; dir++) for (const pose of POSES) jobs.push({ cell: anim[dir * 16 + POSE_COLUMN[pose]], pose, dir });
  return jobs;
}

const part = (id: string, parent: string | null, pos: Vec3, size: Vec3, ramp: number[], rot: Vec3 = [0, 0, 0]): Part => ({ id, parent, pos, rot, size, ramp });
const strand = (id: string, parent: string, pos: Vec3, rot: Vec3, size: Vec3, ramp: number[]): Part => ({ id, parent, pos, rot, size, ramp, shape: "strand" });

const side = (k: number, s: number) => `${k}${s < 0 ? "L" : "R"}`;

function aim(v: Vec3): Vec3 {
  const l = Math.hypot(...v);
  const a = Math.acos(-v[1] / l);
  const b = Math.atan2(-v[0], -v[2]);
  const deg = (r: number) => Math.round((r * 180) / Math.PI);
  return [deg(a), Math.abs(Math.sin(a)) < 1e-6 ? 0 : deg(b), 0];
}

const HAIR = [8, 7, 7, 6, 6, 6, 5];

const SHINE = [
  "...5555555555...",
  ".55555555555555.",
  "555..........555",
];

function kiriHair(): Part[] {
  const out: Part[] = [
    { ...part("hair", "head", [0, 5, -6], [19.5, 15, 16], [8, 7, 7, 6, 6]), grad: 0.15 },
    { ...part("shine", "hair", [0, 10, 11.9], [24, 4.5, 4], [5], [-52, 0, 0]), shape: "decal", image: SHINE },
    part("bangs", "head", [0, 10, 8], [15, 6, 7], [8, 7, 7, 6], [30, 0, 0]),
  ];
  const add = (id: string, parent: string, pos: Vec3, dir: Vec3, size: Vec3, ramp: number[], grad: number) =>
    out.push({ ...strand(id, parent, pos, aim(dir), size, ramp), grad });
  for (const s of [-1, 1]) {
    add(`fringe${side(0, s)}`, "head", [s * 2, 12, 12], [s * 0.5, -1, 0.7], [3.5, 9, 1.5], [8, 7, 7, 6], 0.2);
    add(`fringe${side(1, s)}`, "head", [s * 7, 11, 11], [s * 0.7, -1, 0.5], [3.5, 9, 1.5], [8, 7, 7, 6], 0.2);
    add(`fringe${side(2, s)}`, "head", [s * 11, 9, 9], [s * 0.8, -1, 0.3], [3.5, 9, 1.5], [8, 7, 7, 6], 0.2);
    add(`wing${side(0, s)}`, "head", [s * 14, 5, 1], [s * 0.4, -0.5, -0.85], [5, 13, 2.5], HAIR, 0.4);
    add(`wing${side(1, s)}`, "head", [s * 15, -2, -1], [s * 0.35, -0.7, -0.7], [5, 12, 2.5], HAIR, 0.4);
    add(`fall${side(0, s)}`, "head", [s * 12, -2, -10], [s * 0.15, -1, -0.4], [7, 12, 3.5], HAIR, 0.5);
    add(`fall${side(1, s)}`, "head", [s * 6, -2, -12], [s * 0.08, -1, -0.5], [7, 11, 3.5], HAIR, 0.5);
  }
  add("fall0", "head", [0, -2, -13], [0, -1, -0.55], [8, 11, 3.5], HAIR, 0.5);
  add("flowR", "head", [15, -4, -6], [0.25, -1, -0.5], [5, 13, 2.5], HAIR, 0.5);
  out.push(
    part("braid1", "head", [17, 3.5, 0], [3.5, 3.5, 3.5], [6, 5]),
    part("braid2", "braid1", [0, -5, 1], [3.5, 3.5, 3.5], [6, 5]),
    part("braid3", "braid2", [0, -5, 1], [3, 3, 3], [6, 5]),
    part("ribbon", "braid3", [0, -4, 0], [4.5, 2.5, 4], [6, 5]),
    part("tie", "ribbon", [0, -2, 0], [3, 2, 3], [13, 12]),
    { ...strand("braidTip", "tie", [0, -1, 0], [0, 0, 0], [2, 1, 0.4], [6, 5]), grad: 0.5 },
  );
  return out;
}

const EYE = [
  ".1111111.",
  "111111111",
  "144bbbb41",
  "14b44bbb1",
  "14bb11bb1",
  "14bb11bb1",
  "14bbbbbb1",
  "134bbbb31",
  ".1333331.",
  "..11111..",
];

function eyes(): Part[] {
  const decal = (id: string, pos: Vec3, rot: Vec3, size: Vec3, image: string[]): Part => ({ ...part(id, "head", pos, size, [1], rot), shape: "decal", image });
  return [
    decal("eyeL", [-7.5, -1, 15.2], [0, -25, 0], [9, 12.5, 3], EYE),
    decal("eyeR", [7.5, -1, 15.2], [0, 25, 0], [9, 12.5, 3], EYE),
    decal("nose", [0, -6, 16.8], [0, 0, 0], [1.2, 1.2, 2], ["a"]),
  ];
}

const pp = (pos: Vec3, rot: Vec3 = [0, 0, 0]): PartPose => ({ pos, rot });

function walkPoses(): Model["poses"] {
  const walk1 = {
    body: pp([0, 1.5, 1], [8, 0, 0]),
    footR: pp([0, 2.5, 6]),
    footL: pp([0, 1, -5]),
    handL: pp([1, 2, 4]),
    handR: pp([-1, 2, -4]),
  };
  const walk2 = {
    body: pp([0, -1, 0]),
    footR: pp([0, 0, 2]),
    footL: pp([0, 2.5, -2]),
    handL: pp([-1.5, 0.5, 0]),
    handR: pp([1.5, 0.5, 0]),
  };
  return { stand: {}, walk1, walk2, walk3: mirrorPose(walk1), walk4: mirrorPose(walk2) };
}

export function defaultModel(): Model {
  return {
    version: 1,
    pitch: 30,
    yaw: [180, 70, 0, -70],
    light: [-0.5, 0.8, 0.6],
    outline: 1,
    edge: 3,
    palette: [
      [51, 102, 204], [0, 0, 0], [153, 153, 170], [204, 204, 221], [255, 255, 255],
      [255, 238, 136], [238, 153, 34], [221, 85, 17], [136, 34, 0],
      [255, 204, 170], [221, 136, 102], [34, 153, 136], [221, 34, 68],
      [136, 0, 51], [170, 204, 68], [102, 136, 34],
    ],
    parts: [
      part("body", null, [0, -12, 1], [9, 7, 8], [3, 4]),
      part("scarf", "body", [0, 4, 6], [9, 3, 5], [15, 14]),
      strand("scarfTail", "body", [5, 2, -6], aim([0.4, -0.6, -0.7]), [4, 12, 1.5], [15, 14]),
      part("head", "body", [0, 11, -1], [18, 16, 17], [10, 9]),
      ...kiriHair(),
      ...eyes(),
      part("handL", null, [-17, -11, 10], [4.5, 4.5, 4.5], [10, 9]),
      part("handR", null, [17, -11, 10], [4.5, 4.5, 4.5], [10, 9]),
      part("footL", null, [-8, -16, 4], [5, 5, 7], [6, 5]),
      part("footR", null, [8, -16, 4], [5, 5, 7], [6, 5]),
    ],
    poses: walkPoses(),
  };
}

const isVec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));

export function parseModel(json: unknown): Model | null {
  const m = json as Partial<Model> | null;
  if (!m || m.version !== 1 || typeof m.pitch !== "number" || !isVec(m.light) || !Array.isArray(m.parts) || !Array.isArray(m.palette)) return null;
  const yaw = Array.isArray(m.yaw) && m.yaw.length === 4 && m.yaw.every((n) => typeof n === "number") ? m.yaw : [180, 65, 0, -65];
  if (typeof m.outline !== "number" || typeof m.edge !== "number" || m.palette.length !== 16) return null;
  const ids = new Set<string>();
  for (const p of m.parts) {
    if (!p || typeof p.id !== "string" || ids.has(p.id) || !isVec(p.pos) || !isVec(p.rot) || !isVec(p.size) || !Array.isArray(p.ramp) || p.ramp.length === 0) return null;
    if (p.shape !== undefined && !(p.shape in SHAPES)) return null;
    if (p.grad !== undefined && typeof p.grad !== "number") return null;
    if (p.line !== undefined && typeof p.line !== "boolean") return null;
    if (p.image !== undefined && (!Array.isArray(p.image) || p.image.length === 0 || !p.image.every((r) => typeof r === "string" && r.length === p.image![0].length && /^[0-9a-f.]+$/.test(r)))) return null;
    ids.add(p.id);
  }
  for (const p of m.parts) if (p.parent !== null && !ids.has(p.parent)) return null;
  const poses: Model["poses"] = {};
  for (const name of POSES) poses[name] = m.poses?.[name] ?? {};
  return { ...(m as Model), yaw, poses };
}

const num = (n: number) => String(Math.round(n * 100) / 100);
const vec = (v: number[]) => `[${v.map(num).join(", ")}]`;

export function formatModel(m: Model): string {
  const parts = m.parts.map(
    (p) => `  {"id": ${JSON.stringify(p.id)}, "parent": ${JSON.stringify(p.parent)}, "pos": ${vec(p.pos)}, "rot": ${vec(p.rot)}, "size": ${vec(p.size)}, "ramp": [${p.ramp.join(", ")}]${p.shape && p.shape !== "ellipsoid" ? `, "shape": "${p.shape}"` : ""}${p.grad ? `, "grad": ${num(p.grad)}` : ""}${p.line ? `, "line": true` : ""}${p.image ? `, "image": ${JSON.stringify(p.image)}` : ""}}`,
  );
  const poses = POSES.map((name) => {
    const entries = Object.entries(m.poses[name] ?? {})
      .filter(([, v]) => v.pos.some((n) => n !== 0) || v.rot.some((n) => n !== 0))
      .map(([id, v]) => `   ${JSON.stringify(id)}: {"pos": ${vec(v.pos)}, "rot": ${vec(v.rot)}}`);
    return entries.length ? `  ${JSON.stringify(name)}: {\n${entries.join(",\n")}\n  }` : `  ${JSON.stringify(name)}: {}`;
  });
  return [
    "{",
    ` "version": 1,`,
    ` "pitch": ${num(m.pitch)},`,
    ` "yaw": [${m.yaw.map(num).join(", ")}],`,
    ` "light": ${vec(m.light)},`,
    ` "outline": ${m.outline},`,
    ` "edge": ${num(m.edge)},`,
    ` "palette": [${m.palette.map((c) => `[${c.join(", ")}]`).join(", ")}],`,
    ` "parts": [\n${parts.join(",\n")}\n ],`,
    ` "poses": {\n${poses.join(",\n")}\n }`,
    "}",
    "",
  ].join("\n");
}

export type Mat3 = number[];

const rad = (d: number) => (d * Math.PI) / 180;

export function rotation(r: Vec3): Mat3 {
  const [x, y, z] = r.map(rad);
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  const X = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const Y = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mul(Y, mul(X, Z));
}

export function mul(a: Mat3, b: Mat3): Mat3 {
  const o = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return o;
}

export const apply = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

export const applyT = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
  m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
  m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
];

export interface Placed {
  part: Part;
  index: number;
  center: Vec3;
  rot: Mat3;
}

export function place(m: Model, pose: string | null, yaw: number): Placed[] {
  const byId = new Map(m.parts.map((p, i) => [p.id, i]));
  const done = new Map<string, Placed>();
  const root: Placed = { part: m.parts[0], index: -1, center: [0, 0, 0], rot: rotation([0, yaw, 0]) };
  const overrides = pose ? (m.poses[pose] ?? {}) : {};
  const visit = (p: Part, depth: number): Placed => {
    const hit = done.get(p.id);
    if (hit) return hit;
    const parent = p.parent && depth < 32 ? visit(m.parts[byId.get(p.parent)!], depth + 1) : root;
    const o = overrides[p.id];
    const pos: Vec3 = o ? [p.pos[0] + o.pos[0], p.pos[1] + o.pos[1], p.pos[2] + o.pos[2]] : p.pos;
    const rot: Vec3 = o ? [p.rot[0] + o.rot[0], p.rot[1] + o.rot[1], p.rot[2] + o.rot[2]] : p.rot;
    const c = apply(parent.rot, pos);
    const placed: Placed = {
      part: p,
      index: byId.get(p.id)!,
      center: [parent.center[0] + c[0], parent.center[1] + c[1], parent.center[2] + c[2]],
      rot: mul(parent.rot, rotation(rot)),
    };
    done.set(p.id, placed);
    return placed;
  };
  return m.parts.map((p) => visit(p, 0));
}

export function parentFrame(m: Model, pose: string | null, yaw: number, id: string): Mat3 {
  const p = m.parts.find((q) => q.id === id);
  if (!p || p.parent === null) return rotation([0, yaw, 0]);
  return place(m, pose, yaw).find((q) => q.part.id === p.parent)!.rot;
}

export function mirrorId(id: string): string {
  if (id.endsWith("L")) return id.slice(0, -1) + "R";
  if (id.endsWith("R")) return id.slice(0, -1) + "L";
  return id;
}

export function mirrorPose(src: Record<string, PartPose>): Record<string, PartPose> {
  const out: Record<string, PartPose> = {};
  for (const [id, v] of Object.entries(src)) {
    out[mirrorId(id)] = { pos: [-v.pos[0], v.pos[1], v.pos[2]], rot: [v.rot[0], -v.rot[1], -v.rot[2]] };
  }
  return out;
}
