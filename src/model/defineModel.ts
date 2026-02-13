import { registerModel, type ModelSchema } from "./registry.js";

export function defineModel(name: string, schema: ModelSchema) {
  registerModel({ name, schema });

  return { name, schema };
}
