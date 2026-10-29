import type { IndexedImage } from "./data/image.ts";
import type { GameData } from "./data/gameData.ts";
import type { Sheets } from "./gfx/sheets.ts";
import type { Renderer } from "./gfx/render.ts";
import type { State } from "./game/state.ts";
import type { Game } from "./game/game.ts";

export interface Runner {
  step(): void;
  draw(): void;
}

export interface ModContext {
  params: URLSearchParams;
  images: Map<string, IndexedImage>;
  sheets: Sheets;
  data: GameData;
  state: State;
  renderer: Renderer;
  game: Game;
}

export interface Mod {
  takeover?(params: URLSearchParams): Promise<boolean>;
  setup?(ctx: ModContext): Promise<Runner | void>;
}

export async function loadMods(): Promise<Mod[]> {
  let names: string[];
  try {
    const res = await fetch("/dev/mods", { cache: "no-store" });
    if (!res.ok) return [];
    names = await res.json();
  } catch {
    return [];
  }
  const mods: Mod[] = [];
  for (const name of names) {
    const path = `../mods/${name}/src/index.js`;
    try {
      mods.push(await import(path));
    } catch (e) {
      console.warn(`확장 ${name}`, e);
    }
  }
  return mods;
}
