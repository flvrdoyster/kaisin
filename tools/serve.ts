import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

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

const SAVABLE = /^\/dev\/(characters\/[a-z-]+\.json)$/;
const SAVABLE_PNG = /^\/dev\/(gfx\/KIRI_BASE\.png)$/;
const loopback = (a?: string) => a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname.startsWith("/dev/")) {
    if (!loopback(req.socket.remoteAddress)) {
      res.writeHead(403).end();
      return;
    }
    if (url.pathname === "/dev/stat") {
      const f = normalize(url.searchParams.get("f") ?? "");
      const full = join(root, "assets", f);
      try {
        if (!full.startsWith(join(root, "assets")) || !statSync(full).isFile()) throw new Error();
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ mtime: statSync(full).mtimeMs }));
      } catch {
        res.writeHead(404).end();
      }
      return;
    }
    const png = SAVABLE_PNG.exec(url.pathname);
    if (req.method === "PUT" && png) {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        if (body.length > 2_000_000 || !body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
          res.writeHead(400).end();
          return;
        }
        writeFileSync(join(root, "assets", png[1]), body);
        res.writeHead(200).end("ok");
      });
      return;
    }
    const m = SAVABLE.exec(url.pathname);
    if (req.method === "PUT" && m) {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          JSON.parse(body);
          if (body.length > 500000) throw new Error();
          const dir = join(root, "assets/characters");
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(root, "assets", m[1]), body);
          res.writeHead(200).end("ok");
        } catch {
          res.writeHead(400).end();
        }
      });
      return;
    }
    res.writeHead(404).end();
    return;
  }
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const file = join(root, path === "/" ? "index.html" : path);
  if (!file.startsWith(root) || !(path === "/" || path === "/index.html" || path === "/robots.txt" || path === "/sitemap.xml" || path.startsWith("/dist/") || path.startsWith("/assets/"))) {
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
