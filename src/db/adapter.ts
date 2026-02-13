import path from "node:path";

import { createJsonFileStore } from "../crud/internal/jsonFileStore.js";
import { createInMemoryStore, type CrudStore } from "../crud/internal/store.js";
import type { ModelDefinition } from "../model/registry.js";
import { createPostgresDbAdapter, type PostgresDbConfig } from "./postgresAdapter.js";
import { createMongoDbAdapter, type MongoDbConfig } from "./mongoAdapter.js";

export type DbAdapter = {
    // Used for logging / debugging only.
    kind: "memory" | "json-file" | (string & {});

    // Optional lifecycle hooks for real database clients (Postgres/MySQL/Mongo/etc).
    init?: () => Promise<void>;
    dispose?: () => Promise<void>;

    // Per-model repository/store used by the built-in CRUD routes.
    getCrudStore(model: ModelDefinition): CrudStore;
};

export type DbConfig = {
    adapter?: "memory" | "json" | "postgres" | "mongodb";
    json?: {
        dir?: string;
    };
    postgres?: {
        connectionString?: string;
        schema?: string;
    };
    mongodb?: {
        connectionString?: string;
        dbName?: string;
        collectionPrefix?: string;
    };
};

export function createMemoryDbAdapter(): DbAdapter {
    const stores = new Map<string, CrudStore>();

    return {
        kind: "memory",
        getCrudStore(model: ModelDefinition) {
            const key = model.name.toLowerCase();
            const existing = stores.get(key);
            if (existing) return existing;

            const store = createInMemoryStore();
            stores.set(key, store);
            return store;
        },
    };
}

export function createJsonFileDbAdapter(projectRoot: string, dirOverride?: string): DbAdapter {
    const dir = dirOverride ?? ".railnode/db";
    const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(projectRoot, dir);

    const stores = new Map<string, CrudStore>();

    return {
        kind: "json-file",
        getCrudStore(model: ModelDefinition) {
            const key = model.name.toLowerCase();
            const existing = stores.get(key);
            if (existing) return existing;

            const filePath = path.join(resolvedDir, `${key}.json`);
            const store = createJsonFileStore({ filePath });

            stores.set(key, store);
            return store;
        },
    };
}

export function createDbAdapter(projectRoot: string, config: DbConfig | undefined): DbAdapter {
    const adapter = config?.adapter ?? "memory";

    switch (adapter) {
        case "memory":
            return createMemoryDbAdapter();
        case "json":
            return createJsonFileDbAdapter(projectRoot, config?.json?.dir);
        case "postgres": {
            const connectionString =
                config?.postgres?.connectionString ?? process.env["DATABASE_URL"];

            if (!connectionString) {
                throw new Error(
                    "Postgres db adapter requires a connection string. Set db.postgres.connectionString in backend.config.*, or set DATABASE_URL."
                );
            }

            const pgCfg: PostgresDbConfig = {
                connectionString,
                ...(typeof config?.postgres?.schema === "string" ? { schema: config.postgres.schema } : {}),
            };

            return createPostgresDbAdapter(pgCfg);
        }
        case "mongodb": {
            const connectionString =
                config?.mongodb?.connectionString ?? process.env["MONGODB_URI"];
            const dbName = config?.mongodb?.dbName ?? process.env["MONGODB_DB"];

            if (!connectionString) {
                throw new Error(
                    "MongoDB db adapter requires a connection string. Set db.mongodb.connectionString in backend.config.*, or set MONGODB_URI."
                );
            }
            if (!dbName) {
                throw new Error(
                    "MongoDB db adapter requires a database name. Set db.mongodb.dbName in backend.config.*, or set MONGODB_DB."
                );
            }

            const cfg: MongoDbConfig = {
                connectionString,
                dbName,
                ...(typeof config?.mongodb?.collectionPrefix === "string"
                    ? { collectionPrefix: config.mongodb.collectionPrefix }
                    : {}),
            };

            return createMongoDbAdapter(cfg);
        }
        default:
            // If config is provided from JS (not JSON), keep runtime safe.
            return createMemoryDbAdapter();
    }
}
