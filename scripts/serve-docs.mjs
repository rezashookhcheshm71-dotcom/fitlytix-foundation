// Dev-only static server for docs/ prototypes (Node 22, zero dependencies).
// Production server has no Python, so this stays Node-only by design.
// Usage: node scripts/serve-docs.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "docs");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const HOST = "0.0.0.0"; // must accept the proxied preview host, not just localhost

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

/** Directory listing so every prototype under docs/ is reachable. */
async function listing() {
  const entries = (await readdirSorted(ROOT)).filter((n) => !n.startsWith("."));
  const rows = await Promise.all(
    entries.map(async (name) => {
      const st = await stat(join(ROOT, name)).catch(() => null);
      const dir = st?.isDirectory();
      return `<li><a href="/${encodeURIComponent(name)}${dir ? "/" : ""}">${dir ? "📁 " : ""}${name}</a></li>`;
    }),
  );
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>FitLytix docs</title>
<style>body{background:#1a1a1f;color:#f2f2f0;font:15px/1.8 system-ui,sans-serif;padding:32px}
a{color:#f0873a;text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:19px;margin:0 0 4px}p{color:#a0a0a8;margin:0 0 20px;font-size:13px}
ul{list-style:none;padding:0}li{padding:5px 0;border-bottom:1px solid #ffffff14}</style></head>
<body><h1>FitLytix — docs/ prototypes</h1>
<p><a href="/visual-map.html">← visual-map.html · نقشه‌یِ وضعیت و پیشنهادها</a></p>
<ul>${rows.join("")}</ul></body></html>`;
}

async function readdirSorted(dir) {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(dir)).sort((a, b) => a.localeCompare(b));
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    let rel = decodeURIComponent(url.pathname);

    if (rel === "/" || rel === "")
      return send(res, 200, "text/html; charset=utf-8", await listing());

    // Map /index.html to the visual deck so the preview root lands on it.
    if (rel === "/index.html") rel = "/visual-map.html";

    // Path-traversal guard: stay inside ROOT.
    const target = resolve(join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, "")));
    if (!target.startsWith(ROOT)) return send(res, 403, "text/plain; charset=utf-8", "forbidden");

    const st = await stat(target).catch(() => null);
    if (!st) return send(res, 404, "text/plain; charset=utf-8", "not found");
    if (st.isDirectory()) {
      const sub = await readdirSorted(target).then((e) => e.filter((n) => !n.startsWith(".")));
      const body = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><body style="background:#1a1a1f;color:#f2f2f0;font:15px system-ui;padding:32px">
<h2>${url.pathname}</h2><ul>${sub.map((n) => `<li><a style="color:#f0873a" href="${encodeURIComponent(n)}">${n}</a></li>`).join("")}</ul>
<p><a style="color:#f0873a" href="/">← بالا</a></p></body></html>`;
      return send(res, 200, "text/html; charset=utf-8", body);
    }

    const type = MIME[extname(target).toLowerCase()] ?? "application/octet-stream";
    return send(res, 200, type, await readFile(target));
  } catch (err) {
    return send(
      res,
      500,
      "text/plain; charset=utf-8",
      `error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}).listen(PORT, HOST, () => {
  console.log(`[serve-docs] http://${HOST}:${PORT}/ → ${ROOT}`);
  console.log(`[serve-docs] deck: http://${HOST}:${PORT}/visual-map.html`);
});

function send(res, status, type, body) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}
