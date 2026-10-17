import { GAME_TABLES } from "../data/gameTables.ts";
import { KIRI_DEF } from "../data/kiriDef.ts";
import { decodeIndexedPng, type IndexedImage } from "../data/image.ts";
import { CENTER } from "../game/characters.ts";
import { CHARACTER_CELLS } from "./sheetCheck.ts";
import { hasWalkTable, walkCells } from "./walkFromStand.ts";

const WORK = "work/kiri/KIRI_BASE.png";
const FINAL = "assets/gfx/KIRI.png";
const W = 640;
const H = 272;
const ZOOM = 2;
const ANIM_ZOOM = 3;
const FRAME_MS = 160;
const DIRS = ["위", "오른쪽", "아래", "왼쪽"];
const WALK_FRAMES: Record<number, string> = { 0: "정지", 2: "걷기1", 6: "걷기2", 10: "걷기3", 14: "걷기4" };
const ATTACK_FRAMES: Record<number, string> = { 1: "공격1", 2: "공격 잔상", 3: "공격2" };

const CSS = `
html:has(body.sheet), body.sheet { height: auto; touch-action: auto; user-select: auto; -webkit-user-select: auto; }
body.sheet { margin: 0; background: #1b1b1f; color: #ddd; font: 12px sans-serif; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 10px; padding: 12px; box-sizing: border-box; }
.sheet canvas { image-rendering: pixelated; display: block; aspect-ratio: auto; width: auto; height: auto; }
.sheet .row { display: flex; gap: 10px; align-items: flex-start; }
.sheet .side { width: 340px; display: flex; flex-direction: column; gap: 8px; }
.sheet .box { background: #26262c; border: 1px solid #3a3a42; padding: 8px; }
.sheet .title { font-weight: bold; margin-bottom: 4px; }
.sheet .warn { color: #ff8080; }
.sheet .ok { color: #80ff80; }
.sheet label { display: block; margin: 2px 0; }
.sheet select { font: inherit; margin-bottom: 6px; display: block; }
.sheet kbd { background: #3a3a42; padding: 0 4px; border-radius: 3px; }
`;

const rects = Int32Array.from(GAME_TABLES.rectSMASH);
const anim = Int32Array.from(GAME_TABLES.playerAnim);
const characterCells = new Set(CHARACTER_CELLS);
const autoCells = new Map<number, number>();
for (let dir = 0; dir < 4; dir++) {
  if (!hasWalkTable(dir)) continue;
  const [stand, ...walk] = walkCells(dir);
  for (const c of walk) autoCells.set(c, stand);
}

function kiriPoses(): Int32Array {
  const poses = Int32Array.from(GAME_TABLES.poses);
  for (let d = 0; d < 4; d++) {
    const trail = anim[(d + 4) * 16 + 2];
    poses[trail * 4] = KIRI_DEF.dirs[d].trail[0];
    poses[trail * 4 + 1] = KIRI_DEF.dirs[d].trail[1];
  }
  return poses;
}

function cellNames(): Map<number, string> {
  const names = new Map<number, string>([[32, "피격"], [34, "무덤 석상"], [36, "쓰러짐"]]);
  for (let d = 0; d < 4; d++) {
    for (const [k, name] of Object.entries(WALK_FRAMES)) names.set(anim[d * 16 + Number(k)], `${DIRS[d]} ${name}`);
    for (const [k, name] of Object.entries(ATTACK_FRAMES)) if (!names.has(anim[(d + 4) * 16 + Number(k)])) names.set(anim[(d + 4) * 16 + Number(k)], `${DIRS[d]} ${name}`);
    names.set(anim[(d + 8) * 16], `${DIRS[d]} 스매시1`);
    names.set(anim[(d + 8) * 16 + 1], `${DIRS[d]} 스매시2`);
  }
  return names;
}

function rowOf(cell: number): number | null {
  for (let row = 0; row < 12; row++) if (anim.subarray(row * 16, row * 16 + 16).includes(cell)) return row;
  return null;
}

const rowLength = (row: number) => (row >= 4 && row < 8 ? 6 : 16);
const STILLS: [number, string][] = [[32, "피격"], [36, "쓰러짐"], [34, "무덤 석상"]];
const KINDS = ["걷기", "공격", "스매시"];
const rect = (cell: number) => rects.subarray(cell * 4, cell * 4 + 4);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...children);
  return e;
}

class SheetEditor {
  private work: ImageData;
  private readonly poses = kiriPoses();
  private readonly names = cellNames();
  private readonly main = el("canvas", { width: W * ZOOM, height: H * ZOOM });
  private readonly preview = el("canvas", { width: 2 * 96 * ANIM_ZOOM, height: 96 * ANIM_ZOOM });
  private readonly info = el("div");
  private readonly status = el("div");
  private readonly exportLine = el("div");
  private readonly overlay = el("input", { type: "checkbox" });
  private readonly centers = el("input", { type: "checkbox", checked: true });
  private readonly animSelect = el(
    "select",
    {},
    ...KINDS.flatMap((kind, i) => DIRS.map((dir, d) => el("option", { value: `row${i * 4 + d}`, textContent: `${kind} · ${dir}` }))),
    ...STILLS.map(([cell, name]) => el("option", { value: `cell${cell}`, textContent: `${name} (정지 그림)` })),
  );
  private selected = 6;
  private hover: number | null = null;
  private frame = 0;
  private paused = false;
  private dirty = false;
  private seen = -1;
  private ownSave = 0;
  private readonly history: ImageData[] = [];
  private readonly workCanvas = el("canvas", { width: W, height: H });
  private readonly smashCanvas = el("canvas", { width: W, height: H });
  private readonly finalCanvas = el("canvas", { width: W, height: H });
  private finalSeen = -1;

  constructor(work: ImageData, smash: IndexedImage, final: ImageData) {
    this.work = work;
    this.animSelect.value = "row2";
    this.smashCanvas.getContext("2d")!.putImageData(smashImage(smash), 0, 0);
    this.finalCanvas.getContext("2d")!.putImageData(final, 0, 0);
    document.head.append(el("style", { textContent: CSS }));
    document.body.className = "sheet";
    document.body.replaceChildren(
      this.main,
      el(
        "div",
        { className: "row" },
        el("div", { className: "box" }, el("div", { className: "title", textContent: "애니메이션 (왼쪽 키리 최종 파일, 오른쪽 스마슈)" }), this.animSelect, this.preview),
        el(
        "div",
        { className: "side" },
        el("div", { className: "box" }, el("div", { className: "title", textContent: "선택한 칸" }), this.info),
        el(
          "div",
          { className: "box" },
          el("label", {}, this.overlay, " 스마슈 겹쳐 보기 (O)"),
          el("label", {}, this.centers, " 몸 중심 표시 (C)"),
        ),
        el(
          "div",
          { className: "box" },
          el("div", { className: "title", textContent: "조작" }),
          el("div", { innerHTML: "클릭: 칸 선택<br><kbd>방향키</kbd> 칸 그림 1px 이동 (<kbd>Shift</kbd> 4px)<br><kbd>Space</kbd> 애니메이션 정지·재생<br><kbd>Ctrl+Z</kbd> 되돌리기 · <kbd>Ctrl+S</kbd> 저장" }),
        ),
        el("div", { className: "box" }, this.status, this.exportLine),
        ),
      ),
    );
    this.main.addEventListener("mousemove", (e) => {
      this.hover = this.cellAt(e);
      this.draw();
    });
    this.main.addEventListener("mouseleave", () => {
      this.hover = null;
      this.draw();
    });
    this.main.addEventListener("click", (e) => {
      const c = this.cellAt(e);
      if (c !== null) {
        this.selected = c;
        const row = rowOf(c);
        if (row !== null) this.animSelect.value = `row${row}`;
        else if (STILLS.some(([cell]) => cell === c)) this.animSelect.value = `cell${c}`;
        this.frame = 0;
        this.draw();
      }
    });
    this.overlay.addEventListener("change", () => this.draw());
    this.animSelect.addEventListener("change", () => {
      this.frame = 0;
      this.animSelect.blur();
      this.drawPreview();
    });
    this.centers.addEventListener("change", () => this.draw());
    addEventListener("keydown", (e) => this.key(e));
    addEventListener("beforeunload", (e) => {
      if (this.dirty) e.preventDefault();
    });
    setInterval(() => {
      if (!this.paused) this.frame++;
      this.drawPreview();
    }, FRAME_MS);
    setInterval(() => void this.poll(), 1000);
    this.setStatus("");
    this.draw();
  }

  private cellAt(e: MouseEvent): number | null {
    const b = this.main.getBoundingClientRect();
    const x = (e.clientX - b.left) / ZOOM;
    const y = (e.clientY - b.top) / ZOOM;
    let best: number | null = null;
    for (let i = 0; i < rects.length / 4; i++) {
      const [l, t, r, bt] = rect(i);
      if (x >= l && x < r && y >= t && y < bt && (best === null || (r - l) * (bt - t) < this.area(best))) best = i;
    }
    return best;
  }

  private area(cell: number) {
    const [l, t, r, b] = rect(cell);
    return (r - l) * (b - t);
  }

  private label(cell: number) {
    const [l, t, r, b] = rect(cell);
    const kind = characterCells.has(cell) ? this.names.get(cell) ?? "캐릭터" : "공용 (스마슈 시트에서 그림)";
    const auto = autoCells.has(cell) ? ` · 자동 (${autoCells.get(cell)}번과 스마슈 걷기 칸으로 만듦)` : "";
    return `${cell}번 · ${kind}${auto} · ${r - l}×${b - t} · (${l}, ${t})`;
  }

  private key(e: KeyboardEvent) {
    if (e.target instanceof HTMLSelectElement) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "s") void this.save();
    else if (mod && e.key === "z") this.undo();
    else if (e.key === " ") this.paused = !this.paused;
    else if (e.key === "o" || e.key === "O") this.overlay.checked = !this.overlay.checked;
    else if (e.key === "c" || e.key === "C") this.centers.checked = !this.centers.checked;
    else if (e.key.startsWith("Arrow")) {
      const step = e.shiftKey ? 4 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]!;
      this.move(d[0], d[1]);
    } else return;
    e.preventDefault();
    this.draw();
  }

  private snapshot() {
    this.history.push(new ImageData(new Uint8ClampedArray(this.work.data), this.work.width, this.work.height));
    if (this.history.length > 40) this.history.shift();
  }

  private undo() {
    const prev = this.history.pop();
    if (!prev) return;
    this.work = prev;
    this.dirty = true;
    this.setStatus("되돌림");
  }

  private move(dx: number, dy: number) {
    if (autoCells.has(this.selected)) {
      this.setStatus(`${this.selected}번은 내보낼 때 자동으로 만드는 칸이라 옮기지 않음 (${autoCells.get(this.selected)}번을 고치면 따라 바뀜)`);
      return;
    }
    const [l, t, r, b] = rect(this.selected);
    const w = r - l;
    const h = b - t;
    const src = new Uint8ClampedArray(w * h * 4);
    let lost = 0;
    for (let y = 0; y < h; y++) src.set(this.work.data.subarray(((t + y) * W + l) * 4, ((t + y) * W + r) * 4), y * w * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = src[(y * w + x) * 4 + 3];
        const nx = x + dx;
        const ny = y + dy;
        if (a > 0 && (nx < 0 || ny < 0 || nx >= w || ny >= h)) lost++;
      }
    }
    if (lost > 0) {
      this.setStatus(`칸 밖으로 ${lost}px가 나가서 옮기지 않음`);
      return;
    }
    this.snapshot();
    for (let y = 0; y < h; y++) this.work.data.fill(0, ((t + y) * W + l) * 4, ((t + y) * W + r) * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        this.work.data.set(src.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), ((t + ny) * W + l + nx) * 4);
      }
    }
    this.dirty = true;
    this.setStatus(`${this.selected}번 칸을 (${dx}, ${dy}) 옮김`);
  }

  private setStatus(text: string) {
    this.status.replaceChildren(el("div", { className: this.dirty ? "warn" : "ok", textContent: this.dirty ? "저장 안 됨" : "저장됨" }), el("div", { textContent: text }));
  }

  private async save() {
    const full = el("canvas", { width: this.work.width, height: this.work.height });
    full.getContext("2d")!.putImageData(this.work, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => full.toBlob(ok, "image/png"));
    if (!blob) return;
    this.ownSave = performance.now();
    const res = await fetch(`/dev/${WORK}`, { method: "PUT", body: blob });
    if (res.ok) this.dirty = false;
    this.setStatus(res.ok ? await res.text() : "저장 실패 (개발 서버가 필요합니다)");
  }

  private async poll() {
    try {
      const res = await fetch(`/dev/stat?f=${encodeURIComponent(WORK)}`, { cache: "no-store" });
      if (res.ok) {
        const { mtime } = await res.json();
        if (this.seen >= 0 && mtime !== this.seen && performance.now() - this.ownSave > 2000) {
          if (this.dirty) this.setStatus("작업 파일이 밖에서 바뀌었지만, 저장 안 된 이동이 있어 다시 읽지 않음");
          else {
            this.work = await loadRgba(WORK);
            this.history.length = 0;
            this.setStatus("작업 파일을 다시 읽음");
            this.draw();
          }
        }
        this.seen = mtime;
      }
      const fin = await fetch(`/dev/stat?f=${encodeURIComponent(FINAL)}`, { cache: "no-store" });
      if (fin.ok) {
        const { mtime } = await fin.json();
        if (this.finalSeen >= 0 && mtime !== this.finalSeen) {
          this.finalCanvas.getContext("2d")!.putImageData(await loadRgba(FINAL), 0, 0);
          this.draw();
        }
        this.finalSeen = mtime;
      }
      const ex = await fetch("/dev/export", { cache: "no-store" });
      if (ex.ok) {
        const line = (await ex.json())[WORK];
        this.exportLine.textContent = line ? `내보내기: ${line}` : "";
      }
    } catch {
      this.exportLine.textContent = "개발 서버에 연결할 수 없음";
    }
  }

  private draw() {
    const c = this.main.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    for (let y = 0; y < H; y += 8) {
      for (let x = 0; x < W; x += 8) {
        c.fillStyle = (x + y) % 16 === 0 ? "#2e2e34" : "#38383f";
        c.fillRect(x * ZOOM, y * ZOOM, 8 * ZOOM, 8 * ZOOM);
      }
    }
    if (this.overlay.checked) {
      c.globalAlpha = 0.35;
      c.drawImage(this.smashCanvas, 0, 0, W * ZOOM, H * ZOOM);
      c.globalAlpha = 1;
    }
    this.workCanvas.getContext("2d")!.putImageData(this.work, 0, 0);
    c.drawImage(this.workCanvas, 0, 0, W * ZOOM, H * ZOOM);
    c.globalAlpha = 0.5;
    for (const cell of autoCells.keys()) {
      const [l, t, r, b] = rect(cell);
      c.drawImage(this.finalCanvas, l, t, r - l, b - t, l * ZOOM, t * ZOOM, (r - l) * ZOOM, (b - t) * ZOOM);
    }
    c.globalAlpha = 1;
    c.font = "10px sans-serif";
    c.textBaseline = "top";
    for (let i = 0; i < rects.length / 4; i++) {
      const [l, t, r, b] = rect(i);
      const mine = characterCells.has(i);
      c.strokeStyle = i === this.selected ? "#ffff40" : i === this.hover ? "#ffffff" : mine ? "rgba(80, 220, 120, 0.7)" : "rgba(160, 160, 160, 0.35)";
      c.lineWidth = i === this.selected ? 2 : 1;
      c.strokeRect(l * ZOOM + 0.5, t * ZOOM + 0.5, (r - l) * ZOOM - 1, (b - t) * ZOOM - 1);
      c.fillStyle = mine ? "#a0ffb0" : "#999";
      c.fillText(autoCells.has(i) ? `${i} 자동` : String(i), l * ZOOM + 2, t * ZOOM + 2);
      if (this.centers.checked && mine) {
        const x = (l + CENTER - this.poses[i * 4]) * ZOOM;
        const y = (t + CENTER - this.poses[i * 4 + 1]) * ZOOM;
        c.fillStyle = "#ffff00";
        c.fillRect(x - 3, y, 7, 1);
        c.fillRect(x, y - 3, 1, 7);
      }
    }
    this.info.replaceChildren(
      el("div", { textContent: this.label(this.selected) }),
      el("div", { textContent: this.hover !== null && this.hover !== this.selected ? `가리킨 칸: ${this.label(this.hover)}` : " " }),
    );
    this.drawPreview();
  }

  private drawPreview() {
    const c = this.preview.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#33333a";
    c.fillRect(0, 0, this.preview.width, this.preview.height);
    const choice = this.animSelect.value;
    const row = choice.startsWith("row") ? Number(choice.slice(3)) : null;
    const k = row === null ? 0 : this.frame % rowLength(row);
    const pose = row === null ? Number(choice.slice(4)) : anim[row * 16 + k];
    const [l, t, r, b] = rect(pose);
    const half = 96 * ANIM_ZOOM;
    const smashPoses = GAME_TABLES.poses;
    for (const [i, src, poses] of [[0, this.finalCanvas, this.poses], [1, this.smashCanvas, smashPoses]] as const) {
      const ox = i * half + 24 * ANIM_ZOOM;
      const oy = 24 * ANIM_ZOOM;
      c.drawImage(src, l, t, r - l, b - t, ox + poses[pose * 4] * ANIM_ZOOM, oy + poses[pose * 4 + 1] * ANIM_ZOOM, (r - l) * ANIM_ZOOM, (b - t) * ANIM_ZOOM);
      c.fillStyle = "#ffff00";
      c.fillRect(ox + 24 * ANIM_ZOOM - 2, oy + 24 * ANIM_ZOOM - 2, 4, 4);
    }
    c.fillStyle = "#ddd";
    c.font = "12px sans-serif";
    c.textBaseline = "top";
    c.fillText(row === null ? `${pose}번 (정지 그림)` : `${pose}번 · ${this.names.get(pose) ?? ""} · 프레임 ${k}${this.paused ? " (정지)" : ""}`, 6, 6);
  }
}

async function loadRgba(url: string): Promise<ImageData> {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const c = el("canvas", { width: bitmap.width, height: bitmap.height }).getContext("2d")!;
  c.drawImage(bitmap, 0, 0);
  return c.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function loadIndexed(url: string): Promise<IndexedImage> {
  return decodeIndexedPng(new Uint8Array(await (await fetch(url, { cache: "no-store" })).arrayBuffer()));
}

function smashImage(img: IndexedImage): ImageData {
  const data = new ImageData(img.width, img.height);
  img.pixels.forEach((v, i) => {
    if (v === 0) return;
    const [r, g, b] = img.palette[v];
    data.data.set([r, g, b, 255], i * 4);
  });
  return data;
}

export async function startSheetEditor() {
  const [work, smash, final] = await Promise.all([loadRgba(WORK), loadIndexed("assets/gfx/SMASH.png"), loadRgba(FINAL)]);
  new SheetEditor(work, smash, final);
}
