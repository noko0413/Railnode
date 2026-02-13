import type { FieldDefinition } from "./fields.js";

export type ModelSchema = Record<string, FieldDefinition>;

export type ModelDefinition = {
    name: string;
    schema: ModelSchema;
};

const modelsByName = new Map<string, ModelDefinition>();

export function registerModel(model: ModelDefinition) {
    modelsByName.set(model.name, model);
}

export function getModels() {
    return [...modelsByName.values()];
}
