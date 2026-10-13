import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { staticRoot } from "./paths.mjs";

const generated = fileURLToPath(new URL("../out/", import.meta.url));

// Only replace the generated site after Next.js has successfully exported it.
await stat(path.join(generated, "index.html"));
await mkdir(path.dirname(staticRoot), { recursive: true });
await rm(staticRoot, { recursive: true, force: true });
await rename(generated, staticRoot);

console.log("Static site exported to out/oqjljzdba7/");
