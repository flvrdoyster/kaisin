import { track } from "./analytics.ts";

const ARROW =
  '<polygon fill="currentColor" points="16.43 0 16.43 5.48 10.95 5.48 10.95 10.95 5.48 10.95 5.48 16.43 0 16.43 0 21.9 5.48 21.9 5.48 27.38 10.95 27.38 10.95 32.86 16.43 32.86 16.43 38.33 21.9 38.33 21.9 0 16.43 0"/>';

const SWORD =
  '<svg viewBox="0 0 42.06 42.16" fill="currentColor">' +
  '<rect x="21.03" y="11.92" width="3" height="3"/>' +
  '<polygon points="18.03 20.84 18.03 17.93 21.03 17.93 21.03 14.93 18.03 14.93 18.03 17.84 15.02 17.84 15.02 20.84 12.02 20.84 9.01 20.84 9.01 23.85 12.02 23.85 12.02 26.85 15.02 26.85 15.02 20.84 18.03 20.84"/>' +
  '<polygon points="30.04 6.01 33.05 6.01 33.05 3 30.04 3 30.04 5.91 27.04 5.91 27.04 8.92 30.04 8.92 30.04 6.01"/>' +
  '<rect x="24.03" y="8.92" width="3" height="3"/>' +
  '<rect x="27.04" y="17.93" width="3" height="3"/>' +
  '<polygon points="24.03 23.85 21.03 23.85 21.03 26.85 15.02 26.85 15.02 29.85 18.03 29.85 18.03 32.95 21.03 32.95 21.03 29.85 21.03 26.85 24.03 26.85 24.03 23.94 27.04 23.94 27.04 20.94 24.03 20.94 24.03 23.85"/>' +
  '<polygon points="36.05 11.92 33.05 11.92 33.05 14.93 36.05 14.93 36.05 12.02 39.06 12.02 39.06 9.01 36.05 9.01 36.05 11.92"/>' +
  '<rect x="30.04" y="14.93" width="3" height="3"/>' +
  '<polygon points="33.05 0 33.05 3 39.06 3 39.06 9.01 42.06 9.01 42.06 3 42.06 0 33.05 0"/>' +
  '<polygon points="21.13 35.96 18.03 35.96 18.03 38.96 21.13 38.96 24.13 38.96 24.13 32.95 21.13 32.95 21.13 35.96"/>' +
  '<polygon points="5.91 17.84 2.91 17.84 2.91 23.85 5.91 23.85 5.91 20.84 9.01 20.84 9.01 17.84 5.91 17.84"/>' +
  '<rect x="6.01" y="23.85" width="3" height="3"/>' +
  '<rect x="15.02" y="32.95" width="3" height="3"/>' +
  '<rect x="9.01" y="26.85" width="3" height="3"/>' +
  '<rect x="12.02" y="29.9" width="3" height="3"/>' +
  '<polygon points="6.01 32.86 3 32.86 3 35.86 6.01 35.86 6.01 32.91 9.01 32.91 9.01 29.9 6.01 29.9 6.01 32.86"/>' +
  '<rect x="9.01" y="32.95" width="3" height="3"/>' +
  '<rect x="6.01" y="36.01" width="3" height="3"/>' +
  '<polygon points="3 36.01 0 36.01 0 42.16 3 42.16 3 42.16 6.01 42.16 6.01 39.15 3 39.15 3 36.01"/>' +
  "</svg>";

const ICONS = {
  up: `<svg viewBox="0 0 21.9 38.33">${ARROW}</svg>`,
  down: `<svg viewBox="0 0 21.9 38.33">${ARROW}</svg>`,
  left: `<svg viewBox="0 0 21.9 38.33">${ARROW}</svg>`,
  right: `<svg viewBox="0 0 21.9 38.33">${ARROW}</svg>`,
  attack: SWORD,
  pause: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
  title:
    '<svg viewBox="66.6 75.6 666.8 624.5"><path d="M359.1,89.6c24.1-18.7,57.8-18.7,81.9,0l279.5,217.4c25.1,19.5,11.2,59.7-20.5,59.7h-33.2v266.7c0,36.8-29.8,66.7-66.7,66.7H200c-36.8,0-66.7-29.8-66.7-66.7v-266.7h-33.2c-31.8,0-45.6-40.2-20.5-59.7L359.1,89.6Z" fill="currentColor"/></svg>',
};

const RING_RADIUS = 70;
const ATTACK_RADIUS = 48;
const MOVE_DEAD = 18;
const MOVE_REACH = 56;
const ATTACK = 0x140;

interface Pad {
  zone: "move" | "attack";
  x: number;
  y: number;
  cx: number;
  cy: number;
  bits: number;
}

function capture(e: HTMLElement, id: number) {
  try {
    e.setPointerCapture(id);
  } catch {
    return;
  }
}

function element(tag: string, className: string, parent: HTMLElement): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  parent.appendChild(e);
  return e;
}

export class Input {
  private readonly down = new Set<number>();
  private readonly pads = new Map<number, Pad>();
  private readonly buttons = new Map<number, number>();
  private root: HTMLElement | null = null;
  private base: HTMLElement | null = null;
  private knob: HTMLElement | null = null;
  private attack: HTMLElement | null = null;
  private hint: HTMLElement | null = null;

  constructor(private readonly map: Int32Array) {
    addEventListener("keydown", (e) => {
      if (this.map[e.keyCode]) e.preventDefault();
      this.down.add(e.keyCode);
    });
    addEventListener("keyup", (e) => this.down.delete(e.keyCode));
    addEventListener("blur", () => {
      this.down.clear();
      this.pads.clear();
      this.buttons.clear();
      this.refresh();
    });
    if (navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).has("touch")) this.touch();
  }

  read(): number {
    let bits = 0;
    for (const k of this.down) if (k < 0x100) bits |= this.map[k];
    for (const pad of this.pads.values()) bits |= pad.bits;
    for (const b of this.buttons.values()) bits |= b;
    return bits;
  }

  private touch() {
    track("gamepad_activate");
    const root = element("div", "touch", document.body);
    this.hint = element("div", "touch-ring touch-hint", root);
    for (const d of ["up", "down", "left", "right"] as const) element("i", `touch-arrow touch-${d}`, this.hint).innerHTML = ICONS[d];
    this.base = element("div", "touch-ring touch-base", root);
    for (const d of ["up", "down", "left", "right"] as const) element("i", `touch-arrow touch-${d}`, this.base).innerHTML = ICONS[d];
    this.knob = element("div", "touch-knob", root);
    this.attack = element("div", "touch-attack", root);
    this.attack.innerHTML = ICONS.attack;
    for (const [icon, bit, side] of [[ICONS.pause, 0x80, "touch-pause"], [ICONS.title, 0x200, "touch-title"]] as const) {
      const b = element("div", `touch-button ${side}`, root);
      b.innerHTML = icon;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        capture(b, e.pointerId);
        this.buttons.set(e.pointerId, bit);
      });
      const release = (e: PointerEvent) => this.buttons.delete(e.pointerId);
      b.addEventListener("pointerup", release);
      b.addEventListener("pointercancel", release);
    }
    this.root = root;
    const layout = () => this.layout();
    addEventListener("resize", layout);
    addEventListener("orientationchange", layout);
    visualViewport?.addEventListener("resize", layout);
    layout();
    setTimeout(layout, 500);
    setTimeout(layout, 2000);
    root.addEventListener("pointerdown", (e) => {
      capture(root, e.pointerId);
      const zone = e.clientX < innerWidth / 2 ? "move" : "attack";
      const r = zone === "move" ? RING_RADIUS : ATTACK_RADIUS;
      const x = zone === "move" ? Math.min(Math.max(e.clientX, r + 4), Math.max(r + 4, innerWidth / 2)) : Math.min(Math.max(e.clientX, r + 4), innerWidth - r - 4);
      const y = Math.min(Math.max(e.clientY, r + 4), Math.max(r + 4, innerHeight - r - 4));
      this.pads.set(e.pointerId, { zone, x: e.clientX, y: e.clientY, cx: x, cy: y, bits: zone === "attack" ? ATTACK : 0 });
      this.refresh(e);
    });
    root.addEventListener("pointermove", (e) => {
      const pad = this.pads.get(e.pointerId);
      if (!pad || pad.zone !== "move") return;
      const dx = e.clientX - pad.x;
      const dy = e.clientY - pad.y;
      const m = Math.hypot(dx, dy);
      let bits = 0;
      if (m > MOVE_DEAD) {
        if (Math.abs(dx) > m * 0.38) bits |= dx > 0 ? 2 : 1;
        if (Math.abs(dy) > m * 0.38) bits |= dy > 0 ? 8 : 4;
      }
      pad.bits = bits;
      this.refresh(e, dx, dy, m);
    });
    const release = (e: PointerEvent) => {
      this.pads.delete(e.pointerId);
      this.refresh();
    };
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);
    root.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private layout() {
    const root = this.root;
    const canvas = document.getElementById("screen");
    if (!root || !canvas) return;
    const free = innerHeight - canvas.getBoundingClientRect().bottom;
    const portrait = innerHeight > innerWidth && free > 190;
    if (portrait) root.style.setProperty("--pad-cy", `${Math.round(free / 2)}px`);
    else root.style.removeProperty("--pad-cy");
    this.refresh();
  }

  private refresh(e?: PointerEvent, dx = 0, dy = 0, m = 0) {
    if (!this.base || !this.knob || !this.attack) return;
    const move = [...this.pads.values()].find((p) => p.zone === "move");
    this.base.style.display = this.knob.style.display = move ? "block" : "none";
    if (this.hint) this.hint.style.display = move ? "none" : "block";
    if (move) {
      for (const [d, bit] of [["up", 4], ["down", 8], ["left", 1], ["right", 2]] as const) {
        this.base.classList.toggle(`on-${d}`, (move.bits & bit) !== 0);
      }
      const k = m > MOVE_REACH ? MOVE_REACH / m : 1;
      this.base.style.left = `${move.cx}px`;
      this.base.style.top = `${move.cy}px`;
      this.knob.style.left = `${move.cx + dx * k}px`;
      this.knob.style.top = `${move.cy + dy * k}px`;
    }
    const press = [...this.pads.values()].find((p) => p.zone === "attack");
    this.attack.classList.toggle("on", !!press);
    this.attack.classList.toggle("moved", !!press);
    this.attack.style.left = press ? `${press.cx}px` : "";
    this.attack.style.top = press ? `${press.cy}px` : "";
    void e;
  }
}
