import { defineModel } from "../model/defineModel.js";
import { number, string } from "../model/fields.js";

export const User = defineModel("User", {
    name: string(),
    email: string(),
    age: number().optional(),
});