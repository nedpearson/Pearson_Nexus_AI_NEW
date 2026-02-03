import { spawn } from "node:child_process";

const port = process.env.PORT ?? "4173";

// Vite preview must bind 0.0.0.0 on Railway so the platform can route traffic to it.
const args = ["preview", "--host", "0.0.0.0", "--port", port, "--strictPort"];

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
