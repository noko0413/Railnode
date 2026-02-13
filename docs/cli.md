# CLI reference

Railnode ships a `railnode` CLI (and a `create-railnode-app` convenience wrapper).

## Create a new project

```bash
npx railnode create-app my-app
```

Options:

- `--dir <path>`: scaffold into a specific empty directory

## Generate a model

```bash
npx railnode generate model User
```

Options:

- `--project <path>`: generate into a different project directory

This creates a file in `src/models/*.model.ts`.

## Run dev server

```bash
railnode dev
```

Options:

- `--port <port>`: override port
- `--project <path>`: project root (where `backend.config.*` lives)
- `--models-dir <path>`: override models directory (relative to project)
- `--routes-dir <path>`: override routes directory (relative to project)
- `--no-crud`: disable CRUD route generation
- `--quiet`: suppress Railnode logs

## Doctor (project sanity checks)

```bash
railnode doctor
```

Options:

- `--project <path>`
- `--models-dir <path>`
- `--routes-dir <path>`
- `--json`: machine-readable report
- `--strict`: exit non-zero on warnings

Doctor checks:

- Node version
- config file loadability
- models/routes directories exist
- route files export `basePath` + default router
- presence of deps like `tsx` in your app
