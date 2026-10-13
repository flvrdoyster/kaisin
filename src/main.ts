import { LANG_FILES, Lang, savedLang, savedMode } from "./settings.ts";
import { GameData } from "./data/gameData.ts";
import { Sheets } from "./gfx/sheets.ts";
import { Renderer } from "./gfx/render.ts";
import { Input } from "./input.ts";
import { SoundEffects } from "./audio/se.ts";
import { State, Tables } from "./game/state.ts";
import { setState } from "./game/core.ts";
import { Game, loadCommonSheets } from "./game/game.ts";
import { readTexts } from "./game/text.ts";
import { startMusic, type TrackInfo } from "./audio/music.ts";
import { track } from "./analytics.ts";
import { decodeIndexedPng, type IndexedImage } from "./data/image.ts";

const pad2 = (n: number) => String(n).padStart(2, "0");

const BACKDROPS = ["MAIN_BG", "TITLE_BG", "STAFF_BG", ...Array.from({ length: 7 }, (_, i) => `END_BG_${i}`)];

function imageList(): string[] {
  const names: string[] = [];
  const cns = [
    "ANI_SP", "BOSS_2", "BOSS_3", "BOW3", "CIRCLE_S", "ENDING1", "ENDING2", "ENDING3", "ENDING4", "ENDING5",
    "ENDING6", "ENDING7", "IROIRO_0", "JUMPDEBU", "MAGICIAN", "MAP_DT_1", "MAP_DT_2", "MAP_DT_3", "MAP_DT_4",
    "MAP_DT_5", "MAP_DT_6", "MAP_DT_7", "MAP_DT_8", "MAP_DT_9", "MAP_DT_A", "NIKUWAR2", "NIKUWARM", "PITCHER",
    "RED_T_1", "SMASH", "SPOT_SP", "STAFF", "STAFF_SP", "STATE_DT", "SUUJI_DT", "TAKOSHA", "TITLE_P", "TIT_BG",
    "UNEUNE", "YAMI_SP", "ZAKO_1", "ZAKO_2", "ZAKO_3", "ZAKO_4",
  ];
  for (const c of cns) names.push(`${c}.png`);
  return names;
}

async function fetchFile(root: string, name: string): Promise<Uint8Array> {
  const res = await fetch(`${root}/${name}`);
  if (!res.ok) throw new Error(`${root}/${name}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

interface Loaded {
  ints: Map<string, Int32Array>;
  images: Map<string, IndexedImage>;
  languages: Lang[];
}

async function loadMaps(): Promise<Map<string, Int32Array>> {
  const ints = new Map<string, Int32Array>();
  const read = async (name: string, key: string) => {
    const res = await fetch(`assets/maps/${name}.json`);
    if (!res.ok) throw new Error(`assets/maps/${name}.json: ${res.status}`);
    const data = await res.json();
    if (data.tiles) ints.set(`${key}/tiles`, Int32Array.from(data.tiles));
    if (data.attributes) ints.set(`${key}/attributes`, Int32Array.from(data.attributes));
    if (data.script) ints.set(`${key}/script`, Int32Array.from((data.script as number[][]).flat()));
  };
  await Promise.all([
    ...Array.from({ length: 36 }, (_, i) => read(`room_${pad2(i)}`, `room/${pad2(i)}`)),
    ...BACKDROPS.map((name) => read(`backdrop_${name}`, `backdrop/${name}`)),
  ]);
  return ints;
}

async function loadFiles(): Promise<Loaded> {
  const images = new Map<string, IndexedImage>();
  const get = async (name: string, lang: Lang | null) => {
    images.set(lang ? `${lang}/${name}` : name, await decodeIndexedPng(await fetchFile(lang ? `assets/gfx/${lang}` : "assets/gfx", name)));
  };
  await Promise.all(imageList().filter((name) => !LANG_FILES.has(name)).map((name) => get(name, null)));
  const languages: Lang[] = [];
  for (const lang of ["kr", "jp"] as Lang[]) {
    try {
      await Promise.all([...LANG_FILES].map((name) => get(name, lang)));
      languages.push(lang);
    } catch {
      continue;
    }
  }
  if (languages.length === 0) throw new Error("게임 데이터를 불러오지 못했습니다");
  return { ints: await loadMaps(), images, languages };
}

async function decode(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return ctx.decodeAudioData(await res.arrayBuffer());
}

async function loadAudio(ctx: AudioContext, state: State) {
  const [se, bgm] = await Promise.all([
    fetch("assets/audio/audio.json").then((r) => r.json()),
    fetch("assets/audio/bgm.json").then((r) => r.json()),
  ]);
  const effects = await Promise.all(se.se.map((e: { file: string }) => decode(ctx, `assets/audio/${e.file}`)));
  state.se = new SoundEffects(ctx, effects);
  const tracks = bgm.map((b: { file: string; loop: TrackInfo["loop"] }) => ({ url: `assets/audio/${b.file}`, loop: b.loop }));
  startMusic(ctx, tracks);
}

async function loadWebFonts(table: string) {
  const chars = { kr: new Set<string>(), jp: new Set<string>() };
  for (const line of table.split(/\r?\n/).slice(1)) {
    const cols = line.split("\t");
    if (cols.length < 4) continue;
    for (const c of cols[3]) chars.kr.add(c);
    for (const c of cols[2]) chars.jp.add(c);
  }
  const wait = new Promise<void>((resolve) => setTimeout(resolve, 8000));
  const loads = (["kr", "jp"] as const).flatMap((l) => {
    const family = l === "kr" ? "Noto Sans KR" : "Noto Sans JP";
    const text = [...chars[l]].join("");
    return ["400", "700"].map((w) => document.fonts.load(`${w} 16px "${family}"`, text).catch(() => []));
  });
  await Promise.race([Promise.all(loads), wait]);
}

const DEV = ["localhost", "127.0.0.1"].includes(location.hostname);

async function boot() {
  const params = new URLSearchParams(location.search);
  const status = document.getElementById("status")!;
  status.textContent = "불러오는 중…";
  const textTable = await (await fetch("assets/text/texts.tsv")).text();
  const [{ ints, images, languages }] = await Promise.all([loadFiles(), loadWebFonts(textTable)]);
  const requested = params.get("v") === "jp" ? "jp" : params.get("v") === "kr" ? "kr" : savedLang();
  const lang: Lang = requested && languages.includes(requested) ? requested : languages[0];
  let current: Lang = lang;
  const intsOf = (key: string) => {
    const v = ints.get(key);
    if (!v) throw new Error(`missing ${key}`);
    return v;
  };
  const image = (name: string) => {
    const img = images.get(LANG_FILES.has(name) ? `${current}/${name}` : name);
    if (!img) throw new Error(`missing ${name}`);
    return img;
  };
  const data = new GameData(lang);
  const sheets = new Sheets(image);
  const state = new State(new Tables(data), data, sheets, intsOf);
  setState(state);
  loadCommonSheets();

  const canvas = document.getElementById("screen") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const fontFor = (l: Lang) =>
    l === "kr"
      ? '"Noto Sans KR", "Noto Sans JP", "Gulim", "굴림", "AppleGothic", sans-serif'
      : '"Noto Sans JP", "Noto Sans KR", "MS Gothic", "Osaka", sans-serif';
  const renderer = new Renderer(ctx, sheets, fontFor(lang), data.i32("clipRects"));
  const input = new Input(data.i32("keymap0"));
  const audio = new AudioContext();
  loadAudio(audio, state).catch((e) => console.warn("오디오", e));
  const wake = () => {
    if ((audio.state as string) !== "running") audio.resume().catch(() => {});
  };
  for (const type of ["keydown", "pointerdown", "pointerup", "touchend", "click", "focus", "pageshow"]) addEventListener(type, wake);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });

  const startRoom = params.has("room") ? Number(params.get("room")) : null;
  const SCENES: Record<string, number> = { ending: 5, epilogue: 0xc, clear: 0xe, gameover: 7, tomb: 0xa, status: 0x11 };
  state.scene = SCENES[params.get("scene") ?? ""] ?? (params.get("mode") === "trial" ? 4 : params.has("room") ? 3 : 2);
  let forcedInput: number | null = null;
  state.languages = languages;
  state.lang = lang;
  state.mode = savedMode();
  state.invincible = state.mode === 2 ? 1 : 0;
  state.bugMode = state.mode === 1 ? 1 : 0;
  state.textTable = textTable;
  state.texts = readTexts(textTable, lang);
  state.languageHooks.push(() => {
    current = state.lang;
    renderer.fontFamily = fontFor(state.lang);
  });
  const game = new Game(renderer, () => forcedInput ?? input.read(), startRoom);
  status.textContent = "";
  if (DEV) {
    const run = (frames: number, bits = 0) => {
      forcedInput = bits;
      for (let i = 0; i < frames; i++) {
        game.step();
        game.draw();
      }
      forcedInput = null;
    };
    Object.assign(window, { kaisin: { state, game, run, input } });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) game.autoPause();
  });
  addEventListener("pagehide", () => game.autoPause());

  const FRAME_MS = 40;
  let last = performance.now();
  let acc = 0;
  const loop = (now: number) => {
    acc += now - last;
    last = now;
    if (acc > FRAME_MS * 5) acc = FRAME_MS * 5;
    let stepped = false;
    while (acc >= FRAME_MS) {
      game.step();
      acc -= FRAME_MS;
      stepped = true;
      if (acc >= FRAME_MS) game.draw();
    }
    if (stepped) game.draw();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  track("game_start", { lang });
}

boot().catch((e) => {
  track("load_failed");
  document.getElementById("status")!.textContent = String(e);
  console.error(e);
});
