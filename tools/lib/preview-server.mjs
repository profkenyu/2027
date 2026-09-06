import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".woff2": "font/woff2"
};

export async function startPreviewServer({ routes = {} } = {}) {
  await mkdir(resolve(ROOT, "dist"), { recursive: true });
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (Object.hasOwn(routes, pathname)) {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(routes[pathname]);
        return;
      }
      const path = resolve(ROOT, "." + pathname);
      if (!path.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(path);
      response.setHeader("Content-Type", MIME[extname(path)] ?? "application/octet-stream");
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    })
  };
}
