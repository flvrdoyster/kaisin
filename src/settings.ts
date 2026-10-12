export type Lang = "kr" | "jp";

export const LANG_FILES = new Set([
  "ENDING5.png",
  "MAP_DT_5.png",
  "STAFF.png",
  "STAFF_SP.png",
  "STATE_DT.png",
  "TITLE_P.png",
]);

const KEY = "kaisin.lang";

export function savedLang(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "kr" || v === "jp" ? v : null;
  } catch {
    return null;
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    return;
  }
}

export type Mode = 0 | 1 | 2;

export function savedMode(): Mode {
  try {
    const v = Number(localStorage.getItem("kaisin.mode"));
    return v === 1 || v === 2 ? v : 0;
  } catch {
    return 0;
  }
}

export function saveMode(mode: Mode) {
  try {
    localStorage.setItem("kaisin.mode", String(mode));
  } catch {
    return;
  }
}
