#!/usr/bin/env node
// READ-ONLY git-side inventory (P33, stage 1).
//
// Counterpart to scripts/recon/server-inventory.mjs. Produces the same manifest
// shape so compare.mjs can diff the two directly.
//
// Inventory is taken from a git REV (default HEAD), not from the working tree:
// the P33 question is "what is committed" versus "what is running on cPanel".
// Uncommitted work is reported separately so it cannot hide inside either side.
//
//   node scripts/recon/git-inventory.mjs --out /tmp/git-manifest.json [--rev HEAD]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const REV = opt("rev", "HEAD");
const OUT = resolve(opt("out", "/tmp/fitlytix-git-manifest.json"));

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// `--format` alone: git rejects it combined with `--long`, because --long
// already implies its own fixed layout. Verified against git 2.39.5.
const listing = git(["ls-tree", "-r", "--format=%(objectmode) %(objectname) %(path)", REV])
  .split("\n")
  .filter(Boolean);

const rows = [];
for (const line of listing) {
  const m = /^(\d+) ([0-9a-f]{40}) (.+)$/.exec(line);
  if (!m) {
    rows.push({ path: line, error: "unparsed ls-tree line" });
    continue;
  }
  const [, mode, sha, path] = m;
  // Blob content is hashed exactly as stored, so the md5 is comparable with the
  // server-side hash of the same bytes.
  const buf = execFileSync("git", ["cat-file", "blob", sha], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const text = buf.toString("utf8");
  rows.push({
    path,
    bytes: buf.length,
    md5: createHash("md5").update(buf).digest("hex"),
    lines: /\.(ts|tsx|js|mjs|cjs|jsx|json|css|scss|html|md|sql|txt|yml|yaml)$/i.test(path)
      ? text.split("\n").length
      : null,
    gitMode: mode,
    gitSha: sha,
    secret: false,
  });
}
rows.sort((a, b) => a.path.localeCompare(b.path));

// Working-tree state, reported but not mixed into the manifest rows.
let dirty = [];
try {
  dirty = git(["status", "--porcelain"])
    .split("\n")
    .filter(Boolean)
    .map((l) => ({ status: l.slice(0, 2).trim(), path: l.slice(3) }));
} catch (err) {
  dirty = [{ status: "error", path: err.message }];
}

const manifest = {
  generatedAt: new Date().toISOString(),
  source: `git:${REV}`,
  rev: git(["rev-parse", REV]).trim(),
  node: process.version,
  counts: {
    files: rows.length,
    bytes: rows.reduce((n, r) => n + (r.bytes ?? 0), 0),
    dirty: dirty.length,
  },
  files: rows,
  uncommitted: dirty,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log("");
console.log("FitLytix git inventory - read only");
console.log(`  rev      ${manifest.rev.slice(0, 12)} (${REV})`);
console.log(`  files    ${rows.length} (${manifest.counts.bytes} bytes)`);
console.log(`  dirty    ${dirty.length} uncommitted path(s)`);
console.log(`  out      ${OUT}`);
console.log("");
console.log("Next: compare against the server manifest with");
console.log(`  node scripts/recon/compare.mjs --git ${OUT} --server <server manifest.json>`);
console.log("");
