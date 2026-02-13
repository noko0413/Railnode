import fs from "node:fs/promises";
import path from "node:path";
import { isDirectory, pathExists, readJsonFile, readTextFile } from "../utils/fs.js";
import { loadBackendConfig, resolveRuntimeDir } from "../core/backendConfig.js";

export type DoctorOptions = {
    projectRoot?: string;
    modelsDir?: string;
    routesDir?: string;
    json?: boolean;
    strict?: boolean;
};

type Severity = "ok" | "warn" | "error";

type DoctorItem = {
    severity: Severity;
    title: string;
    details?: string;
};

type DoctorReport = {
    projectRoot: string;
    nodeVersion: string;
    configPath?: string;
    modelsPath: string;
    routesPath: string;
    items: DoctorItem[];
    summary: {
        ok: number;
        warn: number;
        error: number;
    };
};

function formatValueForDisplay(value: unknown) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";

    switch (typeof value) {
        case "string":
            return value;
        case "number":
        case "boolean":
        case "bigint":
            return String(value);
        case "symbol":
            return value.toString();
        case "function":
            return "[function]";
        default:
            break;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return Object.prototype.toString.call(value);
    }
}

function isRouteFile(fileName: string) {
    return (
        fileName.endsWith(".route.ts") ||
        fileName.endsWith(".route.js") ||
        fileName.endsWith(".route.mjs") ||
        fileName.endsWith(".route.cjs")
    );
}

function isModelFile(fileName: string) {
    return (
        fileName.endsWith(".model.ts") ||
        fileName.endsWith(".model.js") ||
        fileName.endsWith(".model.mjs") ||
        fileName.endsWith(".model.cjs")
    );
}

function formatItemPrefix(severity: Severity) {
    if (severity === "ok") return "OK  ";
    if (severity === "warn") return "WARN";
    return "ERR ";
}

function countSummary(items: DoctorItem[]) {
    return items.reduce(
        (acc, item) => {
            acc[item.severity]++;
            return acc;
        },
        { ok: 0, warn: 0, error: 0 }
    );
}

function hasExportDefault(source: string) {
    return /\bexport\s+default\b/.test(source);
}

function hasBasePathExport(source: string) {
    return /\bexport\s+(?:const|let|var)\s+basePath\s*=/.test(source);
}

function majorNodeVersion() {
    const major = Number(process.versions.node.split(".")[0] ?? "0");
    return Number.isFinite(major) ? major : 0;
}

async function tryReadProjectPackageJson(projectRoot: string) {
    const pkgPath = path.join(projectRoot, "package.json");
    if (!(await pathExists(pkgPath))) return { pkgPath, pkg: undefined as undefined | Record<string, unknown> };

    try {
        const parsed = await readJsonFile(pkgPath);
        if (parsed && typeof parsed === "object") {
            return { pkgPath, pkg: parsed as Record<string, unknown> };
        }
    } catch {
        // handled by caller
    }

    return { pkgPath, pkg: undefined as undefined | Record<string, unknown> };
}

function getDepVersion(pkg: Record<string, unknown>, name: string) {
    const deps = (pkg["dependencies"] ?? {}) as Record<string, unknown>;
    const devDeps = (pkg["devDependencies"] ?? {}) as Record<string, unknown>;
    const v = deps[name] ?? devDeps[name];
    return typeof v === "string" ? v : undefined;
}

async function listMatchingFiles(dirPath: string, predicate: (fileName: string) => boolean) {
    if (!(await isDirectory(dirPath))) return [] as string[];
    const entries = await fs.readdir(dirPath);
    return entries.filter(predicate).sort();
}

export async function runDoctor(opts: DoctorOptions = {}) {
    const projectRoot = opts.projectRoot ? path.resolve(process.cwd(), opts.projectRoot) : process.cwd();
    const items: DoctorItem[] = [];

    // Node version check (matches package engines).
    const nodeMajor = majorNodeVersion();
    if (nodeMajor >= 22) {
        items.push({ severity: "ok", title: `Node version ${process.versions.node}` });
    } else {
        items.push({
            severity: "warn",
            title: `Node version ${process.versions.node} (recommended >= 22)`,
            details: "Railnode is tested with modern Node. Upgrade if you see ESM/loader issues.",
        });
    }

    // backend.config.*
    let configPath: string | undefined;
    let fileConfig: Record<string, unknown> = {};
    try {
        const loaded = await loadBackendConfig(projectRoot);
        configPath = loaded.configPath;
        fileConfig = loaded.config;
        if (configPath) {
            items.push({ severity: "ok", title: `Loaded config: ${path.relative(projectRoot, configPath)}` });
        } else {
            items.push({
                severity: "warn",
                title: "No backend.config.* found",
                details: "Optional, but recommended. Create backend.config.mjs to set port/modelsDir/routesDir.",
            });
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        items.push({ severity: "error", title: "Failed to load backend config", details: msg });
    }

    const effectivePort = (fileConfig["port"]) ?? undefined;
    if (effectivePort !== undefined) {
        const n = Number(effectivePort);
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
            items.push({
                severity: "warn",
                title: `Config port looks invalid: ${formatValueForDisplay(effectivePort)}`,
                details: "Use an integer between 1 and 65535, e.g. port: 3000",
            });
        } else {
            items.push({ severity: "ok", title: `Config port: ${n}` });
        }
    }

    const modelsDirFromConfig = fileConfig["modelsDir"];
    if (modelsDirFromConfig !== undefined && typeof modelsDirFromConfig !== "string") {
        items.push({
            severity: "warn",
            title: `Config modelsDir is not a string: ${formatValueForDisplay(modelsDirFromConfig)}`,
            details: "Use a string path like modelsDir: \"src/models\"",
        });
    }

    const routesDirFromConfig = fileConfig["routesDir"];
    if (routesDirFromConfig !== undefined && typeof routesDirFromConfig !== "string") {
        items.push({
            severity: "warn",
            title: `Config routesDir is not a string: ${formatValueForDisplay(routesDirFromConfig)}`,
            details: "Use a string path like routesDir: \"src/routes\"",
        });
    }

    // Resolve dirs the same way runtime does.
    const modelsPath = await resolveRuntimeDir(
        projectRoot,
        opts.modelsDir ?? (typeof modelsDirFromConfig === "string" ? modelsDirFromConfig : undefined),
        [
            "dist/models",
            "src/models",
        ]
    );
    const routesPath = await resolveRuntimeDir(
        projectRoot,
        opts.routesDir ?? (typeof routesDirFromConfig === "string" ? routesDirFromConfig : undefined),
        [
            "dist/routes",
            "src/routes",
        ]
    );

    if (await isDirectory(modelsPath)) {
        items.push({ severity: "ok", title: `Models dir: ${path.relative(projectRoot, modelsPath)}` });
    } else {
        items.push({
            severity: "warn",
            title: `Models dir missing: ${path.relative(projectRoot, modelsPath)}`,
            details: "Create src/models or set modelsDir in backend.config.*",
        });
    }

    if (await isDirectory(routesPath)) {
        items.push({ severity: "ok", title: `Routes dir: ${path.relative(projectRoot, routesPath)}` });
    } else {
        items.push({
            severity: "warn",
            title: `Routes dir missing: ${path.relative(projectRoot, routesPath)}`,
            details: "Create src/routes or set routesDir in backend.config.*",
        });
    }

    // Package.json dependencies sanity.
    const { pkgPath, pkg } = await tryReadProjectPackageJson(projectRoot);
    if (!pkg) {
        items.push({
            severity: "warn",
            title: `Could not read ${path.relative(projectRoot, pkgPath)}`,
            details: "Doctor uses package.json to check required dev deps (tsx) and runtime deps (express for pnpm).",
        });
    } else {
        const tsxVersion = getDepVersion(pkg, "tsx");
        if (tsxVersion) {
            items.push({ severity: "ok", title: `Dependency: tsx@${tsxVersion}` });
        } else {
            items.push({
                severity: "warn",
                title: "Missing dependency: tsx",
                details:
                    "`railnode dev` runs Node with `--import tsx`, which must be resolvable from your project. Install: npm i -D tsx",
            });
        }

        const expressVersion = getDepVersion(pkg, "express");
        if (expressVersion) {
            items.push({ severity: "ok", title: `Dependency: express@${expressVersion}` });
        } else {
            items.push({
                severity: "warn",
                title: "Missing dependency: express",
                details:
                    "If you use pnpm (no-hoist), add express as a direct dependency: npm i express. (Some package managers may still work via hoisting.)",
            });
        }

        const railnodeVersion = getDepVersion(pkg, "railnode");
        if (railnodeVersion) {
            items.push({ severity: "ok", title: `Dependency: railnode@${railnodeVersion}` });
        } else {
            items.push({
                severity: "warn",
                title: "railnode not found in dependencies",
                details: "If this is your app, install railnode: npm i railnode",
            });
        }
    }

    // Route files quick validation (static scan).
    const routeFiles = await listMatchingFiles(routesPath, isRouteFile);
    if (routeFiles.length === 0) {
        items.push({
            severity: "warn",
            title: "No route files found",
            details: "Create src/routes/health.route.ts exporting default router + basePath.",
        });
    } else {
        let okCount = 0;
        for (const fileName of routeFiles) {
            const fullPath = path.join(routesPath, fileName);
            const src = await readTextFile(fullPath).catch(() => "");
            const hasDefault = hasExportDefault(src);
            const hasBasePath = hasBasePathExport(src);

            if (hasDefault && hasBasePath) {
                okCount++;
                continue;
            }

            const missing: string[] = [];
            if (!hasDefault) missing.push("export default ...");
            if (!hasBasePath) missing.push("export const basePath = \"/...\"");
            items.push({
                severity: "warn",
                title: `Route export check: ${path.relative(projectRoot, fullPath)}`,
                details: `Missing: ${missing.join(" and ")}`,
            });
        }
        items.push({
            severity: "ok",
            title: `Routes scanned: ${routeFiles.length} (looks good: ${okCount})`,
        });
    }

    // Model files quick validation.
    const modelFiles = await listMatchingFiles(modelsPath, isModelFile);
    if (modelFiles.length === 0) {
        items.push({
            severity: "warn",
            title: "No model files found",
            details: "Create src/models/user.model.ts (or run: railnode generate model User)",
        });
    } else {
        let defineModelCount = 0;
        for (const fileName of modelFiles) {
            const fullPath = path.join(modelsPath, fileName);
            const src = await readTextFile(fullPath).catch(() => "");
            if (/\bdefineModel\s*\(/.test(src)) defineModelCount++;
        }
        items.push({
            severity: "ok",
            title: `Models scanned: ${modelFiles.length} (defineModel detected: ${defineModelCount})`,
        });
    }

    const summary = countSummary(items);

    const report: DoctorReport = {
        projectRoot,
        nodeVersion: process.versions.node,
        ...(configPath ? { configPath } : {}),
        modelsPath,
        routesPath,
        items,
        summary,
    };

    if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log("Railnode Doctor");
        console.log(`Project: ${projectRoot}`);
        if (configPath) console.log(`Config:  ${configPath}`);
        console.log(`Models:  ${modelsPath}`);
        console.log(`Routes:  ${routesPath}`);
        console.log("");

        for (const item of items) {
            console.log(`${formatItemPrefix(item.severity)}  ${item.title}`);
            if (item.details) {
                console.log(`      ${item.details}`);
            }
        }

        console.log("");
        console.log(`Summary: OK=${summary.ok} WARN=${summary.warn} ERR=${summary.error}`);
    }

    const shouldFail = summary.error > 0 || (opts.strict ? summary.warn > 0 : false);
    if (shouldFail) process.exitCode = 1;
}
