import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "site");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of ["index.html", "dist", "assets"]) cpSync(join(root, name), join(out, name), { recursive: true });
console.log(`site: ${out}`);
