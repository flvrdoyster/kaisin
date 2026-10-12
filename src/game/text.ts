import { Obj } from "./obj.ts";
import { G, free, spawn } from "./core.ts";
import { freeByUpdate } from "./world.ts";

export interface TextInfo {
  text: string;
  length: number;
  font: number;
}

export function readTexts(table: string, lang: string): TextInfo[] {
  const info = G.data.i32("textInfo");
  const column = lang === "kr" ? 3 : 2;
  const out: TextInfo[] = [];
  for (let i = 0; i < info.length / 5; i++) out.push({ text: "", length: info[i * 5], font: info[i * 5 + 3] });
  for (const line of table.split(/\r?\n/).slice(1)) {
    const cols = line.split("\t");
    const id = Number(cols[0]);
    if (cols.length < 4 || !Number.isInteger(id)) continue;
    while (out.length <= id) out.push({ text: "", length: 0, font: out[154].font });
    out[id].text = cols[column];
    out[id].length = cols[column].length;
  }
  return out;
}

function textUpdate(o: Obj) {
  queueText(o.x, o.y, o.f48, o.f50 !== 0 ? o.f50 : undefined);
  o.f4c--;
  if (o.f4c < 1) free(o);
}

export function queueText(x: number, y: number, id: number, center?: number) {
  if (G.textQueue.length < 0x1f) G.textQueue.push({ x, y, id, center });
}

const LINE_GAP = 44;
const STAGE_CENTER = 256;

function spaced(y: number): number {
  for (const other of liveTextYs()) {
    if (Math.abs(y - other) < LINE_GAP) return y >= other ? other + LINE_GAP : Math.max(0, other - LINE_GAP);
  }
  return y;
}

export function showText(x: number, y: number, id: number, frames: number, center = 0) {
  const stage = G.scene === 0;
  const o = spawn(textUpdate, 1);
  if (!o) return;
  o.kind = 2;
  o.x = x;
  o.y = stage ? spaced(y) : y;
  if (stage) center = STAGE_CENTER;
  o.f48 = id;
  o.f4c = frames;
  o.f50 = center;
  o.f34 = 4;
  o.f58 = 1;
}

export function liveTextYs(): number[] {
  const ys: number[] = [];
  for (const o of G.world.all()) if (o.live && o.update === textUpdate) ys.push(o.y);
  return ys;
}

export function clearTexts() {
  freeByUpdate([textUpdate]);
}

export function showRoomIntro(room: number, i: number) {
  const id = G.t.roomIntroIds[i + room * 4];
  showText(0x40, 0xe0, id, 0x7d);
  showText(0x40, 0x110, id + 1, 0x7d);
}
