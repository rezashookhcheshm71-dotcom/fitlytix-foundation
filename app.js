// cPanel / Passenger startup file. Passenger sets PORT (and optionally HOST);
// the generated Nitro node-server reads them. No custom HTTP server here.
process.env.NODE_ENV ??= "production";
await import("./.output/server/index.mjs");
