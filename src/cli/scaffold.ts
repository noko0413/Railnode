import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists, writeFileIfAbsent } from "../utils/fs.js";

function toKebabCase(input: string) {
    return input
        .trim()
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

function toPascalCase(input: string) {
    return input
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join("");
}

function renderAppPackageJson(appName: string) {
    return JSON.stringify(
        {
            name: appName,
            version: "0.0.0",
            private: true,
            type: "module",
            scripts: {
                dev: "railnode dev",
                build: "tsc -p tsconfig.json",
                typecheck: "tsc -p tsconfig.json --noEmit",
                start: "node dist/index.js",
                "generate:model": "railnode generate model",
            },
            dependencies: {
                railnode: "^1.0.0",
                // Direct dependency improves compatibility with pnpm (no hoisting).
                express: "^5.2.1",
            },
            devDependencies: {
                "@types/express": "^5.0.6",
                "@types/node": "^25.0.0",
                // Required by `railnode dev` (Node resolves `--import tsx` from the app).
                tsx: "^4.21.0",
                typescript: "^5.9.0",
            },
        },
        null,
        2
    );
}

function renderAppTsconfigJson() {
    return JSON.stringify(
        {
            compilerOptions: {
                rootDir: "./src",
                outDir: "./dist",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                target: "ESNext",
                lib: ["ESNext"],
                types: ["node"],
                sourceMap: true,
                strict: true,
                verbatimModuleSyntax: true,
                isolatedModules: true,
                moduleDetection: "force",
                skipLibCheck: true,
            },
        },
        null,
        2
    );
}

function renderBackendConfigMjs() {
    return `// Railnode config (optional)
export default {
    port: 3000,
    // modelsDir: "src/models",
    // routesDir: "src/routes",
    // enableCrud: true,
};
`;
}

function renderAppIndexTs() {
    return `import { createApp } from "railnode";

// By default Railnode reads backend.config.* from the project root.
// You can also pass overrides: createApp({ port: 4000, enableCrud: false })
const app = createApp();
await app.start();
`;
}

function renderHealthRouteTs() {
    return `import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true });
});

export const basePath = "/health";
export default router;
`;
}

function renderSampleUserModelTs() {
    return `import { defineModel, number, string } from "railnode";

export const User = defineModel("User", {
  name: string(),
  email: string(),
  age: number().optional(),
});
`;
}

function renderAppReadme(appName: string) {
    return `# ${appName}

## Dev

\`npm run dev\`

Config can live in \`backend.config.mjs\` (recommended), or you can pass overrides via \`createApp({ ... })\`.

- Loads models from \`src/models/*.model.ts\`
- Loads routes from \`src/routes/*.route.ts\`

## Try it

- Health: \`GET /health\`
- Users CRUD: \`/users\`
`;
}

function renderGitignore() {
    return `node_modules
dist
.env
.DS_Store
`;
}

export async function createAppScaffold(appNameRaw?: string, targetDirRaw?: string) {
    const cwd = process.cwd();
    const resolvedTargetDir = targetDirRaw ? path.resolve(cwd, targetDirRaw) : undefined;

    const appName = toKebabCase(
        appNameRaw ?? (resolvedTargetDir ? path.basename(resolvedTargetDir) : "railnode-app")
    );
    if (!appName) {
        throw new Error('App name is required. Example: `railnode create-app my-app`');
    }

    const targetDir = resolvedTargetDir ?? path.resolve(cwd, appName);

    if (await pathExists(targetDir)) {
        const entries = await fs.readdir(targetDir).catch(() => [] as string[]);
        if (entries.length > 0) {
            throw new Error(
                `Target directory is not empty: ${targetDir}. Choose a new name, or pass --dir to an empty folder.`
            );
        }
    }

    await ensureDir(path.join(targetDir, "src/models"));
    await ensureDir(path.join(targetDir, "src/routes"));

    await fs.writeFile(path.join(targetDir, "package.json"), renderAppPackageJson(appName), "utf8");
    await fs.writeFile(path.join(targetDir, "tsconfig.json"), renderAppTsconfigJson(), "utf8");

    await writeFileIfAbsent(path.join(targetDir, "backend.config.mjs"), renderBackendConfigMjs());
    await writeFileIfAbsent(path.join(targetDir, "src/index.ts"), renderAppIndexTs());
    await writeFileIfAbsent(path.join(targetDir, "src/routes/health.route.ts"), renderHealthRouteTs());
    await writeFileIfAbsent(path.join(targetDir, "src/models/user.model.ts"), renderSampleUserModelTs());
    await writeFileIfAbsent(path.join(targetDir, "README.md"), renderAppReadme(appName));
    await writeFileIfAbsent(path.join(targetDir, ".gitignore"), renderGitignore());

    return { appName, targetDir };
}

export async function generateModel(modelNameRaw: string, projectDirRaw?: string) {
    const modelName = toPascalCase(modelNameRaw);
    if (!modelName) throw new Error("Model name is required");

    const projectDir = projectDirRaw ? path.resolve(process.cwd(), projectDirRaw) : process.cwd();
    const modelsDir = path.join(projectDir, "src/models");
    await ensureDir(modelsDir);

    const fileName = `${toKebabCase(modelName)}.model.ts`;
    const filePath = path.join(modelsDir, fileName);

    const content = `import { defineModel, string } from "railnode";

export const ${modelName} = defineModel("${modelName}", {
  name: string(),
});
`;

    if (await pathExists(filePath)) {
        throw new Error(`Model already exists: ${path.relative(process.cwd(), filePath)}`);
    }

    await fs.writeFile(filePath, content, "utf8");
    return { modelName, filePath };
}
