import { randomUUID } from "node:crypto";

export type CrudItem = {
    id: string;
    createdAt: string;
    updatedAt: string;
} & Record<string, unknown>;

export type MaybePromise<T> = T | Promise<T>;

export type CrudStore = {
    getAll(): MaybePromise<CrudItem[]>;
    getById(id: string): MaybePromise<CrudItem | null>;
    create(payload: unknown): MaybePromise<CrudItem>;
    update(id: string, payload: unknown): MaybePromise<CrudItem | null>;
    delete(id: string): MaybePromise<boolean>;
};

// Alias retained for readability at call sites.
export type InMemoryStore = CrudStore;

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

export function createInMemoryStore(): InMemoryStore {
    const items = new Map<string, CrudItem>();

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
            return updated;
        },

        delete(id: string) {
            return items.delete(id);
        },
    };
}
