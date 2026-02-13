# Backend configuration

Railnode reads runtime config from the project root, using the first file that exists:

- `backend.config.json`
- `backend.config.js`
- `backend.config.mjs`
- `backend.config.cjs`

If none exists, defaults are used.

## Minimal config example (ESM)

`backend.config.mjs`:

```js
export default {
  port: 3000,
  // modelsDir: "src/models",
  // routesDir: "src/routes",
  // enableCrud: true,
};
```

## Supported fields

- `port` (number)
- `modelsDir` (string) — relative to project root
- `routesDir` (string) — relative to project root
- `enableCrud` (boolean)
- `db` (object) — see [Database adapters](database.md)

## Directory resolution rules

If you don’t set `modelsDir` / `routesDir`, Railnode tries:

- Models: `dist/models` then `src/models`
- Routes: `dist/routes` then `src/routes`

This supports both:

- production builds (`npm run build` then `node dist/index.js`)
- dev (`railnode dev`) loading TypeScript from `src/`

## Overrides and precedence

When you call `createApp({ ... })` you can provide overrides.

Effective config is merged like this:

1. File config from `backend.config.*`
2. Overrides passed to `createApp(config)`

The CLI’s `railnode dev --port/--project/--models-dir/--routes-dir/--no-crud` ultimately becomes `createApp({ ... })` overrides.

## JSON config notes

`backend.config.json` must be a JSON object.

Example:

```json
{
  "port": 3000,
  "enableCrud": true,
  "db": { "adapter": "json", "json": { "dir": ".railnode/db" } }
}
```

If you use `.js/.mjs/.cjs`, export a default object:

```js
export default { port: 3000 };
```
