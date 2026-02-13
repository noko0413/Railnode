# Getting started

## Requirements

- Node.js >= 22

## Create a new app

From anywhere:

```bash
npx railnode create-app my-app
cd my-app
npm install
npm run dev
```

This scaffolds:

- `src/index.ts` (starts the server)
- `src/models/*.model.ts` (models)
- `src/routes/*.route.ts` (manual routes)
- `backend.config.mjs` (optional config)

## Project layout (default)

- Models are loaded from (first match wins):
  - `dist/models` (when you build)
  - `src/models` (dev)
- Routes are loaded from:
  - `dist/routes` (when you build)
  - `src/routes` (dev)

The defaults can be overridden via `backend.config.*`.

## Run in dev mode

In a scaffolded app, `npm run dev` typically runs:

```bash
railnode dev
```

Dev mode uses Node’s loader to run TypeScript directly (it relies on `tsx` being installed in the app).

## Add a model (and get CRUD routes automatically)

```bash
npx railnode generate model Todo
```

Then edit `src/models/todo.model.ts`:

```ts
import { boolean, defineModel, string } from "railnode";

export const Todo = defineModel("Todo", {
  title: string(),
  done: boolean().optional(),
});
```

Start the server and try:

- `GET /health`
- `POST /todos`
- `GET /todos`

CRUD routes are described in detail in [Models + automatic CRUD routes](models-and-crud.md).
