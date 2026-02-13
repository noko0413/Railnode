export { createApp, type BackendConfig } from "./core/createApp.js";

export { HttpError } from "./core/errorHandling.js";

export {
    createDbAdapter,
    createJsonFileDbAdapter,
    createMemoryDbAdapter,
    type DbAdapter,
    type DbConfig,
} from "./db/adapter.js";

export { createPostgresDbAdapter, type PostgresDbConfig } from "./db/postgresAdapter.js";

export { createMongoDbAdapter, type MongoDbConfig } from "./db/mongoAdapter.js";

export { defineModel } from "./model/defineModel.js";
export { string, number, boolean } from "./model/fields.js";

export { getModels } from "./model/registry.js";
