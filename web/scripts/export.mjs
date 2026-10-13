import { cp, mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { generatedRoot, staticRoot } from "./paths.mjs";

// Only replace the generated site after Next.js has successfully exported it.
await stat(path.join(generatedRoot, "index.html"));
const parent = path.dirname(staticRoot);
await mkdir(parent, { recursive: true });
const staging = await mkdtemp(path.join(parent, `.${path.basename(staticRoot)}-`));
try {
  await cp(generatedRoot, staging, { recursive: true, force: true });
  await rm(staticRoot, { recursive: true, force: true });
  await rename(staging, staticRoot);
  await rm(generatedRoot, { recursive: true, force: true });
} finally {
  await rm(staging, { recursive: true, force: true });
}

console.log(`Static site exported to ${staticRoot}`);
