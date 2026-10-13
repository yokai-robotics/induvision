import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dataDirectory = fileURLToPath(new URL("../data/", import.meta.url));
const definitions = {
  cameras: {
    strings: ["sensorFormat", "sensorSupplier", "sensorModel", "interfaceType", "lensMount", "bitDepth", "exposureRange"],
    numbers: ["resolutionWidth", "resolutionHeight", "sensorWidthMm", "sensorHeightMm", "pixelSizeUm", "maxFps"],
    enums: { cameraType: ["Area scan", "Line scan", "3D", "Smart camera"], sensorTechnology: ["", "CMOS", "CCD"], colorMode: ["", "Monochrome", "Couleur"], shutter: ["", "Global shutter", "Rolling shutter"] }
  },
  lenses: {
    strings: ["mount", "sensorFormat"],
    numbers: ["focalLengthMm", "maxSensorDiagonalMm", "apertureMin", "apertureMax", "minFocusDistanceMm", "minWorkingDistanceMm"],
    optionalNumbers: ["recommendedWorkingDistanceMm", "opticalResolutionMp"],
    enums: { lensType: ["", "Standard", "Télécentrique", "Macro", "Grand angle"] }
  }
};

export function validateEntry(entry, kind, filename = "fiche") {
  const fail = (message) => { throw new Error(`${filename}: ${message}`); };
  const definition = definitions[kind];
  if (!definition || !entry || typeof entry !== "object" || Array.isArray(entry)) fail("objet catalogue invalide");
  for (const field of ["id", "brand", "model"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) fail(`${field} obligatoire`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) fail("id doit être un slug stable");
  for (const field of definition.strings) if (typeof entry[field] !== "string") fail(`${field} doit être une chaîne`);
  for (const [field, values] of Object.entries(definition.enums)) if (!values.includes(entry[field])) fail(`${field} invalide`);
  for (const field of [...definition.numbers, ...(definition.optionalNumbers ?? [])]) {
    if (definition.optionalNumbers?.includes(field) && entry[field] === undefined) continue;
    const value = entry[field];
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value <= 0)) fail(`${field}: nombre positif ou null attendu`);
    if (field.startsWith("resolution") && value !== null && !Number.isInteger(value)) fail(`${field}: entier attendu`);
  }
  for (const field of ["notes", "sourceUrl", "distortion"]) if (entry[field] !== undefined && typeof entry[field] !== "string") fail(`${field} doit être une chaîne`);
  if (entry.sourceUrl) {
    let url;
    try { url = new URL(entry.sourceUrl); } catch { fail("sourceUrl invalide"); }
    if (!["http:", "https:"].includes(url.protocol)) fail("sourceUrl doit être HTTP/HTTPS");
  }
  if (kind === "cameras") {
    for (const [dimension, resolution] of [["sensorWidthMm", "resolutionWidth"], ["sensorHeightMm", "resolutionHeight"]]) {
      if (entry[dimension] && entry[resolution] && entry.pixelSizeUm) {
        const expected = entry[resolution] * entry.pixelSizeUm / 1000;
        if (Math.abs(entry[dimension] - expected) / expected > 0.1) fail(`${dimension} incohérent avec la résolution et la taille du pixel`);
      }
    }
  }
  if (kind === "lenses" && entry.apertureMin && entry.apertureMax && entry.apertureMin > entry.apertureMax) fail("plage d’ouverture inversée");
  return entry;
}

async function jsonFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await jsonFiles(filename));
    else if (entry.name.endsWith(".json")) files.push(filename);
  }
  return files.sort();
}

export async function generateCatalog() {
  const catalog = {};
  for (const kind of Object.keys(definitions)) {
    const ids = new Set();
    const models = new Set();
    catalog[kind] = [];
    for (const filename of await jsonFiles(path.join(dataDirectory, kind))) {
      const entry = validateEntry(JSON.parse(await readFile(filename, "utf8")), kind, filename);
      const modelKey = `${entry.brand.trim().toLowerCase()}/${entry.model.trim().toLowerCase()}`;
      if (ids.has(entry.id) || models.has(modelKey)) throw new Error(`${filename}: identifiant ou modèle dupliqué`);
      ids.add(entry.id); models.add(modelKey); catalog[kind].push(entry);
    }
    if (!catalog[kind].length) throw new Error(`${kind}: catalogue vide`);
    catalog[kind].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "fr"));
  }
  await writeFile(path.join(dataDirectory, "catalog.generated.json"), JSON.stringify(catalog) + "\n");
  console.log(`Catalogue validé : ${catalog.cameras.length} caméras, ${catalog.lenses.length} objectifs.`);
  return catalog;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateCatalog();
