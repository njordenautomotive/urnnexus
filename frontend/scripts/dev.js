import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const isSystemdRuntime = Boolean(process.env.INVOCATION_ID);
const runProductionFrontend = isSystemdRuntime || args.includes("--prod") || process.env.URN_NEXUS_FRONTEND_MODE === "production";

function exitWithChild(childProcess) {
  childProcess.on("error", (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
  childProcess.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

if (runProductionFrontend) {
  const python = process.env.PYTHON || path.join(repoRoot, ".venv", "bin", "python");
  const serverScript = path.join(repoRoot, "scripts", "serve_frontend_dist.py");
  const distRoot = path.join(scriptDir, "..", "dist");
  if (!existsSync(python)) {
    console.error(`Python interpreter not found: ${python}`);
    process.exit(1);
  }
  if (!existsSync(serverScript)) {
    console.error(`Frontend server script not found: ${serverScript}`);
    process.exit(1);
  }
  const child = spawn(
    python,
    [
      serverScript,
      "--dist",
      distRoot,
      "--backend",
      process.env.URN_NEXUS_BACKEND_URL || "http://127.0.0.1:8000",
      "--host",
      process.env.URN_NEXUS_FRONTEND_HOST || "127.0.0.1",
      "--port",
      process.env.URN_NEXUS_FRONTEND_PORT || "5173",
      "--log-level",
      process.env.LOG_LEVEL || "INFO",
    ],
    {
      cwd: path.join(repoRoot, "frontend"),
      env: process.env,
      stdio: "inherit",
    },
  );
  exitWithChild(child);
} else {
  const viteBin = path.join(repoRoot, "frontend", "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(viteBin)) {
    console.error(`Vite entrypoint not found: ${viteBin}`);
    process.exit(1);
  }
  const child = spawn(process.execPath, [viteBin, ...args], {
    cwd: path.join(repoRoot, "frontend"),
    env: process.env,
    stdio: "inherit",
  });
  exitWithChild(child);
}
