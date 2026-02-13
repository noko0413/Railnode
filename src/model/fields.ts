type FieldType = "string" | "number" | "boolean";

export type FieldDefinition = {
    type: FieldType;
    isOptional: boolean;
};

type FieldBuilder = FieldDefinition & {
    optional(): FieldDefinition;
};

function createField(type: FieldType): FieldBuilder {
    return {
        type,
        isOptional: false,
        optional() {
            return { type, isOptional: true };
        },
    };
}

export function string() {
    return createField("string");
}

export function number() {
    return createField("number");
}

export function boolean() {
    return createField("boolean");
}
