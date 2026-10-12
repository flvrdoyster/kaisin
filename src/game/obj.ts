export type Update = (o: Obj) => void;

export const POOL_SIZE = 600;
export const LAYERS = 10;

export class Obj {
  prev: Obj | null = null;
  next: Obj | null = null;
  update: Update | null = null;
  layer = 0;
  kind = 0;
  x = 0;
  y = 0;
  spr = 0;
  drawFlags = 0;
  scaleX = 0;
  scaleY = 0;
  f34 = 0;
  f38 = 0;
  f3c = 0;
  f40 = 0;
  f44 = 0;
  f48 = 0;
  f4c = 0;
  f50 = 0;
  f54 = 0;
  f58 = 0;
  p2c: Obj | null = null;
  p38: Obj | null = null;
  p3c: Obj | null = null;
  p40: Obj | null = null;
  p44: Obj | null = null;
  p48: Obj | null = null;
  p4c: Obj | null = null;
  p50: Obj | null = null;
  p54: Obj | null = null;
  live = false;

  clear() {
    this.update = null;
    this.layer = 0;
    this.kind = this.x = this.y = this.spr = this.drawFlags = 0;
    this.scaleX = this.scaleY = 0;
    this.f34 = this.f38 = this.f3c = this.f40 = this.f44 = 0;
    this.f48 = this.f4c = this.f50 = this.f54 = this.f58 = 0;
    this.p2c = this.p38 = this.p3c = this.p40 = this.p44 = null;
    this.p48 = this.p4c = this.p50 = this.p54 = null;
    this.live = false;
  }
}

class LayerList {
  readonly head = new Obj();
  readonly tail = new Obj();
  constructor() {
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }
}

export class World {
  readonly layers: LayerList[] = [];
  private free: Obj[] = [];
  paused = false;
  freeze = false;

  constructor() {
    for (let i = 0; i < LAYERS; i++) this.layers.push(new LayerList());
    this.reset();
  }

  reset() {
    for (const l of this.layers) {
      l.head.next = l.tail;
      l.tail.prev = l.head;
    }
    this.free = [];
    for (let i = POOL_SIZE - 1; i >= 0; i--) this.free.push(new Obj());
  }

  spawn(update: Update, layer: number): Obj | null {
    const o = this.free.pop();
    if (!o) return null;
    o.clear();
    o.update = update;
    o.layer = layer;
    o.live = true;
    const list = this.layers[layer];
    o.prev = list.head;
    o.next = list.head.next;
    list.head.next!.prev = o;
    list.head.next = o;
    return o;
  }

  spawnBack(update: Update, layer: number): Obj | null {
    const o = this.free.pop();
    if (!o) return null;
    o.clear();
    o.update = update;
    o.layer = layer;
    o.live = true;
    const list = this.layers[layer];
    o.prev = list.tail.prev;
    o.next = list.tail;
    list.tail.prev!.next = o;
    list.tail.prev = o;
    return o;
  }

  kill(o: Obj | null) {
    if (!o || !o.live) return;
    const prev = o.prev!;
    const next = o.next!;
    next.prev = prev;
    prev.next = next;
    o.clear();
    o.prev = prev;
    o.next = next;
    this.free.push(o);
  }

  run() {
    if (this.paused) return;
    for (const list of this.layers) {
      let o = list.head.next!;
      while (o !== list.tail) {
        if (!this.freeze || (o.f58 & 1) !== 0) o.update?.(o);
        o = o.next!;
      }
    }
  }

  *all(): Generator<Obj> {
    for (const list of this.layers) {
      let o = list.head.next!;
      while (o !== list.tail) {
        const next = o.next!;
        yield o;
        o = next;
      }
    }
  }

  drawList(): Obj[] {
    const out: Obj[] = [];
    for (const list of this.layers) {
      for (let o = list.head.next!; o !== list.tail; o = o.next!) if (o.kind === 1) out.push(o);
    }
    return out;
  }
}
