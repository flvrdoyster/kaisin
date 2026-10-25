import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "site");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const verification = readdirSync(root).filter((n) => /^naver[0-9a-f]+\.html$/.test(n));
for (const name of ["index.html", "robots.txt", "sitemap.xml", "thumbnail-kaisin.png", "dist", "assets", ...verification]) cpSync(join(root, name), join(out, name), { recursive: true });
console.log(`site: ${out}`);
