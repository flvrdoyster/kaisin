import { GAME_TABLES } from "../../data/gameTables.ts";
import { decodeIndexedPng, encodeIndexedPng, type IndexedImage } from "../../data/image.ts";
import {
  POSES, POSE_LABELS, SHAPES, SOLIDS, apply, applyT, defaultModel, formatModel, mirrorPose, parentFrame, parseModel, place, rotation, walkJobs,
  type CellJob, type Model, type Part, type PartPose, type PoseName, type Shape, type Vec3,
} from "./model.ts";
import { colorize, project, rasterize, view, type Cam } from "./raster.ts";

const MODEL_URL = "assets/characters/kiri-model.json";
const DIRS = ["위", "오른쪽", "아래", "왼쪽"];
const ZOOM = 7;
const VIEW = 432;
const STRIP = 2;
const ANIM = 3;
const ANIM_MS = 120;

const CSS = `
body.poser { display: grid; grid-template-columns: auto 340px; gap: 12px; align-items: start; justify-content: start; padding: 12px; box-sizing: border-box; height: auto; min-height: 100%; user-select: none; touch-action: auto; overflow: auto; font-size: 13px; }
.poser canvas { image-rendering: pixelated; width: auto; aspect-ratio: auto; background: #222; display: block; }
.poser .views { display: flex; flex-direction: column; gap: 8px; }
.poser .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
.poser .panel { display: flex; flex-direction: column; gap: 8px; }
.poser fieldset { border: 1px solid #444; border-radius: 6px; padding: 6px 8px; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.poser legend { color: #aaa; padding: 0 4px; }
.poser label { display: flex; gap: 4px; align-items: center; }
.poser input[type=number] { width: 58px; background: #111; color: #ddd; border: 1px solid #555; }
.poser input[type=text], .poser select { background: #111; color: #ddd; border: 1px solid #555; }
.poser button { background: #333; color: #ddd; border: 1px solid #666; border-radius: 4px; padding: 2px 8px; cursor: pointer; }
.poser button.on { background: #6a5acd; border-color: #a99cff; }
.poser .btns { display: flex; flex-wrap: wrap; gap: 4px; }
.poser .swatches { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; }
.poser .swatches input { width: 100%; height: 22px; padding: 0; border: 1px solid #555; background: none; }
.poser .help { color: #888; line-height: 1.5; }
.poser .status { color: #9c9; min-height: 1.4em; }
.poser .status.dirty { color: #fc6; }
`;

type Mode = "model" | PoseName;

// 화면 하나(확대 뷰·자유 시점)의 시점과 월드→화면 좌표 변환.
interface ViewSpec {
  cam: Cam;
  scale: number;
  at(p: Vec3): [number, number];
}

// 선택 부위의 손잡이: 이동 화살표(캐릭터 기준 X·Y·Z)와 크기 손잡이(부위 지역 축).
interface Handle {
  kind: "move" | "size";
  axis: number;
  point: Vec3;
  dir: Vec3;
  factor: number;
}

const AXIS_COLORS = ["#ff5a5a", "#5adc5a", "#5a9cff"];
const ARROW = 12;
const GRAB = 7;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
}

class Poser {
  private model: Model;
  private mode: Mode = "model";
  private dir = 2;
  private sel = 0;
  private overlay = false;
  private hires = true;
  private history: string[] = [];
  private dirty = false;
  private drag: { x: number; y: number; kind: "move" | "depth" | "rotate"; base: string } | null = null;
  private cells = new Map<string, ImageData>();
  private readonly rects = Int32Array.from(GAME_TABLES.rectSMASH);
  private readonly offsets = Int32Array.from(GAME_TABLES.poses);
  private readonly anim = Int32Array.from(GAME_TABLES.playerAnim);
  private readonly jobs: CellJob[];
  private readonly main = el("canvas", { width: VIEW, height: VIEW });
  private readonly strip = el("canvas");
  private readonly animView = el("canvas");
  private readonly free = el("canvas", { width: VIEW, height: VIEW, title: "자유 시점: 드래그로 돌리기 · 휠 확대 · 더블클릭 게임 시점" });
  private freeCam: Cam | null = null;
  private freeZoom = 5;
  private orbit: { x: number; y: number; moved: boolean } | null = null;
  private grab: { spec: ViewSpec; canvas: HTMLCanvasElement; handle: Handle; x: number; y: number; base: string } | null = null;
  private readonly panel = el("div", { className: "panel" });
  private readonly status = el("div", { className: "status" });

  constructor(model: Model, private readonly smash: IndexedImage) {
    this.model = model;
    this.jobs = walkJobs(this.anim);
    this.strip.width = POSES.length * 48 * STRIP;
    this.strip.height = 4 * 48 * STRIP;
    this.animView.width = 2 * 48 * ANIM;
    this.animView.height = 2 * 48 * ANIM;
    document.body.className = "poser";
    document.body.replaceChildren(
      el("style", { textContent: CSS }),
      el("div", { className: "views" }, el("div", { className: "row" }, this.main, this.free, this.animView), this.strip),
      this.panel,
    );
    this.main.addEventListener("pointerdown", (e) => this.down(e));
    this.free.addEventListener("pointerdown", (e) => this.freeDown(e));
    this.free.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.freeZoom = Math.max(2, Math.min(14, this.freeZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      this.drawFree();
    }, { passive: false });
    this.free.addEventListener("dblclick", () => {
      this.freeCam = null;
      this.drawFree();
    });
    this.free.addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("pointermove", (e) => this.moveDrag(e));
    addEventListener("pointerup", (e) => this.endDrag(e));
    this.main.addEventListener("contextmenu", (e) => e.preventDefault());
    this.main.addEventListener("wheel", (e) => this.wheel(e), { passive: false });
    this.strip.addEventListener("pointerdown", (e) => this.pickStrip(e));
    addEventListener("keydown", (e) => this.key(e));
    addEventListener("beforeunload", (e) => {
      if (this.dirty) e.preventDefault();
    });
    this.buildPanel();
    this.refresh();
    const tick = () => {
      this.drawAnim();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private get part(): Part {
    return this.model.parts[Math.min(this.sel, this.model.parts.length - 1)];
  }

  private poseName(): PoseName | null {
    return this.mode === "model" ? null : this.mode;
  }

  private jobFor(pose: PoseName, dir: number) {
    return this.jobs.find((j) => j.pose === pose && j.dir === dir)!;
  }

  private center(cell: number): [number, number] {
    return [24 - this.offsets[cell * 4], 24 - this.offsets[cell * 4 + 1]];
  }

  private size(cell: number): [number, number] {
    const r = this.rects.subarray(cell * 4, cell * 4 + 4);
    return [r[2] - r[0], r[3] - r[1]];
  }

  private snapshot() {
    this.history.push(formatModel(this.model));
    if (this.history.length > 200) this.history.shift();
  }

  private changed() {
    this.dirty = true;
    this.cells.clear();
    this.refresh();
  }

  private undo() {
    const prev = this.history.pop();
    const m = prev ? parseModel(JSON.parse(prev)) : null;
    if (!m) return;
    this.model = m;
    this.changed();
  }

  private poseOf(id: string): PartPose {
    const name = this.poseName()!;
    const pose = (this.model.poses[name] ??= {});
    return (pose[id] ??= { pos: [0, 0, 0], rot: [0, 0, 0] });
  }

  private target(): { pos: Vec3; rot: Vec3 } {
    return this.mode === "model" ? this.part : this.poseOf(this.part.id);
  }

  private rgba(index: number): [number, number, number, number] {
    const c = this.model.palette[index] ?? [255, 0, 255];
    return [c[0], c[1], c[2], index === 0 ? 0 : 255];
  }

  private cellImage(pose: PoseName | null, dir: number): ImageData {
    const key = `${pose}:${dir}`;
    const hit = this.cells.get(key);
    if (hit) return hit;
    const cell = this.jobFor(pose ?? "stand", dir).cell;
    const [w, h] = this.size(cell);
    const [cx, cy] = this.center(cell);
    const px = colorize(this.model, rasterize(this.model, pose, dir, w, h, cx, cy));
    const img = new ImageData(w, h);
    for (let i = 0; i < px.length; i++) img.data.set(this.rgba(px[i]), i * 4);
    this.cells.set(key, img);
    return img;
  }

  private smashImage(cell: number): ImageData {
    const r = this.rects.subarray(cell * 4, cell * 4 + 4);
    const img = new ImageData(r[2] - r[0], r[3] - r[1]);
    for (let y = r[1]; y < r[3]; y++) {
      for (let x = r[0]; x < r[2]; x++) {
        const v = this.smash.pixels[y * this.smash.width + x];
        const c = this.smash.palette[v];
        img.data.set([c[0], c[1], c[2], v === 0 ? 0 : 255], ((y - r[1]) * img.width + x - r[0]) * 4);
      }
    }
    return img;
  }

  private blit(ctx: CanvasRenderingContext2D, img: ImageData, x: number, y: number, scale: number, alpha = 1) {
    const c = el("canvas", { width: img.width, height: img.height });
    c.getContext("2d")!.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, x, y, img.width * scale, img.height * scale);
    ctx.restore();
  }

  private mainOrigin(): { cell: number; ox: number; oy: number; cx: number; cy: number } {
    const cell = this.jobFor(this.poseName() ?? "stand", this.dir).cell;
    const [w, h] = this.size(cell);
    const [cx, cy] = this.center(cell);
    return { cell, ox: (VIEW - w * ZOOM) / 2, oy: (VIEW - h * ZOOM) / 2, cx, cy };
  }

  private drawMain() {
    const ctx = this.main.getContext("2d")!;
    ctx.clearRect(0, 0, VIEW, VIEW);
    const { cell, ox, oy, cx, cy } = this.mainOrigin();
    const [w, h] = this.size(cell);
    ctx.fillStyle = "#2c2c34";
    ctx.fillRect(ox, oy, w * ZOOM, h * ZOOM);
    const pose = this.poseName();
    if (this.hires) {
      const f = rasterize(this.model, pose, this.dir, VIEW, VIEW, ox / ZOOM + cx, oy / ZOOM + cy, ZOOM);
      const px = colorize(this.model, f, false);
      const img = new ImageData(VIEW, VIEW);
      for (let i = 0; i < px.length; i++) {
        const c = this.rgba(px[i]);
        if (f.part[i] === this.sel) [0, 1, 2].forEach((k) => (c[k] = Math.round(c[k] * 0.55 + [255, 0, 255][k] * 0.45)));
        img.data.set(c, i * 4);
      }
      this.blit(ctx, img, 0, 0, 1);
    } else {
      this.blit(ctx, this.cellImage(pose, this.dir), ox, oy, ZOOM);
    }
    if (this.overlay) this.blit(ctx, this.smashImage(cell), ox, oy, ZOOM, 0.45);
    ctx.strokeStyle = "#555";
    ctx.strokeRect(ox - 0.5, oy - 0.5, w * ZOOM + 1, h * ZOOM + 1);
    ctx.fillStyle = "#ff0";
    ctx.fillRect(ox + cx * ZOOM - 1, oy + cy * ZOOM - 1, 3, 3);
    this.drawHandles(ctx, this.mainSpec());
    ctx.fillStyle = "#ccc";
    ctx.font = "12px system-ui";
    const label = this.mode === "model" ? "모델(기본 자세)" : POSE_LABELS[this.mode];
    ctx.fillText(`${label} · ${DIRS[this.dir]} · 칸 ${cell} · 선택 ${this.part.id}`, 8, 16);
  }

  private mainSpec(): ViewSpec {
    const { ox, oy, cx, cy } = this.mainOrigin();
    const cam = { pitch: this.model.pitch, yaw: this.model.yaw[this.dir] };
    return {
      cam,
      scale: ZOOM,
      at: (p) => {
        const s = project(cam.pitch, p);
        return [ox + (s[0] + cx) * ZOOM, oy + (s[1] + cy) * ZOOM];
      },
    };
  }

  private freeSpec(): ViewSpec {
    const cam = this.freeCam ?? { pitch: this.model.pitch, yaw: this.model.yaw[this.dir] };
    const z = this.freeZoom;
    return {
      cam,
      scale: z,
      at: (p) => {
        const s = project(cam.pitch, p);
        return [VIEW / 2 + s[0] * z, VIEW / 2 + s[1] * z];
      },
    };
  }

  // 자유 시점: 게임 시점과 같은 부위 모양을 아무 각도에서나 본다(외곽선 없이 고해상도).
  private drawFree() {
    const ctx = this.free.getContext("2d")!;
    const spec = this.freeSpec();
    const z = spec.scale;
    const f = rasterize(this.model, this.poseName(), this.dir, VIEW, VIEW, VIEW / 2 / z, VIEW / 2 / z, z, spec.cam);
    const px = colorize(this.model, f, false);
    const img = new ImageData(VIEW, VIEW);
    for (let i = 0; i < px.length; i++) {
      const c = this.rgba(px[i]);
      if (f.part[i] === this.sel) [0, 1, 2].forEach((k) => (c[k] = Math.round(c[k] * 0.55 + [255, 0, 255][k] * 0.45)));
      if (f.part[i] < 0) c.splice(0, 4, 36, 36, 44, 255);
      img.data.set(c, i * 4);
    }
    ctx.putImageData(img, 0, 0);
    this.drawHandles(ctx, spec);
    ctx.fillStyle = "#ccc";
    ctx.font = "12px system-ui";
    const tag = this.freeCam ? `자유 시점 · 기울기 ${Math.round(spec.cam.pitch)}° · 회전 ${Math.round(spec.cam.yaw)}°` : "자유 시점 (게임 시점과 같음)";
    ctx.fillText(`${tag} · 드래그 돌리기 · 휠 확대 · 더블클릭 되돌리기`, 8, 16);
  }

  private handles(cam: Cam): Handle[] {
    const pl = place(this.model, this.poseName(), cam.yaw).find((q) => q.index === this.sel);
    if (!pl) return [];
    const c = pl.center;
    const add = (v: Vec3, k: number): Vec3 => [c[0] + v[0] * k, c[1] + v[1] * k, c[2] + v[2] * k];
    const rootRot = rotation([0, cam.yaw, 0]);
    const out: Handle[] = [0, 1, 2].map((i) => {
      const a = apply(rootRot, [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0]);
      return { kind: "move", axis: i, point: add(a, ARROW), dir: a, factor: 1 };
    });
    if (this.mode !== "model") return out;
    const s = pl.part.size;
    const ax = (i: number, sign = 1) => apply(pl.rot, [i === 0 ? sign : 0, i === 1 ? sign : 0, i === 2 ? sign : 0]);
    if (pl.part.shape === "strand") {
      out.push({ kind: "size", axis: 0, point: add(ax(0), s[0]), dir: ax(0), factor: 1 });
      out.push({ kind: "size", axis: 1, point: add(ax(1, -1), s[1]), dir: ax(1, -1), factor: 1 });
      const tip = add(ax(1, -1), s[1]);
      const r = ax(0);
      out.push({ kind: "size", axis: 2, point: [tip[0] + r[0] * s[2], tip[1] + r[1] * s[2], tip[2] + r[2] * s[2]], dir: r, factor: 1 });
    } else if (pl.part.shape === "decal") {
      out.push({ kind: "size", axis: 0, point: add(ax(0), s[0] / 2), dir: ax(0), factor: 2 });
      out.push({ kind: "size", axis: 1, point: add(ax(1), s[1] / 2), dir: ax(1), factor: 2 });
    } else {
      for (const i of [0, 1, 2]) out.push({ kind: "size", axis: i, point: add(ax(i), s[i]), dir: ax(i), factor: 1 });
    }
    return out;
  }

  private drawHandles(ctx: CanvasRenderingContext2D, spec: ViewSpec) {
    const pl = place(this.model, this.poseName(), spec.cam.yaw).find((q) => q.index === this.sel);
    if (!pl) return;
    const [cx, cy] = spec.at(pl.center);
    ctx.save();
    ctx.lineWidth = 2;
    for (const h of this.handles(spec.cam)) {
      const [x, y] = spec.at(h.point);
      ctx.strokeStyle = ctx.fillStyle = AXIS_COLORS[h.axis];
      if (h.kind === "move") {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 4.5, y - 4.5, 9, 9);
        ctx.lineWidth = 2;
      }
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.restore();
  }

  private canvasPoint(canvas: HTMLCanvasElement, e: PointerEvent | MouseEvent): [number, number] {
    const b = canvas.getBoundingClientRect();
    return [((e.clientX - b.left) * canvas.width) / b.width, ((e.clientY - b.top) * canvas.height) / b.height];
  }

  private hitHandle(canvas: HTMLCanvasElement, spec: ViewSpec, e: PointerEvent): Handle | null {
    const [mx, my] = this.canvasPoint(canvas, e);
    let best: Handle | null = null;
    let bestD = GRAB;
    for (const h of this.handles(spec.cam)) {
      const [x, y] = spec.at(h.point);
      const dist = Math.hypot(x - mx, y - my);
      if (dist <= bestD) {
        best = h;
        bestD = dist;
      }
    }
    return best;
  }

  private startGrab(canvas: HTMLCanvasElement, spec: ViewSpec, e: PointerEvent): boolean {
    if (e.button !== 0) return false;
    const handle = this.hitHandle(canvas, spec, e);
    if (!handle) return false;
    const [x, y] = this.canvasPoint(canvas, e);
    this.grab = { spec, canvas, handle, x, y, base: formatModel(this.model) };
    return true;
  }

  // 손잡이 끌기: 마우스 이동을 손잡이 축의 화면 방향에 투영해 월드 길이로 바꾼다.
  private moveGrab(e: PointerEvent) {
    const g = this.grab!;
    const [mx, my] = this.canvasPoint(g.canvas, e);
    const [ax, ay] = g.spec.at([0, 0, 0]);
    const [bx, by] = g.spec.at(g.handle.dir);
    const sx = bx - ax, sy = by - ay;
    const len2 = sx * sx + sy * sy;
    if (len2 < 1e-6) return;
    const t = ((mx - g.x) * sx + (my - g.y) * sy) / len2;
    if (Math.abs(t) < 0.05) return;
    if (g.base) {
      this.history.push(g.base);
      g.base = "";
    }
    g.x = mx;
    g.y = my;
    if (g.handle.kind === "move") {
      const d = g.handle.dir;
      const local = applyT(parentFrame(this.model, this.poseName(), g.spec.cam.yaw, this.part.id), [d[0] * t, d[1] * t, d[2] * t]);
      const target = this.target();
      for (let i = 0; i < 3; i++) target.pos[i] += local[i];
    } else {
      const s = this.part.size;
      s[g.handle.axis] = Math.max(0.5, s[g.handle.axis] + t * g.handle.factor);
    }
    this.changed();
  }

  private freeDown(e: PointerEvent) {
    if (this.startGrab(this.free, this.freeSpec(), e)) return;
    this.orbit = { x: e.clientX, y: e.clientY, moved: false };
  }

  private freePick(e: PointerEvent) {
    const spec = this.freeSpec();
    const [mx, my] = this.canvasPoint(this.free, e);
    const sx = (mx - VIEW / 2) / spec.scale;
    const sy = (my - VIEW / 2) / spec.scale;
    const p = rasterize(this.model, this.poseName(), this.dir, 1, 1, 0.5 - sx, 0.5 - sy, 1, spec.cam).part[0];
    if (p >= 0) {
      this.sel = p;
      this.refresh();
    }
  }

  private drawStrip() {
    const ctx = this.strip.getContext("2d")!;
    ctx.clearRect(0, 0, this.strip.width, this.strip.height);
    const S = 48 * STRIP;
    POSES.forEach((pose, col) => {
      for (let dir = 0; dir < 4; dir++) {
        const x = col * S;
        const y = dir * S;
        ctx.fillStyle = "#2c2c34";
        ctx.fillRect(x + 1, y + 1, S - 2, S - 2);
        this.blit(ctx, this.cellImage(pose, dir), x, y, STRIP);
        if (pose === this.mode && dir === this.dir) {
          ctx.strokeStyle = "#a99cff";
          ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
        }
      }
    });
  }

  private drawAnim() {
    const ctx = this.animView.getContext("2d")!;
    ctx.clearRect(0, 0, this.animView.width, this.animView.height);
    const k = Math.floor(performance.now() / ANIM_MS) % 16;
    for (let dir = 0; dir < 4; dir++) {
      const cell = this.anim[dir * 16 + k];
      const job = this.jobs.find((j) => j.cell === cell);
      if (!job) continue;
      const x = (dir % 2) * 48 * ANIM;
      const y = Math.floor(dir / 2) * 48 * ANIM;
      ctx.fillStyle = "#2c2c34";
      ctx.fillRect(x + 1, y + 1, 48 * ANIM - 2, 48 * ANIM - 2);
      this.blit(ctx, this.cellImage(job.pose, dir), x, y, ANIM);
    }
  }

  private refresh() {
    this.drawMain();
    this.drawFree();
    this.drawStrip();
    this.syncPanel();
    this.status.textContent = this.dirty ? "저장 안 됨 (Ctrl+S)" : this.status.textContent || "";
    this.status.classList.toggle("dirty", this.dirty);
  }

  private screenDelta(dx: number, dy: number, kind: "move" | "depth"): Vec3 {
    const { up, d } = view(this.model.pitch);
    if (kind === "depth") return [d[0] * dy, d[1] * dy, d[2] * dy];
    return [dx, -dy * up[1], -dy * up[2]];
  }

  private pick(e: PointerEvent): number {
    const { ox, oy, cx, cy } = this.mainOrigin();
    const b = this.main.getBoundingClientRect();
    const mx = ((e.clientX - b.left) * VIEW) / b.width;
    const my = ((e.clientY - b.top) * VIEW) / b.height;
    const sx = (mx - ox) / ZOOM - cx;
    const sy = (my - oy) / ZOOM - cy;
    const f = rasterize(this.model, this.poseName(), this.dir, 1, 1, 0.5 - sx, 0.5 - sy);
    return f.part[0];
  }

  private down(e: PointerEvent) {
    if (this.startGrab(this.main, this.mainSpec(), e)) return;
    const p = this.pick(e);
    if (p >= 0 && !e.shiftKey && e.button === 0) this.sel = p;
    const kind = e.button === 2 || e.altKey ? "rotate" : e.shiftKey ? "depth" : "move";
    this.drag = { x: e.clientX, y: e.clientY, kind, base: formatModel(this.model) };
    this.refresh();
  }

  private moveDrag(e: PointerEvent) {
    if (this.grab) return this.moveGrab(e);
    if (this.orbit) {
      const dx = e.clientX - this.orbit.x;
      const dy = e.clientY - this.orbit.y;
      if (!this.orbit.moved && Math.hypot(dx, dy) < 3) return;
      this.orbit.moved = true;
      this.orbit.x = e.clientX;
      this.orbit.y = e.clientY;
      const cam = this.freeCam ?? { pitch: this.model.pitch, yaw: this.model.yaw[this.dir] };
      this.freeCam = { yaw: cam.yaw + dx * 0.6, pitch: Math.max(-85, Math.min(89, cam.pitch + dy * 0.5)) };
      this.drawFree();
      return;
    }
    if (!this.drag) return;
    const b = this.main.getBoundingClientRect();
    const k = VIEW / b.width / ZOOM;
    const dx = (e.clientX - this.drag.x) * k;
    const dy = (e.clientY - this.drag.y) * k;
    if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) return;
    if (this.drag.base) {
      this.history.push(this.drag.base);
      this.drag.base = "";
    }
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    const t = this.target();
    if (this.drag.kind === "rotate") {
      t.rot[1] += dx * 6;
      t.rot[0] += dy * 6;
    } else {
      const world = this.screenDelta(dx, dy, this.drag.kind);
      const local = applyT(parentFrame(this.model, this.poseName(), this.model.yaw[this.dir], this.part.id), world);
      for (let i = 0; i < 3; i++) t.pos[i] += local[i];
    }
    this.changed();
  }

  private endDrag(e: PointerEvent) {
    if (this.grab) {
      this.grab = null;
      this.roundTarget();
      this.part.size = this.part.size.map((v) => Math.round(v * 2) / 2) as Vec3;
      this.refresh();
      return;
    }
    if (this.orbit) {
      const clicked = !this.orbit.moved;
      this.orbit = null;
      if (clicked && e.button === 0) this.freePick(e);
      return;
    }
    if (!this.drag) return;
    this.drag = null;
    this.roundTarget();
    this.refresh();
  }

  private roundTarget() {
    const t = this.target();
    for (let i = 0; i < 3; i++) {
      t.pos[i] = Math.round(t.pos[i] * 2) / 2;
      t.rot[i] = Math.round(t.rot[i]);
    }
  }

  private wheel(e: WheelEvent) {
    if (this.mode !== "model") return;
    e.preventDefault();
    this.snapshot();
    const k = e.deltaY < 0 ? 1.05 : 1 / 1.05;
    this.part.size = this.part.size.map((v) => Math.max(0.5, Math.round(v * k * 2) / 2)) as Vec3;
    this.changed();
  }

  private pickStrip(e: PointerEvent) {
    const b = this.strip.getBoundingClientRect();
    const S = (48 * STRIP * b.width) / this.strip.width;
    const col = Math.floor((e.clientX - b.left) / S);
    const row = Math.floor((e.clientY - b.top) / S);
    if (col < 0 || col >= POSES.length || row < 0 || row > 3) return;
    this.mode = POSES[col];
    this.dir = row;
    this.refresh();
  }

  private key(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void this.save();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      if (tag === "INPUT") return;
      e.preventDefault();
      this.undo();
      return;
    }
    if (tag === "INPUT" || tag === "SELECT") return;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const a = arrows[e.key];
    if (a) {
      e.preventDefault();
      this.snapshot();
      const t = this.target();
      const step = e.shiftKey ? 4 : 1;
      if (e.altKey) {
        t.rot[1] += a[0] * step * 5;
        t.rot[0] += a[1] * step * 5;
      } else {
        const local = applyT(parentFrame(this.model, this.poseName(), this.model.yaw[this.dir], this.part.id), this.screenDelta(a[0] * step, a[1] * step, "move"));
        for (let i = 0; i < 3; i++) t.pos[i] = Math.round((t.pos[i] + local[i]) * 2) / 2;
      }
      this.changed();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "o") this.overlay = !this.overlay;
    else if (k === "h") this.hires = !this.hires;
    else if (k === "q") this.dir = (this.dir + 3) % 4;
    else if (k === "w") this.dir = (this.dir + 1) % 4;
    else if (k === "tab") {
      e.preventDefault();
      this.sel = (this.sel + (e.shiftKey ? this.model.parts.length - 1 : 1)) % this.model.parts.length;
    } else if (k === "m") {
      this.mode = "model";
    } else if (/^[1-5]$/.test(k)) {
      this.mode = POSES[Number(k) - 1];
    } else return;
    this.refresh();
  }

  private async save() {
    const json = formatModel(this.model);
    const res = await fetch(`/dev/characters/kiri-model.json`, { method: "PUT", body: json });
    if (!res.ok) {
      this.status.textContent = "모델 저장 실패";
      return;
    }
    const W = 640;
    const H = 272;
    const pixels = new Uint8Array(W * H);
    for (const job of this.jobs) {
      const r = this.rects.subarray(job.cell * 4, job.cell * 4 + 4);
      const [w, h] = [r[2] - r[0], r[3] - r[1]];
      const [cx, cy] = this.center(job.cell);
      const px = colorize(this.model, rasterize(this.model, job.pose, job.dir, w, h, cx, cy));
      for (let y = 0; y < h; y++) pixels.set(px.subarray(y * w, (y + 1) * w), (r[1] + y) * W + r[0]);
    }
    const png = await encodeIndexedPng({ width: W, height: H, palette: this.model.palette, pixels });
    const res2 = await fetch(`/dev/gfx/KIRI_BASE.png`, { method: "PUT", body: png as BodyInit });
    this.dirty = !res2.ok;
    this.status.textContent = res2.ok ? `저장함 ${new Date().toLocaleTimeString()} (kiri-model.json, KIRI_BASE.png)` : "KIRI_BASE.png 저장 실패";
    this.refresh();
  }

  private inputs = new Map<string, HTMLInputElement>();
  private readers = new Map<string, () => number>();
  private partList = el("select", { size: 10 });
  private parentSel = el("select");
  private shapeSel = el("select");
  private sizeLabel = el("span", { textContent: "크기" });
  private modeSel = el("select");
  private rampInput = el("input", { type: "text" });
  private idInput = el("input", { type: "text" });
  private dirBtns: HTMLButtonElement[] = [];
  private addBtns: HTMLButtonElement[] = [];
  private swatches: HTMLInputElement[] = [];

  private num(key: string, get: () => number, set: (v: number) => void, step = 0.5) {
    const input = el("input", { type: "number", step: String(step) });
    input.addEventListener("change", () => {
      const v = Number(input.value);
      if (!Number.isFinite(v)) return;
      this.snapshot();
      set(v);
      this.changed();
    });
    this.inputs.set(key, input);
    this.readers.set(key, get);
    return input;
  }

  private vecRow(label: string | Node, key: string, get: () => Vec3, step = 0.5) {
    return el(
      "label",
      {},
      label,
      ...[0, 1, 2].map((i) => this.num(`${key}${i}`, () => get()[i], (v) => (get()[i] = v), step)),
    );
  }

  private buildPanel() {
    this.modeSel.append(el("option", { value: "model", textContent: "모델(기본 자세)" }), ...POSES.map((p) => el("option", { value: p, textContent: `포즈: ${POSE_LABELS[p]}` })));
    this.modeSel.addEventListener("change", () => {
      this.mode = this.modeSel.value as Mode;
      this.refresh();
    });
    this.dirBtns = DIRS.map((d, i) => {
      const b = el("button", { textContent: d });
      b.addEventListener("click", () => {
        this.dir = i;
        this.refresh();
      });
      return b;
    });
    this.partList.addEventListener("change", () => {
      this.sel = this.partList.selectedIndex;
      this.refresh();
    });
    this.parentSel.addEventListener("change", () => {
      this.snapshot();
      this.part.parent = this.parentSel.value || null;
      this.changed();
    });
    this.shapeSel.append(...Object.entries(SHAPES).map(([v, t]) => el("option", { value: v, textContent: t })));
    // 도형 추가: 선택 부위의 자식으로 그 앞쪽 표면에 만든다(묻혀서 안 보이지 않도록).
    this.addBtns = (Object.keys(SHAPES) as Shape[]).filter((sh) => sh !== "decal").map((shape) => {
      const b = el("button", { textContent: SHAPES[shape] });
      b.addEventListener("click", () => {
        if (this.mode !== "model") return;
        this.snapshot();
        const parent = this.part;
        let n = 1;
        while (this.model.parts.some((q) => q.id === `${shape}${n}`)) n++;
        const size: Vec3 = shape === "strand" ? [2.5, 8, 0.5] : [4, 4, 4];
        // 색은 부모를 물려받으므로 같은 색 표면에 묻히지 않게 외곽선을 켜 둔다.
        const p: Part = { id: `${shape}${n}`, parent: parent.id, pos: [0, 0, parent.shape === "decal" ? 0 : parent.size[2]], rot: [0, 0, 0], size, ramp: [...parent.ramp], line: true };
        if (shape !== "ellipsoid") p.shape = shape;
        this.model.parts.splice(this.sel + 1, 0, p);
        this.sel++;
        this.changed();
      });
      return b;
    });
    this.shapeSel.addEventListener("change", () => {
      this.snapshot();
      const shape = this.shapeSel.value as Shape;
      if (shape === "strand" && this.part.shape !== "strand") this.part.size = [Math.max(this.part.size[0], 2), this.part.size[1] * 2, 0.5];
      if (shape === "ellipsoid") delete this.part.shape;
      else this.part.shape = shape;
      this.changed();
    });
    this.rampInput.addEventListener("change", () => {
      const ramp = this.rampInput.value.split(/[ ,]+/).filter(Boolean).map(Number);
      if (ramp.length === 0 || ramp.some((n) => !Number.isInteger(n) || n < 1 || n > 15)) return;
      this.snapshot();
      this.part.ramp = ramp;
      this.changed();
    });
    this.idInput.addEventListener("change", () => {
      const id = this.idInput.value.trim();
      if (!id || this.model.parts.some((p) => p.id === id)) return;
      this.snapshot();
      const old = this.part.id;
      for (const p of this.model.parts) if (p.parent === old) p.parent = id;
      for (const pose of Object.values(this.model.poses)) {
        if (pose[old]) {
          pose[id] = pose[old];
          delete pose[old];
        }
      }
      this.part.id = id;
      this.changed();
    });
    const button = (text: string, fn: () => void) => {
      const b = el("button", { textContent: text });
      b.addEventListener("click", fn);
      return b;
    };
    const mirrorFrom = el("select");
    mirrorFrom.append(...POSES.map((p) => el("option", { value: p, textContent: POSE_LABELS[p] })));
    this.swatches = this.model.palette.map((_, i) => {
      const s = el("input", { type: "color", title: String(i) });
      s.addEventListener("change", () => {
        this.snapshot();
        const h = s.value;
        this.model.palette[i] = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)) as [number, number, number];
        this.changed();
      });
      return s;
    });
    const hex = (c: number[]) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
    const syncSwatches = () => this.swatches.forEach((s, i) => (s.value = hex(this.model.palette[i])));
    this.syncExtra = syncSwatches;

    this.panel.append(
      el("fieldset", {}, el("legend", { textContent: "보기" }), this.modeSel, el("div", { className: "btns" }, ...this.dirBtns)),
      el(
        "fieldset",
        {},
        el("legend", { textContent: "부위" }),
        this.partList,
        el("label", {}, "이름", this.idInput),
        el("label", {}, "부모", this.parentSel),
        el("label", {}, "형태", this.shapeSel),
        el("div", { className: "btns" }, el("span", { textContent: "추가" }), ...this.addBtns),
        el(
          "div",
          { className: "btns" },
          button("복제", () => {
            this.snapshot();
            const p = structuredClone(this.part);
            let n = 2;
            while (this.model.parts.some((q) => q.id === `${p.id}${n}`)) n++;
            p.id = `${p.id}${n}`;
            p.pos[0] += 4;
            this.model.parts.splice(this.sel + 1, 0, p);
            this.sel++;
            this.changed();
          }),
          button("삭제", () => {
            if (this.model.parts.length <= 1) return;
            this.snapshot();
            const id = this.part.id;
            const parent = this.part.parent;
            for (const p of this.model.parts) if (p.parent === id) p.parent = parent;
            for (const pose of Object.values(this.model.poses)) delete pose[id];
            this.model.parts.splice(this.sel, 1);
            this.sel = Math.max(0, this.sel - 1);
            this.changed();
          }),
          button("위로", () => this.reorder(-1)),
          button("아래로", () => this.reorder(1)),
        ),
      ),
      el(
        "fieldset",
        {},
        el("legend", { textContent: "선택 부위 값" }),
        this.vecRow("위치", "pos", () => this.target().pos),
        this.vecRow("회전", "rot", () => this.target().rot, 5),
        this.vecRow(this.sizeLabel, "size", () => this.part.size),
        el("label", {}, "색(어둠→밝음)", this.rampInput),
      ),
      el(
        "fieldset",
        {},
        el("legend", { textContent: "포즈" }),
        el(
          "div",
          { className: "btns" },
          button("이 부위 초기화", () => {
            const name = this.poseName();
            if (!name) return;
            this.snapshot();
            delete this.model.poses[name][this.part.id];
            this.changed();
          }),
          button("포즈 전체 초기화", () => {
            const name = this.poseName();
            if (!name) return;
            this.snapshot();
            this.model.poses[name] = {};
            this.changed();
          }),
        ),
        el(
          "label",
          {},
          mirrorFrom,
          button("좌우 반전 복사", () => {
            const name = this.poseName();
            if (!name) return;
            this.snapshot();
            this.model.poses[name] = mirrorPose(structuredClone(this.model.poses[mirrorFrom.value] ?? {}));
            this.changed();
          }),
          button("그대로 복사", () => {
            const name = this.poseName();
            if (!name) return;
            this.snapshot();
            this.model.poses[name] = structuredClone(this.model.poses[mirrorFrom.value] ?? {});
            this.changed();
          }),
        ),
      ),
      el(
        "fieldset",
        {},
        el("legend", { textContent: "카메라·외곽선" }),
        el("label", {}, "기울기", this.num("pitch", () => this.model.pitch, (v) => (this.model.pitch = v), 1)),
        el("label", {}, "방향 회전", ...[0, 1, 2, 3].map((i) => this.num(`yaw${i}`, () => this.model.yaw[i], (v) => (this.model.yaw[i] = v), 5))),
        this.vecRow("빛", "light", () => this.model.light, 0.1),
        el("label", {}, "외곽선 색", this.num("outline", () => this.model.outline, (v) => (this.model.outline = Math.max(0, Math.min(15, Math.round(v)))), 1)),
        el("label", {}, "깊이 차 외곽선", this.num("edge", () => this.model.edge, (v) => (this.model.edge = v), 0.5)),
      ),
      el("fieldset", {}, el("legend", { textContent: "팔레트 (0 = 투명)" }), el("div", { className: "swatches" }, ...this.swatches)),
      el("div", { className: "btns" }, button("저장 (Ctrl+S)", () => void this.save())),
      this.status,
      el("div", {
        className: "help",
        innerHTML: [
          "클릭: 부위 선택 · 드래그: 화면 평면 이동",
          "손잡이: 동그라미 = 이동(빨강 X·초록 Y·파랑 Z, 캐릭터 기준), 네모 = 그 축 크기(모델에서만)",
          "자유 시점: 드래그로 돌리기 · 휠 확대 · 더블클릭 게임 시점 · 손잡이도 끌 수 있음",
          "반구·상자·원기둥·원뿔·캡슐·고리: 크기는 세 축 반 크기",
          "Shift+드래그: 깊이 이동 · 우클릭/Alt+드래그: 회전",
          "방향키: 1px 이동(Shift 4px) · Alt+방향키: 회전",
          "휠: 크기(모델에서만) · Tab: 다음 부위",
          "가닥: 밑 굵기·길이·끝 굵기(반지름), 기본 방향은 아래(-Y)",
          "데칼: 부모 표면에 그림(image)을 지역 +Z 방향으로 투영, 크기는 폭·높이·투영 깊이",
          "M: 모델 · 1~5: 포즈 · Q/W: 방향 · 오른쪽 시트 클릭: 칸 선택",
          "O: 스마슈 겹치기 · H: 고해상도/1배율 · Ctrl+Z: 되돌리기",
          "포즈 값은 모델 기본 자세에 더하는 차이값",
        ].join("<br>"),
      }),
    );
  }

  private syncExtra = () => {};

  private reorder(d: number) {
    const j = this.sel + d;
    if (j < 0 || j >= this.model.parts.length) return;
    this.snapshot();
    const ps = this.model.parts;
    [ps[this.sel], ps[j]] = [ps[j], ps[this.sel]];
    this.sel = j;
    this.changed();
  }

  private syncPanel() {
    this.modeSel.value = this.mode;
    this.dirBtns.forEach((b, i) => b.classList.toggle("on", i === this.dir));
    const ids = this.model.parts.map((p) => p.id);
    if (this.partList.options.length !== ids.length || ids.some((id, i) => this.partList.options[i].text !== id)) {
      this.partList.replaceChildren(...ids.map((id) => el("option", { textContent: id })));
    }
    this.partList.selectedIndex = this.sel;
    this.parentSel.replaceChildren(el("option", { value: "", textContent: "(없음)" }), ...ids.filter((id) => id !== this.part.id).map((id) => el("option", { value: id, textContent: id })));
    this.parentSel.value = this.part.parent ?? "";
    this.shapeSel.value = this.part.shape ?? "ellipsoid";
    this.sizeLabel.textContent =
      this.part.shape === "strand" ? "밑·길이·끝" : this.part.shape === "decal" ? "폭·높이·깊이" : this.part.shape && SOLIDS.has(this.part.shape) ? "반 크기" : "반지름";
    this.addBtns.forEach((b) => (b.disabled = this.mode !== "model"));
    this.idInput.value = this.part.id;
    this.rampInput.value = this.part.ramp.join(", ");
    for (const [key, input] of this.inputs) {
      if (document.activeElement !== input) input.value = String(Math.round(this.readers.get(key)!() * 100) / 100);
    }
    const modelOnly = this.mode === "model";
    for (const i of [0, 1, 2]) this.inputs.get(`size${i}`)!.disabled = !modelOnly;
    this.rampInput.disabled = !modelOnly;
    this.syncExtra();
  }
}

export async function startPoser() {
  const smashRes = await fetch("assets/gfx/SMASH.png");
  const smash = await decodeIndexedPng(new Uint8Array(await smashRes.arrayBuffer()));
  let model = defaultModel();
  try {
    const res = await fetch(MODEL_URL, { cache: "no-store" });
    const m = res.ok ? parseModel(await res.json()) : null;
    if (m) model = m;
  } catch {
    // 모델 파일이 없으면 기본 모델로 시작한다
  }
  new Poser(model, smash);
}
