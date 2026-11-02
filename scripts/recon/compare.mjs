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

// --- known-artifact fingerprints --------------------------------------------
// docs/project-prompts.md records md5 fingerprints for fourteen files that
// exist only on the server. Matching them turns the recon from "a list of
// files" into "positively identified files", and exposes any file that has
// drifted since the spec was written.
// Overridable so a fixture can exercise the matcher, and so a future spec can
// ship a fresh fingerprint list without editing this file.
const KNOWN_ARG = opt("known");
const KNOWN_PATH = KNOWN_ARG
  ? resolve(KNOWN_ARG)
  : new URL("./known-artifacts.json", import.meta.url);

function matchKnown() {
  let known;
  try {
    known = JSON.parse(readFileSync(KNOWN_PATH, "utf8"));
  } catch (err) {
    return { available: false, rows: [], error: err.message };
  }
  const baseName = (p) => String(p).split("/").pop();
  const byBase = new Map();
  for (const [path, f] of srvFiles) {
    const b = baseName(path);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push({ path, ...f });
  }

  const rows = known.map((k) => {
    const hits = byBase.get(k.file) ?? [];
    if (hits.length === 0) {
      return { file: k.file, state: "absent", detail: "not found on the server" };
    }
    // A basename may appear more than once (e.g. a backup copy); report each.
    return hits.map((h) => {
      let state;
      let detail;
      if (k.md5Complete && h.md5) {
        if (h.md5 === k.md5) {
          state = "confirmed";
          detail = "md5 matches the spec exactly";
        } else {
          // This is the interesting failure: the file is not what the spec
          // recorded, so it changed after the spec was written.
          state = "drifted";
          detail = `md5 ${h.md5} differs from spec ${k.md5}`;
        }
      } else if (h.md5 && h.md5.startsWith(k.md5Prefix)) {
        state = "prefix-match";
        detail = `md5 starts with ${k.md5Prefix}; the spec recorded only a prefix`;
      } else if (h.md5) {
        state = "unverified";
        detail = `spec recorded only prefix ${k.md5Prefix}, actual ${h.md5} does not start with it`;
      } else {
        state = "unhashable";
        detail = "server manifest has no md5 for this file";
      }
      const sizeNote =
        k.sizeBytes != null && h.bytes != null && k.sizeBytes !== h.bytes
          ? ` (spec size ${k.sizeBytes}, actual ${h.bytes})`
          : "";
      return { file: k.file, path: h.path, state, detail: detail + sizeNote, bytes: h.bytes };
    });
  });
  return { available: true, rows: rows.flat() };
}

const known = matchKnown();
const DRIFT_STATES = new Set(["drifted", "unverified"]);
const knownDrift = known.rows.filter((r) => DRIFT_STATES.has(r.state));
const knownAbsent = known.rows.filter((r) => r.state === "absent");

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
  knownArtifacts: known.available
    ? {
        matched: known.rows.length,
        drifted: knownDrift.length,
        absent: knownAbsent.length,
        rows: known.rows,
      }
    : { matched: 0, note: "known-artifacts.json unavailable" },
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
if (known.available && known.rows.length) {
  console.log("");
  console.log(
    `  known artifacts: ${known.rows.length} matched, ${knownDrift.length} drifted, ` +
      `${knownAbsent.length} absent from the server`,
  );
  for (const r of known.rows) {
    const tag = r.state.toUpperCase().padEnd(12);
    console.log(`     ${tag} ${dot(r.file)}${r.detail ? `  - ${r.detail}` : ""}`);
  }
}
console.log(`  ignored:    ${noise.length} (lockfiles and generated files)`);
if (gitMan.uncommitted?.length) {
  console.log(`  note:       ${gitMan.uncommitted.length} uncommitted path(s) in the git tree`);
}
console.log("");

if (OUT_PATH) console.log(`  report written to ${resolve(OUT_PATH)}`);
console.log("");

// Server-only files are the dangerous case, so the exit code flags them.
process.exit(serverOnly.length > 0 ? 1 : 0);
