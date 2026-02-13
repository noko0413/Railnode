import { Command, InvalidArgumentError } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppScaffold, generateModel } from "./scaffold.js";
import { runDev } from "./dev.js";
import { runDoctor } from "./doctor.js";
import { buildDevOptions, buildDoctorOptions } from "./optionBuilder.js";

const knownTopLevel = new Set([
    "create-app",
    "generate",
    "dev",
    "help",
    "-h",
    "--help",
    "-V",
    "--version",
]);

function maybeRewriteArgsForCreateAppBin(argv: string[]) {
    const invokedAs = path.basename(argv[1] ?? "");
    if (invokedAs !== "create-app" && invokedAs !== "create-railnode-app") return;

    const firstArg = argv[2];
    if (firstArg && !knownTopLevel.has(firstArg)) {
        argv.splice(2, 0, "create-app");
    }
}

async function readSelfVersion() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.join(__dirname, "..", "..", "package.json");

    try {
        const raw = await fs.readFile(pkgPath, "utf8");
        const pkg = JSON.parse(raw) as { version?: string };
        return pkg.version ?? "0.0.0";
    } catch {
        return "0.0.0";
    }
}

function detectPackageManager() {
    const ua = process.env["npm_config_user_agent"] ?? "";
    if (ua.startsWith("pnpm/")) {
        return { install: "pnpm install", runDev: "pnpm dev" };
    }
    if (ua.startsWith("yarn/")) {
        return { install: "yarn", runDev: "yarn dev" };
    }
    if (ua.startsWith("bun/")) {
        return { install: "bun install", runDev: "bun run dev" };
    }
    return { install: "npm install", runDev: "npm run dev" };
}

function parsePort(value: string) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        throw new InvalidArgumentError(`Invalid port: ${value}. Use an integer between 1 and 65535.`);
    }
    return n;
}

function formatError(err: unknown) {
    if (err instanceof Error) {
        const cause = (err as Error & { cause?: unknown }).cause;
        if (cause instanceof Error && cause.message && cause.message !== err.message) {
            return `Error: ${err.message}\nCaused by: ${cause.message}`;
        }
        return `Error: ${err.message}`;
    }
    return `Error: ${String(err)}`;
}

export async function runCli(argv: string[]) {
    maybeRewriteArgsForCreateAppBin(argv);

    const program = new Command();

    program
        .name("railnode")
        .description("Railnode CLI")
        .version(await readSelfVersion());

    program
        .command("create-app")
        .description("Scaffold a new Railnode project")
        .argument("[name]", "Project name (defaults to railnode-app)")
        .option("-d, --dir <path>", "Target directory (defaults to ./<name>)")
        .action(async (name: string | undefined, opts: { dir?: string }) => {
            const { targetDir } = await createAppScaffold(name, opts.dir);
            const pm = detectPackageManager();
            console.log(`\nCreated project in ${targetDir}`);
            console.log(`\nNext:`);
            console.log(`  cd ${path.relative(process.cwd(), targetDir) || "."}`);
            console.log(`  ${pm.install}`);
            console.log(`  ${pm.runDev}`);
        });

    const generate = program.command("generate").description("Code generation commands");

    generate
        .command("model")
        .description("Generate a model in src/models")
        .argument("<name>", "Model name (PascalCase recommended)")
        .option("-p, --project <path>", "Project directory (defaults to cwd)")
        .action(async (name: string, opts: { project?: string }) => {
            const { filePath } = await generateModel(name, opts.project);
            console.log(`Generated model: ${filePath}`);
        });

    program
        .command("dev")
        .description("Run the server in dev mode (loads .ts models/routes)")
        .option("-p, --port <port>", "Port override", parsePort)
        .option("--project <path>", "Project root (defaults to cwd)")
        .option("--models-dir <path>", "Models directory (relative to project root)")
        .option("--routes-dir <path>", "Routes directory (relative to project root)")
        .option("--no-crud", "Disable CRUD route generation")
        .option("--quiet", "Disable framework logs")
        .action(
            (opts: {
                port?: number;
                project?: string;
                modelsDir?: string;
                routesDir?: string;
                crud?: boolean;
                quiet?: boolean;
            }) => {
                runDev(buildDevOptions(opts));
            }
        );

    program
        .command("doctor")
        .description("Check a project for common configuration and wiring issues")
        .option("--project <path>", "Project root (defaults to cwd)")
        .option("--models-dir <path>", "Models directory (relative to project root)")
        .option("--routes-dir <path>", "Routes directory (relative to project root)")
        .option("--json", "Output a JSON report")
        .option("--strict", "Exit non-zero on warnings")
        .action(
            async (opts: {
                project?: string;
                modelsDir?: string;
                routesDir?: string;
                json?: boolean;
                strict?: boolean;
            }) => {
                await runDoctor(buildDoctorOptions(opts));
            }
        );

    try {
        await program.parseAsync(argv);
    } catch (err: unknown) {
        console.error(formatError(err));
        process.exitCode = 1;
    }
}
