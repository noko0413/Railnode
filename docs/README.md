# Railnode documentation

Start here if you’re new to the repo or to Railnode.

## Core concepts

- [Getting started](getting-started.md)
- [Models + automatic CRUD routes](models-and-crud.md)
- [Manual routes (route loader)](routes.md)
- [Database adapters (switching storage)](database.md)
- [Backend configuration](config.md)
- [CLI reference](cli.md)
- [Troubleshooting](troubleshooting.md)

## Mental model

Railnode boots an Express app and then:

1. Loads model modules from `modelsDir` (defaults to `dist/models` then `src/models`).
2. (Optional) Generates CRUD routes for every registered model.
3. Loads route modules from `routesDir` (defaults to `dist/routes` then `src/routes`).

Model files register themselves at import-time via `defineModel(...)`. Route files are auto-mounted when they export both `basePath` and a default `express.Router`.
