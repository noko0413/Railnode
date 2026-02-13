import { isRecord } from "../utils/guards.js";
import type { DbConfig } from "../db/adapter.js";
import type { LoadedBackendConfig } from "./backendConfig.js";

export function validatePort(
    port: unknown,
    configPath: string | undefined
): number | null {
    if (port === undefined) return null;
    if (typeof port !== "number") {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: port must be a number.`
        );
    }
    return port;
}

export function validateString(
    value: unknown,
    fieldName: string,
    configPath: string | undefined
): string | null {
    if (value === undefined) return null;
    if (typeof value !== "string") {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: ${fieldName} must be a string.`
        );
    }
    return value;
}

export function validateBoolean(
    value: unknown,
    fieldName: string,
    configPath: string | undefined
): boolean | null {
    if (value === undefined) return null;
    if (typeof value !== "boolean") {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: ${fieldName} must be a boolean.`
        );
    }
    return value;
}

export function validateDbConfig(
    dbCfg: unknown,
    configPath: string | undefined
): DbConfig {
    if (!isRecord(dbCfg)) {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: db must be an object like { adapter: "memory" | "json", json: { dir: ".railnode/db" } }.`
        );
    }

    const cfg = dbCfg as Record<string, unknown>;
    const typed: DbConfig = {};

    // Validate adapter
    const rawAdapter = cfg["adapter"];
    if (rawAdapter !== undefined) {
        if (typeof rawAdapter !== "string") {
            throw new Error(
                `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.adapter must be a string ("memory" or "json").`
            );
        }
        const validAdapters = ["memory", "json", "postgres", "mongodb"];
        if (!validAdapters.includes(rawAdapter)) {
            throw new Error(
                `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.adapter must be "memory", "json", "postgres", or "mongodb".`
            );
        }
        typed.adapter = rawAdapter as "memory" | "json" | "postgres" | "mongodb";
    }

    // Validate JSON config
    const rawJson = cfg["json"];
    if (rawJson !== undefined) {
        if (!isRecord(rawJson)) {
            throw new Error(
                `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.json must be an object like { dir: ".railnode/db" }.`
            );
        }

        const rawDir = (rawJson as Record<string, unknown>)["dir"];
        if (rawDir !== undefined && typeof rawDir !== "string") {
            throw new Error(
                `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.json.dir must be a string.`
            );
        }

        typed.json = {
            ...(typeof rawDir === "string" ? { dir: rawDir } : {}),
        };
    }

    // Validate PostgreSQL config
    const rawPostgres = cfg["postgres"];
    if (rawPostgres !== undefined) {
        validatePostgresConfig(rawPostgres, configPath);
        const postgresConfig = rawPostgres as Record<string, unknown>;
        const conn = postgresConfig["connectionString"];
        const schema = postgresConfig["schema"];

        typed.postgres = {
            ...(typeof conn === "string" ? { connectionString: conn } : {}),
            ...(typeof schema === "string" ? { schema } : {}),
        };

        if (
            typed.adapter === "postgres" &&
            !typed.postgres.connectionString &&
            !process.env["DATABASE_URL"]
        ) {
            throw new Error(
                `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.adapter is "postgres" but no connection string provided. Set db.postgres.connectionString or DATABASE_URL.`
            );
        }
    }

    // Validate MongoDB config
    const rawMongo = cfg["mongodb"];
    if (rawMongo !== undefined) {
        validateMongoDbConfig(rawMongo, configPath);
        const mongoConfig = rawMongo as Record<string, unknown>;
        const conn = mongoConfig["connectionString"];
        const dbName = mongoConfig["dbName"];
        const prefix = mongoConfig["collectionPrefix"];

        typed.mongodb = {
            ...(typeof conn === "string" ? { connectionString: conn } : {}),
            ...(typeof dbName === "string" ? { dbName } : {}),
            ...(typeof prefix === "string" ? { collectionPrefix: prefix } : {}),
        };

        if (
            typed.adapter === "mongodb" &&
            !typed.mongodb.connectionString &&
            !process.env["MONGODB_URI"]
        ) {
            throw new Error(
                `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.adapter is "mongodb" but no connection string provided. Set db.mongodb.connectionString or MONGODB_URI.`
            );
        }
        if (
            typed.adapter === "mongodb" &&
            !typed.mongodb.dbName &&
            !process.env["MONGODB_DB"]
        ) {
            throw new Error(
                `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.adapter is "mongodb" but no db name provided. Set db.mongodb.dbName or MONGODB_DB.`
            );
        }
    }

    return typed;
}

function validatePostgresConfig(
    config: unknown,
    configPath: string | undefined
): void {
    if (!isRecord(config)) {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.postgres must be an object like { connectionString: "postgres://...", schema: "public" }.`
        );
    }

    const cfg = config as Record<string, unknown>;
    const conn = cfg["connectionString"];
    const schema = cfg["schema"];

    if (conn !== undefined && typeof conn !== "string") {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.postgres.connectionString must be a string.`
        );
    }
    if (schema !== undefined && typeof schema !== "string") {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.postgres.schema must be a string.`
        );
    }
}

function validateMongoDbConfig(
    config: unknown,
    configPath: string | undefined
): void {
    if (!isRecord(config)) {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.mongodb must be an object like { connectionString: "mongodb://...", dbName: "mydb" }.`
        );
    }

    const cfg = config as Record<string, unknown>;
    const conn = cfg["connectionString"];
    const dbName = cfg["dbName"];
    const prefix = cfg["collectionPrefix"];

    if (conn !== undefined && typeof conn !== "string") {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.mongodb.connectionString must be a string.`
        );
    }
    if (dbName !== undefined && typeof dbName !== "string") {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.mongodb.dbName must be a string.`
        );
    }
    if (prefix !== undefined && typeof prefix !== "string") {
        throw new Error(
            `Invalid backend config${configPath ? ` (${configPath})` : ""}: db.mongodb.collectionPrefix must be a string.`
        );
    }
}

export function buildFileConfig(
    fileConfig: LoadedBackendConfig,
    configPath: string | undefined
) {
    const typed: Omit<
        typeof fileConfig,
        keyof (typeof fileConfig & Record<string, never>)
    > & { port?: number; modelsDir?: string; routesDir?: string; enableCrud?: boolean; db?: DbConfig } = {};

    const port = validatePort(fileConfig.port, configPath);
    if (port !== null) typed.port = port;

    const modelsDir = validateString(
        fileConfig.modelsDir,
        "modelsDir",
        configPath
    );
    if (modelsDir !== null) typed.modelsDir = modelsDir;

    const routesDir = validateString(
        fileConfig.routesDir,
        "routesDir",
        configPath
    );
    if (routesDir !== null) typed.routesDir = routesDir;

    const enableCrud = validateBoolean(
        fileConfig.enableCrud,
        "enableCrud",
        configPath
    );
    if (enableCrud !== null) typed.enableCrud = enableCrud;

    if (fileConfig.db !== undefined) {
        typed.db = validateDbConfig(fileConfig.db, configPath);
    }

    return typed;
}
