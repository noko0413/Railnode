import { loadModulesFromDir } from "../utils/moduleLoader.js";

function isModelFile(fileName: string) {
    return (
        fileName.endsWith(".model.ts") ||
        fileName.endsWith(".model.js") ||
        fileName.endsWith(".model.mjs") ||
        fileName.endsWith(".model.cjs")
    );
}

type LoadOptions = {
    log?: (message: string) => void;
};

export async function loadModels(modelsDir: string, opts: LoadOptions = {}) {
    const log = opts.log ?? (() => undefined);

    const loaded = await loadModulesFromDir(modelsDir, isModelFile, ({ fileName }) => {
        log(`Loaded model: ${fileName}`);
    });

    if (loaded === 0) {
        log(`No model modules found in ${modelsDir}. Create a file like src/models/user.model.ts`);
    }

    return loaded;
}
