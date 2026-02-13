import { createApp } from "./core/createApp.js";

const app = createApp({ port: 3000 });
await app.start();
