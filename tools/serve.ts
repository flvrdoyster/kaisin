import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 5179);
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

createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const file = join(root, path === "/" ? "index.html" : path);
  if (!file.startsWith(root) || !(path === "/" || path === "/index.html" || path.startsWith("/dist/") || path.startsWith("/assets/"))) {
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
