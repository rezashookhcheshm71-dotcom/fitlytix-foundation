#!/usr/bin/env node
// READ-ONLY server inventory + safety backup (P33, stage 1).
//
// Purpose: before git becomes the single source of truth and is deployed over
// the cPanel application, capture exactly what the server holds today. The
// server is known to carry files that git does not (reference-ranges.ts,
// domain/metrics.tsx, domain/carousel.tsx, flx-*.css, migrations 003-006,
// src/api/auth/me.ts, and a set of survey/apply/check scripts). Deploying git
// over them without this step would destroy them permanently.
//
// This script NEVER writes to the application tree and NEVER mutates the
// database. It only reads, and writes into one directory of your choosing.
//
// --- cPanel constraints this file is built for ------------------------------
//   * No Python on the host: Node only.
//   * Upload accepts only png/webp/jpeg/gif/txt/markdown/csv/html/xml/css/
//     javascript/json/pdf. A `.mjs` upload is rejected, so upload this file
//     renamed to `server-inventory.txt` and run it with node directly.
//   * All filenames Latin.
//   * Terminal-copied text is unreliable (spaces are silently dropped), so any
//     text meant to be copied back is printed with "·" in place of spaces.
//
// --- usage ------------------------------------------------------------------
//   node server-inventory.txt --app /home/eugtezmj/public_html/fitlytix-app \
//                             --out /home/eugtezmj/fitlytix-recon-2026-11
//
//   add --copy to also duplicate every inventoried file into <out>/files/
//   add --db   to also capture DESCRIBE output for the live schema
//
// Output in <out>/:
//   manifest.json      path, bytes, mtime, md5 for every file (the recon input)
//   manifest.txt       the same rows with "·" for spaces, safe to copy back
//   files/             verbatim copies, only when --copy is given
//   schema.json        DESCRIBE per table, only when --db is given
import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const APP_DIR = resolve(opt("app", process.cwd()));
const OUT_DIR = resolve(opt("out", "./fitlytix-recon"));
const DO_COPY = flag("copy");
const DO_DB = flag("db");
const MAX_BYTES = Number(opt("max-bytes", 8 * 1024 * 1024));

// Never descend into these: they are regenerable, huge, or secret-bearing.
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".output",
  "dist",
  ".vinxi",
  ".cache",
  "tmp",
  ".arena",
]);
// Read but never copy: real secrets stay on the server. `.env.example` and its
// siblings are committed templates holding no credentials, so they are copied;
// without that carve-out the manifest would show a phantom missing file.
const SECRET_PATTERNS = [
  /^\.env$/,
  /^\.env\.(?!example$|sample$|template$|dist$)/,
  /id_rsa/,
  /credentials?$/i,
  /\.pem$/,
  /\.key$/,
];

/** Terminal copy is lossy for spaces, so anything copied back uses "·". */
const dot = (s) => String(s).split(" ").join("·");

function walk(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    acc.errors.push({ path: toRel(dir), error: `unreadable: ${err.code ?? err.message}` });
    return acc;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      acc.skipped.push({ path: toRel(abs), reason: "symlink (not followed)" });
      continue;
    }
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        acc.skipped.push({ path: toRel(abs), reason: `skip-dir:${entry.name}` });
        continue;
      }
      walk(abs, acc);
      continue;
    }
    if (!entry.isFile()) {
      acc.skipped.push({ path: toRel(abs), reason: `not-a-file:${entry.kind ?? "unknown"}` });
      continue;
    }
    acc.files.push(abs);
  }
  return acc;
}

const toRel = (abs) => relative(APP_DIR, abs).split(sep).join("/");
const isSecret = (rel) => SECRET_PATTERNS.some((re) => re.test(rel));

function inspect(abs) {
  const rel = toRel(abs);
  const st = statSync(abs);
  const row = {
    path: rel,
    bytes: st.size,
    mtime: st.mtime.toISOString(),
    md5: null,
    lines: null,
    secret: isSecret(rel),
  };
  if (st.size > MAX_BYTES) {
    row.note = `larger than max-bytes (${st.size}); hash skipped`;
    return row;
  }
  const buf = readFileSync(abs);
  row.md5 = createHash("md5").update(buf).digest("hex");
  // Line count only for text-ish files; binary content would be meaningless.
  if (/\.(ts|tsx|js|mjs|cjs|jsx|json|css|scss|html|md|sql|txt|yml|yaml|env)$/i.test(rel)) {
    row.lines = buf.toString("utf8").split("\n").length;
  }
  return row;
}

async function copyFile(abs, rel) {
  const dest = join(OUT_DIR, "files", rel);
  mkdirSync(join(dest, ".."), { recursive: true });
  await pipeline(Readable.from(readFileSync(abs)), createWriteStream(dest));
}

/** Live schema capture. Requires the app's own DB env; never guesses columns. */
async function captureSchema() {
  const envPath = join(APP_DIR, ".env");
  if (!existsSync(envPath)) return { ok: false, error: ".env not found in --app directory" };
  // Parse only the keys we need; do not eval the file.
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const host = env.DB_HOST ?? env.MYSQL_HOST;
  const user = env.DB_USER ?? env.MYSQL_USERNAME;
  const pass = env.DB_PASSWORD ?? env.MYSQL_PASSWORD;
  const name = env.DB_NAME ?? env.MYSQL_DATABASE;
  if (!host || !user || !name) {
    return { ok: false, error: "DB_HOST/DB_USER/DB_NAME missing from .env" };
  }
  let mysql;
  try {
    ({ default: mysql } = await import("mysql2/promise"));
  } catch {
    return { ok: false, error: "mysql2 not resolvable from this working directory" };
  }
  let conn;
  try {
    // The database is reachable only from inside the Node process on this host.
    conn = await mysql.createConnection({ host, user, password: pass, database: name });
    const [tables] = await conn.query("SHOW TABLES");
    const key = Object.keys(tables[0] ?? {})[0];
    const schema = {};
    for (const row of tables) {
      const table = row[key];
      const [cols] = await conn.query(`DESCRIBE \`${table}\``);
      const [countRows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
      schema[table] = { columns: cols, rows: countRows[0]?.n ?? null };
    }
    return { ok: true, database: name, schema };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

// --- run ---------------------------------------------------------------------

if (!existsSync(APP_DIR)) {
  console.error(`--app directory does not exist: ${APP_DIR}`);
  process.exit(2);
}
mkdirSync(OUT_DIR, { recursive: true });
if (DO_COPY) mkdirSync(join(OUT_DIR, "files"), { recursive: true });

const acc = walk(APP_DIR, { files: [], skipped: [], errors: [] });
const rows = [];
for (const abs of acc.files) {
  try {
    rows.push(inspect(abs));
  } catch (err) {
    acc.errors.push({ path: toRel(abs), error: `inspect failed: ${err.message}` });
  }
}
rows.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  generatedAt: new Date().toISOString(),
  appDir: APP_DIR,
  node: process.version,
  counts: {
    files: rows.length,
    bytes: rows.reduce((n, r) => n + r.bytes, 0),
    skipped: acc.skipped.length,
    errors: acc.errors.length,
  },
  files: rows,
  skipped: acc.skipped,
  errors: acc.errors,
};

writeFileSync(join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

// Copy-safe rendering: "·" replaces every space so a terminal paste cannot
// silently drop one and corrupt an md5 or a path.
const txt = [
  `FitLytix·server·inventory·${manifest.generatedAt}`,
  `appDir·${dot(APP_DIR)}`,
  `node·${process.version}`,
  `files·${rows.length}·bytes·${manifest.counts.bytes}·skipped·${acc.skipped.length}·errors·${acc.errors.length}`,
  "",
  "md5·······························bytes·····lines····path",
  // padStart/padEnd fill with spaces, and a terminal paste silently drops them,
  // so the assembled row is passed through dot() one more time. This is what
  // makes the file genuinely copy-safe rather than merely looking aligned.
  ...rows.map((r) =>
    dot(
      [
        (r.md5 ?? "-").padEnd(32),
        String(r.bytes).padStart(8),
        String(r.lines ?? "-").padStart(6),
        r.path,
      ].join("·"),
    ),
  ),
  "",
];
if (acc.errors.length) txt.push(`errors·${JSON.stringify(acc.errors)}`);
writeFileSync(join(OUT_DIR, "manifest.txt"), txt.join("\n"), "utf8");

let copied = 0;
let secretsHeld = 0;
if (DO_COPY) {
  for (const r of rows) {
    if (r.secret) {
      secretsHeld += 1;
      continue; // never duplicate a secret off the server
    }
    if (r.md5 === null) continue;
    try {
      await copyFile(join(APP_DIR, r.path), r.path);
      copied += 1;
    } catch (err) {
      acc.errors.push({ path: r.path, error: `copy failed: ${err.message}` });
    }
  }
}

let schemaNote = "skipped (pass --db)";
if (DO_DB) {
  const schema = await captureSchema();
  writeFileSync(join(OUT_DIR, "schema.json"), `${JSON.stringify(schema, null, 2)}\n`, "utf8");
  schemaNote = schema.ok
    ? `${Object.keys(schema.schema).length} tables captured`
    : `FAILED: ${schema.error}`;
}

console.log("");
console.log("FitLytix server inventory - read only");
console.log(`  app      ${APP_DIR}`);
console.log(`  out      ${OUT_DIR}`);
console.log(`  files    ${rows.length} (${manifest.counts.bytes} bytes)`);
console.log(`  skipped  ${acc.skipped.length} (node_modules, .git, symlinks, ...)`);
console.log(`  errors   ${acc.errors.length}`);
console.log(`  copied   ${DO_COPY ? copied : "0 (--copy not given)"}`);
if (secretsHeld) console.log(`  secrets  ${secretsHeld} inventoried but NOT copied`);
console.log(`  schema   ${schemaNote}`);
console.log("");
console.log("Next: send manifest.txt back. Compare it against the git inventory with");
console.log("  node scripts/recon/compare.mjs --server <manifest.json> --git <git-manifest.json>");
console.log("");
process.exit(acc.errors.length > 0 && rows.length === 0 ? 1 : 0);
