import express from "express";
import { generateCrudRoutes } from "../crud/crudGenerator.js";
import { loadModels } from "../model/loadModels.js";
import { loadRoutes } from "./routeLoader.js";

import { isDirectory } from "../utils/fs.js";
import { loadDotEnvIfPresent } from "../utils/dotenv.js";
import { createDbAdapter, type DbConfig, type DbAdapter } from "../db/adapter.js";
import { loadBackendConfig, resolveRuntimeDir } from "./backendConfig.js";
import { createErrorMiddleware } from "./errorHandling.js";
import { buildFileConfig } from "./configValidator.js";

export type BackendConfig = {
    port?: number;
    projectRoot?: string;
    modelsDir?: string;
    routesDir?: string;
    enableCrud?: boolean;
    db?: DbConfig;
    dbAdapter?: DbAdapter;
    log?: (message: string) => void;
};

export function createApp(config: BackendConfig = {}) {
    const app = express();
    app.use(express.json());

    const log = config.log ?? (message => console.log(message));

    return {
        async start(portOverride?: number) {
            const projectRoot = config.projectRoot ?? process.cwd();
            await loadDotEnvIfPresent(projectRoot);
            const { config: fileConfig, configPath } = await loadBackendConfig(projectRoot);

            const fileConfigTyped = buildFileConfig(fileConfig, configPath);

            const effectiveConfig: BackendConfig = { ...fileConfigTyped, ...config, log };

            const effectivePort = portOverride ?? effectiveConfig.port ?? 3000;
            if (!Number.isInteger(effectivePort) || effectivePort < 1 || effectivePort > 65535) {
                throw new Error(
                    `Invalid port: ${String(effectivePort)}. Use an integer between 1 and 65535 (e.g. --port 3000).`
                );
            }
            const modelsPath = await resolveRuntimeDir(projectRoot, effectiveConfig.modelsDir, [
                "dist/models",
                "src/models",
            ]);
            const routesPath = await resolveRuntimeDir(projectRoot, effectiveConfig.routesDir, [
                "dist/routes",
                "src/routes",
            ]);

            if (!(await isDirectory(modelsPath))) {
                log(
                    `Models directory not found at ${modelsPath}. Create it (e.g. src/models) or set modelsDir in backend.config.*`
                );
            }
            if (!(await isDirectory(routesPath))) {
                log(
                    `Routes directory not found at ${routesPath}. Create it (e.g. src/routes) or set routesDir in backend.config.*`
                );
            }

            // Expose runtime config to routes/middleware via Express locals.
            (app.locals as Record<string, unknown>)["backend"] = {
                config: effectiveConfig,
                runtime: {
                    projectRoot,
                    port: effectivePort,
                    modelsPath,
                    routesPath,
                },
                log,
            };

            await loadModels(modelsPath, { log });

            if (effectiveConfig.enableCrud ?? true) {
                const dbAdapter =
                    effectiveConfig.dbAdapter ??
                    createDbAdapter(projectRoot, effectiveConfig.db);
                if (dbAdapter.init) await dbAdapter.init();
                generateCrudRoutes(app, { log, dbAdapter });
            }

            await loadRoutes(routesPath, app, { log });

            // Centralized JSON error responses (Express default is HTML/text).
            app.use(createErrorMiddleware({ log }));

            app.listen(effectivePort, () => {
                log(`Server running on http://localhost:${effectivePort}`);
            });
        },

        raw() {
            return app;
        },
    };
}
