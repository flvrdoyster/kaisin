import { selectCharacter } from "../../../src/game/characters.ts";
import type { ModContext, Runner } from "../../../src/mods.ts";
import { ASSETS, FACE, SHEET, type KiriArt } from "../src/index.ts";
import { formatDef, getKiriDef } from "../src/kiri.ts";
import { checkFace, checkSheet } from "./sheetCheck.ts";
import { hitboxHooks } from "./hitbox.ts";
import { SpriteViewer, type DevHooks } from "./sprites.ts";

export function devSetup(ctx: ModContext, art: KiriArt): Runner | void {
  const { params, images, data, state, renderer } = ctx;
  const sprites = params.get("sprites");
  const editing = params.get("edit") !== null;
  if (sprites !== "smash" && (sprites !== null || editing)) selectCharacter("kiri");
  if (params.has("hitbox")) state.debug = hitboxHooks();
  Object.assign((window as unknown as { kaisin?: object }).kaisin ?? {}, { def: getKiriDef });
  if (sprites === null && !editing) return;
  const hooks: DevHooks = {
    watch: [`${ASSETS}/${SHEET}`, `${ASSETS}/${FACE}`],
    warnings: () => [
      ...art.errors.values(),
      ...checkSheet(art.sheet, art.paletteSizes.get(SHEET) ?? 0, data.i32("rectSMASH"), images.get("SMASH.png")!),
      ...checkFace(art.face, art.paletteSizes.get(FACE) ?? 0),
    ],
    refresh: (name) => art.reload(name),
    save: async (def) => {
      const res = await fetch("/dev/kiri-def", { method: "PUT", body: formatDef(def) });
      return res.ok;
    },
  };
  return new SpriteViewer(renderer, hooks, editing, sprites === "smash");
}
