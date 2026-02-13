# Models + automatic CRUD routes

Railnode’s “automatic routes” are the built-in CRUD endpoints generated for every registered model.

## How models are discovered

- Any file in the models directory matching `*.model.(ts|js|mjs|cjs)` is imported.
- Importing a model file should call `defineModel(...)`.
- `defineModel(...)` registers the model globally (at import-time).

Example model:

```ts
import { defineModel, number, string } from "railnode";

export const User = defineModel("User", {
  name: string(),
  email: string(),
  age: number().optional(),
});
```

## Automatic CRUD route mounting

On startup Railnode (by default) generates CRUD routes for every registered model.

Base path:

- `/${modelName.toLowerCase()}s`
  - `User` → `/users`
  - `Todo` → `/todos`

For each model, the CRUD router supports:

- `GET /<base>` — list all
- `GET /<base>/:id` — fetch by id
- `POST /<base>` — create
- `PUT /<base>/:id` — replace/update
- `DELETE /<base>/:id` — delete

IDs are strings.

- Memory/JSON/Postgres: UUIDs
- MongoDB: the document’s ObjectId hex string

## Validation

Requests to `POST` and `PUT` are validated against the model schema.

- Missing required fields are rejected.
- Types must match (`string`, `number`, `boolean`).
- `.optional()` marks a field optional.

## Disabling CRUD generation

You can disable auto CRUD routes:

- CLI dev mode: `railnode dev --no-crud`
- Config file: set `enableCrud: false`
- Programmatically: `createApp({ enableCrud: false })`

## Where data is stored

CRUD routes write/read via a per-model store provided by a DB adapter.

- Default adapter is in-memory (data resets on restart).
- You can switch adapters via `backend.config.*`.

See [Database adapters](database.md).
