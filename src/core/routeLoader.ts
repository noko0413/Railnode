import type express from "express";

import { loadModulesFromDir } from "../utils/moduleLoader.js";

function isRouteFile(fileName: string) {
    return (
        fileName.endsWith(".route.ts") ||
        fileName.endsWith(".route.js") ||
        fileName.endsWith(".route.mjs") ||
        fileName.endsWith(".route.cjs")
    );
}

type LoadOptions = {
    log?: (message: string) => void;
}

export async function loadRoutes(routesDir: string, app: express.Application, opts: LoadOptions = {}) {
    const log = opts.log ?? (() => undefined);

    let mounted = 0;
    const loaded = await loadModulesFromDir(routesDir, isRouteFile, ({ fileName, module }) => {
        const router = module["default"];
        const basePath = module["basePath"];
        const hasRouter = router !== undefined && router !== null;

        if (typeof basePath === "string" && basePath.length > 0) {
            if (!hasRouter) {
                log(
                    `Skipped route: ${fileName} exports basePath but has no default export. Expected: export default Router() and export const basePath = "/..."`
                );
                return;
            }
            app.use(basePath, router as express.Router);
            mounted++;
            log(`Loaded route: ${fileName} -> ${basePath}`);
            return;
        }

        if (hasRouter) {
            log(
                `Skipped route: ${fileName} has a default export but no valid basePath string. Add: export const basePath = "/..."`
            );
        }
    });

    if (loaded === 0) {
        log(`No route modules found in ${routesDir}. Create a file like src/routes/health.route.ts`);
    } else if (mounted === 0) {
        log(
            `Found ${loaded} route file(s) in ${routesDir}, but none were mounted. Ensure each route exports { default, basePath }.`
        );
    }

    return loaded;
}
