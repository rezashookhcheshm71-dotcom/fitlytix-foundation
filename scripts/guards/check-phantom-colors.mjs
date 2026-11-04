// Guard: a colour utility class must name a colour token that actually exists.
//
// WHY THIS EXISTS
// `border-ember bg-ember/15` once shipped as the selected state of the role
// selector in src/routes/register.tsx. There is no --color-ember, so both classes
// compiled to nothing at all and the selected button differed from the unselected
// one by text opacity alone. TypeScript cannot see this: a className is a string.
// The only thing that caught it was grepping the built stylesheet for the
// selector, which is a manual step nobody remembers to take.
//
// SCOPE, STATED HONESTLY
// This checks COLOUR utilities against the --color-* tokens declared in
// src/styles.css. It does not validate spacing, sizing or layout classes, and it
// does not know which utilities Tailwind can synthesise on demand. That is a
// deliberate trade: the colour case is the one that produced a real defect, it
// needs no build to check, and a guard that tried to cover everything would spend
// its life producing false positives instead of catching bugs.
//
// Contract: human-readable lines first, then ONE JSON object on the last line.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT, STATUS } from "./lib.mjs";

function emit(status, detail, extra) {
  for (const line of String(detail ?? "").split("\n")) {
    if (line.trim()) console.log(`  ${line}`);
  }
  console.log(JSON.stringify({ name: "phantom-colors", status, detail: detail ?? "", ...extra }));
  process.exit(status === STATUS.FAIL ? 1 : 0);
}

/* --- what the design system actually declares -------------------------------- */

const STYLE_PATH = join(REPO_ROOT, "src", "styles.css");
if (!existsSync(STYLE_PATH)) {
  emit(STATUS.FAIL, `cannot find ${relative(REPO_ROOT, STYLE_PATH)} - the token source is missing`);
}
const css = readFileSync(STYLE_PATH, "utf8");

/** Every colour the theme exposes as a utility value. */
const colorTokens = new Set(
  [...css.matchAll(/--color-([a-z0-9][a-z0-9-]*)\s*:/g)].map((m) => m[1]),
);

/** Every custom @utility, so hand-written utilities are not mistaken for colours. */
const customUtilities = new Set(
  [...css.matchAll(/@utility\s+([a-z0-9][a-z0-9-]*)/g)].map((m) => m[1]),
);

if (colorTokens.size === 0) {
  emit(STATUS.FAIL, "no --color-* tokens found in src/styles.css - the scan would flag everything");
}

/* --- Tailwind values that are not colours ------------------------------------ */

// Sizes, alignments, directions and keywords share the same prefixes as colours
// (text-lg, border-b, bg-cover, ring-inset). A value carrying a digit is a size
// and is skipped wholesale, which also covers the opacity-modifier case after it
// has been stripped below.
const NON_COLOR_VALUES = new Set([
  "white",
  "black",
  "transparent",
  "current",
  "inherit",
  "initial",
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "left",
  "right",
  "center",
  "justify",
  "start",
  "end",
  "wrap",
  "nowrap",
  "ellipsis",
  "clip",
  "balance",
  "pretty",
  "t",
  "b",
  "s",
  "e",
  "l",
  "r",
  "x",
  "y",
  "top",
  "bottom",
  "solid",
  "dashed",
  "dotted",
  "double",
  "hidden",
  "none",
  "visible",
  "collapse",
  "separate",
  "auto",
  "full",
  "screen",
  "min",
  "max",
  "fit",
  "px",
  "cover",
  "contain",
  "fixed",
  "local",
  "scroll",
  "repeat",
  "no-repeat",
  "inset",
  "offset",
  "default",
]);

// Sub-prefixes whose value is never a colour token name.
const NON_COLOR_SUBPREFIXES = [
  "gradient-",
  "linear-",
  "radial-",
  "conic-",
  "clip-",
  "origin-",
  "repeat-",
  "size-",
  "position-",
  "offset-",
  "inset-",
  "spacing-",
];

const COLOR_PREFIXES = [
  "text",
  "bg",
  "border",
  "ring",
  "fill",
  "stroke",
  "from",
  "via",
  "to",
  "outline",
  "divide",
  "accent",
];

// Tailwind's own palette is always available, so those values are legitimate even
// though no --color-* token declares them.
const DEFAULT_PALETTE =
  /^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?$/;

/* --- source scanning ---------------------------------------------------------- */

/**
 * Collect the contents of every string literal, ignoring comments.
 *
 * Comment stripping has to be string-aware, and this is the part that is easy to
 * get wrong: a naive `text.replace(/\/\/.*$/gm, "")` also eats the `//` inside
 * "https://example.com". Walking the file character by character keeps URLs intact
 * while still dropping the `//` and `/* *\/` comments - including the JSX
 * `{/* *\/}` form - so a class name mentioned in prose is never flagged as code.
 */
function collectStrings(src) {
  const out = [];
  let buf = null;
  let quote = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (buf !== null) {
      if (c === "\\") {
        buf += c + (next ?? "");
        i += 2;
        continue;
      }
      if (c === quote) {
        out.push(buf);
        buf = null;
        i += 1;
        continue;
      }
      // Template-literal ${...} interpolations are kept as text. A computed class
      // name cannot be validated statically, and pretending otherwise would mean
      // guessing at runtime values.
      buf += c;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      buf = "";
      quote = c;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    i += 1;
  }
  return out;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

/**
 * Structural segments that sit between the prefix and the colour name.
 *
 * Tailwind spells a per-side border colour as border-<side>-<colour>, so
 * "border-s-primary" is the token `primary` applied to the inline-start edge and
 * not a colour called "s-primary". The same shape appears on ring-offset-*,
 * outline-offset-* and divide-x|y-*. Peeling these first is what keeps the guard
 * from reporting valid utilities as phantoms - the first run of this file flagged
 * exactly three, and all three were this.
 */
const STRUCTURAL_SEGMENTS = {
  border: /^(t|b|s|e|l|r|x|y)-/,
  ring: /^offset-/,
  outline: /^offset-/,
  divide: /^(x|y)-/,
};

/** Decide whether one class token names a colour that does not exist. */
function inspect(token) {
  // Drop variant prefixes: hover:bg-x is judged on bg-x.
  const base = token.includes(":") ? token.slice(token.lastIndexOf(":") + 1) : token;
  const match = /^([a-z]+)-(.+)$/.exec(base);
  if (!match) return null;
  const [, prefix, rawValue] = match;
  if (!COLOR_PREFIXES.includes(prefix)) return null;

  let value = rawValue;
  if (value.startsWith("[") || value.startsWith("(")) return null; // arbitrary value
  // An opacity modifier is not part of the colour name: bg-card/40 is card at 40%.
  value = value.replace(/\/\d+(?:\.\d+)?$/, "");
  // Peel a side or offset segment, then re-check what is left. border-t-2 peels to
  // "2", which the digit rule below discards, so widths are still ignored.
  const structural = STRUCTURAL_SEGMENTS[prefix];
  if (structural) value = value.replace(structural, "");
  if (!value) return null;
  if (/\d/.test(value)) return null; // a size, not a colour
  if (value.startsWith("[") || value.startsWith("(")) return null;
  if (NON_COLOR_VALUES.has(value)) return null;
  if (NON_COLOR_SUBPREFIXES.some((p) => value.startsWith(p))) return null;
  if (DEFAULT_PALETTE.test(value)) return null;
  if (customUtilities.has(base) || customUtilities.has(token)) return null;
  if (colorTokens.has(value)) return null;

  return { token, prefix, value };
}

/* --- run --------------------------------------------------------------------- */

const srcDir = join(REPO_ROOT, "src");
const violations = [];
let scanned = 0;
let tokensSeen = 0;

for (const file of walk(srcDir)) {
  scanned += 1;
  const rel = relative(REPO_ROOT, file);
  const seen = new Set();
  for (const str of collectStrings(readFileSync(file, "utf8"))) {
    for (const token of str.split(/\s+/)) {
      const clean = token.replace(/[^A-Za-z0-9_\-/:.[\]()%,]/g, "");
      if (!clean.includes("-")) continue;
      tokensSeen += 1;
      if (seen.has(clean)) continue;
      const hit = inspect(clean);
      if (hit) {
        seen.add(clean);
        violations.push({ file: rel, ...hit });
      }
    }
  }
}

if (violations.length === 0) {
  emit(
    STATUS.PASS,
    [
      `every colour utility names a real token`,
      `${scanned} source files scanned, ${tokensSeen} class tokens checked`,
      `${colorTokens.size} --color-* tokens and ${customUtilities.size} custom utilities declared`,
    ].join("\n"),
    { files: scanned, tokens: tokensSeen, violations: 0 },
  );
}

const byFile = new Map();
for (const v of violations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}

const lines = [`${violations.length} class(es) name a colour that does not exist:`, ""];
for (const [file, hits] of [...byFile.entries()].sort()) {
  lines.push(file);
  for (const h of hits) {
    lines.push(`  ${h.token}  ->  no --color-${h.value} in src/styles.css`);
  }
}
lines.push(
  "",
  "These compile to nothing, so the element silently loses its styling while",
  "typecheck, tests and build all stay green. Use a token that exists, or add",
  "the token to the @theme block in src/styles.css first.",
);
emit(STATUS.FAIL, lines.join("\n"), {
  files: scanned,
  tokens: tokensSeen,
  violations: violations.length,
});
