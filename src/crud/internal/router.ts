import { Router, type Request, type Response } from "express";
import type { ModelDefinition } from "../../model/registry.js";
import { validateInput } from "../../model/validator.js";
import type { InMemoryStore } from "./store.js";

function parseId(raw: string): string | null {
    const id = raw.trim();
    return id.length > 0 ? id : null;
}

function extractIdFromRequest(req: Request): string | null {
    const rawId = req.params["id"];
    if (typeof rawId !== "string") return null;
    return parseId(rawId);
}

function handleInvalidId(res: Response): Response {
    return res.status(400).json({ message: "Invalid id" });
}

export function getCrudBasePath(modelName: string): string {
    return `/${modelName.toLowerCase()}s`;
}

export function createCrudRoutes(model: ModelDefinition, store: InMemoryStore) {
    const router = Router();

    // GET all
    router.get("/", async (_req: Request, res: Response) => {
        return res.json(await store.getAll());
    });

    // GET by id
    router.get("/:id", async (req: Request, res: Response) => {
        const id = extractIdFromRequest(req);
        if (id === null) return handleInvalidId(res);

        const item = await store.getById(id);
        if (!item) return res.status(404).json({ message: "Not found" });

        return res.json(item);
    });

    // POST (create)
    router.post("/", async (req: Request, res: Response) => {
        const errors = validateInput(model.schema, req.body);
        if (errors.length > 0) return res.status(400).json({ errors });

        const newItem = await store.create(req.body);
        return res.status(201).json(newItem);
    });

    // PUT (update)
    router.put("/:id", async (req: Request, res: Response) => {
        const id = extractIdFromRequest(req);
        if (id === null) return handleInvalidId(res);

        const errors = validateInput(model.schema, req.body);
        if (errors.length > 0) return res.status(400).json({ errors });

        const updatedItem = await store.update(id, req.body);
        if (!updatedItem) return res.status(404).json({ message: "Not found" });

        return res.json(updatedItem);
    });

    // DELETE
    router.delete("/:id", async (req: Request, res: Response) => {
        const id = extractIdFromRequest(req);
        if (id === null) return handleInvalidId(res);

        const success = await store.delete(id);
        if (!success) return res.status(404).json({ message: "Not found" });

        return res.status(204).send();
    });

    return router;
}
