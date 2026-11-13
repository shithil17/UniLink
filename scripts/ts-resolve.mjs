// Lets `node scripts/<name>.ts` load the app's source, which imports its own files without an extension
// (`from "./common"`). Node's ESM loader needs the extension, so on a miss this retries with `.ts` and
// `/index.ts`. Used by `vp run seed` through `node --import ./scripts/ts-resolve.mjs`.
import { register } from "node:module";

register("./ts-resolve-hooks.mjs", import.meta.url);
