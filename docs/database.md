# Database adapters (switching storage)

Railnode’s built-in CRUD layer reads/writes through a small DB adapter interface.

That means:

- CRUD route code does not change when you switch storage.
- You pick the adapter in `backend.config.*`.

## The adapters

### 1) Memory (default)

- Adapter: `memory`
- Data resets on server restart

Config:

```json
{
  "enableCrud": true,
  "db": { "adapter": "memory" }
}
```

### 2) JSON file (simple persistence)

- Adapter: `json`
- Stores one file per model under a directory

Config:

```json
{
  "enableCrud": true,
  "db": {
    "adapter": "json",
    "json": { "dir": ".railnode/db" }
  }
}
```

Notes:

- `dir` may be relative to the project root.
- Model `Todo` writes to `.railnode/db/todo.json`.

### 3) PostgreSQL

- Adapter: `postgres`
- Uses `db.postgres.connectionString` or `DATABASE_URL`

Config:

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

Environment-only configuration:

- Set `DATABASE_URL` and keep config minimal:

```json
{ "db": { "adapter": "postgres" } }
```

### 4) MongoDB

- Adapter: `mongodb`
- Uses `db.mongodb.connectionString` or `MONGODB_URI`
- Uses `db.mongodb.dbName` or `MONGODB_DB`

Config:

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

Environment-only configuration:

- `MONGODB_URI=mongodb://...`
- `MONGODB_DB=mydb`

## Switching adapters safely

1. Stop the server.
2. Update `backend.config.*` (or environment variables).
3. Start the server.

Notes:

- Each adapter has different persistence semantics.
- Switching adapters does not migrate existing data automatically.

IDs:

- Memory/JSON/Postgres adapters generate string UUIDs.
- MongoDB uses the document’s ObjectId hex string.

## Advanced: provide a custom adapter programmatically

If you are embedding Railnode (not just using the CLI), you can bypass config and pass a `dbAdapter`:

```ts
import { createApp, createPostgresDbAdapter } from "railnode";

const app = createApp({
  dbAdapter: createPostgresDbAdapter({
    connectionString: process.env.DATABASE_URL!,
    schema: "public",
  }),
});

await app.start();
```

When `dbAdapter` is provided, it wins over `db` config.
