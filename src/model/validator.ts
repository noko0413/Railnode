import { type FieldDefinition } from "./fields.js";

type Schema = Record<string, FieldDefinition>;

export function validateInput(schema: Schema, input: unknown) {
    const errors: string[] = [];

    if (!input || typeof input !== "object") {
        return ["body must be an object"];
    }

    const record = input as Record<string, unknown>;

    for (const key in schema) {
        const field = schema[key];
        if (!field) continue;
        const value = record[key];

        if (value === undefined || value === null) {
            if (!field.isOptional) {
                errors.push(`${key} is required`);
            }
            continue;
        }

        if (field.type === "string" && typeof value !== "string") {
            errors.push(`${key} must be a string`);
        }

        if (field.type === "number" && typeof value !== "number") {
            errors.push(`${key} must be a number`);
        }

        if (field.type === "boolean" && typeof value !== "boolean") {
            errors.push(`${key} must be a boolean`);
        }
    }

    return errors;
}
