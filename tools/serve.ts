import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface ModServer {
  start?(): void;
  handle?(req: IncomingMessage, res: ServerResponse, path: string): boolean;
}

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

const mods = (existsSync(join(root, "mods")) ? readdirSync(join(root, "mods"), { withFileTypes: true }) : [])
  .filter((d) => d.isDirectory() && existsSync(join(root, "mods", d.name, "src/index.ts")))
  .map((d) => d.name);
const extensions: ModServer[] = [];
for (const name of mods) {
  const file = join(root, "mods", name, "tools/serve.ts");
  if (!existsSync(file)) continue;
  const ext: ModServer = await import(pathToFileURL(file).href);
  ext.start?.();
  extensions.push(ext);
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
        if (!(full.startsWith(join(root, "assets/")) || full.startsWith(join(root, "mods/"))) || !statSync(full).isFile()) throw new Error();
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ mtime: statSync(full).mtimeMs }));
      } catch {
        res.writeHead(404).end();
      }
      return;
    }
    if (url.pathname === "/dev/mods") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(mods));
      return;
    }
    if (extensions.some((ext) => ext.handle?.(req, res, url.pathname))) return;
    res.writeHead(404).end();
    return;
  }
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const file = join(root, path === "/" ? "index.html" : path);
  if (!file.startsWith(root) || !(path === "/" || path === "/index.html" || path === "/robots.txt" || path === "/sitemap.xml" || /^\/naver[0-9a-f]+\.html$/.test(path) || path.startsWith("/dist/") || path.startsWith("/assets/") || (path.startsWith("/mods/") && loopback(req.socket.remoteAddress)))) {
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
