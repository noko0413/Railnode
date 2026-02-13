import { createApp } from "./core/createApp.js";

function parseArgs(argv: string[]) {
    const out: {
        port?: number;
        projectRoot?: string;
        modelsDir?: string;
        routesDir?: string;
        enableCrud?: boolean;
        quiet?: boolean;
    } = {};

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--port") {
            const next = argv[i + 1];
            const port = next ? Number(next) : NaN;
            if (!Number.isNaN(port)) out.port = port;
            i++;
            continue;
        }

        if (arg === "--project") {
            const next = argv[i + 1];
            if (next && !next.startsWith("-")) out.projectRoot = next;
            i++;
            continue;
        }

        if (arg === "--models-dir") {
            const next = argv[i + 1];
            if (next && !next.startsWith("-")) out.modelsDir = next;
            i++;
            continue;
        }

        if (arg === "--routes-dir") {
            const next = argv[i + 1];
            if (next && !next.startsWith("-")) out.routesDir = next;
            i++;
            continue;
        }

        if (arg === "--no-crud") {
            out.enableCrud = false;
            continue;
        }

        if (arg === "--quiet") {
            out.quiet = true;
            continue;
        }
    }

    return out;
}

const args = parseArgs(process.argv.slice(2));

const config = {
    ...(args.port === undefined ? {} : { port: args.port }),
    ...(args.projectRoot ? { projectRoot: args.projectRoot } : {}),
    ...(args.modelsDir ? { modelsDir: args.modelsDir } : {}),
    ...(args.routesDir ? { routesDir: args.routesDir } : {}),
    ...(args.enableCrud === false ? { enableCrud: false } : {}),
    ...(args.quiet ? { log: () => undefined } : {}),
};

const app = createApp(config);
await app.start();
