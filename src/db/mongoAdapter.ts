import { MongoClient, ObjectId, type Collection, type Db } from "mongodb";

import type { CrudItem, CrudStore } from "../crud/internal/store.js";
import type { FieldDefinition } from "../model/fields.js";
import type { ModelDefinition, ModelSchema } from "../model/registry.js";
import type { DbAdapter } from "./adapter.js";

export type MongoDbConfig = {
    connectionString: string;
    dbName: string;
    collectionPrefix?: string;
};

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

function asMongoOpError(op: string, modelName: string | null, err: unknown): Error {
    const prefix = modelName ? `MongoDB (${modelName})` : "MongoDB";
    const msg = errorMessage(err);

    // Avoid dumping whole error objects (may include connection details in some stacks).
    return new Error(`${prefix} ${op} failed: ${msg}`);
}

type StoredDoc = {
    // NOTE: Mongo always has _id; we expose it as `id: string` in API responses.
    _id?: ObjectId;
    createdAt: Date;
    updatedAt: Date;
} & Record<string, unknown>;

function unwrapFindOneAndUpdateResult<T>(result: unknown): T | null {
    if (result === null || result === undefined) return null;

    if (typeof result === "object") {
        const obj = result as Record<string, unknown>;
        if ("value" in obj) return (obj["value"] as T | null) ?? null;
    }

    return result as T;
}

function now() {
    return new Date();
}

function nowIso(value: Date) {
    return value.toISOString();
}

function tryParseObjectId(raw: string): ObjectId | null {
    try {
        return new ObjectId(raw);
    } catch {
        return null;
    }
}

function modelToCollectionName(model: ModelDefinition) {
    const base = `${model.name.toLowerCase()}s`;
    return base.replace(/[^a-z0-9_]/g, "_");
}

function sanitizeClientPayload(payload: unknown) {
    if (!payload || typeof payload !== "object") return {};

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = payload as Record<
        string,
        unknown
    >;

    return rest;
}

function splitStructuredPatch(schema: ModelSchema, payload: unknown): {
    set: Record<string, unknown>;
    unset: Record<string, "">;
} {
    const raw = sanitizeClientPayload(payload);

    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};

    for (const key in schema) {
        const value = raw[key];
        if (value === undefined) continue;

        if (value === null) {
            unset[key] = "";
            continue;
        }

        set[key] = value;
    }

    return { set, unset };
}

function pickStructuredInsert(schema: ModelSchema, payload: unknown): Record<string, unknown> {
    const raw = sanitizeClientPayload(payload);
    const picked: Record<string, unknown> = {};

    for (const key in schema) {
        const value = raw[key];
        if (value === undefined || value === null) continue;
        picked[key] = value;
    }

    return picked;
}

function schemaToJsonSchema(schema: ModelSchema) {
    const numericBsonTypes = ["int", "long", "double", "decimal"] as const;

    const props: Record<string, unknown> = {
        _id: { bsonType: "objectId" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
    };

    const required = ["_id", "createdAt", "updatedAt"];

    for (const key in schema) {
        const field: FieldDefinition | undefined = schema[key];
        if (!field) continue;

        const bsonType =
            field.type === "string"
                ? "string"
                : field.type === "number"
                    ? numericBsonTypes
                    : "bool";

        props[key] = { bsonType };
        if (!field.isOptional) required.push(key);
    }

    return {
        bsonType: "object",
        required,
        additionalProperties: true,
        properties: props,
    };
}

function docToCrudItem(doc: StoredDoc): CrudItem {
    const { _id, createdAt, updatedAt, ...rest } = doc;

    if (!_id) {
        throw new Error("MongoDB document is missing _id");
    }

    return {
        id: _id.toHexString(),
        createdAt: nowIso(createdAt),
        updatedAt: nowIso(updatedAt),
        ...rest,
    };
}

export function createMongoDbAdapter(cfg: MongoDbConfig): DbAdapter {
    let client: MongoClient | null = null;
    let db: Db | null = null;

    const collectionCache = new Map<string, Promise<Collection<StoredDoc>>>();

    async function connect() {
        if (client && db) return { client, db };

        try {
            client = new MongoClient(cfg.connectionString);
            await client.connect();

            db = client.db(cfg.dbName);
            return { client, db };
        } catch (err) {
            // If connect fails, ensure we don't keep a half-initialized client around.
            try {
                await client?.close();
            } catch {
                // ignore
            }
            client = null;
            db = null;
            throw asMongoOpError("connect", null, err);
        }
    }

    async function ensureCollection(model: ModelDefinition): Promise<Collection<StoredDoc>> {
        const baseName = modelToCollectionName(model);
        const collectionName = `${cfg.collectionPrefix ?? ""}${baseName}`;

        const existing = collectionCache.get(collectionName);
        if (existing) return existing;

        const promise = (async () => {
            try {
                const { db } = await connect();

                const existingCollections = await db
                    .listCollections({ name: collectionName }, { nameOnly: true })
                    .toArray();

                if (existingCollections.length === 0) {
                    // Create with schema validation (best effort).
                    try {
                        await db.createCollection(collectionName, {
                            validator: {
                                $jsonSchema: schemaToJsonSchema(model.schema),
                            },
                            validationLevel: "moderate",
                        });
                    } catch {
                        // If validator/collection creation fails due to permissions or server settings,
                        // still continue with an unvalidated collection.
                        await db.createCollection(collectionName);
                    }
                }

                // Best-effort: keep collection validator in sync even when the collection already exists.
                // (Mongo validators are sticky; schema changes in code won't apply unless we update them.)
                try {
                    await db.command({
                        collMod: collectionName,
                        validator: { $jsonSchema: schemaToJsonSchema(model.schema) },
                        validationLevel: "moderate",
                    });
                } catch {
                    // Ignore if user lacks collMod privileges or server disallows validators.
                }

                const collection = db.collection<StoredDoc>(collectionName);
                // `_id` is indexed by default.

                return collection;
            } catch (err) {
                throw asMongoOpError("ensure collection", model.name, err);
            }
        })();

        // If initialization fails, drop the cached promise so a future request can retry.
        const guarded = promise.catch(err => {
            collectionCache.delete(collectionName);
            throw err;
        });

        collectionCache.set(collectionName, guarded);
        return guarded;
    }

    function storeForModel(model: ModelDefinition): CrudStore {
        async function collection() {
            return ensureCollection(model);
        }

        function buildLookup(id: string): Record<string, unknown> {
            const objectId = tryParseObjectId(id);
            if (objectId) return { _id: objectId };

            // No valid identifier format.
            return { _id: null };
        }

        return {
            async getAll() {
                try {
                    const col = await collection();
                    const docs = await col
                        .find({})
                        .sort({ _id: 1 })
                        .toArray();
                    return docs.map(docToCrudItem);
                } catch (err) {
                    throw asMongoOpError("getAll", model.name, err);
                }
            },

            async getById(id: string) {
                try {
                    const col = await collection();

                    const lookup = buildLookup(id);
                    // If lookup is invalid, treat as not found.
                    if (lookup["_id"] === null) return null;

                    const doc = await col.findOne(lookup);
                    return doc ? docToCrudItem(doc) : null;
                } catch (err) {
                    throw asMongoOpError(`getById(${id})`, model.name, err);
                }
            },

            async create(payload: unknown) {
                try {
                    const col = await collection();
                    const timestamp = now();

                    const structured = pickStructuredInsert(model.schema, payload);

                    const _id = new ObjectId();

                    const doc: StoredDoc = {
                        _id,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        ...structured,
                    };

                    const result = await col.insertOne(doc);

                    // Create the response item without an extra round trip.
                    return docToCrudItem({ ...doc, _id: result.insertedId });
                } catch (err) {
                    throw asMongoOpError("create", model.name, err);
                }
            },

            async update(id: string, payload: unknown) {
                try {
                    const col = await collection();

                    const lookup = buildLookup(id);
                    if (lookup["_id"] === null) return null;

                    const { set, unset } = splitStructuredPatch(model.schema, payload);
                    const update: Record<string, unknown> = {
                        $set: {
                            ...set,
                            updatedAt: now(),
                        },
                    };

                    if (Object.keys(unset).length > 0) {
                        update["$unset"] = unset;
                    }

                    const result = await col.findOneAndUpdate(
                        lookup,
                        update,
                        { returnDocument: "after" }
                    );
                    const doc = unwrapFindOneAndUpdateResult<StoredDoc>(result);
                    return doc ? docToCrudItem(doc) : null;
                } catch (err) {
                    throw asMongoOpError(`update(${id})`, model.name, err);
                }
            },

            async delete(id: string) {
                try {
                    const col = await collection();

                    const lookup = buildLookup(id);
                    if (lookup["_id"] === null) return false;

                    const res = await col.deleteOne(lookup);
                    return res.deletedCount > 0;
                } catch (err) {
                    throw asMongoOpError(`delete(${id})`, model.name, err);
                }
            },
        };
    }

    return {
        kind: "mongodb",
        async init() {
            await connect();
        },
        async dispose() {
            if (!client) return;
            try {
                await client.close();
            } catch (err) {
                throw asMongoOpError("dispose", null, err);
            } finally {
                client = null;
                db = null;
                collectionCache.clear();
            }
        },
        getCrudStore(model: ModelDefinition) {
            return storeForModel(model);
        },
    };
}
