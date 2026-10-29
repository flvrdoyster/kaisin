import { G } from "../../../src/game/core.ts";
import { CENTER, charSpr } from "../../../src/game/characters.ts";
import { Renderer } from "../../../src/gfx/render.ts";
import { CharDef } from "../src/kiri.ts";
import { CharacterEditor } from "./editor.ts";

const DIRS = ["위", "오른쪽", "아래", "왼쪽"];
const PANEL_W = 160;
const ROWS = [{ y: 0, h: 96 }, { y: 96, h: 128 }, { y: 224, h: 160 }, { y: 384, h: 96 }];
const STEP_TICKS = 5;

export interface DevHooks {
  watch: string[];
  warnings(): string[];
  refresh(name: string): Promise<void>;
  save(def: CharDef): Promise<boolean>;
}

export class SpriteViewer {
  private tick = 0;
  private frame = 0;
  private paused = false;
  private readonly editor: CharacterEditor;
  private readonly seen = new Map<string, number>();
  private poll = 0;

  constructor(
    private readonly r: Renderer,
    private readonly hooks: DevHooks,
    startEditor: boolean,
    private readonly annotate = false,
  ) {
    const canvas = document.getElementById("screen") as HTMLCanvasElement;
    this.editor = new CharacterEditor(
      r,
      {
        save: (def) => hooks.save(def),
      },
      canvas,
    );
    this.editor.active = startEditor;
    addEventListener("keydown", (e) => {
      if (this.editor.key(e)) {
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === "e") this.editor.active = !this.editor.active;
      else if (this.editor.active) return;
      else if (e.key === " " || e.key === "p") this.paused = !this.paused;
      else if (e.key === "ArrowRight") this.frame++;
      else if (e.key === "ArrowLeft") this.frame = Math.max(0, this.frame - 1);
      else return;
      e.preventDefault();
    });
  }

  private async watch() {
    for (const f of this.hooks.watch) {
      let mtime = -1;
      try {
        const res = await fetch(`/dev/stat?f=${encodeURIComponent(f)}`, { cache: "no-store" });
        if (res.ok) mtime = (await res.json()).mtime;
      } catch {
        return;
      }
      const prev = this.seen.get(f);
      this.seen.set(f, mtime);
      if (prev === undefined || prev === mtime || mtime < 0) continue;
      await this.hooks.refresh(f.split("/").pop()!);
    }
  }

  step() {
    if (++this.poll >= 25) {
      this.poll = 0;
      void this.watch();
    }
    if (this.editor.active || this.paused || ++this.tick < STEP_TICKS) return;
    this.tick = 0;
    this.frame++;
  }

  private pose(row: number, k: number): number {
    return G.char.anim[row * 16 + k];
  }

  private offset(pose: number): [number, number] {
    return [G.char.poses[pose * 4], G.char.poses[pose * 4 + 1]];
  }

  private label(x: number, y: number, text: string, color = "#ddd") {
    const c = this.r.ctx;
    c.font = "11px sans-serif";
    c.textBaseline = "top";
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  private wrap(text: string, width: number): string[] {
    const c = this.r.ctx;
    c.font = "11px sans-serif";
    const lines: string[] = [];
    let line = "";
    for (const ch of text) {
      if (line && c.measureText(line + ch).width > width) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }

  private rects(base: number, count: number, ox: number, oy: number, color: string) {
    const t = G.char.attackRects;
    for (let i = 0; i < count; i++) {
      const [l, top, rr, b] = t.subarray(base + i * 4, base + i * 4 + 4);
      if (l !== rr) this.r.box(ox + l, oy + top, rr - l, b - top, color);
    }
  }

  private panel(col: number, row: number, title: string, spr: number, ox: number, oy: number) {
    const px = col * PANEL_W;
    const { y: py, h } = ROWS[row];
    const f38 = px + 56;
    const f3c = py + (h >> 1) - 24;
    this.r.box(px, py, PANEL_W, h, "#333");
    this.r.sprite(f38 + ox, f3c + oy, spr);
    this.label(px + 4, py + 3, title);
    if (this.annotate) {
      const cell = G.sheets.get(G.char.sheet)?.frame(spr & 0xffff);
      if (cell) {
        this.r.box(f38 + ox, f3c + oy, cell.w, cell.h, "#00bcd4");
        this.r.dot(f38, f3c, 3, "#ff40ff");
        this.label(px + 4, py + h - 14, `셀${cell.w}×${cell.h} 오프셋${ox},${oy} 몸${CENTER - ox},${CENTER - oy}`, "#8fd");
      }
    }
    return { f38, f3c };
  }

  private center(f38: number, f3c: number) {
    this.r.dot(f38 + 24, f3c + 24, 4, "#ffff00");
  }

  draw() {
    if (this.editor.active) {
      this.editor.draw();
      return;
    }
    const r = this.r;
    r.clear();
    const base = charSpr();
    for (let d = 0; d < 4; d++) {
      const k = this.frame % 16;
      const p = this.pose(d, k);
      const [ox, oy] = this.offset(p);
      const { f38, f3c } = this.panel(d, 0, `걷기 ${DIRS[d]} f44=${k} 포즈 ${p}`, base + p, ox, oy);
      this.center(f38, f3c);
    }
    for (let d = 0; d < 4; d++) {
      const row = d + 4;
      const k = this.frame % 6;
      const p = this.pose(row, k);
      const [ox, oy] = this.offset(p);
      const { f38, f3c } = this.panel(d, 1, `공격 ${DIRS[d]} f44=${k} 포즈 ${p}`, base + p, ox, oy);
      if (k === 2 || k === 3) {
        const [px, py] = this.offset(this.pose(row, k - 1));
        if (k === 2) this.rects(d * 20 + 16, 1, f38 + px, f3c + py, "#ff4040");
        else {
          this.rects(d * 20, 3, f38 + px, f3c + py, "#ff4040");
          const t = G.char.strikes[d];
          for (let i = 0; i < t.length; i += 2) r.dot(f38 + 24 + t[i], f3c + 24 + t[i + 1], 3, "#40c0ff");
        }
      }
      this.center(f38, f3c);
    }
    for (let d = 0; d < 4; d++) {
      const row = d + 8;
      const k = this.frame % 16;
      const p = this.pose(row, k);
      const [ox, oy] = this.offset(p);
      const { f38, f3c } = this.panel(d, 2, `스매시 ${DIRS[d]} 포즈 ${p}`, base + p, ox, oy);
      this.rects(d * 20 + 12, 1, f38 + ox, f3c + oy, "#ff4040");
      this.center(f38, f3c);
    }
    const still: [string, number][] = [["피격 32", 0x20], ["쓰러짐 36", 0x24], ["무덤 석상 34", 0x22]];
    still.forEach(([title, n], i) => this.panel(i, 3, title, base + n, 0, 0));
    const wx = 3 * PANEL_W + 4;
    let wy = ROWS[3].y + 4;
    this.label(wx, wy, this.paused ? "정지: ←/→ 한 칸, 스페이스 재생" : "재생: 스페이스 정지", "#ffff80");
    wy += 13;
    this.label(wx, wy, "E: 판정 편집기", "#80c0ff");
    for (const [text, color] of [
      ["빨강: 공격 판정(만들어진 프레임, 적은 다음 갱신에 반응)", "#ff4040"],
      ["하늘색 점: 블록 타격점", "#40c0ff"],
      ["노랑 점: 몸 중심", "#ffff00"],
    ] as const) {
      for (const line of this.wrap(text, PANEL_W - 8)) {
        wy += 13;
        this.label(wx, wy, line, color);
      }
    }
    if (this.annotate) {
      for (const [text, color] of [
        ["청록 상자: 셀(그림) 위치", "#00bcd4"],
        ["보라 점: f38,f3c (오프셋 기준)", "#ff40ff"],
        ["노랑 점 = f38+24", "#ffff00"],
                ["몸: 셀 안의 몸 중심 좌표", "#8fd"],
      ] as const)
        for (const line of this.wrap(text, PANEL_W - 8)) {
          wy += 13;
          this.label(wx, wy, line, color);
        }
    }
    const warnings = this.hooks.warnings();
    const ok = warnings.length === 0;
    for (const w of ok ? ["검사 통과"] : warnings) {
      for (const line of this.wrap(w, PANEL_W - 8)) {
        wy += 13;
        this.label(wx, wy, line, ok ? "#80ff80" : "#ff8080");
      }
    }
    r.present(0, 0);
  }
}
