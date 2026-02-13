import type { Application } from "express";
import { getModels } from "../model/registry.js";
import { createInMemoryStore } from "./internal/store.js";
import { createCrudRoutes, getCrudBasePath } from "./internal/router.js";
import type { DbAdapter } from "../db/adapter.js";

type LoadOptions = {
    log?: (message: string) => void;
    dbAdapter?: DbAdapter;
};

export function generateCrudRoutes(app: Application, opts: LoadOptions = {}) {
    const log = opts.log ?? (() => undefined);
    const models = getModels();

    for (const model of models) {
        const store = opts.dbAdapter ? opts.dbAdapter.getCrudStore(model) : createInMemoryStore();
        const router = createCrudRoutes(model, store);
        const basePath = getCrudBasePath(model.name);

        app.use(basePath, router);
        log(`CRUD routes: ${model.name} -> ${basePath}`);
    }
}
