# P33 · Reconciliation: making git the single source of truth

Read-only tooling that answers one question before anything is deployed:
**what does the server hold that git does not?**

The server is known to carry files absent from git — `reference-ranges.ts`,
`domain/metrics.tsx`, `domain/carousel.tsx`, `flx-*.css`, migrations 003–006,
`src/api/auth/me.ts`, and a set of survey/apply/check scripts. Deploying git
over the application without capturing those first destroys them permanently.

All three scripts are read-only. None of them writes to the application tree,
and none mutates the database.

| script                 | runs on                | writes to                        |
| ---------------------- | ---------------------- | -------------------------------- |
| `server-inventory.mjs` | cPanel host            | a directory you choose (`--out`) |
| `git-inventory.mjs`    | anywhere with the repo | a file you choose (`--out`)      |
| `compare.mjs`          | anywhere               | optionally `--out`               |

## Step 1 — inventory the server

cPanel rejects `.mjs` uploads (the whitelist is png, webp, jpeg, gif, txt,
markdown, csv, html, xml, css, javascript, json, pdf), so upload the file
**renamed to `server-inventory.txt`**. Node runs it by content, not extension.

Upload it somewhere outside the application directory, then run it with the
application's own Node binary — there is no Python on this host:

```
/home/eugtezmj/nodevenv/public_html/fitlytix-app/22/bin/node \
  /home/eugtezmj/server-inventory.txt \
  --app /home/eugtezmj/public_html/fitlytix-app \
  --out /home/eugtezmj/fitlytix-recon \
  --copy --db
```

`--copy` duplicates every inventoried file into `<out>/files/`, which is the
actual backup. `--db` adds `DESCRIBE` output plus a row count for every table,
capturing the live schema — which is the only way to settle the `value_json`
versus `answer_json` question behind finding F1 without guessing a column name.

Real `.env` files are inventoried (path, size, md5) but **never copied**, so no
credential leaves the host. `.env.example` is copied, because it is a committed
template holding no secrets.

Two files come out of it:

- `manifest.json` — machine-readable input for `compare.mjs`
- `manifest.txt` — the same rows with `·` in place of every space, because a
  terminal copy silently drops spaces and would corrupt an md5 or a path

Send `manifest.txt` back by pasting it, or download `manifest.json`.

## Step 2 — inventory git

```
node scripts/recon/git-inventory.mjs --out /tmp/git-manifest.json
```

This reads from `HEAD` by default, not from the working tree, because the
question is what is _committed_. Uncommitted paths are reported separately so
they cannot hide inside either side. Use `--rev <sha>` to inventory another
commit.

## Step 3 — compare

```
node scripts/recon/compare.mjs \
  --git /tmp/git-manifest.json \
  --server /path/to/manifest.json \
  --out /tmp/recon-report.json
```

Output falls into four buckets:

| bucket          | meaning                       | action                                            |
| --------------- | ----------------------------- | ------------------------------------------------- |
| **server-only** | a git deploy would destroy it | pull it into git, or accept the loss deliberately |
| **differs**     | same path, different bytes    | a human decision, file by file                    |
| **git-only**    | new from git                  | safe to deploy                                    |
| **identical**   | matches byte for byte         | nothing to do                                     |

Lockfiles (`package-lock.json`, `bun.lock`) and generated files
(`src/routeTree.gen.ts`, `.output/`) are listed apart, never counted as
differences: they change on every install and would drown the real signal.

**Exit code is 1 when server-only files exist.** That is the case where
deploying loses work, so it is safe to wire into a deploy gate.

## Verified behaviour

Each of these was produced by running the tools, not by reading them:

| test                               | result                                                       |
| ---------------------------------- | ------------------------------------------------------------ |
| inventory of this repo             | 199 files, 0 errors, `node_modules`/`.git`/`.output` skipped |
| `.env.example`                     | inventoried **and** copied (it is a template, not a secret)  |
| a real `.env`                      | inventoried but **not** copied — absent from `files/`        |
| `manifest.txt` raw spaces          | **0** across all 199 data rows                               |
| compare, uncommitted files present | 3 server-only, exit **1**                                    |
| compare, trees matched             | 0 server-only, 198 identical, exit **0**                     |

Two bugs were caught this way that reading would not have found: the
copy-safe rendering was still padding with raw spaces (defeating its own
purpose), and `git ls-tree` rejects `--long` combined with `--format`.

## What this does not do

It cannot merge anything. Once `compare.mjs` reports the differences, deciding
what each one means is still a human call — that is P34 and beyond.
