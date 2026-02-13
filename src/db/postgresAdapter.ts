import type { CrudItem, CrudStore } from "../crud/internal/store.js";
import type { ModelDefinition } from "../model/registry.js";
import type { DbAdapter } from "./adapter.js";
import { randomUUID } from "node:crypto";

export type PostgresDbConfig = {
    connectionString: string;
    schema?: string;
};

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

function asPostgresOpError(op: string, modelName: string | null, err: unknown): Error {
    const prefix = modelName ? `Postgres (${modelName})` : "Postgres";
    const msg = errorMessage(err);
    return new Error(`${prefix} ${op} failed: ${msg}`);
}

function nowIsoFromPg(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return new Date(value).toISOString();
    return new Date().toISOString();
}

function sanitizeClientPayload(payload: unknown) {
    if (!payload || typeof payload !== "object") return {};

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = payload as Record<
        string,
        unknown
    >;

    return rest;
}

function safeIdentifier(name: string) {
    // Allow only simple identifiers; throw early to avoid SQL injection.
    // Adapters can implement a richer naming/quoting strategy if needed.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(
            `Invalid SQL identifier: ${name}. Use letters, numbers, and underscores only (must not start with a number).`
        );
    }
    return `"${name}"`;
}

function modelToTableName(model: ModelDefinition) {
    // Keep it consistent with CRUD base path: /${modelName.toLowerCase()}s
    const base = `${model.name.toLowerCase()}s`;
    // Convert '-' etc to '_' conservatively.
    const normalized = base.replace(/[^A-Za-z0-9_]/g, "_");
    return normalized;
}

async function withClient<T>(pool: PgPool, fn: (client: PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try {
        return await fn(client);
    } finally {
        client.release();
    }
}

type QueryResult<T> = {
    rows: T[];
    rowCount?: number | null;
};

type PoolClient = {
    query<T>(queryText: string, params?: unknown[]): Promise<QueryResult<T>>;
    release(): void;
};

type PgPool = {
    connect(): Promise<PoolClient>;
    query<T>(queryText: string, params?: unknown[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
};

type PoolCtor = new (config: { connectionString: string }) => PgPool;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

async function loadPgPoolCtor(): Promise<PoolCtor> {
    // `pg` is CommonJS in many setups; dynamic import works in ESM and we normalize.
    const modUnknown: unknown = await import("pg");
    const mod = isRecord(modUnknown) ? modUnknown : {};

    const defaultUnknown = mod["default"];
    const defaultObj = isRecord(defaultUnknown) ? defaultUnknown : {};

    const poolCtorUnknown = mod["Pool"] ?? defaultObj["Pool"];
    if (typeof poolCtorUnknown !== "function") {
        throw new Error("Failed to load Postgres driver: expected pg.Pool export.");
    }

    return poolCtorUnknown as PoolCtor;
}

type CrudRow = {
    id: string;
    created_at: string | Date;
    updated_at: string | Date;
    data: Record<string, unknown>;
};

function rowToCrudItem(row: CrudRow): CrudItem {
    return {
        id: row.id,
        createdAt: nowIsoFromPg(row.created_at),
        updatedAt: nowIsoFromPg(row.updated_at),
        ...row.data,
    };
}

export function createPostgresDbAdapter(cfg: PostgresDbConfig): DbAdapter {
    const schema = cfg.schema ?? "public";

    let pool: PgPool | null = null;

    async function getPool(): Promise<PgPool> {
        if (pool) return pool;

        try {
            const PoolCtor = await loadPgPoolCtor();
            pool = new PoolCtor({ connectionString: cfg.connectionString });
            return pool;
        } catch (err) {
            pool = null;
            throw asPostgresOpError("connect", null, err);
        }
    }

    const tableReady = new Map<string, Promise<void>>();

    async function ensureTable(model: ModelDefinition) {
        const table = modelToTableName(model);
        const key = `${schema}.${table}`;

        const existing = tableReady.get(key);
        if (existing) return existing;

        const promise = (async () => {
            try {
                const pool = await getPool();

                return withClient(pool, async client => {
                    const schemaIdent = safeIdentifier(schema);
                    const tableIdent = safeIdentifier(table);

                    // Ensure schema exists.
                    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaIdent}`);

                    await client.query(`
                CREATE TABLE IF NOT EXISTS ${schemaIdent}.${tableIdent} (
                    id TEXT PRIMARY KEY,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    data JSONB NOT NULL DEFAULT '{}'::jsonb
                )
            `);
                });
            } catch (err) {
                throw asPostgresOpError("ensure table", model.name, err);
            }
        })();

        // If table init fails, drop the cached promise so a future request can retry.
        const guarded = promise.catch(err => {
            tableReady.delete(key);
            throw err;
        });

        tableReady.set(key, guarded);
        return guarded;
    }

    function storeForModel(model: ModelDefinition): CrudStore {
        const table = modelToTableName(model);
        const schemaIdent = safeIdentifier(schema);
        const tableIdent = safeIdentifier(table);
        const fullName = `${schemaIdent}.${tableIdent}`;

        async function ready() {
            await ensureTable(model);
        }

        return {
            async getAll() {
                try {
                    await ready();
                    const pool = await getPool();
                    const result = await pool.query<CrudRow>(
                        `SELECT id, created_at, updated_at, data FROM ${fullName} ORDER BY id ASC`
                    );
                    return result.rows.map(rowToCrudItem);
                } catch (err) {
                    throw asPostgresOpError("getAll", model.name, err);
                }
            },

            async getById(id: string) {
                try {
                    await ready();

                    const pool = await getPool();
                    const result = await pool.query<CrudRow>(
                        `SELECT id, created_at, updated_at, data FROM ${fullName} WHERE id = $1`,
                        [id]
                    );
                    const row = result.rows[0];
                    return row ? rowToCrudItem(row) : null;
                } catch (err) {
                    throw asPostgresOpError(`getById(${id})`, model.name, err);
                }
            },

            async create(payload: unknown) {
                try {
                    await ready();
                    const data = sanitizeClientPayload(payload);

                    const id = randomUUID();

                    const pool = await getPool();

                    const result = await pool.query<CrudRow>(
                        `INSERT INTO ${fullName} (id, data) VALUES ($1, $2::jsonb) RETURNING id, created_at, updated_at, data`,
                        [id, JSON.stringify(data)]
                    );

                    const row = result.rows[0];
                    if (!row) throw new Error("Postgres insert returned no row.");
                    return rowToCrudItem(row);
                } catch (err) {
                    throw asPostgresOpError("create", model.name, err);
                }
            },

            async update(id: string, payload: unknown) {
                try {
                    await ready();

                    const patch = sanitizeClientPayload(payload);

                    const pool = await getPool();

                    // Shallow merge: existing data + patch
                    const result = await pool.query<CrudRow>(
                        `
                    UPDATE ${fullName}
                    SET data = COALESCE(data, '{}'::jsonb) || $2::jsonb,
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING id, created_at, updated_at, data
                    `,
                        [id, JSON.stringify(patch)]
                    );

                    const row = result.rows[0];
                    return row ? rowToCrudItem(row) : null;
                } catch (err) {
                    throw asPostgresOpError(`update(${id})`, model.name, err);
                }
            },

            async delete(id: string) {
                try {
                    await ready();

                    const pool = await getPool();
                    const result = await pool.query(`DELETE FROM ${fullName} WHERE id = $1`, [id]);
                    return (result.rowCount ?? 0) > 0;
                } catch (err) {
                    throw asPostgresOpError(`delete(${id})`, model.name, err);
                }
            },
        };
    }

    return {
        kind: "postgres",
        async init() {
            try {
                // Validate connectivity early.
                const pool = await getPool();
                await pool.query("SELECT 1");
            } catch (err) {
                throw asPostgresOpError("init", null, err);
            }
        },
        async dispose() {
            if (!pool) return;
            try {
                await pool.end();
            } catch (err) {
                throw asPostgresOpError("dispose", null, err);
            } finally {
                pool = null;
            }
        },
        getCrudStore(model: ModelDefinition) {
            return storeForModel(model);
        },
    };
}
