import type { Camera, Lens, Study, StudyConfig } from "../app/types";

export const STUDIES_KEY = "induvision.studies.v1";
export const MAX_IMPORT_BYTES = 2_000_000;
const numericFields: Array<keyof StudyConfig | "fpsMin" | "fpsMax" | "resolutionMpMin" | "resolutionMpMax"> = [
  "detectionWidthMm", "detectionHeightMm", "workingDistanceMm", "objectSpeedMmS", "minDetailMm", "pixelsPerDetailTarget", "requiredFps", "exposureUs", "maxMotionBlurPx", "objectWidthCm", "objectHeightCm", "objectLengthCm", "fpsMin", "fpsMax", "resolutionMpMin", "resolutionMpMax"
];

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Étude invalide.");
  return value as Record<string, unknown>;
}

export function parseStudies(text: string): Study[] {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error("Le fichier dépasse 2 Mo.");
  const envelope = record(JSON.parse(text));
  if (envelope.version !== 1) throw new Error("Version de fichier non prise en charge.");
  if (!Array.isArray(envelope.studies) || envelope.studies.length > 1000) throw new Error("Liste d’études invalide.");
  const ids = new Set<string>();
  return envelope.studies.map((value): Study => {
    const source = record(value);
    if (typeof source.id !== "string" || !source.id.trim() || ids.has(source.id)) throw new Error("Identifiant d’étude absent ou dupliqué.");
    ids.add(source.id);
    if (typeof source.name !== "string" || !source.name.trim() || source.name.length > 200) throw new Error("Nom d’étude invalide.");
    if (!["horizontal", "vertical"].includes(String(source.objectTravelAxis))) throw new Error("Axe de déplacement invalide.");
    const study = { id: source.id, name: source.name, objectTravelAxis: source.objectTravelAxis } as Study;
    for (const field of numericFields) {
      const number = source[field] ?? null;
      if (number !== null && (typeof number !== "number" || !Number.isFinite(number) || number < 0)) throw new Error(`Valeur invalide : ${field}.`);
      Object.assign(study, { [field]: number });
    }
    for (const field of ["selectedCameraId", "selectedLensId", "createdAt", "updatedAt"] as const) {
      if (source[field] !== undefined && source[field] !== null) {
        if (typeof source[field] !== "string") throw new Error(`Valeur invalide : ${field}.`);
        study[field] = source[field];
      }
    }
    const formats = JSON.parse(String(source.sensorFormats ?? "[]"));
    if (!Array.isArray(formats) || formats.some((item) => typeof item !== "string")) throw new Error("Formats capteur invalides.");
    study.sensorFormats = JSON.stringify(formats);
    const pairs = JSON.parse(String(source.comparisonPairs ?? "[]"));
    if (!Array.isArray(pairs)) throw new Error("Comparaisons invalides.");
    study.comparisonPairs = JSON.stringify(pairs.map((value) => {
      const pair = record(value);
      if (typeof pair.cameraId !== "string" || typeof pair.lensId !== "string") throw new Error("Comparaison invalide.");
      return { cameraId: pair.cameraId, lensId: pair.lensId };
    }));
    return study;
  });
}

export function serializeStudies(studies: Study[]) {
  const text = JSON.stringify({ version: 1, studies }, null, 2);
  parseStudies(text);
  return text;
}

export function repairReferences(study: Study, cameras: Camera[], lenses: Lens[]): Study {
  const cameraIds = new Set(cameras.map((camera) => camera.id));
  const lensIds = new Set(lenses.map((lens) => lens.id));
  const pairs = JSON.parse(study.comparisonPairs ?? "[]") as Array<{ cameraId: string; lensId: string }>;
  return {
    ...study,
    selectedCameraId: cameraIds.has(study.selectedCameraId ?? "") ? study.selectedCameraId : cameras[0]?.id ?? "",
    selectedLensId: lensIds.has(study.selectedLensId ?? "") ? study.selectedLensId : lenses[0]?.id ?? "",
    comparisonPairs: JSON.stringify(pairs.filter((pair) => cameraIds.has(pair.cameraId) && lensIds.has(pair.lensId)))
  };
}

export function mergeImportedStudies(existing: Study[], imported: Study[], newId: () => string): Study[] {
  const ids = new Set(existing.map((study) => study.id));
  const copies = imported.map((study) => {
    let id = study.id;
    while (ids.has(id)) id = newId();
    ids.add(id);
    return { ...study, id };
  });
  return [...copies, ...existing];
}

export function writeStudies(storage: Pick<Storage, "getItem" | "setItem">, studies: Study[], expected: string | null) {
  if (storage.getItem(STUDIES_KEY) !== expected) throw new Error("Les études ont changé dans un autre onglet. Recharge la page avant d’enregistrer.");
  const text = serializeStudies(studies);
  storage.setItem(STUDIES_KEY, text);
  return text;
}
