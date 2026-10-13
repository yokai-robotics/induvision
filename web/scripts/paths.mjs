import { fileURLToPath } from "node:url";
import path from "node:path";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
export const webRoot = fileURLToPath(new URL("../", import.meta.url));
export const generatedRoot = fileURLToPath(new URL("../out/", import.meta.url));

const configuredPath = process.env.EXPORT_PATH?.trim();
if (!configuredPath) throw new Error("Set EXPORT_PATH to the static export directory before building or serving the site.");

export const staticRoot = path.resolve(projectRoot, configuredPath);

const overlaps = (first, second) => first === second || first.startsWith(`${second}${path.sep}`) || second.startsWith(`${first}${path.sep}`);
const protectedPaths = [
  webRoot,
  generatedRoot,
  path.join(projectRoot, ".git"),
  path.join(projectRoot, "node_modules"),
  path.join(webRoot, "node_modules"),
  path.join(webRoot, ".next")
];

if (staticRoot === projectRoot || protectedPaths.some((protectedPath) => overlaps(staticRoot, path.resolve(protectedPath)))) {
  throw new Error(`EXPORT_PATH must point to a dedicated export directory, outside protected project paths: ${staticRoot}`);
}
