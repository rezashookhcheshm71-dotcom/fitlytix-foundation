#!/usr/bin/env node
// READ-ONLY comparison of the two inventories (P33, stage 1).
//
//   node scripts/recon/compare.mjs --git <git-manifest.json> --server <manifest.json>
//
// Answers the only question that matters before deploying git over the server:
//   1. what exists ONLY on the server  -> would be destroyed by a git deploy
//   2. what exists ONLY in git         -> new, safe to deploy
//   3. what exists in both but differs -> needs a human decision, file by file
//
// Nothing is written back to either tree. Exits 1 when server-only files are
// found, because that is the case where deploying would lose work.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "";
};

const GIT_PATH = opt("git");
const SERVER_PATH = opt("server");
const OUT_PATH = opt("out");

if (!GIT_PATH || !SERVER_PATH) {
  console.error("usage: node scripts/recon/compare.mjs --git <git.json> --server <server.json>");
  console.error("       [--out <report.json>]");
  process.exit(2);
}

function load(label, path) {
  try {
    const data = JSON.parse(readFileSync(resolve(path), "utf8"));
    if (!Array.isArray(data.files)) throw new Error("manifest has no files array");
    return data;
  } catch (err) {
    console.error(`cannot read ${label} manifest at ${path}: ${err.message}`);
    process.exit(2);
  }
}

const gitMan = load("git", GIT_PATH);
const srvMan = load("server", SERVER_PATH);

const index = (man) => new Map(man.files.filter((f) => f.path).map((f) => [f.path, f]));
const gitFiles = index(gitMan);
const srvFiles = index(srvMan);

// Lock files describe a dependency tree, not application code. They differ on
// every install and would drown the real signal, so they are listed apart.
const isNoise = (p) => /^(package-lock\.json|bun\.lock|pnpm-lock\.yaml|yarn\.lock)$/.test(p);
// Generated at build time; never a reconciliation decision.
const isGenerated = (p) => /^(src\/routeTree\.gen\.ts|\.output\/|dist\/)/.test(p);

const serverOnly = [];
const gitOnly = [];
const differs = [];
const identical = [];
const noise = [];

for (const [path, s] of srvFiles) {
  const g = gitFiles.get(path);
  if (isNoise(path) || isGenerated(path)) {
    noise.push({ path, kind: isNoise(path) ? "lockfile" : "generated" });
    continue;
  }
  if (!g) {
    serverOnly.push({ path, bytes: s.bytes, md5: s.md5, lines: s.lines });
    continue;
  }
  if (s.md5 && g.md5 && s.md5 !== g.md5) {
    differs.push({
      path,
      server: { bytes: s.bytes, md5: s.md5, lines: s.lines },
      git: { bytes: g.bytes, md5: g.md5, lines: g.lines },
      byteDelta: (s.bytes ?? 0) - (g.bytes ?? 0),
    });
  } else {
    identical.push(path);
  }
}

for (const [path, g] of gitFiles) {
  if (isNoise(path) || isGenerated(path)) continue;
  if (!srvFiles.has(path)) gitOnly.push({ path, bytes: g.bytes, md5: g.md5, lines: g.lines });
}

serverOnly.sort((a, b) => a.path.localeCompare(b.path));
gitOnly.sort((a, b) => a.path.localeCompare(b.path));
differs.sort((a, b) => a.path.localeCompare(b.path));

const report = {
  generatedAt: new Date().toISOString(),
  git: { manifest: GIT_PATH, rev: gitMan.rev, source: gitMan.source },
  server: { manifest: SERVER_PATH, appDir: srvMan.appDir, generatedAt: srvMan.generatedAt },
  counts: {
    serverOnly: serverOnly.length,
    gitOnly: gitOnly.length,
    differs: differs.length,
    identical: identical.length,
    noise: noise.length,
  },
  serverOnly,
  gitOnly,
  differs,
  noise,
};

if (OUT_PATH) {
  writeFileSync(resolve(OUT_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

const dot = (s) => String(s).split(" ").join("·");

console.log("");
console.log("FitLytix recon - git vs server");
console.log(`  git     ${(gitMan.rev ?? "?").slice(0, 12)}`);
console.log(`  server  ${srvMan.appDir ?? "?"}`);
console.log("");

if (serverOnly.length) {
  console.log(`  !! SERVER-ONLY (${serverOnly.length}) - a git deploy would DESTROY these:`);
  for (const f of serverOnly) {
    console.log(`     ${String(f.bytes ?? "?").padStart(8)}b  ${dot(f.path)}`);
  }
  console.log("");
} else {
  console.log("  server-only: none - nothing on the server is missing from git");
}

if (differs.length) {
  console.log(`  DIFFERS (${differs.length}) - needs a decision per file:`);
  for (const f of differs) {
    const sign = f.byteDelta > 0 ? "+" : "";
    console.log(
      `     server ${String(f.server.bytes).padStart(8)}b / git ${String(f.git.bytes).padStart(8)}b` +
        ` (${sign}${f.byteDelta})  ${dot(f.path)}`,
    );
  }
  console.log("");
} else {
  console.log("  differs: none - every shared file matches byte for byte");
}

console.log(`  git-only:   ${gitOnly.length} (new from git, safe to deploy)`);
console.log(`  identical:  ${identical.length}`);
console.log(`  ignored:    ${noise.length} (lockfiles and generated files)`);
if (gitMan.uncommitted?.length) {
  console.log(`  note:       ${gitMan.uncommitted.length} uncommitted path(s) in the git tree`);
}
console.log("");

if (OUT_PATH) console.log(`  report written to ${resolve(OUT_PATH)}`);
console.log("");

// Server-only files are the dangerous case, so the exit code flags them.
process.exit(serverOnly.length > 0 ? 1 : 0);
