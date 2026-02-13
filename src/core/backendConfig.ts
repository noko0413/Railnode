import path from "node:path";
import { pathToFileURL } from "node:url";
import { isRecord } from "../utils/guards.js";
import { pathExists, readJsonFile } from "../utils/fs.js";

export type LoadedBackendConfig = {
    [key: string]: unknown;
    port?: unknown;
    projectRoot?: unknown;
    modelsDir?: unknown;
    routesDir?: unknown;
    enableCrud?: unknown;
    db?: unknown;
};

export async function loadBackendConfig(projectRoot: string): Promise<{
    config: LoadedBackendConfig;
    configPath?: string;
}> {
    const candidates = [
        "backend.config.json",
        "backend.config.js",
        "backend.config.mjs",
        "backend.config.cjs",
    ].map(f => path.join(projectRoot, f));

    const configPath = await (async () => {
        for (const p of candidates) {
            if (await pathExists(p)) return p;
        }
        return undefined;
    })();

    if (!configPath) return { config: {} };

    if (configPath.endsWith(".json")) {
        let parsed: unknown;
        try {
            parsed = await readJsonFile(configPath);
        } catch (err: unknown) {
            throw new Error(`Failed to read backend config JSON: ${configPath}`, { cause: err });
        }
        if (!isRecord(parsed)) {
            throw new Error(
                `Invalid backend config: ${configPath}. Expected a JSON object like { port: 3000, modelsDir: "src/models", routesDir: "src/routes" }`
            );
        }
        return { config: parsed as LoadedBackendConfig, configPath };
    }

    let modUnknown: unknown;
    try {
        modUnknown = await import(pathToFileURL(configPath).href);
    } catch (err: unknown) {
        throw new Error(
            `Failed to import backend config: ${configPath}. Expected ESM/CJS exporting a default object.`,
            { cause: err }
        );
    }

    const mod = isRecord(modUnknown) ? modUnknown : {};
    const cfg = mod["default"] ?? mod["config"] ?? {};
    if (!isRecord(cfg)) {
        throw new Error(
            `Invalid backend config: ${configPath}. Export a default object, e.g. export default { port: 3000 }`
        );
    }

    return { config: cfg as LoadedBackendConfig, configPath };
}

export async function resolveRuntimeDir(projectRoot: string, override: string | undefined, candidates: string[]) {
    if (override) return path.resolve(projectRoot, override);

    for (const rel of candidates) {
        const full = path.join(projectRoot, rel);
        if (await pathExists(full)) return full;
    }

    // Default to the last candidate even if it doesn't exist.
    return path.join(projectRoot, candidates[candidates.length - 1] ?? "");
}
