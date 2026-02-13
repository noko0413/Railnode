import type { DevRunnerOptions } from "./dev.js";
import type { DoctorOptions } from "./doctor.js";

export function buildDevOptions(opts: {
    port?: number;
    project?: string;
    modelsDir?: string;
    routesDir?: string;
    crud?: boolean;
    quiet?: boolean;
}): DevRunnerOptions {
    return {
        ...(opts.port === undefined ? {} : { port: opts.port }),
        ...(opts.project ? { projectRoot: opts.project } : {}),
        ...(opts.modelsDir ? { modelsDir: opts.modelsDir } : {}),
        ...(opts.routesDir ? { routesDir: opts.routesDir } : {}),
        ...(opts.crud === false ? { enableCrud: false } : {}),
        ...(opts.quiet ? { quiet: true } : {}),
    };
}

export function buildDoctorOptions(opts: {
    project?: string;
    modelsDir?: string;
    routesDir?: string;
    json?: boolean;
    strict?: boolean;
}): DoctorOptions {
    return {
        ...(opts.project ? { projectRoot: opts.project } : {}),
        ...(opts.modelsDir ? { modelsDir: opts.modelsDir } : {}),
        ...(opts.routesDir ? { routesDir: opts.routesDir } : {}),
        ...(opts.json ? { json: true } : {}),
        ...(opts.strict ? { strict: true } : {}),
    };
}
