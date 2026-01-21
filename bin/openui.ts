#!/usr/bin/env bun

import { $ } from "bun";

const PORT = process.env.PORT || 6969;
const LAUNCH_CWD = process.cwd();
const CURRENT_VERSION = "1.0.0";

// Check for updates (non-blocking)
async function checkForUpdates() {
  try {
    const res = await fetch("https://registry.npmjs.org/@fallom/openui/latest", {
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return;

    const data = await res.json();
    const latestVersion = data.version;

    if (latestVersion && latestVersion !== CURRENT_VERSION) {
      console.log(`\x1b[33m  Update available: ${CURRENT_VERSION} → ${latestVersion}\x1b[0m`);
      console.log(`\x1b[38;5;245m  Run: npm install -g @fallom/openui\x1b[0m\n`);
    }
  } catch {
    // Silently ignore - don't block startup for version check
  }
}

console.log(`
\x1b[38;5;251m  ┌─────────────────────────────────────┐
  │                                     │
  │   \x1b[38;5;141m○\x1b[38;5;251m  \x1b[1mOpenUI\x1b[0m\x1b[38;5;251m  v${CURRENT_VERSION}                 │
  │      \x1b[38;5;245mAI Agent Canvas\x1b[38;5;251m               │
  │                                     │
  └─────────────────────────────────────┘\x1b[0m
`);

console.log(`\x1b[38;5;245m  Directory:\x1b[0m ${LAUNCH_CWD}`);
console.log(`\x1b[38;5;245m  Server:\x1b[0m    \x1b[38;5;141mhttp://localhost:${PORT}\x1b[0m`);
console.log(`\x1b[38;5;245m  Press\x1b[0m     \x1b[38;5;245mCtrl+C to stop\x1b[0m\n`);

// Check for updates in background
checkForUpdates();

// Start the server with LAUNCH_CWD env var
const server = Bun.spawn(["bun", "run", "server/index.ts"], {
  cwd: import.meta.dir + "/..",
  stdio: ["inherit", "inherit", "inherit"],
  env: { ...process.env, PORT: String(PORT), LAUNCH_CWD }
});

// Open browser
setTimeout(async () => {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  await $`${cmd} http://localhost:${PORT}`.quiet();
}, 1500);

process.on("SIGINT", () => {
  server.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.kill();
  process.exit(0);
});

await server.exited;
