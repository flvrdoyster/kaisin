import { selectCharacter } from "../../../src/game/characters.ts";
import { decodeIndexedPng, type IndexedImage } from "../../../src/data/image.ts";
import type { ModContext, Runner } from "../../../src/mods.ts";
import { KIRI_FACE, KIRI_SHEET, registerKiri } from "./kiri.ts";

export const ASSETS = "mods/kiri/assets";
export const SHEET = "KIRI.png";
export const FACE = "KIRI_FACE.png";

export interface KiriArt {
  sheet?: IndexedImage;
  face?: IndexedImage;
  paletteSizes: Map<string, number>;
  errors: Map<string, string>;
  read(name: string): Promise<IndexedImage | undefined>;
  reload(name: string): Promise<void>;
}

function loader(ctx: ModContext): KiriArt {
  const { images, sheets } = ctx;
  const art: KiriArt = {
    paletteSizes: new Map(),
    errors: new Map(),
    async read(name) {
      const res = await fetch(`${ASSETS}/${name}`, { cache: "no-store" });
      if (!res.ok) return undefined;
      try {
        const img = await decodeIndexedPng(new Uint8Array(await res.arrayBuffer()));
        art.errors.delete(name);
        art.paletteSizes.set(name, img.palette.length);
        img.palette = img.palette.slice(0, 16);
        return img;
      } catch (e) {
        art.errors.set(name, `${name} 읽기 실패: ${(e as Error).message}`);
        return undefined;
      }
    },
    async reload(name) {
      const img = await art.read(name);
      if (!img) return;
      images.set(name, img);
      if (name === SHEET) {
        art.sheet = img;
        sheets.reload(new Set([name]));
      } else {
        art.face = img;
        if (sheets.get(KIRI_FACE)) sheets.reload(new Set([name]));
        else sheets.loadGrid(KIRI_FACE, name, 0xf0, 0, 0x80, 0x80);
      }
      sheets.applyPalette();
      selectCharacter("kiri");
    },
  };
  return art;
}

export async function takeover(params: URLSearchParams): Promise<boolean> {
  if (params.get("sheet") !== "kiri") return false;
  const { startSheetEditor } = await import("../dev/sheetEditor.ts");
  await startSheetEditor();
  return true;
}

export async function setup(ctx: ModContext): Promise<Runner | void> {
  const { params, images, sheets, data } = ctx;
  const art = loader(ctx);
  art.sheet = await art.read(SHEET);
  art.face = await art.read(FACE);
  images.set(SHEET, art.sheet ?? images.get("SMASH.png")!);
  if (art.face) images.set(FACE, art.face);
  sheets.loadRects(KIRI_SHEET, SHEET, 0xe0, 0xe0, data.i32("rectSMASH"));
  if (art.face) sheets.loadGrid(KIRI_FACE, FACE, 0xf0, 0, 0x80, 0x80);
  sheets.applyPalette();
  registerKiri();
  if (params.get("char") === "kiri") selectCharacter("kiri");
  if (!(params.has("sprites") || params.has("edit") || params.has("hitbox"))) return;
  const { devSetup } = await import("../dev/index.ts");
  return devSetup(ctx, art);
}
