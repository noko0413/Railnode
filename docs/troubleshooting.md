# Troubleshooting

## First step: run doctor

From your app root:

```bash
railnode doctor
```

For CI or scripts:

```bash
railnode doctor --json --strict
```

## Common issues

### Dev server fails to start (TS loader issues)

Symptoms:

- Errors about `--import tsx`
- Module resolution failures in dev

Fix:

- Ensure your app has `tsx` installed (scaffolded apps include it in `devDependencies`).
- Ensure you’re on Node >= 22.

### Routes are not loading

Checklist:

- File name ends with `.route.ts` (or `.route.js/.mjs/.cjs`).
- The module exports both:
  - `export const basePath = "/..."`
  - `export default router`

See [Manual routes](routes.md).

### CRUD routes are missing

Checklist:

- `enableCrud` is not set to `false`.
- You have at least one model registered via `defineModel(...)`.

See [Models + CRUD](models-and-crud.md).

### Postgres adapter complains about missing connection string

Provide one of:

- `db.postgres.connectionString` in `backend.config.*`
- `DATABASE_URL` in the environment

See [Database adapters](database.md).

### Mongo adapter complains about missing URI / db name

Provide:

- `MONGODB_URI` (or config `db.mongodb.connectionString`)
- `MONGODB_DB` (or config `db.mongodb.dbName`)

See [Database adapters](database.md).
