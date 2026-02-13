# Manual routes (route loader)

Beyond CRUD, you add normal Express routers and Railnode will auto-mount them.

## How route files are discovered

- Any file in the routes directory matching `*.route.(ts|js|mjs|cjs)` is imported.
- A route module is mounted only when it exports:
  - `export const basePath = "/something"` (string)
  - `export default router` where `router` is an `express.Router()`

If `basePath` is present but there is no default export, the route is skipped.
If a default export exists but `basePath` is missing/invalid, the route is skipped.

## Minimal example

Create `src/routes/health.route.ts`:

```ts
import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true });
});

export const basePath = "/health";
export default router;
```

This is mounted at `/health`.

## Route composition

If you want multiple endpoints under one base path:

```ts
router.get("/stats", ...);
router.post("/reindex", ...);

export const basePath = "/admin";
```

Results:

- `GET /admin/stats`
- `POST /admin/reindex`

## Accessing runtime config in a route

Railnode stores runtime info on `app.locals.backend`.

In a route handler (you have access to `req.app.locals`):

```ts
router.get("/", (req, res) => {
  const backend = req.app.locals["backend"] as any;
  res.json({
    port: backend?.runtime?.port,
    modelsPath: backend?.runtime?.modelsPath,
    routesPath: backend?.runtime?.routesPath,
    dbAdapterKind: backend?.config?.dbAdapter?.kind ?? backend?.config?.db?.adapter,
  });
});
```

Keep this lightweight—`app.locals` is a convenient escape hatch for operational/debug info.
