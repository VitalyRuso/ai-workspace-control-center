import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 8080);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function json(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");

  if (url.pathname === "/health") {
    json(response, 200, {
      ok: true,
      service: "ai-workspace-control-center-demo",
      demoMode: true
    });
    return;
  }

  if (url.pathname === "/api/apps") {
    json(response, 200, { apps: [], demoMode: true });
    return;
  }

  if (url.pathname === "/api/logs") {
    json(response, 200, { logs: [], demoMode: true });
    return;
  }

  if (url.pathname === "/api/workflows") {
    json(response, 200, { workflows: [], demoMode: true });
    return;
  }

  if (url.pathname === "/api/workflows/targets") {
    json(response, 200, { targets: [], demoMode: true });
    return;
  }

  if (url.pathname === "/api/workflows/runs") {
    json(response, 200, { runs: [], demoMode: true });
    return;
  }

  if (url.pathname === "/api/workspace-shell/status") {
    json(response, 200, {
      safeMode: true,
      demoMode: true,
      localWorkerOnline: false,
      appsTotal: 0,
      toolsTotal: 0,
      runningTools: 0
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    json(response, 200, {
      ok: false,
      demoMode: true,
      localWorkerOnline: false,
      message: "This public demo currently provides the interface only. Live generation will be connected through Vitaly's Local Worker."
    });
    return;
  }

  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(publicDir, "." + requested);

  if (!filePath.startsWith(publicDir + path.sep) && filePath !== publicDir) {
    json(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      "content-type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    response.end(data);
  } catch {
    try {
      const index = await fs.readFile(path.join(publicDir, "index.html"));
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(index);
    } catch {
      json(response, 404, { error: "Not found" });
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Control Center demo listening on 0.0.0.0:${port}`);
});
