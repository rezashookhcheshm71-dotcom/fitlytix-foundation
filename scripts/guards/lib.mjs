// Shared helpers for the verification guards (P41).
//
// Node built-ins only, zero dependencies: the production host runs Node and
// nothing else, so every guard has to be runnable there too, not just locally.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const GUARD_DIR = join(REPO_ROOT, "scripts", "guards");
export const BASELINE_PATH = join(GUARD_DIR, "baseline.json");

/**
 * Statuses a guard may report. `skip` means "not measured yet" and is never
 * allowed to read as a pass — an unmeasured stage is an honest empty state.
 */
export const STATUS = { PASS: "pass", FAIL: "fail", WARN: "warn", SKIP: "skip" };

/** Rank used to fold many guard results into one step result. */
const RANK = { [STATUS.PASS]: 0, [STATUS.SKIP]: 1, [STATUS.WARN]: 2, [STATUS.FAIL]: 3 };

/** Worst of two statuses; `skip` outranks `pass` so silence is never green. */
export function worst(a, b) {
  return (RANK[a] ?? 0) >= (RANK[b] ?? 0) ? a : b;
}

/** Run Node with arbitrary arguments. Never throws: guards report, they do not crash. */
export function runNodeArgs(args, opts = {}) {
  try {
    const out = execFileSync(process.execPath, args, {
      cwd: opts.cwd ?? REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: out ?? "" };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/**
 * Run a dependency's own JS entry point through the current Node binary.
 * Going through `node <script>` instead of `node_modules/.bin/<name>` keeps the
 * result independent of symlink and shebang handling across platforms.
 */
export function runNode(script, args, opts = {}) {
  return runNodeArgs([script, ...args], opts);
}

/** Count non-overlapping matches without the `grep -c` exit-code trap. */
export function countMatches(text, re) {
  return (String(text).match(re) ?? []).length;
}

/** Last non-empty stdout line, which is the guards' machine-readable contract. */
export function lastJson(out) {
  const lines = String(out)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    try {
      return JSON.parse(line);
    } catch {
      // Not JSON yet — keep walking backwards, a guard may log before reporting.
    }
  }
  return null;
}

export function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

/** Written pretty-printed so prettier agrees with the committed formatting. */
export function saveBaseline(next) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

/** Merge one guard's section into baseline.json without clobbering the rest. */
export function saveBaselineSection(section, value) {
  saveBaseline({ ...(loadBaseline() ?? {}), [section]: value });
}

/** Repo-relative, slash-separated paths so the baseline is portable. */
export function toRepoPath(abs) {
  const p = abs.startsWith(REPO_ROOT) ? abs.slice(REPO_ROOT.length + 1) : abs;
  return p.split("\\").join("/");
}

/**
 * Parsed eslint report for the whole repo.
 * Returns `{ ok: false }` when eslint itself failed, so callers can tell a
 * broken tool apart from a clean tree.
 */
export function lintReport() {
  const { code, out } = runNode("node_modules/eslint/bin/eslint.js", [".", "-f", "json"]);
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    return { ok: false, code, raw: String(out).slice(-2000) };
  }
  if (!Array.isArray(parsed)) return { ok: false, code, raw: "eslint returned no array" };

  const files = {};
  const byRule = {};
  let errors = 0;
  let warnings = 0;

  for (const entry of parsed) {
    const rel = toRepoPath(entry.filePath);
    let fileErrors = 0;
    let fileWarnings = 0;
    for (const msg of entry.messages ?? []) {
      const rule = msg.ruleId ?? "(parse-error)";
      if (msg.severity === 2) {
        errors += 1;
        fileErrors += 1;
      } else {
        warnings += 1;
        fileWarnings += 1;
      }
      byRule[rule] = (byRule[rule] ?? 0) + 1;
    }
    if (fileErrors > 0 || fileWarnings > 0) {
      files[rel] = { errors: fileErrors, warnings: fileWarnings };
    }
  }
  return { ok: true, code, errors, warnings, files, byRule };
}

/** Every `check-*.mjs` guard, sorted, as repo-relative paths. */
export function discoverGuards() {
  if (!existsSync(GUARD_DIR)) return [];
  return readdirSorted(GUARD_DIR)
    .filter((name) => /^check-.*\.mjs$/.test(name))
    .map((name) => join("scripts", "guards", name));
}

function readdirSorted(dir) {
  return readdirSync(dir).sort((a, b) => a.localeCompare(b));
}
