import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDirectory, readDirSorted } from "./fs.js";
import { isRecord } from "./guards.js";

export type LoadedModule = {
    fileName: string;
    fullPath: string;
    module: Record<string, unknown>;
};

export async function loadModulesFromDir(
    dirPath: string,
    fileFilter: (fileName: string) => boolean,
    onModule: (mod: LoadedModule) => void | Promise<void>
) {
    if (!(await isDirectory(dirPath))) return 0;

    const files = (await readDirSorted(dirPath)).filter(fileFilter);
    let loaded = 0;

    for (const fileName of files) {
        const fullPath = path.join(dirPath, fileName);
        let modUnknown: unknown;
        try {
            modUnknown = await import(pathToFileURL(fullPath).href);
        } catch (err: unknown) {
            const rel = path.relative(process.cwd(), fullPath);
            const hint =
                "If this file is TypeScript, run via `railnode dev` (tsx) or build first (tsc) before running `node dist/...`.";
            throw new Error(`Failed to import module: ${rel}. ${hint}`, { cause: err });
        }

        const module = isRecord(modUnknown) ? modUnknown : {};

        await onModule({ fileName, fullPath, module });
        loaded++;
    }

    return loaded;
}
