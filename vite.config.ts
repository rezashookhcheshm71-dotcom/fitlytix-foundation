// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Self-hosted Node.js (cPanel/Passenger): standalone Nitro server at .output/server/index.mjs.
  // Inside the Lovable build environment the wrapper still forces its own hosting preset.
  nitro: { preset: "node-server" },
  // Dev/preview only: accept the sandbox preview host and local addresses.
  // Production traffic reaches the built Nitro server, not this dev server.
  vite: {
    server: {
      allowedHosts: [".e2b.app", "localhost", "127.0.0.1"],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
