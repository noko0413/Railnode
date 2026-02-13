import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export type DevRunnerOptions = {
    port?: number;
    projectRoot?: string;
    modelsDir?: string;
    routesDir?: string;
    enableCrud?: boolean;
    quiet?: boolean;
};

export function runDev(opts: DevRunnerOptions = {}) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const runnerPath = path.join(__dirname, "..", "cliDevRunner.js");

    const args = [
        "--import",
        "tsx",
        "--no-warnings",
        runnerPath,
        ...(opts.port === undefined ? [] : ["--port", String(opts.port)]),
        ...(opts.projectRoot ? ["--project", opts.projectRoot] : []),
        ...(opts.modelsDir ? ["--models-dir", opts.modelsDir] : []),
        ...(opts.routesDir ? ["--routes-dir", opts.routesDir] : []),
        ...(opts.enableCrud === false ? ["--no-crud"] : []),
        ...(opts.quiet ? ["--quiet"] : []),
    ];

    const child = spawn(process.execPath, args, {
        stdio: "inherit",
        cwd: process.cwd(),
        env: process.env,
    });

    child.on("exit", code => {
        process.exitCode = code ?? 0;
    });
}
