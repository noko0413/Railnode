import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { CrudItem, CrudStore } from "./store.js";

export type JsonFileStoreOptions = {
    filePath: string;
};

type PersistedCrudData = {
    items: CrudItem[];
};

function nowIso() {
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
}

function isCrudItem(value: unknown): value is CrudItem {
    if (!isRecord(value)) return false;
    return (
        typeof value["id"] === "string" &&
        typeof value["createdAt"] === "string" &&
        typeof value["updatedAt"] === "string"
    );
}

function loadPersistedData(filePath: string): PersistedCrudData {
    if (!fs.existsSync(filePath)) return { items: [] };

    let raw: string;
    try {
        raw = fs.readFileSync(filePath, "utf8");
    } catch {
        return { items: [] };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        // Backup corrupt JSON to help debugging.
        try {
            const backupPath = `${filePath}.corrupt-${Date.now()}`;
            fs.renameSync(filePath, backupPath);
        } catch {
            // ignore
        }
        return { items: [] };
    }

    if (!isRecord(parsed)) return { items: [] };

    const rawItems = parsed["items"];
    const itemsRaw = Array.isArray(rawItems) ? rawItems : [];
    const items = itemsRaw.filter(isCrudItem);
    return { items };
}

function atomicWriteJson(filePath: string, data: unknown) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    const json = JSON.stringify(data, null, 2);

    fs.writeFileSync(tempPath, json, "utf8");
    fs.renameSync(tempPath, filePath);
}

export function createJsonFileStore(opts: JsonFileStoreOptions): CrudStore {
    const filePath = opts.filePath;

    const persisted = loadPersistedData(filePath);
    const items = new Map<string, CrudItem>(persisted.items.map(item => [item.id, item]));

    function flush() {
        atomicWriteJson(filePath, {
            items: [...items.values()],
        } satisfies PersistedCrudData);
    }

    return {
        getAll() {
            return [...items.values()];
        },

        getById(id: string) {
            return items.get(id) ?? null;
        },

        create(payload: unknown) {
            const now = nowIso();
            const item: CrudItem = {
                id: randomUUID(),
                createdAt: now,
                updatedAt: now,
                ...sanitizeClientPayload(payload),
            };

            items.set(item.id, item);
            flush();
            return item;
        },

        update(id: string, payload: unknown) {
            const existing = items.get(id);
            if (!existing) return null;

            const updated: CrudItem = {
                ...existing,
                ...sanitizeClientPayload(payload),
                updatedAt: nowIso(),
            };

            items.set(id, updated);
            flush();
            return updated;
        },

        delete(id: string) {
            const didDelete = items.delete(id);
            if (didDelete) flush();
            return didDelete;
        },
    };
}
