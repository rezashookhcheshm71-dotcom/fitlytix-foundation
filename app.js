// cPanel / Passenger startup file.
//
// Responsibilities beyond "start the app":
//   1. Guarantee NODE_ENV=production when the host forgets to set it.
//   2. Load environment variables from a file, so the app no longer depends on Apache /
//      LiteSpeed `SetEnv` directives — those are dropped silently when the surrounding
//      `<IfModule Litespeed>` block does not match the running server, which leaves the
//      app with no DB credentials at all.
//   3. Hand over to the built Nitro server (`.output/server/index.mjs`).
//
// Lookup order for the env file (first existing wins):
//   $FITLYTIX_ENV_FILE → ./.env → $HOME/fitlytix.env
// Keep that file outside the web root and chmod 600 when possible.
import fs from "node:fs";
import path from "node:path";

process.env.NODE_ENV ??= "production";

function loadEnvironment() {
  if (typeof process.loadEnvFile !== "function") {
    console.warn("[boot] process.loadEnvFile unavailable (Node < 20.12); relying on server env");
    return null;
  }

  const home = process.env.HOME ?? "";
  const candidates = [
    process.env.FITLYTIX_ENV_FILE,
    path.resolve(process.cwd(), ".env"),
    home ? path.join(home, "fitlytix.env") : undefined,
  ].filter((candidate) => Boolean(candidate));

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      process.loadEnvFile(file);
      // Never log values — only which file was used.
      console.log(`[boot] environment loaded from ${file}`);
      return file;
    } catch (error) {
      console.warn(
        `[boot] could not load ${file}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.warn("[boot] no env file found; using only variables provided by the server");
  return null;
}

loadEnvironment();

await import("./.output/server/index.mjs");
