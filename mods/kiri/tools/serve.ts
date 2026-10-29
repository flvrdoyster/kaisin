import type { IncomingMessage, ServerResponse } from "node:http";
import { statSync, watchFile, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EXPORTS, exportArt } from "./export.ts";

const root = resolve(import.meta.dirname, "../../..");
const mtime = (f: string) => {
  try {
    return statSync(join(root, f)).mtimeMs;
  } catch {
    return -1;
  }
};

const exportStatus: Record<string, string> = {};
const exported: Record<string, number> = {};
function runExport(spec: (typeof EXPORTS)[number]) {
  const m = spec.sources.map(mtime).join(",");
  if (exported[spec.final] === m) return;
  exported[spec.final] = m;
  try {
    exportStatus[spec.final] = exportArt(spec);
  } catch (e) {
    exportStatus[spec.final] = `${spec.final} 내보내기 실패: ${(e as Error).message}`;
  }
  console.log(exportStatus[spec.final]);
}

export function start() {
  for (const spec of EXPORTS) {
    if (Math.max(...spec.sources.map(mtime)) > mtime(spec.final)) runExport(spec);
    for (const source of spec.sources) {
      watchFile(join(root, source), { interval: 500 }, (cur, prev) => {
        if (cur.mtimeMs !== prev.mtimeMs && cur.mtimeMs > 0) runExport(spec);
      });
    }
  }
}

function body(req: IncomingMessage, done: (b: Buffer) => void) {
  const chunks: Buffer[] = [];
  req.on("data", (c: Buffer) => chunks.push(c));
  req.on("end", () => done(Buffer.concat(chunks)));
}

export function handle(req: IncomingMessage, res: ServerResponse, path: string): boolean {
  if (req.method === "PUT" && path === "/dev/kiri-def") {
    body(req, (b) => {
      try {
        const text = b.toString("utf8").trim();
        if (text.length > 500000 || typeof JSON.parse(text) !== "object") throw new Error();
        writeFileSync(join(root, "mods/kiri/src/hitboxDef.ts"), `import type { CharDef } from "./kiri.ts";\n\nexport const KIRI_DEF: CharDef = ${text};\n`);
        res.writeHead(200).end("ok");
      } catch {
        res.writeHead(400).end();
      }
    });
    return true;
  }
  if (path === "/dev/export") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(exportStatus));
    return true;
  }
  const spec = EXPORTS.find((e) => e.sources.some((f) => path === `/dev/${f}`));
  if (req.method === "PUT" && spec) {
    body(req, (b) => {
      if (b.length > 2_000_000 || !b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        res.writeHead(400).end();
        return;
      }
      writeFileSync(join(root, path.slice("/dev/".length)), b);
      runExport(spec);
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(exportStatus[spec.final]);
    });
    return true;
  }
  return false;
}
