# Railnode

[![CI](https://github.com/ShishirShekhar/Railnode/actions/workflows/ci.yml/badge.svg)](https://github.com/ShishirShekhar/Railnode/actions/workflows/ci.yml)

A minimal, model-driven backend framework built on **Express 5** with **TypeScript + ESM**.

## Requirements

- Node.js >= 22

## Install

```bash
npm install
```

## 5-minute quickstart (model → running API)

This creates a new app, adds a model, starts the dev server, and exercises the generated CRUD endpoints.

```bash
# 1) Scaffold a new project
npx railnode create-app my-app
cd my-app

# 2) Install deps
npm install

# 3) Create a model (generates src/models/todo.model.ts)
npx railnode generate model Todo

# 4) Start the dev server (loads .ts models/routes)
npm run dev
```

Edit `src/models/todo.model.ts` to look like this:

```ts
import { boolean, defineModel, string } from "railnode";

export const Todo = defineModel("Todo", {
 title: string(),
 done: boolean().optional(),
});
```

Now try it:

```bash
# Health route (from src/routes/health.route.ts)
curl http://localhost:3000/health

# Create
curl -sS -X POST http://localhost:3000/todos \
 -H 'content-type: application/json' \
 -d '{"title":"Buy milk","done":false}'

# List
curl -sS http://localhost:3000/todos
```

Notes:

- CRUD base path is `/${modelName.toLowerCase()}s` (so `Todo` → `/todos`).
- The built-in CRUD store is in-memory (data resets on restart).

### Persisting CRUD data (DB adapter)

Railnode’s CRUD layer talks to storage through a small **DB adapter** interface.
That means the framework can use different backends (in-memory, PostgreSQL, MySQL, MongoDB, etc.) without changing the CRUD route code.

By default, Railnode uses an in-memory adapter.

To persist CRUD data across restarts, configure the built-in JSON-file adapter in `backend.config.json`:

```json
{
 "enableCrud": true,
 "db": {
  "adapter": "json",
  "json": {
   "dir": ".railnode/db"
  }
 }
}
```

This creates one file per model (e.g. `.railnode/db/todo.json`).

### PostgreSQL adapter

To use PostgreSQL for the built-in CRUD routes:

```json
{
 "enableCrud": true,
 "db": {
  "adapter": "postgres",
  "postgres": {
   "connectionString": "postgres://user:pass@localhost:5432/mydb",
   "schema": "public"
  }
 }
}
```

You can also omit `connectionString` and set `DATABASE_URL` in the environment.

### MongoDB adapter (structured)

MongoDB stores one collection per model and writes each model field as a real document field (not a single JSON blob).

```json
{
 "enableCrud": true,
 "db": {
  "adapter": "mongodb",
  "mongodb": {
   "connectionString": "mongodb://localhost:27017",
   "dbName": "railnode_dev",
   "collectionPrefix": ""
  }
 }
}
```

You can also set `MONGODB_URI` and `MONGODB_DB` in the environment.

## Usage (after publishing to npm)

This repo publishes a package (currently named `railnode`) that contains two binaries:

- `railnode` (main CLI)
- `create-railnode-app` (convenience wrapper for scaffolding)

Examples:

```bash
# Scaffold a new app (recommended)
npx railnode create-app my-app

# Or use the dedicated wrapper (short form)
npx create-railnode-app my-app

# Or run the secondary binary via npx (explicit package)
npx --package railnode create-railnode-app my-app
```

Note: If you specifically want `npx create-railnode-app my-app` (without `--package railnode`),
you typically publish a separate wrapper package named `create-railnode-app` (this repo includes one under `packages/create-railnode-app`).

## Scripts

- `npm run dev` — run the demo in watch mode
- `npm run dev:cli` — run the CLI from source
- `npm run dev:create-app` — run the app generator from source
- `npm run lint` / `npm run lint:fix`
- `npm run typecheck`
- `npm run build`
- `npm test` — runs lint + typecheck

## Documentation

New to Railnode? Start here:

- [docs/README.md](docs/README.md)
- [docs/getting-started.md](docs/getting-started.md)
- [docs/models-and-crud.md](docs/models-and-crud.md)
- [docs/routes.md](docs/routes.md)
- [docs/database.md](docs/database.md)
- [docs/config.md](docs/config.md)
- [docs/cli.md](docs/cli.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)

## CLI

After building (`npm run build`), the package exposes these binaries:

- `railnode`
- `create-railnode-app`

(There are also compatibility aliases: `backend-framework` and `create-app`.)

## Project status

This is an early-stage project. APIs may change.

## License

ISC — see [LICENSE](LICENSE).
