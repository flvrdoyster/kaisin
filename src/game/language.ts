import { LANG_FILES, Lang, saveLang } from "../settings.ts";
import { G } from "./core.ts";
import { readTexts } from "./text.ts";
import { track } from "../analytics.ts";

export function setLanguage(lang: Lang) {
  G.lang = lang;
  track("language_change", { lang });
  saveLang(lang);
  for (const hook of G.languageHooks) hook();
  G.sheets.reload(LANG_FILES);
  G.sheets.applyPalette();
  G.texts = readTexts(G.textTable, lang);
}
