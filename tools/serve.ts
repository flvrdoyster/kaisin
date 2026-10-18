import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, statSync, watchFile, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { EXPORTS, exportArt } from "./kiri.ts";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 7674);
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".tsv": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

if (process.argv.includes("--watch")) {
  spawn(join(root, "node_modules/.bin/tsc"), ["--watch", "--preserveWatchOutput"], { cwd: root, stdio: "inherit" });
}

const loopback = (a?: string) => a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
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
for (const spec of EXPORTS) {
  if (Math.max(...spec.sources.map(mtime)) > mtime(spec.final)) runExport(spec);
  for (const source of spec.sources) {
    watchFile(join(root, source), { interval: 500 }, (cur, prev) => {
      if (cur.mtimeMs !== prev.mtimeMs && cur.mtimeMs > 0) runExport(spec);
    });
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname.startsWith("/dev/")) {
    if (!loopback(req.socket.remoteAddress)) {
      res.writeHead(403).end();
      return;
    }
    if (url.pathname === "/dev/stat") {
      const f = normalize(url.searchParams.get("f") ?? "");
      const full = join(root, f);
      try {
        if (!(full.startsWith(join(root, "assets/")) || full.startsWith(join(root, "work/"))) || !statSync(full).isFile()) throw new Error();
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ mtime: statSync(full).mtimeMs }));
      } catch {
        res.writeHead(404).end();
      }
      return;
    }
    if (req.method === "PUT" && url.pathname === "/dev/kiri-def") {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8").trim();
          if (body.length > 500000 || typeof JSON.parse(body) !== "object") throw new Error();
          writeFileSync(join(root, "src/data/kiriDef.ts"), `import type { CharDef } from "../game/characters.ts";\n\nexport const KIRI_DEF: CharDef = ${body};\n`);
          res.writeHead(200).end("ok");
        } catch {
          res.writeHead(400).end();
        }
      });
      return;
    }
    if (url.pathname === "/dev/export") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(exportStatus));
      return;
    }
    const spec = EXPORTS.find((e) => e.sources.some((f) => url.pathname === `/dev/${f}`));
    if (req.method === "PUT" && spec) {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        if (body.length > 2_000_000 || !body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
          res.writeHead(400).end();
          return;
        }
        writeFileSync(join(root, url.pathname.slice("/dev/".length)), body);
        runExport(spec);
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(exportStatus[spec.final]);
      });
      return;
    }
    res.writeHead(404).end();
    return;
  }
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const file = join(root, path === "/" ? "index.html" : path);
  if (!file.startsWith(root) || !(path === "/" || path === "/index.html" || path === "/robots.txt" || path === "/sitemap.xml" || path.startsWith("/dist/") || path.startsWith("/assets/") || (path.startsWith("/work/") && loopback(req.socket.remoteAddress)))) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error();
  } catch {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}/`));
