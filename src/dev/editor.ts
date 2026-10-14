import { G } from "../game/core.ts";
import { CENTER, CharDef, Rect, charSpr, defaultDef, getKiriDef, selectCharacter } from "../game/characters.ts";
import { Renderer } from "../gfx/render.ts";

const DIRS = ["위", "오른쪽", "아래", "왼쪽"];
const K = 4;
const VIEW = 480;
const ORG = VIEW / 2;
const BX = 160;
const BY = 120;
const TOL = 6;

type Hit = "move" | "l" | "r" | "t" | "b" | "tl" | "tr" | "bl" | "br";
type Sel = { kind: "swing"; i: number } | { kind: "start" } | { kind: "hurt" } | { kind: "strike"; i: number } | null;
type Stage = "swing" | "start" | "hurt";

interface Drag {
  mode: Hit | "point" | "trail";
  mx: number;
  my: number;
  rect?: Rect;
  point?: [number, number];
  trail?: [number, number];
}

export interface EditorHooks {
  save(def: CharDef): Promise<boolean>;
}

export class CharacterEditor {
  private dir = 0;
  private stage: Stage = "swing";
  private sel: Sel = null;
  private drag: Drag | null = null;
  private ghost = true;
  private mouse = { x: 0, y: 0 };
  private toast = { text: "", until: 0 };
  private history: string[] = [];
  private dirty = false;

  constructor(
    private readonly r: Renderer,
    private readonly hooks: EditorHooks,
    private readonly canvas: HTMLCanvasElement,
  ) {
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    addEventListener("pointermove", (e) => this.move(e));
    addEventListener("pointerup", () => {
      this.drag = null;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  active = false;

  get isDirty() {
    return this.dirty;
  }

  private def(): CharDef {
    return getKiriDef();
  }

  private pos(e: PointerEvent) {
    const b = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - b.left) * 640) / b.width, y: ((e.clientY - b.top) * 480) / b.height };
  }

  private show(text: string) {
    this.toast = { text, until: performance.now() + 2500 };
  }

  private snapshot() {
    this.history.push(JSON.stringify(this.def()));
    if (this.history.length > 100) this.history.shift();
  }

  private changed() {
    this.dirty = true;
    selectCharacter("kiri");
  }

  private rectOf(sel: NonNullable<Sel>): Rect | null {
    const d = this.def();
    if (sel.kind === "swing") return d.dirs[this.dir].swing[sel.i];
    if (sel.kind === "start") return d.dirs[this.dir].start;
    if (sel.kind === "hurt") return d.hurt;
    return null;
  }

  private items(): NonNullable<Sel>[] {
    if (this.stage === "swing") {
      const out: NonNullable<Sel>[] = [0, 1, 2].map((i) => ({ kind: "swing", i }));
      this.def().dirs[this.dir].strikes.forEach((_, i) => out.push({ kind: "strike", i }));
      return out;
    }
    return this.stage === "start" ? [{ kind: "start" }] : [{ kind: "hurt" }];
  }

  private sx = (x: number) => ORG + x * K;
  private sy = (y: number) => ORG + y * K;

  private hitRect(r: Rect, mx: number, my: number): Hit | null {
    const x0 = this.sx(r[0]);
    const x1 = this.sx(r[2]);
    const y0 = this.sy(r[1]);
    const y1 = this.sy(r[3]);
    const nl = Math.abs(mx - x0) <= TOL;
    const nr = Math.abs(mx - x1) <= TOL;
    const nt = Math.abs(my - y0) <= TOL;
    const nb = Math.abs(my - y1) <= TOL;
    const inX = mx >= x0 - TOL && mx <= x1 + TOL;
    const inY = my >= y0 - TOL && my <= y1 + TOL;
    if (!inX || !inY) return null;
    if (nl && nt) return "tl";
    if (nr && nt) return "tr";
    if (nl && nb) return "bl";
    if (nr && nb) return "br";
    if (nl) return "l";
    if (nr) return "r";
    if (nt) return "t";
    if (nb) return "b";
    return mx > x0 && mx < x1 && my > y0 && my < y1 ? "move" : null;
  }

  private down(e: PointerEvent) {
    if (!this.active) return;
    const { x, y } = this.pos(e);
    if (x >= VIEW) return;
    this.mouse = { x, y };
    if (e.button === 2) {
      if (this.stage !== "swing") return;
      this.snapshot();
      this.drag = { mode: "trail", mx: x, my: y, trail: [...this.def().dirs[this.dir].trail] as [number, number] };
      return;
    }
    const items = this.items().reverse();
    for (const it of items) {
      if (it.kind === "strike") {
        const p = this.def().dirs[this.dir].strikes[it.i];
        if (Math.abs(x - this.sx(p[0])) <= TOL && Math.abs(y - this.sy(p[1])) <= TOL) {
          this.sel = it;
          this.snapshot();
          this.drag = { mode: "point", mx: x, my: y, point: [...p] as [number, number] };
          return;
        }
      }
    }
    for (const it of items) {
      const r = this.rectOf(it);
      if (!r) continue;
      const h = this.hitRect(r, x, y);
      if (h) {
        this.sel = it;
        this.snapshot();
        this.drag = { mode: h, mx: x, my: y, rect: [...r] as Rect };
        return;
      }
    }
    this.sel = null;
  }

  private move(e: PointerEvent) {
    if (!this.active) return;
    const { x, y } = this.pos(e);
    this.mouse = { x, y };
    const d = this.drag;
    if (!d) return;
    const snap = (v: number) => (e.shiftKey ? Math.round(v / 4) * 4 : v);
    const dx = Math.round((x - d.mx) / K);
    const dy = Math.round((y - d.my) / K);
    if (d.mode === "trail" && d.trail) {
      this.def().dirs[this.dir].trail = [d.trail[0] + dx, d.trail[1] + dy];
      this.changed();
      return;
    }
    if (d.mode === "point" && d.point && this.sel?.kind === "strike") {
      this.def().dirs[this.dir].strikes[this.sel.i] = [snap(d.point[0] + dx), snap(d.point[1] + dy)];
      this.changed();
      return;
    }
    if (!d.rect || !this.sel) return;
    const r = this.rectOf(this.sel);
    if (!r) return;
    const o = d.rect;
    const n: Rect = [...o] as Rect;
    const m = d.mode;
    if (m === "move") {
      n[0] = snap(o[0] + dx);
      n[1] = snap(o[1] + dy);
      n[2] = n[0] + (o[2] - o[0]);
      n[3] = n[1] + (o[3] - o[1]);
    } else {
      if (m === "l" || m === "tl" || m === "bl") n[0] = snap(o[0] + dx);
      if (m === "r" || m === "tr" || m === "br") n[2] = snap(o[2] + dx);
      if (m === "t" || m === "tl" || m === "tr") n[1] = snap(o[1] + dy);
      if (m === "b" || m === "bl" || m === "br") n[3] = snap(o[3] + dy);
    }
    if (n[0] > n[2]) [n[0], n[2]] = [n[2], n[0]];
    if (n[1] > n[3]) [n[1], n[3]] = [n[3], n[1]];
    r.splice(0, 4, ...n);
    this.changed();
  }

  key(e: KeyboardEvent): boolean {
    if (!this.active) return false;
    const k = e.key;
    const d = this.def();
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "s") {
      void this.save();
      return true;
    }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") {
      const prev = this.history.pop();
      if (prev) {
        const o = JSON.parse(prev) as CharDef;
        d.hurt = o.hurt;
        d.dirs = o.dirs;
        this.changed();
        this.show("되돌림");
      }
      return true;
    }
    if (k >= "1" && k <= "4") {
      this.dir = Number(k) - 1;
      this.sel = null;
      return true;
    }
    if (k === "Tab") {
      this.dir = (this.dir + 1) % 4;
      this.sel = null;
      return true;
    }
    if (k.toLowerCase() === "q") {
      this.stage = this.stage === "swing" ? "start" : this.stage === "start" ? "hurt" : "swing";
      this.sel = null;
      return true;
    }
    if (k.toLowerCase() === "g") {
      this.ghost = !this.ghost;
      return true;
    }
    if (k.toLowerCase() === "a" && this.stage === "swing") {
      this.snapshot();
      d.dirs[this.dir].strikes.push([Math.round((this.mouse.x - ORG) / K), Math.round((this.mouse.y - ORG) / K)]);
      this.sel = { kind: "strike", i: d.dirs[this.dir].strikes.length - 1 };
      this.changed();
      return true;
    }
    if ((k === "Delete" || k === "Backspace") && this.sel?.kind === "strike") {
      this.snapshot();
      d.dirs[this.dir].strikes.splice(this.sel.i, 1);
      this.sel = null;
      this.changed();
      return true;
    }
    if (k.toLowerCase() === "c") {
      this.snapshot();
      const src = JSON.parse(JSON.stringify(d.dirs[this.dir]));
      d.dirs = d.dirs.map(() => JSON.parse(JSON.stringify(src)));
      this.changed();
      this.show("현재 방향을 네 방향에 복사");
      return true;
    }
    if (k.toLowerCase() === "m") {
      this.snapshot();
      const opp = (this.dir + 2) % 4;
      const flipX = this.dir % 2 === 1;
      const s = d.dirs[this.dir];
      const fx = (x: number) => (flipX ? -x : x);
      const fy = (y: number) => (flipX ? y : -y);
      const fr = (r: Rect): Rect => {
        const a = [fx(r[0]), fy(r[1]), fx(r[2]), fy(r[3])];
        return [Math.min(a[0], a[2]), Math.min(a[1], a[3]), Math.max(a[0], a[2]), Math.max(a[1], a[3])];
      };
      d.dirs[opp] = {
        trail: [s.trail[0], s.trail[1]],
        swing: s.swing.map(fr),
        start: fr(s.start),
        strikes: s.strikes.map(([x, y]) => [fx(x), fy(y)]),
      };
      this.changed();
      this.show(`${DIRS[this.dir]} → ${DIRS[opp]} 반전 복사`);
      return true;
    }
    if (k.toLowerCase() === "r") {
      this.snapshot();
      d.dirs[this.dir] = defaultDef().dirs[this.dir];
      this.sel = null;
      this.changed();
      this.show("현재 방향을 기본값으로");
      return true;
    }
    if (k.toLowerCase() === "n" && this.stage === "hurt") {
      this.snapshot();
      d.hurt = d.hurt[0] === d.hurt[2] ? [-8, -8, 8, 8] : [0, 0, 0, 0];
      this.sel = { kind: "hurt" };
      this.changed();
      return true;
    }
    if (k.startsWith("Arrow") && this.sel) {
      const step = e.shiftKey ? 4 : 1;
      const dx = k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0;
      const dy = k === "ArrowUp" ? -step : k === "ArrowDown" ? step : 0;
      this.snapshot();
      if (this.sel.kind === "strike") {
        const p = d.dirs[this.dir].strikes[this.sel.i];
        p[0] += dx;
        p[1] += dy;
      } else {
        const r = this.rectOf(this.sel);
        if (r) {
          if (e.altKey) {
            r[2] += dx;
            r[3] += dy;
          } else {
            r[0] += dx;
            r[2] += dx;
            r[1] += dy;
            r[3] += dy;
          }
        }
      }
      this.changed();
      return true;
    }
    return false;
  }

  private async save() {
    const ok = await this.hooks.save(this.def());
    if (ok) this.dirty = false;
    this.show(ok ? "저장됨: assets/characters/kiri.json" : "저장 실패 (개발 서버가 필요합니다)");
  }

  private poseOffset(poses: Int32Array, pose: number): [number, number] {
    return [poses[pose * 4], poses[pose * 4 + 1]];
  }

  private drawSprites() {
    const r = this.r;
    r.clear();
    const f38 = BX - CENTER;
    const f3c = BY - CENTER;
    const row = this.dir + 4;
    const ks = this.stage === "start" ? [1] : this.stage === "swing" ? [2, 3] : [0];
    if (this.ghost) {
      r.ctx.globalAlpha = 0.4;
      for (const k of ks) {
        const p = G.t.playerAnim[row * 16 + k];
        const [ox, oy] = this.poseOffset(G.t.poses, p);
        r.sprite(f38 + ox, f3c + oy, 0x50000 + p);
      }
      r.ctx.globalAlpha = 1;
    }
    for (const k of ks) {
      const p = G.char.anim[row * 16 + k];
      const [ox, oy] = this.poseOffset(G.char.poses, p);
      r.sprite(f38 + ox, f3c + oy, charSpr() + p);
    }
  }

  private line(x0: number, y0: number, x1: number, y1: number, color: string) {
    const c = this.r.out;
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }

  private drawRect(r: Rect, color: string, selected: boolean, label: string) {
    const c = this.r.out;
    const x = this.sx(r[0]);
    const y = this.sy(r[1]);
    const w = (r[2] - r[0]) * K;
    const h = (r[3] - r[1]) * K;
    c.fillStyle = color + "33";
    c.fillRect(x, y, w, h);
    c.strokeStyle = selected ? "#ffff00" : color;
    c.lineWidth = selected ? 2 : 1;
    c.strokeRect(x + 0.5, y + 0.5, w, h);
    if (selected) {
      c.fillStyle = "#ffff00";
      for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) c.fillRect(hx - 3, hy - 3, 6, 6);
    }
    c.fillStyle = color;
    c.font = "11px sans-serif";
    c.textBaseline = "top";
    c.fillText(label, x + 3, y + 3);
  }

  private ghostRects() {
    if (!this.ghost || this.stage === "hurt") return;
    const row = this.dir + 4;
    const t = G.t.attackRects;
    const base = this.dir * 20;
    const list: Rect[] = [];
    let pose: number;
    if (this.stage === "swing") {
      pose = G.t.playerAnim[row * 16 + 2];
      for (let i = 0; i < 3; i++) list.push(t.slice(base + i * 4, base + i * 4 + 4) as unknown as Rect);
    } else {
      pose = G.t.playerAnim[row * 16 + 1];
      list.push(t.slice(base + 16, base + 20) as unknown as Rect);
    }
    const [ox, oy] = this.poseOffset(G.t.poses, pose);
    for (const q of list) {
      if (q[0] === q[2]) continue;
      this.drawRect([q[0] + ox - CENTER, q[1] + oy - CENTER, q[2] + ox - CENTER, q[3] + oy - CENTER], "#aaaaaa", false, "");
    }
  }

  draw() {
    const r = this.r;
    this.drawSprites();
    const c = r.out;
    c.fillStyle = "#14141c";
    c.fillRect(0, 0, 640, 480);
    r.view(BX - VIEW / K / 2, BY - VIEW / K / 2, VIEW / K, VIEW / K, 0, 0, VIEW, VIEW);
    for (let v = -60; v <= 60; v += 8) {
      const col = v % 16 === 0 ? "rgba(120,120,160,0.35)" : "rgba(120,120,160,0.15)";
      this.line(this.sx(v), 0, this.sx(v), VIEW, col);
      this.line(0, this.sy(v), VIEW, this.sy(v), col);
    }
    this.line(ORG, 0, ORG, VIEW, "rgba(255,255,0,0.6)");
    this.line(0, ORG, VIEW, ORG, "rgba(255,255,0,0.6)");
    this.ghostRects();
    const d = this.def();
    const dd = d.dirs[this.dir];
    if (this.stage === "swing") {
      dd.swing.forEach((q, i) => this.drawRect(q, "#ff4040", this.sel?.kind === "swing" && this.sel.i === i, `휘두르기 ${"ABC"[i]}`));
      dd.strikes.forEach((p, i) => {
        const on = this.sel?.kind === "strike" && this.sel.i === i;
        c.fillStyle = on ? "#ffff00" : "#40c0ff";
        c.fillRect(this.sx(p[0]) - 4, this.sy(p[1]) - 4, 8, 8);
      });
    } else if (this.stage === "start") {
      this.drawRect(dd.start, "#ff4040", this.sel?.kind === "start", "시작");
    } else {
      if (d.hurt[0] === d.hurt[2]) {
        c.strokeStyle = "#40e070";
        c.lineWidth = 2;
        c.strokeRect(this.sx(0) - 5, this.sy(0) - 5, 10, 10);
      } else this.drawRect(d.hurt, "#40e070", this.sel?.kind === "hurt", "피격");
    }
    this.panel();
  }

  private panel() {
    const c = this.r.out;
    const d = this.def();
    const dd = d.dirs[this.dir];
    c.fillStyle = "#1c1c28";
    c.fillRect(VIEW, 0, 640 - VIEW, 480);
    c.font = "12px sans-serif";
    c.textBaseline = "top";
    let y = 6;
    const put = (text: string, color = "#ddd") => {
      c.fillStyle = color;
      c.fillText(text, VIEW + 6, y);
      y += 15;
    };
    put(`키리 판정 편집기${this.dirty ? "  ●미저장" : ""}`, this.dirty ? "#ffb060" : "#fff");
    put(`방향: ${DIRS[this.dir]}  (1~4, Tab)`, "#9cf");
    put(`단계: ${this.stage === "swing" ? "공격: 휘두르기" : this.stage === "start" ? "공격: 시작" : "피격 영역(맞는 쪽)"}  (Q)`, "#9cf");
    y += 4;
    const s = this.sel;
    if (s) {
      if (s.kind === "strike") {
        const p = dd.strikes[s.i];
        put(`선택: 타격점 ${s.i + 1}`, "#ff8");
        put(`x ${p[0]}  y ${p[1]}`, "#ff8");
      } else {
        const r = this.rectOf(s)!;
        put(`선택: ${s.kind === "swing" ? "휘두르기 " + "ABC"[s.i] : s.kind === "start" ? "시작" : "피격"}`, "#ff8");
        put(`l ${r[0]}  t ${r[1]}  r ${r[2]}  b ${r[3]}`, "#ff8");
        put(`크기 ${r[2] - r[0]} × ${r[3] - r[1]}`, "#ff8");
      }
    } else put("선택 없음", "#888");
    if (this.stage === "swing") put(`잔상 오프셋 ${dd.trail[0]}, ${dd.trail[1]}  (우클릭 드래그)`, "#aaa");
    y += 6;
    for (const t of [
      "드래그: 이동·모서리 조절",
      "Shift: 4px 단위",
      "방향키: 이동 (Alt: 크기)",
      "A: 타격점 추가  Del: 삭제",
      "N: 피격 점/영역 전환",
      "C: 네 방향에 복사",
      "M: 반대 방향으로 반전 복사",
      "R: 현재 방향 기본값",
      "G: 스마슈 겹쳐 보기",
      "Ctrl+Z 되돌리기",
      "Ctrl+S 저장",
      "E: 미리보기로",
    ])
      put(t, "#888");
    if (performance.now() < this.toast.until) {
      c.fillStyle = "#101018";
      c.fillRect(VIEW + 4, 440, 640 - VIEW - 8, 32);
      c.fillStyle = "#8f8";
      c.fillText(this.toast.text, VIEW + 8, 448);
    }
    c.fillStyle = "#666";
    c.fillText(`좌표: 몸 중심 기준 px`, VIEW + 6, 462 - 18 + 28);
  }
}
